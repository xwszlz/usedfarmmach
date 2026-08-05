/**
 * GET /api/escrow/orders
 * 查询担保交易订单列表
 *
 * Query: role=buyer|seller|all, status, page, pageSize
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/escrow";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || "all";
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: any = {};
    if (role === "buyer") where.buyerId = user.id;
    else if (role === "seller") where.sellerId = user.id;
    else {
      where.OR = [{ buyerId: user.id }, { sellerId: user.id }];
    }
    if (status) where.paymentStatus = status;

    const [orders, total] = await Promise.all([
      prisma.escrowOrder.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              modelName: true,
              images: { take: 1, orderBy: { sortOrder: "asc" } },
            },
          },
          buyer: { select: { id: true, username: true } },
          seller: { select: { id: true, username: true } },
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.escrowOrder.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });

  } catch (error: any) {
    console.error("[Escrow/Orders] 错误:", error);
    return NextResponse.json(
      { success: false, error: error.message || "查询订单失败" },
      { status: 500 }
    );
  }
}
