/**
 * POST /api/escrow/alipay/notify
 * 支付宝异步回调通知
 *
 * 支付宝回调格式：表单提交 POST，参数在 body 中
 * 返回 success 表示处理成功
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCallback } from "@/lib/alipay";
import { handlePaymentSuccess } from "@/lib/escrow";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 支付宝回调是 application/x-www-form-urlencoded
    const formData = await request.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = String(value);
    }

    console.log("[AlipayNotify] 收到回调:", JSON.stringify(params).substring(0, 300));

    // 验签
    const isValid = verifyCallback(params);
    if (!isValid) {
      console.error("[AlipayNotify] 验签失败");
      return new NextResponse("fail", { status: 400 });
    }

    // 处理支付成功
    const tradeStatus = params.trade_status;
    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
      await handlePaymentSuccess(
        params.out_trade_no,
        params.trade_no, // 支付宝交易号
        params
      );
    }

    // 支付宝要求返回纯文本 "success"
    return new NextResponse("success", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });

  } catch (error: any) {
    console.error("[AlipayNotify] 处理回调失败:", error);
    return new NextResponse("fail", { status: 500 });
  }
}
