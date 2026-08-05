/**
 * POST /api/escrow/orders/[id]/dispute
 * 发起交易争议
 *
 * Body: { reason }
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
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ success: false, error: "请填写争议原因" }, { status: 400 });
    }

    const order = await prisma.escrowOrder.findUnique({ where: { id: params.id } });

    if (!order) {
      return NextResponse.json({ success: false, error: "订单不存在" }, { status: 404 });
    }

    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return NextResponse.json({ success: false, error: "无权操作此订单" }, { status: 403 });
    }

    if (order.paymentStatus !== "escrow") {
      return NextResponse.json({ success: false, error: "当前状态不允许发起争议" }, { status: 400 });
    }

    await prisma.escrowOrder.update({
      where: { id: params.id },
      data: {
        disputeStatus: "opened",
        disputeReason: reason,
        disputeOpenedAt: new Date(),
        // 冻结自动放款
        autoReleaseAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "争议已提交，平台将在1-3个工作日内介入处理",
    });

  } catch (error: any) {
    console.error("[Escrow/Dispute] 错误:", error);
    return NextResponse.json(
      { success: false, error: error.message || "发起争议失败" },
      { status: 500 }
    );
  }
}
