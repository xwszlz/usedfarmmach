/**
 * POST /api/webhooks/stripe
 * Stripe Webhook 接收（仅 .com 站）
 *
 * 关键点：
 *  - 必须用 `await request.text()` 取原始 body（不能 json()），否则验签失败。
 *  - 取 `stripe-signature` 头做验签；验签失败返回 400。
 *  - 处理 checkout.session.completed / invoice.paid / 订阅生命周期 /
 *    charge.refunded。
 *  - 幂等：按 stripeSubscriptionId / stripeInvoiceId / stripeSessionId 去重。
 *  - Stripe 要求 2xx，成功统一返回 { received: true }。
 *
 * 红线：
 *  - 真实资金在 Stripe 闭环，此处只写订阅/发票/会员/UsageLog/BillingOrder，
 *    绝不写 CreditTransaction。
 *  - 本路由仅 .com 国际站启用；.cn 的微信/支付宝通道与此路由无关，不得在此处理。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isComSite } from "@/config/site";
import {
  constructWebhookEvent,
  mapPlanToMembershipTier,
  mapPlanToUsageAction,
  isStripePlan,
  retrieveStripeSubscription,
  recordBillingOrder,
} from "@/lib/payments/stripe";
import { grantRecharge } from "@/lib/credits/grant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** 当月 1 号 00:00（UsageLog.periodStart 用） */
function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function POST(request: NextRequest) {
  // 红线：仅 .com 国际站接收 Stripe Webhook
  if (!isComSite()) {
    return NextResponse.json(
      { success: false, error: "Not found", code: "SITE_NOT_SUPPORTED" },
      { status: 404 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  if (!signature) {
    return NextResponse.json({ success: false, error: "Missing signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("[Webhook/Stripe] 验签失败:", err);
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      }
      case "invoice.paid": {
        await handleInvoicePaid(event.data.object);
        break;
      }
      // —— 订阅生命周期（新增）——
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await handleSubscriptionEvent(event.data.object, false);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionEvent(event.data.object, true);
        break;
      }
      // —— 退款对账（新增）——
      case "charge.refunded": {
        await handleChargeRefunded(event.data.object);
        break;
      }
      default:
        // 忽略其它事件类型（如 payment_intent.*、customer.* 等）
        break;
    }
  } catch (err) {
    console.error("[Webhook/Stripe] 处理事件失败:", err);
    // 仍返回 2xx，避免 Stripe 无限重试（失败事件可经日志排查）
  }

  return NextResponse.json({ received: true });
}

/** checkout.session.completed：写/更新订阅、升级会员、记 UsageLog、落 BillingOrder */
async function handleCheckoutSessionCompleted(session: any): Promise<void> {
  const userId = session?.client_reference_id as string | undefined;
  const planRaw = session?.metadata?.plan as string | undefined;
  const customerId = session?.customer as string | undefined;
  const subscriptionId = session?.subscription as string | null | undefined;
  const paymentIntentId =
    typeof session?.payment_intent === "string" ? session.payment_intent : null;

  // —— 积分充值（plan=credit_recharge，非会员 SKU）：一次性支付 -> 加积分，不走会员逻辑 ——
  if (planRaw === "credit_recharge") {
    const credits = Number((session?.metadata?.credits as string) || 0);
    const paid = typeof session?.amount_total === "number" ? session.amount_total : 0;
    if (userId && credits > 0) {
      const dup = await prisma.creditTransaction.findFirst({
        where: { type: "recharge", relatedId: session.id },
      });
      if (!dup) {
        await grantRecharge(userId, credits, "stripe_recharge", session.id);
      }
      try {
        await recordBillingOrder({
          userId,
          plan: "credit_recharge" as any,
          sku: "credit_recharge",
          currency: (((session?.currency as string) || "usd").toUpperCase()),
          amount: paid,
          sessionId: session.id,
          paymentIntentId,
          status: "completed",
        });
      } catch (e) {
        console.error("[Webhook/Stripe] credit recharge recordBillingOrder 失败:", e);
      }
      console.log(`[Webhook/Stripe] 积分充值成功 user=${userId} credits=${credits} session=${session.id}`);
    } else {
      console.error(`[需人工补单][Webhook/Stripe] credit_recharge 缺少 userId/credits session=${session.id}`);
    }
    return;
  }

  if (!userId || !customerId || !isStripePlan(planRaw)) return;
  const plan = planRaw as any;
  const currency = ((session?.currency as string) || "usd").toUpperCase();
  const tier = mapPlanToMembershipTier(plan);
  const action = mapPlanToUsageAction(plan);
  const amountTotal = typeof session?.amount_total === "number" ? session.amount_total : 0;

  // 幂等：确保 StripeCustomer 关联存在
  const existingCustomer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId: customerId },
  });
  if (!existingCustomer) {
    await prisma.stripeCustomer.create({
      data: { userId, stripeCustomerId: customerId },
    });
  }

  // 计算订阅周期结束时间
  // 注意：stripe-node v22 起 Subscription 顶层已移除 current_period_end，
  // 该字段下放到 subscription.items[].current_period_end（同一账期）。
  let currentPeriodEnd = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  if (subscriptionId) {
    const sub = await retrieveStripeSubscription(subscriptionId);
    const periodEnd = sub?.items?.data?.[0]?.current_period_end;
    if (periodEnd) {
      currentPeriodEnd = new Date(periodEnd * 1000);
    }
  }

  // 订阅记录：优先按 stripeSubscriptionId 幂等 upsert；一次性支付兜底 userId+plan
  if (subscriptionId) {
    await prisma.stripeSubscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      update: { status: "active", currentPeriodEnd, currency },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan,
        currency,
        status: "active",
        currentPeriodEnd,
      },
    });
  } else {
    const existingSub = await prisma.stripeSubscription.findFirst({
      where: { userId, plan },
    });
    if (existingSub) {
      await prisma.stripeSubscription.update({
        where: { id: existingSub.id },
        data: { status: "active", currentPeriodEnd, currency },
      });
    } else {
      await prisma.stripeSubscription.create({
        data: {
          userId,
          stripeCustomerId: customerId,
          plan,
          currency,
          status: "active",
          currentPeriodEnd,
        },
      });
    }
  }

  // 会员等级升级
  await prisma.user.update({
    where: { id: userId },
    data: {
      membershipTier: tier,
      membershipExpiresAt: currentPeriodEnd,
    },
  });

  // 记 UsageLog（额度消费只写 UsageLog，绝不写 CreditTransaction）
  await prisma.usageLog.create({
    data: {
      userId,
      action,
      tier,
      periodStart: currentPeriodStart(),
    },
  });

  // 落 BillingOrder（.com + Stripe 下单 → completed 对账）
  await recordBillingOrder({
    userId,
    plan,
    currency,
    amount: amountTotal,
    sessionId: session.id,
    paymentIntentId,
    subscriptionId,
    status: "completed",
  });
}

