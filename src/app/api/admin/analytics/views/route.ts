import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { getOverview, getCategoryRanking, getVideoRanking } from "@/lib/stats-queries";
import type { VideoRankingFilter } from "@/types/stats";

/**
 * 后台浏览量看板 API：GET /api/admin/analytics/views
 *
 * 鉴权（复用 getTokenFromHeaders + verifyToken，与 seller/booth/analytics 一致）：
 *   - 无 token → 401；token 无效 → 401；
 *   - role ∉ {admin, super_admin, seller} → 403；
 *   - admin/super_admin 看全站，可选 ?sellerId= 钻取某卖家；
 *   - seller 强制只看自有数据（product.sellerId / fieldVideo.booth.merchantId）。
 *
 * 查询：
 *   ?type=all|product|field  视频排行类型过滤（默认 all）
 *   ?sellerId=xxx            仅 admin/super_admin 可用
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Token无效" }, { status: 401 });
  }

  const role = payload.role;
  const isAdmin = role === "admin" || role === "super_admin";
  if (!isAdmin && role !== "seller") {
    return NextResponse.json({ success: false, error: "权限不足" }, { status: 403 });
  }

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type") || "all";
  const type: VideoRankingFilter =
    typeParam === "product" || typeParam === "field" ? typeParam : "all";
  const sellerParam = url.searchParams.get("sellerId");

  // seller 强制只看自有数据；admin 可借 ?sellerId= 钻取
  let sellerId: string | undefined;
  if (isAdmin) {
    sellerId = sellerParam ?? undefined;
  } else {
    sellerId = payload.userId;
  }
  const scope = sellerId ? "mine" : "all";

  const [overview, categoryRanking, videoRanking] = await Promise.all([
    getOverview(),
    getCategoryRanking(sellerId),
    getVideoRanking(type, sellerId),
  ]);

  return NextResponse.json({
    success: true,
    data: { overview, categoryRanking, videoRanking, scope },
  });
}
