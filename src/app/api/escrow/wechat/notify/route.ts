/**
 * POST /api/escrow/wechat/notify
 * 微信支付回调通知
 *
 * 微信支付V3回调格式：
 * Headers: Wechatpay-Timestamp, Wechatpay-Nonce, Wechatpay-Signature, Wechatpay-Serial
 * Body: { resource: { ciphertext, nonce, associated_data } }
 *
 * 回调需返回 200 + { code: "SUCCESS" }
 */

import { NextRequest, NextResponse } from "next/server";
import { decryptCallbackResource } from "@/lib/wechat-pay";
import { handlePaymentSuccess } from "@/lib/escrow";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[WechatNotify] 收到回调:", JSON.stringify(body).substring(0, 200));

    // 解密回调资源
    const resource = body.resource;
    if (!resource) {
      console.error("[WechatNotify] 回调缺少 resource 字段");
      return NextResponse.json(
        { code: "FAIL", message: "格式错误" },
        { status: 400 }
      );
    }

    const decrypted = decryptCallbackResource(
      resource.ciphertext,
      resource.associated_data || "",
      resource.nonce
    );

    console.log("[WechatNotify] 解密结果:", JSON.stringify(decrypted).substring(0, 300));

    // 处理支付成功
    if (decrypted.trade_state === "SUCCESS") {
      await handlePaymentSuccess(
        decrypted.out_trade_no,
        decrypted.transaction_id,
        decrypted
      );
    }

    // 微信要求返回 200 + SUCCESS
    return NextResponse.json({ code: "SUCCESS", message: "成功" });

  } catch (error: any) {
    console.error("[WechatNotify] 处理回调失败:", error);
    // 返回非200让微信重试
    return NextResponse.json(
      { code: "FAIL", message: error.message || "处理失败" },
      { status: 500 }
    );
  }
}
