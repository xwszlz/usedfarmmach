/**
 * 关注卖家 API
 *
 * GET    /api/follows              — 获取当前用户关注列表
 * POST   /api/follows              — 关注卖家 { sellerId }
 * DELETE /api/follows?sellerId=xxx — 取消关注
 * GET    /api/follows?sellerId=xxx — 检查是否已关注
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

    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get("sellerId");

    // 检查单个卖家是否已关注
    if (sellerId) {
      const follow = await prisma.follow.findUnique({
        where: { userId_sellerId: { userId: user.id, sellerId } },
      });
      return NextResponse.json({ isFollowing: !!follow });
    }

    // 获取关注列表
    const follows = await prisma.follow.findMany({
      where: { userId: user.id },
      include: {
        seller: {
          select: {
            id: true,
            companyName: true,
            country: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ follows });
  } catch (error) {
    console.error("Failed to fetch follows:", error);
    return NextResponse.json({ error: "Failed to fetch follows" }, { status: 500 });
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

    const { sellerId } = await request.json();
    if (!sellerId) {
      return NextResponse.json({ error: "Missing sellerId" }, { status: 400 });
    }

    // 不能关注自己
    if (sellerId === user.id) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const follow = await prisma.follow.upsert({
      where: { userId_sellerId: { userId: user.id, sellerId } },
      create: { userId: user.id, sellerId },
      update: {},
    });

    return NextResponse.json({ follow }, { status: 201 });
  } catch (error) {
    console.error("Failed to follow seller:", error);
    return NextResponse.json({ error: "Failed to follow seller" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get("sellerId");
    if (!sellerId) {
      return NextResponse.json({ error: "Missing sellerId" }, { status: 400 });
    }

    await prisma.follow.deleteMany({
      where: { userId: user.id, sellerId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to unfollow seller:", error);
    return NextResponse.json({ error: "Failed to unfollow seller" }, { status: 500 });
  }
}