/** invoice.paid：写 StripeInvoice（幂等 by stripeInvoiceId） */
async function handleInvoicePaid(invoice: any): Promise<void> {
  const stripeInvoiceId = invoice?.id as string | undefined;
  const customerId = invoice?.customer as string | undefined;
  if (!stripeInvoiceId || !customerId) return;

  // 幂等：已存在则跳过
  const already = await prisma.stripeInvoice.findUnique({
    where: { stripeInvoiceId },
  });
  if (already) return;

  const customer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId: customerId },
  });
  const subscription = customer
    ? await prisma.stripeSubscription.findFirst({
        where: { userId: customer.userId },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const amount = Math.round(((invoice?.amount_paid as number) || 0) / 100);
  const currency = ((invoice?.currency as string) || "usd").toUpperCase();
  const paidAt = invoice?.paid_at
    ? new Date((invoice.paid_at as number) * 1000)
    : new Date();

  await prisma.stripeInvoice.create({
    data: {
      subscriptionId: subscription?.id ?? customerId,
      stripeInvoiceId,
      amount,
      currency,
      status: "paid",
      paidAt,
      periodStart: invoice?.period_start ? new Date((invoice.period_start as number) * 1000) : null,
      periodEnd: invoice?.period_end ? new Date((invoice.period_end as number) * 1000) : null,
    },
  });
}

/**
 * 订阅生命周期事件（created / updated / deleted）。
 * canceled=true 表示 deleted 事件：仅标记订阅为 canceled，不立即降级会员
 * （会员保留至 currentPeriodEnd，由到期逻辑处理）。
 */
async function handleSubscriptionEvent(sub: any, canceled: boolean): Promise<void> {
  const subscriptionId = sub?.id as string | undefined;
  const customerId = sub?.customer as string | undefined;
  if (!subscriptionId || !customerId) return;

  const planRaw =
    (sub?.metadata?.plan as string | undefined) ??
    (sub?.items?.data?.[0]?.price?.metadata?.plan as string | undefined);
  if (!isStripePlan(planRaw)) return; // 无法归因到已知 SKU，跳过避免脏数据
  const plan = planRaw as any;
  const status: string = canceled ? "canceled" : (sub?.status as string) ?? "active";

  // 周期结束时间（stripe-node v22 起下放到 items[].current_period_end）
  let currentPeriodEnd = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  const periodEnd = sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end;
  if (periodEnd) currentPeriodEnd = new Date(periodEnd * 1000);

  const currency = ((sub?.currency as string) || "usd").toUpperCase();
  const tier = mapPlanToMembershipTier(plan);

  const customer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId: customerId },
  });
  if (!customer) return;
  const userId = customer.userId;

  await prisma.stripeSubscription.upsert({
    where: { stripeSubscriptionId: subscriptionId },
    update: { status, currentPeriodEnd, currency },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan,
      currency,
      status,
      currentPeriodEnd,
    },
  });

  // active / trialing：升级会员；canceled / past_due：保留至周期结束，不立即降级
  if (status === "active" || status === "trialing") {
    await prisma.user.update({
      where: { id: userId },
      data: { membershipTier: tier, membershipExpiresAt: currentPeriodEnd },
    });
  }
}

/** charge.refunded：把对应 BillingOrder 标记为 refunded（对账） */
async function handleChargeRefunded(charge: any): Promise<void> {
  const chargeId = charge?.id as string | undefined;
  const paymentIntentId =
    typeof charge?.payment_intent === "string" ? charge.payment_intent : null;
  if (!chargeId && !paymentIntentId) return;

  const existing = paymentIntentId
    ? await prisma.billingOrder.findFirst({ where: { stripePaymentIntentId: paymentIntentId } })
    : await prisma.billingOrder.findFirst({ where: { stripeChargeId: chargeId! } });

  if (existing) {
    await prisma.billingOrder.update({
      where: { id: existing.id },
      data: { status: "refunded", stripeChargeId: chargeId ?? existing.stripeChargeId },
    });
  }
}
