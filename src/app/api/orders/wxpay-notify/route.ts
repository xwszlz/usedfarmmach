import { NextRequest, NextResponse } from "next/server";
import { decryptCallbackResource } from "@/lib/wechat-pay";
import { handlePaymentSuccess } from "@/lib/escrow";

/**
 * POST /api/orders/wxpay-notify
 * 微信支付 V3 回调通知（定金支付成功后微信服务器回调）
 *
 * 流程：
 * 1. 微信发来加密 resource → 用 API V3 Key 解密 AES-256-GCM
 * 2. 解密后取 out_trade_no（=订单号）+ transaction_id
 * 3. 调 handlePaymentSuccess → 置订单状态为 deposit_paid
 * 4. 返回 {"code":"SUCCESS"} 告知微信已收到
 *
 * 注意：此接口不需要用户登录态（微信服务器直接调用）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 微信 V3 回调结构校验
    const { resource, event_type } = body;
    if (!resource?.ciphertext || !resource?.nonce) {
      console.error("[wxpay-notify] 回调数据缺少 resource 字段");
      return NextResponse.json({ code: "FAIL", message: "invalid resource" }, { status: 400 });
    }

    // 仅处理支付成功事件
    if (event_type !== "TRANSACTION.SUCCESS") {
      console.log("[wxpay-notify] 非支付成功事件，忽略:", event_type);
      return NextResponse.json({ code: "SUCCESS", message: "ignored" });
    }

    // AES-256-GCM 解密
    const decrypted = decryptCallbackResource(
      resource.ciphertext,
      resource.associated_data || "",
      resource.nonce
    );

    const { out_trade_no, transaction_id, trade_state } = decrypted;

    if (!out_trade_no) {
      console.error("[wxpay-notify] 解密后缺少 out_trade_no");
      return NextResponse.json({ code: "FAIL", message: "missing out_trade_no" }, { status: 400 });
    }

    // 仅处理支付成功
    if (trade_state !== "SUCCESS") {
      console.log(`[wxpay-notify] 订单 ${out_trade_no} 交易状态 ${trade_state}，忽略`);
      return NextResponse.json({ code: "SUCCESS", message: "not success" });
    }

    console.log(`[wxpay-notify] 定金支付成功回调: orderNo=${out_trade_no}, txnId=${transaction_id}`);

    // 调用 escrow 逻辑：置定金已付 + 设尾款截止 + 标记产品 reserved
    await handlePaymentSuccess(out_trade_no, transaction_id, decrypted);

    // 返回 SUCCESS 告知微信已收到（否则微信会重试）
    return NextResponse.json({ code: "SUCCESS", message: "OK" });
  } catch (error) {
    console.error("[wxpay-notify] 处理回调异常:", error);
    // 返回 500 让微信重试
    return NextResponse.json(
      { code: "FAIL", message: "internal error" },
      { status: 500 }
    );
  }
}
