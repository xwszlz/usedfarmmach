/**
 * 卖家谈判列表 API
 * GET /api/seller/auctions
 *
 * 返回当前卖家（或管理员）名下的所有询价会话，含报价列表与买家信息。
 * 用于卖家工作台「报价谈判」tab。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ success: false, error: "用户不存在" }, { status: 401 });

    const isAdmin = user.role === "admin" || user.role === "super_admin";
    const where = isAdmin ? {} : { sellerId: user.id };

    const auctions = await prisma.auction.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            priceCny: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
            brand: { select: { nameZh: true, nameEn: true } },
          },
        },
        bids: {
          orderBy: { createdAt: "desc" },
          include: {
            bidder: { select: { id: true, username: true, companyName: true, email: true } },
          },
        },
        _count: { select: { bids: true } },
      },
    });

    const serialized = auctions.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      sellerQuoteAt: a.sellerQuoteAt ? a.sellerQuoteAt.toISOString() : null,
      bids: a.bids.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        bidder: { id: b.bidder.id, username: b.bidder.username, companyName: b.bidder.companyName },
      })),
    }));

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("[Seller Auctions] 错误:", error);
    return NextResponse.json({ success: false, error: "获取谈判列表失败" }, { status: 500 });
  }
}
