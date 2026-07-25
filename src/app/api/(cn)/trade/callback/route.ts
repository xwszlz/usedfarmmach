/**
 * POST /api/trade/callback  （实际路径：src/app/api/(cn)/trade/callback）
 * 微信收付通担保交易支付结果回调（仅 .cn 国内站）
 *
 * 红线（核心）：
 *  - 网站侧绝不写资金流水 / 分账 / 金额变更。
 *  - 仅：幂等更新 GuaranteeIntent.status='paid' + 回写 wechatOrderNo + 写 UsageLog(action='guarantee')。
 *  - 真实资金在微信小程序闭环。
 *
 * 验签：取微信回调头 Wechatpay-Signature / Timestamp / Nonce，verifyCallback 解密 resource。
 * 成功必须返回 200 + { code: "SUCCESS" }（微信要求）。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCallback } from "@/lib/payments/wechat";
import { isCnSite } from "@/config/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** 当月 1 号 00:00 */
function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function POST(request: NextRequest) {
  // 红线 #5：仅 .cn 国内站处理担保交易回调
  if (!isCnSite()) {
    return NextResponse.json(
      { success: false, error: "Not found", code: "SITE_NOT_SUPPORTED" },
      { status: 404 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("wechatpay-signature") || "";
  const timestamp = request.headers.get("wechatpay-timestamp") || "";
  const nonce = request.headers.get("wechatpay-nonce") || "";

  if (!signature || !timestamp || !nonce) {
    return NextResponse.json(
      { code: "FAIL", message: "缺少回调头" },
      { status: 400 }
    );
  }

  const decrypted = verifyCallback(rawBody, signature, timestamp, nonce);
  if (!decrypted) {
    return NextResponse.json(
      { code: "FAIL", message: "验签失败" },
      { status: 400 }
    );
  }

  // 微信担保交易通知体中的订单号（= 我方 GuaranteeIntent.id）
  const outTradeNo = decrypted.out_trade_no as string | undefined;
  const transactionId = decrypted.transaction_id as string | undefined;

  if (outTradeNo) {
    try {
      const intent = await prisma.guaranteeIntent.findUnique({
        where: { id: outTradeNo },
      });

      if (intent && intent.status !== "paid") {
        await prisma.guaranteeIntent.update({
          where: { id: outTradeNo },
          data: {
            status: "paid",
            wechatOrderNo: transactionId ?? intent.wechatOrderNo,
          },
        });

        // 额度消费只写 UsageLog，绝不写 CreditTransaction / 资金流水
        await prisma.usageLog.create({
          data: {
            userId: intent.buyerUserId,
            action: "guarantee",
            tier: "free",
            periodStart: currentPeriodStart(),
          },
        });
      }
    } catch (err) {
      console.error("[Trade/Callback] 更新担保意图失败:", err);
    }
  }

  // 微信要求 200 + { code: "SUCCESS" }
  return NextResponse.json({ code: "SUCCESS", message: "成功" }, { status: 200 });
}
