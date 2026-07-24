/**
 * 卖家还价（counter-offer）API
 * POST /api/auctions/[id]/seller-quote
 * { amount: number, message?: string }
 *
 * 盲报模式下，卖家的还价对全体已报价买家可见（一对一询价），
 * 每位买家可决定接受或继续报自己的价。
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
      select: { id: true, sellerId: true, status: true, title: true },
    });
    if (!bargain) return NextResponse.json({ error: "Bargain not found" }, { status: 404 });
    if (bargain.sellerId !== user.id) {
      return NextResponse.json({ error: "Only the seller can quote" }, { status: 403 });
    }
    if (bargain.status !== "active") {
      return NextResponse.json({ error: "Bargain is not active" }, { status: 400 });
    }

    const body = await request.json();
    const { amount, message } = body;
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid quote amount" }, { status: 400 });
    }

    await prisma.auction.update({
      where: { id: params.id },
      data: {
        sellerQuoteAmount: parseFloat(amount),
        sellerQuoteMsg: message || null,
        sellerQuoteAt: new Date(),
      },
    });

    // 通知所有已报价买家（去重）
    const bids = await prisma.bid.findMany({
      where: { auctionId: params.id },
      select: { bidderId: true, bidder: { select: { id: true, email: true } } },
      distinct: ["bidderId"],
    });
    for (const b of bids) {
      await createNotification({
        userId: b.bidderId,
        type: "inquiry_seller_quote",
        title: "卖家给出了还价",
        body: `${bargain.title}：卖家还价 ¥${parseFloat(amount).toLocaleString()}${message ? ` — ${message}` : ""}`,
        link: "/auctions/my-offers",
        email: b.bidder.email,
      });
    }

    return NextResponse.json({ success: true, message: "Quote sent" });
  } catch (error) {
    console.error("Seller quote error:", error);
    return NextResponse.json({ success: false, error: "Failed to send quote" }, { status: 500 });
  }
}
