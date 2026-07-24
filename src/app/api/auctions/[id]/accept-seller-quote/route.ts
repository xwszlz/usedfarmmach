/**
 * 买家接受卖家还价 API
 * POST /api/auctions/[id]/accept-seller-quote
 *
 * 买家接受卖家在 /seller-quote 中给出的价格，达成交易。
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
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const bargain = await prisma.auction.findUnique({
      where: { id: params.id },
      select: { id: true, sellerId: true, status: true, sellerQuoteAmount: true, title: true, seller: { select: { id: true, email: true } } },
    });
    if (!bargain) return NextResponse.json({ error: "Bargain not found" }, { status: 404 });
    if (bargain.status !== "active") {
      return NextResponse.json({ error: "Bargain is not active" }, { status: 400 });
    }
    if (!bargain.sellerQuoteAmount) {
      return NextResponse.json({ error: "Seller has not sent a quote" }, { status: 400 });
    }

    // 必须是参与过询价的买家
    const hasBid = await prisma.bid.findFirst({
      where: { auctionId: params.id, bidderId: user.id },
    });
    if (!hasBid) {
      return NextResponse.json({ error: "Only a participant buyer can accept" }, { status: 403 });
    }

    const [updated] = await prisma.$transaction([
      prisma.auction.update({
        where: { id: params.id },
        data: {
          status: "accepted",
          acceptedPrice: bargain.sellerQuoteAmount,
          winningBid: bargain.sellerQuoteAmount,
          winnerId: user.id,
          acceptedBidId: null,
        },
      }),
    ]);

    // 通知卖家成交
    await createNotification({
      userId: bargain.sellerId,
      type: "inquiry_accepted",
      title: "买家已接受您的还价",
      body: `${bargain.title}：成交价 ¥${bargain.sellerQuoteAmount.toLocaleString()}`,
      link: "/seller/inquiries",
      email: bargain.seller.email,
    });

    return NextResponse.json({ success: true, data: updated, message: "Deal made" });
  } catch (error) {
    console.error("Accept seller quote error:", error);
    return NextResponse.json({ success: false, error: "Failed to accept quote" }, { status: 500 });
  }
}
