/**
 * 公开只读 API：去交易化「海外车源 / 急需车源」栏目数据源
 *
 * GET /api/sourced-listings?page=&pageSize=&source=&brandKey=&categorySlug=&q=
 *  - 仅返回 `RawListing.isPublic = true` 的行；
 *  - 按 SITE 分站（.com=国际源 / .cn=国内源）；
 *  - **排除 PII**（sellerPhone / sellerWechat / sellerWhatsapp）；
 *  - 返回 `urgentItems`（客户急需车源置顶区）与分页后的 `items`（常规列表）。
 *
 * 无鉴权（公开只读），dynamic 以保证读到最新对外展示开关。
 */
import { NextRequest, NextResponse } from "next/server";
import { listPublicSourced, getSourcedSourceList } from "@/lib/raw-listing/publish";

export const dynamic = "force-dynamic";

function toInt(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;

  try {
    const data = await listPublicSourced({
      page: toInt(url.searchParams.get("page")),
      pageSize: toInt(url.searchParams.get("pageSize")),
      source: url.searchParams.get("source") ?? undefined,
      brandKey: url.searchParams.get("brandKey") ?? undefined,
      categorySlug: url.searchParams.get("categorySlug") ?? undefined,
      q,
    });
    // 提供当前站点可用来源（供前端筛选下拉，最多 50）
    const sources = (await getSourcedSourceList(data.site)).slice(0, 50);
    return NextResponse.json({
      ok: true,
      data: { ...data, sources },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "query failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
