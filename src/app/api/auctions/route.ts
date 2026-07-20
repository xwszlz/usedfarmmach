/**
 * 议价 API（原拍卖改造）
 *
 * GET  /api/auctions              — 获取议价列表
 * POST /api/auctions              — 创建议价（仅seller/admin）
 * GET  /api/auctions/[id]         — 获取议价详情
 * POST /api/auctions/[id]/bid     — 报价
 * POST /api/auctions/[id]/accept  — 卖家接受报价
 * POST /api/auctions/[id]/reject  — 卖家拒绝报价
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const whereClause: Record<string, unknown> = {};
    if (status && status !== "all") {
      whereClause.status = status;
    } else if (!status) {
      whereClause.status = { in: ["active"] };
    }

    const auctions = await prisma.auction.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            workingHours: true,
            condition: true,
            location: true,
            enginePower: true,
            driveSystem: true,
            brand: { select: { nameZh: true, nameEn: true } },
            images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
          },
        },
        seller: {
          select: { id: true, companyName: true, username: true },
        },
        _count: { select: { bids: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: auctions,
    });
  } catch (error) {
    console.error("Bargain list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch bargains" },
      { status: 500 }
    );
  }
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
    const {
      productId,
      title,
      description,
      askingPrice,
      coverImage,
    } = body;

    if (!productId || !title || !askingPrice) {
      return NextResponse.json(
        { error: "Missing required fields: productId, title, askingPrice" },
        { status: 400 }
      );
    }

    // 验证产品属于该用户
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { sellerId: true, status: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.sellerId !== user.id && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "You can only create bargains for your own products" }, { status: 403 });
    }

    const auction = await prisma.auction.create({
      data: {
        bargainNo: generateBargainNo(),
        productId,
        sellerId: product.sellerId,
        title,
        description,
        askingPrice: parseFloat(askingPrice),
        status: "active",
        coverImage,
      },
    });

    return NextResponse.json({
      success: true,
      data: auction,
    });
  } catch (error) {
    console.error("Bargain POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create bargain" },
      { status: 500 }
    );
  }
}
