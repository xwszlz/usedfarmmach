/**
 * 询价详情 API
 * GET /api/auctions/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

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
            priceUsd: true,
            location: true,
            country: true,
            province: true,
            city: true,
            descriptionZh: true,
            descriptionEn: true,
            enginePower: true,
            engineType: true,
            driveSystem: true,
            overallLength: true,
            overallWidth: true,
            overallHeight: true,
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
        },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Bargain not found" }, { status: 404 });
    }

    // 获取当前用户（可选）
    const token = getTokenFromHeaders(request.headers);
    let currentUserId: string | null = null;
    if (token) {
      try {
        const user = await getUserFromToken(token);
        if (user) currentUserId = user.id;
      } catch {
        /* ignore invalid token */
      }
    }

    // 报名人数统计
    const [totalBookingsCount, confirmedBookingsCount] = await Promise.all([
      prisma.inspectionBooking.count({ where: { auctionId: params.id } }),
      prisma.inspectionBooking.count({ where: { auctionId: params.id, depositPaid: true, status: "confirmed" } }),
    ]);

    // 当前用户报名状态（未登录则为null）
    const currentUserBooking = currentUserId
      ? await prisma.inspectionBooking.findFirst({
          where: { auctionId: params.id, userId: currentUserId },
          orderBy: { createdAt: "desc" },
        })
      : null;

    // 增加浏览量
    await prisma.auction.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...auction,
        // 确保前端使用 askingPrice，若未设置则回退到 product.priceCny
        askingPrice: auction.askingPrice || (auction.product as any).priceCny || auction.startPrice,
        totalBookingsCount,
        confirmedBookingsCount,
        currentUserBooking,
      },
    });
  } catch (error) {
    console.error("Bargain detail error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch bargain" },
      { status: 500 }
    );
  }
}
