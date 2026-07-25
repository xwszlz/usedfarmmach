/**
 * POST /api/webhooks/stripe
 * Stripe Webhook 接收（仅 .com 站）
 *
 * 关键点：
 *  - 必须用 `await request.text()` 取原始 body（不能 json()），否则验签失败。
 *  - 取 `stripe-signature` 头做验签；验签失败返回 400。
 *  - 仅处理 checkout.session.completed 与 invoice.paid。
 *  - 幂等：按 subscriptionId / stripeInvoiceId 去重，避免重复写入。
 *  - Stripe 要求 2xx，成功统一返回 { received: true }。
 *
 * 红线：
 *  - 真实资金在 Stripe 闭环，此处只写订阅/发票/会员/UsageLog，绝不写 CreditTransaction。
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
} from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** 当月 1 号 00:00（UsageLog.periodStart 用） */
function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function POST(request: NextRequest) {
  // 红线 #5：仅 .com 国际站接收 Stripe Webhook
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
      default:
        // 忽略其它事件类型
        break;
    }
  } catch (err) {
    console.error("[Webhook/Stripe] 处理事件失败:", err);
    // 仍返回 2xx，避免 Stripe 无限重试（失败事件可经日志排查）
  }

  return NextResponse.json({ received: true });
}

/** checkout.session.completed：写/更新订阅、升级会员、记 UsageLog */
async function handleCheckoutSessionCompleted(session: any): Promise<void> {
  const userId = session?.client_reference_id as string | undefined;
  const planRaw = session?.metadata?.plan as string | undefined;
  const customerId = session?.customer as string | undefined;
  const subscriptionId = session?.subscription as string | null | undefined;

  if (!userId || !customerId || !isStripePlan(planRaw)) return;
  const plan = planRaw as any;
  const currency = ((session?.currency as string) || "usd").toUpperCase();
  const tier = mapPlanToMembershipTier(plan);
  const action = mapPlanToUsageAction(plan);

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

  // 幂等：按 (userId, plan) 去重
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
