/**
 * POST /api/escrow/pay/wechat
 * 微信支付下单 → 返回 code_url（用于生成二维码）
 *
 * Body: { orderId }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/escrow";
import { createNativeOrder, isConfigured as wechatConfigured, APP_ID } from "@/lib/wechat-pay";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (!wechatConfigured()) {
      return NextResponse.json({
        success: false,
        error: "微信支付尚未配置，请联系管理员",
        code: "PAYMENT_NOT_CONFIGURED",
      }, { status: 503 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, error: "缺少订单ID" }, { status: 400 });
    }

    const order = await prisma.escrowOrder.findUnique({
      where: { id: orderId },
      include: { product: { select: { modelName: true } } },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "订单不存在" }, { status: 404 });
    }

    if (order.buyerId !== user.id) {
      return NextResponse.json({ success: false, error: "无权操作此订单" }, { status: 403 });
    }

    if (order.paymentMethod !== "wechat") {
      return NextResponse.json({ success: false, error: "此订单不是微信支付" }, { status: 400 });
    }

    if (order.paymentStatus !== "pending") {
      return NextResponse.json({ success: false, error: "订单状态不允许支付" }, { status: 400 });
    }

    // 创建支付记录
    const paymentRecord = await prisma.paymentRecord.create({
      data: {
        orderId: order.id,
        paymentMethod: "wechat",
        amount: order.amount,
        status: "pending",
        rawRequest: JSON.stringify({ orderNo: order.orderNo, amount: order.amount }),
      },
    });

    // 调用微信支付创建 Native 订单
    const amountInCents = Math.round(order.amount * 100);
    const description = `神雕农机 - ${order.product.modelName}`;

    // 必须显式传回调地址：缺省会回退到全局 WECHAT_NOTIFY_URL，
    // 而 .cn 的该值指向会员回调（/api/membership/wechat/notify），
    // 担保订单号 "SD-ESC-" 在其正则下解析失败 → 返回 200 → 微信不重投 → 静默丢单。
    // 缺省域名按站点派生，避免两站共用同一缺省值导致回调指向对侧域名。
    const base = process.env.NEXT_PUBLIC_APP_URL || `https://${siteConfig.domains.primary}`;
    const result = await createNativeOrder(
      order.orderNo,
      amountInCents,
      description,
      `${base}/api/orders/wxpay-notify`
    );

    // 更新支付记录
    await prisma.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: { rawResponse: JSON.stringify(result) },
    });

    return NextResponse.json({
      success: true,
      data: {
        code_url: result.code_url,
        orderNo: order.orderNo,
        amount: order.amount,
        // 前端用 code_url 生成二维码
      },
    });

  } catch (error: any) {
    console.error("[Escrow/WechatPay] 错误:", error);
    return NextResponse.json(
      { success: false, error: error.message || "微信支付下单失败" },
      { status: 500 }
    );
  }
}
