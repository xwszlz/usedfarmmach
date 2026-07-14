/**
 * 议价详情 API
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
        },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Bargain not found" }, { status: 404 });
    }

    // 增加浏览量
    await prisma.auction.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...auction,
        // 确保前端使用 askingPrice
        askingPrice: auction.askingPrice || auction.startPrice,
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
