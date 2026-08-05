/**
 * 卖家评分 API
 *
 * POST /api/seller-ratings — 提交评分 { sellerId, score, comment, productId, itemMatchScore, serviceScore, logisticsScore }
 * GET  /api/seller-ratings?sellerId=xxx — 获取卖家评分列表（公开）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get("sellerId");
    if (!sellerId) {
      return NextResponse.json({ error: "Missing sellerId" }, { status: 400 });
    }

    const ratings = await prisma.sellerRating.findMany({
      where: { sellerId },
      include: {
        rater: { select: { companyName: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ ratings });
  } catch (error) {
    console.error("Failed to fetch seller ratings:", error);
    return NextResponse.json({ error: "Failed to fetch seller ratings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { sellerId, score, comment, productId, itemMatchScore, serviceScore, logisticsScore } = await request.json();

    if (!sellerId || !score || score < 1 || score > 5) {
      return NextResponse.json({ error: "Invalid sellerId or score (1-5)" }, { status: 400 });
    }

    // 不能给自己评分
    if (sellerId === user.id) {
      return NextResponse.json({ error: "Cannot rate yourself" }, { status: 400 });
    }

    const rating = await prisma.sellerRating.upsert({
      where: {
        sellerId_raterId_productId: {
          sellerId,
          raterId: user.id,
          productId: productId || null,
        },
      },
      create: {
        sellerId,
        raterId: user.id,
        score,
        comment: comment || null,
        productId: productId || null,
        itemMatchScore: itemMatchScore || null,
        serviceScore: serviceScore || null,
        logisticsScore: logisticsScore || null,
      },
      update: {
        score,
        comment: comment || null,
        itemMatchScore: itemMatchScore || null,
        serviceScore: serviceScore || null,
        logisticsScore: logisticsScore || null,
      },
    });

    return NextResponse.json({ rating }, { status: 201 });
  } catch (error) {
    console.error("Failed to create seller rating:", error);
    return NextResponse.json({ error: "Failed to create seller rating" }, { status: 500 });
  }
}
