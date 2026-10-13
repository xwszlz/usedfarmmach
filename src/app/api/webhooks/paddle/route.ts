/**
 * POST /api/webhooks/paddle
 * Paddle Webhook 接收（仅 .com 站）
 *
 * 关键点：
 *  - 必须用 `await request.text()` 取原始 body（不能 json()），否则验签失败。
 *  - 取 `paddle-signature` 头做验签；验签失败返回 400。
 *  - 处理 transaction.completed：按 custom_data 给对应账号加积分。
 *  - 幂等（头号风险）：Paddle 会重投 webhook，因此「查重 + 入账」必须包在
 *    同一个 Serializable 事务内完成，杜绝「事务外 findFirst + 事务内入账」
 *    的并发窗口导致双份入账。
 *  - Paddle 要求 2xx，成功统一返回 { received: true }。
 *
 * 红线：
 *  - 真实资金在 Paddle 闭环，此处只写积分账本；绝不直连支付通道、绝不自建订单号。
 *  - 不写 BillingOrder（避免动 Prisma schema 与 stripe* 列）。对账以
 *    CreditTransaction(type=recharge, relatedId=<paddle transaction id>,
 *    reason=paddle_recharge) + CreditLot + User.credits 为准。
 *  - 本路由仅 .com 国际站启用；.cn 的微信/支付宝通道与此路由无关，不得在此处理。
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isComSite } from "@/config/site";
import { verifyWebhookSignature } from "@/lib/payments/paddle";
import { grantRecharge } from "@/lib/credits/grant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

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
      // TODO: 退款对账待建（transaction.refunded）。
      // 需先与老板确认「退款是否扣回积分」以及 CreditLot 已部分消耗时的冲减口径，
      // 本次不实现，避免误扣用户积分；当前若发生退款只能人工处理。
      default:
        // 忽略其它事件类型（subscription.*、adjustment.* 等，本次只做积分充值）
        break;
    }
  } catch (err) {
    console.error("[Webhook/Paddle] 处理事件失败:", err);
    // 仍返回 2xx，避免 Paddle 无限重试（失败事件可经日志排查）
  }

  return NextResponse.json({ received: true });
}

/**
 * transaction.completed：积分充值入账。
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

  if (custom.plan !== "credit_recharge") return;

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
