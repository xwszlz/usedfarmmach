/**
 * 确保询价会话存在（find-or-create）
 * POST /api/auctions/ensure
 * { productId: string }
 *
 * 阶段0（统一模型/单一入口）核心接口：
 * - 产品已有活跃询价 → 直接返回
 * - 没有 → 以产品信息自动创建一条通用询价（status=active, minParticipants=1）
 * 询价归属产品的卖家，调用者是否有登录均可触发（用于自动开通全站询价）。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function generateBargainNo(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SD-YJ-${dateStr}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        sellerId: true,
        modelName: true,
        priceCny: true,
        brand: { select: { nameZh: true, nameEn: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // find-or-create
    let auction = await prisma.auction.findFirst({
      where: { productId, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    if (!auction) {
      const brandName = product.brand?.nameZh || product.brand?.nameEn || "";
      auction = await prisma.auction.create({
        data: {
          bargainNo: generateBargainNo(),
          productId,
          sellerId: product.sellerId,
          title: `${brandName} ${product.modelName}`.trim(),
          askingPrice: product.priceCny || 0,
          status: "active",
          minParticipants: 1,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { id: auction.id },
    });
  } catch (error) {
    console.error("Ensure auction error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to ensure auction" },
      { status: 500 }
    );
  }
}
