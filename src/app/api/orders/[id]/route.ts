import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

/**
 * GET /api/orders/[id]
 * 订单详情（买方或卖方本人可见）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const order = await prisma.escrowOrder.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        orderNo: true,
        amount: true,
        platformFee: true,
        sellerAmount: true,
        paymentMethod: true,
        paymentStatus: true,
        deliveryAddress: true,
        buyerConfirmed: true,
        buyerConfirmedAt: true,
        paidAt: true,
        escrowStartedAt: true,
        releasedAt: true,
        refundedAt: true,
        cancelledAt: true,
        trackingNo: true,
        deliveryCompany: true,
        shippedAt: true,
        disputeStatus: true,
        disputeReason: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
        product: {
          select: {
            id: true,
            modelName: true,
            priceCny: true,
            condition: true,
            brand: { select: { nameZh: true } },
            images: { take: 9, select: { url: true, isPrimary: true } },
          },
        },
        buyer: { select: { id: true, username: true, companyName: true } },
        seller: { select: { id: true, username: true, companyName: true } },
        payments: {
          select: { id: true, status: true, transactionId: true, prepayId: true, paidAt: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "订单不存在" }, { status: 404 });
    }

    // 仅买方/卖方本人可见
    if (order.buyer.id !== user.id && order.seller.id !== user.id) {
      return NextResponse.json({ success: false, error: "无权限查看该订单" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("[orders/[id]] 查询详情失败:", error);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
