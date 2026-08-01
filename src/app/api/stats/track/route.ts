import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { shouldSkipTracking } from "@/lib/track-guard";

/**
 * 公开埋点接口：POST /api/stats/track
 *
 * 四类 scope 原子自增 + 返回最新累计值：
 *   product    → Product.viewCount + SiteStat.totalPageViews / totalProductViews
 *   category   → Category.viewCount + SiteStat.totalPageViews / totalCategoryViews
 *   video      → ProductVideo.playCount + SiteStat.totalVideoPlays
 *   fieldVideo → FieldVideo.playCount + SiteStat.totalVideoPlays
 *
 * 约定（架构 §7）：
 *   - 所有 +1 走 Prisma increment 原子自增，禁止先查后改；
 *   - 视频播放不计入 PV（totalPageViews 仅 product+category）；
 *   - 必须 force-dynamic 且 revalidate=0，避免命中 CDN/Route Cache；
 *   - 入口调用 shouldSkipTracking 作为 P2 防刷扩展点（本期恒 false）。
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Scope = "product" | "category" | "video" | "fieldVideo";
const VALID_SCOPES: Scope[] = ["product", "category", "video", "fieldVideo"];

/** 对目标实体自增并返回最新值（实体不存在时抛 Prisma P2025） */
async function bumpEntity(scope: Scope, id: string): Promise<number> {
  switch (scope) {
    case "product":
      return (
        await prisma.product.update({
          where: { id },
          data: { viewCount: { increment: 1 } },
          select: { viewCount: true },
        })
      ).viewCount;
    case "category":
      return (
        await prisma.category.update({
          where: { id },
          data: { viewCount: { increment: 1 } },
          select: { viewCount: true },
        })
      ).viewCount;
    case "video":
      return (
        await prisma.productVideo.update({
          where: { id },
          data: { playCount: { increment: 1 } },
          select: { playCount: true },
        })
      ).playCount;
    case "fieldVideo":
      return (
        await prisma.fieldVideo.update({
          where: { id },
          data: { playCount: { increment: 1 } },
          select: { playCount: true },
        })
      ).playCount;
    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}

/** 根据 scope 映射需要自增的 SiteStat 字段 */
function buildTotalsUpdate(scope: Scope): Prisma.SiteStatUpdateInput {
  const data: Prisma.SiteStatUpdateInput = {};
  if (scope === "product") {
    data.totalPageViews = { increment: 1 };
    data.totalProductViews = { increment: 1 };
  } else if (scope === "category") {
    data.totalPageViews = { increment: 1 };
    data.totalCategoryViews = { increment: 1 };
  } else {
    // video & fieldVideo 均只计入视频播放总量
    data.totalVideoPlays = { increment: 1 };
  }
  return data;
}

/** 将 increment 操作转换为首建行时的初始值（首次创建给 1，其余默认 0） */
function buildTotalsCreate(data: Prisma.SiteStatUpdateInput): Prisma.SiteStatCreateInput {
  const create: Prisma.SiteStatCreateInput = { id: "global" };
  if (data.totalPageViews) (create as Record<string, unknown>).totalPageViews = 1;
  if (data.totalProductViews) (create as Record<string, unknown>).totalProductViews = 1;
  if (data.totalCategoryViews) (create as Record<string, unknown>).totalCategoryViews = 1;
  if (data.totalVideoPlays) (create as Record<string, unknown>).totalVideoPlays = 1;
  return create;
}

/** 幂等自增 SiteStat 全局行（'global'），不存在则创建 */
async function bumpTotals(scope: Scope): Promise<void> {
  const data = buildTotalsUpdate(scope);
  await prisma.siteStat.upsert({
    where: { id: "global" },
    update: data,
    create: buildTotalsCreate(data),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // P2 扩展点：防刷 / 爬虫过滤（本期恒 false，不拦截）
  if (shouldSkipTracking(req)) {
    return NextResponse.json({ success: false, error: "skipped" }, { status: 429 });
  }

  let body: { scope?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { scope, id } = body;
  if (typeof scope !== "string" || !VALID_SCOPES.includes(scope as Scope)) {
    return NextResponse.json(
      { success: false, error: `Invalid scope: ${String(scope)}` },
      { status: 400 }
    );
  }
  if (typeof id !== "string" || id.trim() === "") {
    return NextResponse.json({ success: false, error: "Missing or invalid id" }, { status: 400 });
  }

  const validScope = scope as Scope;
  try {
    const count = await bumpEntity(validScope, id);
    await bumpTotals(validScope);
    return NextResponse.json({
      success: true,
      data: { scope: validScope, id, count },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json(
        { success: false, error: `${validScope} not found: ${id}` },
        { status: 404 }
      );
    }
    console.error("[stats/track] unexpected error:", e);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
