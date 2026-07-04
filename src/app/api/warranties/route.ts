/**
 * 质保 API
 *
 * GET /api/warranties              — 获取质保列表
 * GET /api/warranties?productId=xx — 获取设备的质保
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    // 获取用户拥有的产品ID列表
    const userProducts = await prisma.product.findMany({
      where: { sellerId: user.id },
      select: { id: true },
    });
    const productIds = userProducts.map((p) => p.id);

    const whereClause: Record<string, unknown> = {
      productId: { in: productIds },
    };

    if (productId) {
      whereClause.productId = productId;
    }

    const warranties = await prisma.warranty.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            brand: { select: { nameZh: true, nameEn: true } },
          },
        },
        _count: { select: { records: true } },
      },
      orderBy: { endDate: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: warranties,
    });
  } catch (error) {
    console.error("Warranties GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch warranties" },
      { status: 500 }
    );
  }
}
