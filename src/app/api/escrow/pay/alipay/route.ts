/**
 * POST /api/escrow/pay/alipay
 * 支付宝下单 → 返回支付页面URL（跳转支付）
 *
 * Body: { orderId, returnUrl? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/escrow";
import { createPagePayUrl, isConfigured as alipayConfigured } from "@/lib/alipay";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (!alipayConfigured()) {
      return NextResponse.json({
        success: false,
        error: "支付宝尚未配置，请联系管理员",
        code: "PAYMENT_NOT_CONFIGURED",
      }, { status: 503 });
    }

    const body = await request.json();
    const { orderId, returnUrl } = body;

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

    if (order.paymentMethod !== "alipay") {
      return NextResponse.json({ success: false, error: "此订单不是支付宝支付" }, { status: 400 });
    }

    if (order.paymentStatus !== "pending") {
      return NextResponse.json({ success: false, error: "订单状态不允许支付" }, { status: 400 });
    }

    // 创建支付记录
    const paymentRecord = await prisma.paymentRecord.create({
      data: {
        orderId: order.id,
        paymentMethod: "alipay",
        amount: order.amount,
        status: "pending",
        rawRequest: JSON.stringify({ orderNo: order.orderNo, amount: order.amount }),
      },
    });

    // 构造支付宝支付URL
    const subject = `神雕农机 - ${order.product.modelName}`;
    const payUrl = createPagePayUrl(order.orderNo, order.amount, subject, returnUrl);

    // 更新支付记录
    await prisma.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: { rawResponse: JSON.stringify({ payUrl: payUrl.substring(0, 200) + "..." }) },
    });

    return NextResponse.json({
      success: true,
      data: {
        pay_url: payUrl,
        orderNo: order.orderNo,
        amount: order.amount,
        // 前端跳转到此URL完成支付
      },
    });

  } catch (error: any) {
    console.error("[Escrow/Alipay] 错误:", error);
    return NextResponse.json(
      { success: false, error: error.message || "支付宝下单失败" },
      { status: 500 }
    );
  }
}
