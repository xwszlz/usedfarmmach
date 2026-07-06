/**
 * POST /api/escrow/orders/[id]/ship
 * 卖家发货 → 填写物流信息
 *
 * Body: { deliveryCompany, trackingNo }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/escrow";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { deliveryCompany, trackingNo } = body;

    if (!deliveryCompany || !trackingNo) {
      return NextResponse.json({ success: false, error: "请填写物流公司和运单号" }, { status: 400 });
    }

    const order = await prisma.escrowOrder.findUnique({ where: { id: params.id } });

    if (!order) {
      return NextResponse.json({ success: false, error: "订单不存在" }, { status: 404 });
    }

    if (order.sellerId !== user.id) {
      return NextResponse.json({ success: false, error: "只有卖家可以发货" }, { status: 403 });
    }

    if (order.paymentStatus !== "escrow") {
      return NextResponse.json({ success: false, error: "当前状态不允许发货" }, { status: 400 });
    }

    await prisma.escrowOrder.update({
      where: { id: params.id },
      data: {
        deliveryCompany,
        trackingNo,
        shippedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "发货信息已提交",
    });

  } catch (error: any) {
    console.error("[Escrow/Ship] 错误:", error);
    return NextResponse.json(
      { success: false, error: error.message || "发货失败" },
      { status: 500 }
    );
  }
}
