/**
 * 拍卖详情 API
 * GET /api/auctions/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            workingHours: true,
            condition: true,
            priceCny: true,
            location: true,
            descriptionZh: true,
            descriptionEn: true,
            brand: { select: { nameZh: true, nameEn: true } },
            images: { orderBy: { sortOrder: "asc" } },
          },
        },
        seller: {
          select: { id: true, companyName: true, username: true, phone: true, country: true },
        },
        winner: {
          select: { id: true, companyName: true, username: true },
        },
        bids: {
          include: {
            bidder: {
              select: { id: true, companyName: true, username: true },
            },
          },
          orderBy: { amount: "desc" },
          take: 20,
        },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    // 增加浏览量
    await prisma.auction.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    });

    // 检查状态更新
    const now = new Date();

    if (auction.status === "scheduled" && auction.startTime <= now) {
      await prisma.auction.update({
        where: { id: params.id },
        data: { status: "live" },
      });
      auction.status = "live";
    } else if (auction.status === "live" && auction.endTime <= now) {
      const highestBid = await prisma.bid.findFirst({
        where: { auctionId: params.id },
        orderBy: { amount: "desc" },
      });

      if (highestBid && (!auction.reservePrice || highestBid.amount >= auction.reservePrice)) {
        await prisma.auction.update({
          where: { id: params.id },
          data: { status: "ended", winnerId: highestBid.bidderId, winningBid: highestBid.amount },
        });
        await prisma.bid.update({
          where: { id: highestBid.id },
          data: { isWinning: true },
        });
        auction.status = "ended";
        auction.winnerId = highestBid.bidderId;
        auction.winningBid = highestBid.amount;
      } else {
        await prisma.auction.update({
          where: { id: params.id },
          data: { status: "ended" },
        });
        auction.status = "ended";
      }
    }

    return NextResponse.json({
      success: true,
      data: auction,
    });
  } catch (error) {
    console.error("Auction detail error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch auction" },
      { status: 500 }
    );
  }
}
