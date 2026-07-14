/**
 * 议价报价 API（原出价改造）
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
      return NextResponse.json({ error: "Invalid offer amount" }, { status: 400 });
    }

    const bargain = await prisma.auction.findUnique({
      where: { id: params.id },
    });

    if (!bargain) {
      return NextResponse.json({ error: "Bargain not found" }, { status: 404 });
    }

    // 检查议价状态
    if (bargain.status !== "active") {
      return NextResponse.json(
        { error: "This bargain is no longer active" },
        { status: 400 }
      );
    }

    // 不能给自己的设备报价
    if (bargain.sellerId === user.id) {
      return NextResponse.json(
        { error: "Cannot make an offer on your own product" },
        { status: 403 }
      );
    }

    // 创建报价
    const bid = await prisma.bid.create({
      data: {
        auctionId: params.id,
        bidderId: user.id,
        amount: parseFloat(amount),
      },
    });

    // 更新议价统计
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
      message: "Offer submitted successfully",
    });
  } catch (error) {
    console.error("Offer error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit offer" },
      { status: 500 }
    );
  }
}
