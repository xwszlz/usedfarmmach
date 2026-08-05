/**
 * POST /api/escrow/create
 * 创建担保交易订单
 *
 * Body: { productId, paymentMethod, deliveryAddress? }
 * 需要登录认证
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma, createEscrowOrder } from "@/lib/escrow";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, paymentMethod, deliveryAddress } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: "缺少产品ID" }, { status: 400 });
    }

    if (!["wechat", "alipay"].includes(paymentMethod)) {
      return NextResponse.json({ success: false, error: "支付方式不支持" }, { status: 400 });
    }

    // 查产品
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { seller: { select: { id: true, username: true } } },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
    }

    if (product.sellerId === user.id) {
      return NextResponse.json({ success: false, error: "不能购买自己的产品" }, { status: 400 });
    }

    if (product.status === "sold") {
      return NextResponse.json({ success: false, error: "该设备已售出" }, { status: 400 });
    }

    // 检查是否已有进行中的担保交易
    const existing = await prisma.escrowOrder.findFirst({
      where: {
        productId,
        buyerId: user.id,
        paymentStatus: { in: ["pending", "paid", "escrow"] },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        error: "您已有一个进行中的担保交易订单",
        data: { orderId: existing.id, orderNo: existing.orderNo },
      }, { status: 409 });
    }

    // 创建订单
    const order = await createEscrowOrder({
      productId,
      buyerId: user.id,
      sellerId: product.sellerId,
      amount: product.priceCny,
      paymentMethod,
      deliveryAddress,
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        amount: order.amount,
        platformFee: order.platformFee,
        sellerAmount: order.sellerAmount,
        paymentMethod: order.paymentMethod,
        product: order.product,
      },
    });

  } catch (error: any) {
    console.error("[Escrow/Create] 错误:", error);
    return NextResponse.json(
      { success: false, error: error.message || "创建订单失败" },
      { status: 500 }
    );
  }
}
