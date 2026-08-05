/**
 * 卖家设置询价参数
 * POST /api/auctions/[id]/settings
 * { reservePrice?: number, askingPrice?: number }
 *
 * reservePrice 仅作为卖家内部「最低接受价」参考，不向买家展示底价。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

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
      select: { id: true, sellerId: true },
    });
    if (!bargain) return NextResponse.json({ error: "Bargain not found" }, { status: 404 });
    if (bargain.sellerId !== user.id && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data: Record<string, number> = {};
    if (typeof body.reservePrice === "number" && body.reservePrice >= 0) {
      data.reservePrice = body.reservePrice;
    }
    if (typeof body.askingPrice === "number" && body.askingPrice >= 0) {
      data.askingPrice = body.askingPrice;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid field to update" }, { status: 400 });
    }

    const updated = await prisma.auction.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Auction settings error:", error);
    return NextResponse.json({ success: false, error: "Failed to update settings" }, { status: 500 });
  }
}
