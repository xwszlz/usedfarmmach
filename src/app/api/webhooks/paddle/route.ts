/**
 * POST /api/webhooks/paddle
 * Paddle Webhook 接收（仅 .com 站）
 *
 * 同时处理两类业务：
 *  1. 积分充值：transaction.completed 且 custom_data.plan = "credit_recharge" → 加积分
 *  2. 会员订阅/增值包：transaction.completed 且 custom_data.plan 为会员 SKU → 会员履约；
 *     订阅生命周期 subscription.created/updated/canceled；
 *     退款对账 adjustment.created（action=refund）。
 *
 * 关键点：
 *  - 必须用 `await request.text()` 取原始 body（不能 json()），否则验签失败。
 *  - 取 `paddle-signature` 头做验签；验签失败返回 400。
 *  - 幂等（头号风险）：Paddle 会重投 webhook。积分充值按
 *    CreditTransaction(type=recharge, relatedId=<txn id>) 查重 + Serializable 事务；
 *    会员履约按 BillingOrder.paddleTransactionId（@unique）查重，整个履约只做一次。
 *  - Paddle 要求 2xx，成功统一返回 { received: true }。
 *
 * 红线：
 *  - 真实资金在 Paddle 闭环，此处只写积分账本 / 会员等级 / UsageLog / BillingOrder，
 *    绝不直连支付通道、绝不自建订单号。
 *  - 积分对账以 CreditTransaction(type=recharge, relatedId=<paddle transaction id>,
 *    reason=paddle_recharge) + CreditLot + User.credits 为准；
 *    会员对账以 BillingOrder(provider=paddle, paddleTransactionId=<txn id>) 为准。
 *  - 本路由仅 .com 国际站启用；.cn 的微信/支付宝通道与此路由无关，不得在此处理。
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isComSite } from "@/config/site";
import {
  PADDLE_SKU,
  getPaddleSubscription,
  isPaddlePlan,
  mapPlanToUsageAction,
  verifyWebhookSignature,
} from "@/lib/payments/paddle";
import { grantRecharge } from "@/lib/credits/grant";
import { creditsFromLocalAmount, isRechargeCreditsMismatch } from "@/lib/credits/fx";
import { CYCLE_DAYS, type BillingCycle } from "@/lib/membership/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** 当月 1 号 00:00（UsageLog.periodStart 用） */
function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function POST(request: NextRequest) {
  // 红线：仅 .com 国际站接收 Paddle Webhook
  if (!isComSite()) {
    return NextResponse.json(
      { success: false, error: "Not found", code: "SITE_NOT_SUPPORTED" },
      { status: 404 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature") || "";

  if (!signature) {
    return NextResponse.json({ success: false, error: "Missing signature" }, { status: 400 });
  }

  let event: any;
  try {
    // 先验签，再解析（未验签的 body 不进业务逻辑）
    verifyWebhookSignature(rawBody, signature);
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error("[Webhook/Paddle] 验签失败:", err);
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event?.event_type) {
      case "transaction.completed": {
        await handleTransactionCompleted(event.data);
        break;
      }
      case "subscription.created":
      case "subscription.updated": {
        await handleSubscriptionEvent(event.data);
        break;
      }
      case "subscription.canceled": {
        // 与旧支付链路行为一致：保留至周期结束，不立即降级，只打日志
        console.log(
          `[Webhook/Paddle] 订阅取消（保留至周期结束，不立即降级） sub=${event?.data?.id}`
        );
        break;
      }
      case "adjustment.created": {
        await handleAdjustmentCreated(event.data);
        break;
      }
      default:
        // 忽略其它事件类型
        break;
    }
  } catch (err) {
    console.error("[Webhook/Paddle] 处理事件失败:", err);
    // 仍返回 2xx，避免 Paddle 无限重试（失败事件可经日志排查）
  }

  return NextResponse.json({ received: true });
}

/**
 * transaction.completed：按 custom_data.plan 分流。
 *  - credit_recharge → 积分充值入账（既有分支，原样保留）
 *  - 会员 SKU（valuation_pack / intel_pack / premium / enterprise）→ 会员履约
 *
 * 积分数以我们自己写进 custom_data.credits 的为准（Paddle 侧金额仅用于日志），
 * 避免汇率/税费导致「实收金额」与「应发积分」口径打架。
 */
async function handleTransactionCompleted(data: any): Promise<void> {
  const txnId: string | undefined = data?.id;
  const custom = data?.custom_data ?? {};
  const userId: string | undefined = custom.userId;
  const credits = Number(custom.credits);
  const currency = ((data?.currency_code as string) || "usd").toUpperCase();
  // 仅用于日志排查，不参与积分计算
  const paidTotal = data?.details?.totals?.total;

  // 金额一致性告警（只告警，不参与发放）：用于捕捉「Paddle 目录价与 credits 脱钩」的配置事故。
  // 优先取 subtotal：total 可能含税，用含税值比对会持续误报。
  // 容差见 isRechargeCreditsMismatch：相对 1%（至少 2 分）。理由是接库内实时汇率后，
  // 下单与回调之间跨过汇率刷新/过期回落属正常漂移，写死 ±1 会天天误报。
  const paidMinor = Number(data?.details?.totals?.subtotal ?? data?.details?.totals?.total);
  if (Number.isFinite(paidMinor) && paidMinor > 0) {
    const expectedCredits = await creditsFromLocalAmount(paidMinor / 100, currency);
    if (isRechargeCreditsMismatch(expectedCredits, credits)) {
      console.warn(
        `[Webhook/Paddle] 积分与实付金额不一致 期望=${expectedCredits} 实发=${credits} 实付分=${paidMinor} 币种=${currency} txn=${txnId}`
      );
    }
  }

  if (custom.plan !== "credit_recharge") {
    // 会员订阅 / 增值包：走会员履约分支
    await handleMembershipTransaction(data);
    return;
  }

  if (!txnId || !userId || !Number.isFinite(credits) || credits <= 0) {
    console.error(
      `[需人工补单][Webhook/Paddle] credit_recharge 缺少 txnId/userId/credits txn=${txnId}`
    );
    return;
  }

  // 幂等：查重与入账在同一事务内完成（Paddle 会重投 webhook）
  await prisma.$transaction(
    async (tx) => {
      const dup = await tx.creditTransaction.findFirst({
        where: { type: "recharge", relatedId: txnId },
      });
      if (dup) return;
      await grantRecharge(userId, credits, "paddle_recharge", txnId, tx);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  console.log(
    `[Webhook/Paddle] 积分充值成功 user=${userId} credits=${credits} currency=${currency} total=${paidTotal ?? "-"} txn=${txnId}`
  );
}

/**
 * transaction.completed（会员 SKU）：会员履约 + BillingOrder 对账。
 *
 * 幂等：按 paddleTransactionId（BillingOrder 唯一列）查重；已存在的 completed 订单
 * 直接返回，整个履约（升级 + UsageLog）只做一次。
 */
async function handleMembershipTransaction(data: any): Promise<void> {
  const txnId: string | undefined = data?.id;
  const custom = data?.custom_data ?? {};
  const userId: string | undefined = custom.userId;
  const planRaw: unknown = custom.plan;
  const cycle: BillingCycle = custom.cycle === "monthly" ? "monthly" : "yearly";

  if (!txnId || !userId || !isPaddlePlan(planRaw)) {
    console.error(
      `[需人工补单][Webhook/Paddle] 会员交易缺少 txnId/userId/plan txn=${txnId} plan=${String(planRaw)}`
    );
    return;
  }
  const plan = planRaw;
  const action = mapPlanToUsageAction(plan);

  // Paddle 侧金额（最小货币单位的字符串形式）与币种，仅用于对账留痕
  const amountRaw = data?.details?.totals?.total;
  const amount =
    typeof amountRaw === "string" || typeof amountRaw === "number"
      ? Number(amountRaw)
      : null;
  const currency = ((data?.currency_code as string) || "USD").toUpperCase();
  const subscriptionId: string | null =
    typeof data?.subscription_id === "string" ? data.subscription_id : null;

  // 幂等：查重 + 落单在同一事务内完成（Paddle 会重投 webhook）
  const alreadyFulfilled = await prisma.$transaction(async (tx) => {
    const existing = await tx.billingOrder.findUnique({
      where: { paddleTransactionId: txnId },
    });
    if (existing?.status === "completed") return true;
    await tx.billingOrder.upsert({
      where: { paddleTransactionId: txnId },
      update: {
        status: "completed",
        paddleSubscriptionId: subscriptionId ?? undefined,
      },
      create: {
        userId,
        site: "com",
        provider: "paddle",
        plan,
        sku: plan,
        amount,
        currency,
        status: "completed",
        paddleTransactionId: txnId,
        paddleSubscriptionId: subscriptionId,
      },
    });
    return false;
  });
  if (alreadyFulfilled) return;

  // —— 计算会员有效期 ——
  const meta = PADDLE_SKU[plan];
  let expiry: Date;
  if (meta.mode === "subscription" && subscriptionId) {
    // 订阅档：以 Paddle 订阅的 current_billing_period.ends_at 为准，取不到则兜底
    const endsAt = await getPaddleSubscription(subscriptionId);
    expiry = endsAt
      ? new Date(endsAt)
      : new Date(Date.now() + CYCLE_DAYS[cycle] * 86400000);
  } else {
    // 一次性档（payment）：本地按周期天数计算
    expiry = new Date(Date.now() + CYCLE_DAYS[cycle] * 86400000);
  }

  // 订阅有效期更新（会员等级概念已取消，仅保留有效期快照）
  await prisma.user.update({
    where: { id: userId },
    data: { membershipExpiresAt: expiry },
  });

  // 记 UsageLog（额度消费只写 UsageLog，绝不写 CreditTransaction）
  await prisma.usageLog.create({
    data: {
      userId,
      action,
      periodStart: currentPeriodStart(),
    },
  });

  console.log(
    `[Webhook/Paddle] 履约成功 user=${userId} plan=${plan} cycle=${cycle} currency=${currency} total=${amount ?? "-"} txn=${txnId}`
  );
}

/**
 * subscription.created / subscription.updated：
 * 按 subscription_id 查 BillingOrder；命中且事件状态为 active/trialing →
 * 用事件里的 current_billing_period.ends_at 更新该 userId 的 membershipExpiresAt；
 * 查不到 → 打日志跳过（不猜 userId）。
 */
async function handleSubscriptionEvent(data: any): Promise<void> {
  const subscriptionId: string | undefined = data?.id;
  const status: string = data?.status ?? "";
  if (!subscriptionId) return;

  const order = await prisma.billingOrder.findFirst({
    where: { paddleSubscriptionId: subscriptionId },
  });
  if (!order) {
    console.log(
      `[Webhook/Paddle] subscription.${status} 未找到对应 BillingOrder，跳过 sub=${subscriptionId}`
    );
    return;
  }

  if (status === "active" || status === "trialing") {
    const endsAt: string | undefined = data?.current_billing_period?.ends_at;
    if (endsAt) {
      await prisma.user.update({
        where: { id: order.userId },
        data: { membershipExpiresAt: new Date(endsAt) },
      });
    }
  }
}

/**
 * adjustment.created（action=refund 且 status=completed）：
 * 按 transaction_id 找 BillingOrder → mark refunded（与 /api/billing/refund 的
 * 双写对账，照旧支付链路 charge.refunded 的模式）。
 */
async function handleAdjustmentCreated(data: any): Promise<void> {
  if (data?.action !== "refund") return;
  // 仅「已完成」的退款才改对账；pending_approval / approved / rejected 不改
  if (data?.status !== "completed") return;

  const transactionId: string | undefined = data?.transaction_id;
  if (!transactionId) return;

  const existing = await prisma.billingOrder.findFirst({
    where: { paddleTransactionId: transactionId },
  });
  if (existing) {
    await prisma.billingOrder.update({
      where: { id: existing.id },
      data: { status: "refunded" },
    });
  }
}
