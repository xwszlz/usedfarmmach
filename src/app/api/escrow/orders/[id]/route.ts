/**
 * GET /api/escrow/orders/[id]
 * 查询担保交易订单详情
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/escrow";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const order = await prisma.escrowOrder.findUnique({
      where: { id: params.id },
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            priceCny: true,
            images: { take: 3, orderBy: { sortOrder: "asc" } },
          },
        },
        buyer: { select: { id: true, username: true, phone: true } },
        seller: { select: { id: true, username: true, phone: true } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "订单不存在" }, { status: 404 });
    }

    // 权限检查：只有买卖双方和管理员能查看
    if (order.buyerId !== user.id && order.sellerId !== user.id && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "无权查看此订单" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: order });

  } catch (error: any) {
    console.error("[Escrow/OrderDetail] 错误:", error);
    return NextResponse.json(
      { success: false, error: error.message || "查询订单失败" },
      { status: 500 }
    );
  }
}
