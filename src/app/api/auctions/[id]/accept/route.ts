/**
 * 卖家接受报价 API
 * POST /api/auctions/[id]/accept
 * { bidId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

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

    const bargain = await prisma.auction.findUnique({
      where: { id: params.id },
      select: { id: true, sellerId: true, status: true },
    });

    if (!bargain) {
      return NextResponse.json({ error: "Bargain not found" }, { status: 404 });
    }

    // 只有卖家可以接受报价
    if (bargain.sellerId !== user.id) {
      return NextResponse.json({ error: "Only the seller can accept an offer" }, { status: 403 });
    }

    if (bargain.status !== "active") {
      return NextResponse.json({ error: "Bargain is not active" }, { status: 400 });
    }

    const body = await request.json();
    const { bidId } = body;

    if (!bidId) {
      return NextResponse.json({ error: "bidId is required" }, { status: 400 });
    }

    // 验证报价属于此询价
    const bid = await prisma.bid.findFirst({
      where: { id: bidId, auctionId: params.id },
      include: { bidder: { select: { id: true, email: true } } },
    });

    if (!bid) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // 使用事务：更新询价状态 + 标记报价为已接受
    const [updatedAuction] = await prisma.$transaction([
      prisma.auction.update({
        where: { id: params.id },
        data: {
          status: "accepted",
          acceptedBidId: bidId,
          acceptedPrice: bid.amount,
          winnerId: bid.bidderId,
          winningBid: bid.amount,
        },
      }),
      prisma.bid.update({
        where: { id: bidId },
        data: { status: "accepted", isWinning: true },
      }),
    ]);

    // 通知买家报价被接受
    await createNotification({
      userId: bid.bidderId,
      type: "inquiry_accepted",
      title: "您的报价已被接受",
      body: `成交价 ¥${bid.amount.toLocaleString()}。请与卖家联系看货与交付事宜。`,
      link: "/auctions/my-offers",
      email: bid.bidder.email,
    });

    return NextResponse.json({
      success: true,
      data: updatedAuction,
      message: "Offer accepted",
    });
  } catch (error) {
    console.error("Accept offer error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to accept offer" },
      { status: 500 }
    );
  }
}
