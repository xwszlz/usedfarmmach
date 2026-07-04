/**
 * 拍卖出价 API
 * POST /api/auctions/[id]/bid
 * { amount: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid bid amount" }, { status: 400 });
    }

    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    // 检查拍卖状态
    const now = new Date();
    if (auction.status !== "live") {
      // 如果 scheduled 到了开始时间，自动激活
      if (auction.status === "scheduled" && auction.startTime <= now) {
        await prisma.auction.update({
          where: { id: params.id },
          data: { status: "live" },
        });
      } else {
        return NextResponse.json(
          { error: `Auction is ${auction.status}, cannot bid` },
          { status: 400 }
        );
      }
    }

    if (auction.endTime <= now) {
      return NextResponse.json({ error: "Auction has ended" }, { status: 400 });
    }

    // 不能竞拍自己的设备
    if (auction.sellerId === user.id) {
      return NextResponse.json({ error: "Cannot bid on your own auction" }, { status: 403 });
    }

    // 获取当前最高出价
    const highestBid = await prisma.bid.findFirst({
      where: { auctionId: params.id },
      orderBy: { amount: "desc" },
    });

    const minBid = highestBid
      ? highestBid.amount + auction.priceIncrement
      : auction.startPrice;

    if (amount < minBid) {
      return NextResponse.json(
        { error: `Minimum bid is ¥${minBid.toLocaleString()}` },
        { status: 400 }
      );
    }

    // 创建出价
    const bid = await prisma.bid.create({
      data: {
        auctionId: params.id,
        bidderId: user.id,
        amount: parseFloat(amount),
      },
    });

    // 更新拍卖统计
    const bidCount = await prisma.bid.count({
      where: { auctionId: params.id },
    });
    const bidderCount = await prisma.bid.groupBy({
      by: ["bidderId"],
      where: { auctionId: params.id },
    });

    await prisma.auction.update({
      where: { id: params.id },
      data: {
        totalBids: bidCount,
        totalBidders: bidderCount.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: bid,
      message: "Bid placed successfully",
    });
  } catch (error) {
    console.error("Bid error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to place bid" },
      { status: 500 }
    );
  }
}
