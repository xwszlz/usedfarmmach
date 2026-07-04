/**
 * 拍卖 API
 *
 * GET  /api/auctions              — 获取拍卖列表
 * POST /api/auctions              — 创建拍卖（仅seller/admin）
 * GET  /api/auctions/[id]         — 获取拍卖详情
 * POST /api/auctions/[id]/bid     — 出价
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function generateAuctionNo(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SD-PM-${dateStr}-${random}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const whereClause: Record<string, unknown> = {};
    if (status) {
      whereClause.status = status;
    } else {
      // 默认只展示 scheduled 和 live
      whereClause.status = { in: ["scheduled", "live"] };
    }

    const auctions = await prisma.auction.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            brand: { select: { nameZh: true, nameEn: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
        seller: {
          select: { id: true, companyName: true, username: true },
        },
        _count: { select: { bids: true } },
      },
      orderBy: { endTime: "asc" },
      take: limit,
    });

    // 检查是否需要更新状态（scheduled → live, live → ended）
    const now = new Date();
    for (const auction of auctions) {
      if (auction.status === "scheduled" && auction.startTime <= now) {
        await prisma.auction.update({
          where: { id: auction.id },
          data: { status: "live" },
        });
        auction.status = "live";
      } else if (auction.status === "live" && auction.endTime <= now) {
        // 找到最高出价
        const highestBid = await prisma.bid.findFirst({
          where: { auctionId: auction.id },
          orderBy: { amount: "desc" },
        });

        if (highestBid && (!auction.reservePrice || highestBid.amount >= auction.reservePrice)) {
          // 有中标者
          await prisma.auction.update({
            where: { id: auction.id },
            data: {
              status: "ended",
              winnerId: highestBid.bidderId,
              winningBid: highestBid.amount,
            },
          });
          await prisma.bid.update({
            where: { id: highestBid.id },
            data: { isWinning: true },
          });
          auction.status = "ended";
          auction.winnerId = highestBid.bidderId;
          auction.winningBid = highestBid.amount;
        } else {
          // 流拍
          await prisma.auction.update({
            where: { id: auction.id },
            data: { status: "ended" },
          });
          auction.status = "ended";
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: auctions,
    });
  } catch (error) {
    console.error("Auctions GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch auctions" },
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
      startPrice,
      reservePrice,
      priceIncrement = 1000,
      deposit = 0,
      startTime,
      endTime,
      coverImage,
    } = body;

    if (!productId || !title || !startPrice || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
      return NextResponse.json({ error: "You can only auction your own products" }, { status: 403 });
    }

    const auction = await prisma.auction.create({
      data: {
        auctionNo: generateAuctionNo(),
        productId,
        sellerId: product.sellerId,
        title,
        description,
        startPrice: parseFloat(startPrice),
        reservePrice: reservePrice ? parseFloat(reservePrice) : null,
        priceIncrement: parseFloat(priceIncrement),
        deposit: parseFloat(deposit),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        coverImage,
        status: "scheduled",
      },
    });

    return NextResponse.json({
      success: true,
      data: auction,
    });
  } catch (error) {
    console.error("Auction POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create auction" },
      { status: 500 }
    );
  }
}
