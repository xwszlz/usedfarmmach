/**
 * 我的议价 API
 * GET /api/auctions/my-offers — 获取当前用户参与的议价（买家出价 + 卖家发布 + 报名预约）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 作为买家的议价（出价过的）
    const buyerBids = await prisma.bid.findMany({
      where: { bidderId: user.id },
      include: {
        auction: {
          include: {
            product: {
              select: {
                id: true,
                modelName: true,
                year: true,
                brand: { select: { nameZh: true, nameEn: true } },
                images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
              },
            },
            seller: {
              select: { id: true, companyName: true, username: true },
            },
            _count: { select: { bids: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 作为报名者的议价（预约看车/缴纳保证金）
    const inspectionBookings = await prisma.inspectionBooking.findMany({
      where: { userId: user.id },
      include: {
        auction: {
          include: {
            product: {
              select: {
                id: true,
                modelName: true,
                year: true,
                brand: { select: { nameZh: true, nameEn: true } },
                images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
              },
            },
            seller: {
              select: { id: true, companyName: true, username: true },
            },
            _count: { select: { bids: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 作为卖家的议价
    const sellerAuctions = await prisma.auction.findMany({
      where: { sellerId: user.id },
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
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
    });

    // 统一格式化
    const buyerItems = buyerBids.map((bid) => ({
      id: bid.auction.id,
      bargainNo: bid.auction.bargainNo,
      title: bid.auction.title,
      role: "buyer" as const,
      askingPrice: bid.auction.askingPrice,
      myOffer: bid.amount,
      bidStatus: bid.status,
      bargainStatus: bid.auction.status,
      acceptedPrice: bid.auction.acceptedPrice,
      totalBids: bid.auction._count.bids,
      createdAt: bid.createdAt,
      product: bid.auction.product,
      seller: bid.auction.seller,
    }));

    const bookingItems = inspectionBookings.map((booking) => ({
      id: booking.auction.id,
      bargainNo: booking.auction.bargainNo,
      title: booking.auction.title,
      role: "bidder" as const,
      askingPrice: booking.auction.askingPrice,
      myOffer: null,
      bidStatus: null,
      bargainStatus: booking.auction.status,
      acceptedPrice: booking.auction.acceptedPrice,
      totalBids: booking.auction._count.bids,
      createdAt: booking.createdAt,
      product: booking.auction.product,
      seller: booking.auction.seller,
      bookingStatus: booking.status,
      depositPaid: booking.depositPaid,
      depositConfirmedAt: booking.depositConfirmedAt,
    }));

    const sellerItems = sellerAuctions.map((auction) => ({
      id: auction.id,
      bargainNo: auction.bargainNo,
      title: auction.title,
      role: "seller" as const,
      askingPrice: auction.askingPrice,
      myOffer: null,
      bidStatus: null,
      bargainStatus: auction.status,
      acceptedPrice: auction.acceptedPrice,
      totalBids: auction._count.bids,
      createdAt: auction.createdAt,
      product: auction.product,
      seller: auction.seller,
    }));

    // 合并并按时间排序
    const allItems = [...buyerItems, ...bookingItems, ...sellerItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 统计
    const stats = {
      total: allItems.length,
      pending: allItems.filter((i) => i.bidStatus === "pending" || (i.role === "seller" && i.bargainStatus === "active")).length,
      accepted: allItems.filter((i) => i.bargainStatus === "accepted").length,
      active: allItems.filter((i) => i.bargainStatus === "active").length,
    };

    return NextResponse.json({
      success: true,
      data: allItems,
      stats,
    });
  } catch (error) {
    console.error("My offers error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch my offers" },
      { status: 500 }
    );
  }
}
