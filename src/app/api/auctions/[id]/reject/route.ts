/**
 * 卖家拒绝报价 API
 * POST /api/auctions/[id]/reject
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

    if (bargain.sellerId !== user.id) {
      return NextResponse.json({ error: "Only the seller can reject an offer" }, { status: 403 });
    }

    if (bargain.status !== "active") {
      return NextResponse.json({ error: "Bargain is not active" }, { status: 400 });
    }

    const body = await request.json();
    const { bidId } = body;

    if (!bidId) {
      return NextResponse.json({ error: "bidId is required" }, { status: 400 });
    }

    // 标记报价为已拒绝
    const bid = await prisma.bid.update({
      where: { id: bidId },
      data: { status: "rejected" },
      include: { bidder: { select: { id: true, email: true } } },
    });

    // 通知买家报价被拒绝
    await createNotification({
      userId: bid.bidderId,
      type: "inquiry_rejected",
      title: "您的报价未被接受",
      body: "卖家暂未接受该报价，您可重新报价或与卖家沟通。",
      link: "/auctions/my-offers",
      email: bid.bidder.email,
    });

    return NextResponse.json({
      success: true,
      data: bid,
      message: "Offer rejected",
    });
  } catch (error) {
    console.error("Reject offer error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reject offer" },
      { status: 500 }
    );
  }
}
