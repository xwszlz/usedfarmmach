/**
 * mascus 线索池后台 API：列表 + 聚合视图
 *
 *  GET /api/admin/mascus-listings              分页列表（筛选 / 搜索 / Tab 计数 / 下拉选项）
 *  GET /api/admin/mascus-listings?view=sellers 按卖家电话聚合（一个卖家挂了哪些机器）
 *  GET /api/admin/mascus-listings?view=brands  按品牌聚合（哪些牌子线索最多 / 多少带电话）
 *
 * 顺序要求：**先 SITE 闸门，后鉴权**（见 `requireMascusSite` 注释）。
 * 响应统一信封 `{ success, data?, error?, code? }`；`data.view` 用于区分三种视图：
 *   - `"listings"` → `data` 展开为 `MascusListResult`（items/total/page/statusCounts/lookups）
 *   - `"sellers"`  → `data.items` 为 `MascusSellerGroup[]`
 *   - `"brands"`   → `data.items` 为 `MascusBrandGroup[]`
 * 全部业务逻辑在 `@/lib/mascus-leads/query`，本文件只做 HTTP 适配。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireMascusAdmin, requireMascusSite } from "@/lib/mascus-leads/admin-auth";
import {
  aggregateByBrand,
  aggregateBySeller,
  listMascusListings,
  mapMascusError,
  type MascusListQuery,
} from "@/lib/mascus-leads/query";

export const dynamic = "force-dynamic";

/** 解析整数 query 参数；空串 / 非数字 → undefined */
function toInt(v: string | null): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** 解析布尔 query 参数（`1/true` → true，`0/false` → false，其余 → undefined） */
function toBool(v: string | null): boolean | undefined {
  if (v == null || v.trim() === "") return undefined;
  const text = v.trim().toLowerCase();
  if (text === "1" || text === "true") return true;
  if (text === "0" || text === "false") return false;
  return undefined;
}

/** 解析查询串 → lib 的 `MascusListQuery` */
function parseQuery(url: URL): MascusListQuery {
  const p = url.searchParams;
  const order = p.get("order");
  return {
    page: toInt(p.get("page")),
    pageSize: toInt(p.get("pageSize")),
    q: p.get("q") ?? undefined,
    segment: p.get("segment") ?? undefined,
    country: p.get("country") ?? undefined,
    hasPhone: toBool(p.get("hasPhone")),
    onlyActive: toBool(p.get("onlyActive")),
    followStatus: p.get("followStatus") ?? undefined,
    assignedTo: p.get("assignedTo") ?? undefined,
    orderBy: p.get("orderBy") ?? undefined,
    order: order === "asc" ? "asc" : "desc",
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1) SITE 闸门（必须在鉴权之前：`.cn` 侧不泄漏 token 有效性，也不查库）──
  const site = requireMascusSite();
  if (!site.ok) return NextResponse.json(site.body, { status: site.status });

  // ── 2) 鉴权 ──
  const guard = await requireMascusAdmin(req);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  // ── 3) 分发视图 ──
  const url = new URL(req.url);
  const q = parseQuery(url);
  const view = url.searchParams.get("view") ?? "listings";

  try {
    if (view === "sellers") {
      const items = await aggregateBySeller(q);
      return NextResponse.json({ success: true, data: { view: "sellers", items } });
    }
    if (view === "brands") {
      const items = await aggregateByBrand(q);
      return NextResponse.json({ success: true, data: { view: "brands", items } });
    }
    const data = await listMascusListings(q);
    return NextResponse.json({ success: true, data: { view: "listings", ...data } });
  } catch (e) {
    const mapped = mapMascusError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
