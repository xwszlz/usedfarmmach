/**
 * 《采集数据发布位置 · Option D》只读发布层
 *
 * 提供 /overseas 去交易化只读栏目所需的数据读取能力（**绝不转 Product、绝不返回 PII**）。
 *
 * 设计要点（依据 `docs/采集数据发布位置-方案-2026-10-05.md` §3.3 去交易化硬口径）：
 *  - 仅读取 `RawListing.isPublic = true` 的行；
 *  - **排除** `sellerPhone / sellerWechat / sellerWhatsapp`（PII）；
 *  - 按 `SITE` 分站：.com 展示**国际源**（非 `domestic_*`），.cn 展示**国内源**（`domestic_*`）；
 *  - 「客户急需车源」置顶区：categorySlug ∈ 急需标签 OR modelName 命中急需关键词；
 *  - 写侧（publish-to-sourced / unpublish-sourced）留在 `review.ts`（复用 ReviewError / appendNotes）。
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SITE, type SiteVariant } from "@/config/site";
import {
  URGENT_CATEGORY_SLUGS,
  URGENT_MODEL_KEYWORDS,
} from "@/lib/agents/seller-scout/urgent-whitelist";

// ───────────────────────────────────────────────
// 类型
// ───────────────────────────────────────────────

/** /overseas 对外只读展示字段（**不含任何 PII**） */
export interface SourcedListingItem {
  id: string;
  source: string;
  sourceUrl: string;
  brandName: string;
  modelName: string;
  /** 人工修正展示标题（优先于 modelName 展示，避免"配件"类污染） */
  displayTitle: string | null;
  brandKey: string | null;
  categorySlug: string | null;
  year: number | null;
  priceRaw: number | null;
  currency: string | null;
  priceCny: number | null;
  location: string;
  scrapedAt: string;
  publishedAt: string | null;
}

export interface SourcedListQuery {
  page?: number;
  pageSize?: number;
  /** 精确来源过滤（如 agroline / mascus / domestic_xxx） */
  source?: string;
  /** 归一品牌键过滤 */
  brandKey?: string;
  /** 自由品类标签过滤 */
  categorySlug?: string;
  /** 关键词：命中 modelName / brandName / location / sourceUrl */
  q?: string;
  /** 显式指定站点（默认取当前 SITE） */
  site?: SiteVariant;
}

export interface SourcedListResult {
  items: SourcedListingItem[];
  /** 客户急需车源（置顶区，最多 30 条） */
  urgentItems: SourcedListingItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  site: SiteVariant;
}

// ───────────────────────────────────────────────
// 分站来源过滤 + 投影
// ───────────────────────────────────────────────

/** 一次性拉取上限（公开只读栏目数据集预期不大；先全量取回再客户端分区/分页） */
const MAX_FETCH = 500;

/** SITE 分站来源约束：.com=国际（非 domestic_*）/ .cn=国内（domestic_*） */
function siteSourceFilter(site: SiteVariant): Prisma.RawListingWhereInput["source"] {
  return site === "cn"
    ? { startsWith: "domestic" }
    : { not: { startsWith: "domestic" } };
}

/** 仅对外展示字段（**排除 PII**：sellerPhone / sellerWechat / sellerWhatsapp） */
const PUBLIC_SELECT = {
  id: true,
  source: true,
  sourceUrl: true,
  brandName: true,
  modelName: true,
  displayTitle: true,
  brandKey: true,
  categorySlug: true,
  year: true,
  priceRaw: true,
  currency: true,
  priceCny: true,
  location: true,
  scrapedAt: true,
  publishedAt: true,
} satisfies Prisma.RawListingSelect;

type PublicRow = {
  id: string;
  source: string;
  sourceUrl: string;
  brandName: string;
  modelName: string;
  displayTitle: string | null;
  brandKey: string | null;
  categorySlug: string | null;
  year: number | null;
  priceRaw: number | null;
  currency: string | null;
  priceCny: number | null;
  location: string;
  scrapedAt: Date;
  publishedAt: Date | null;
};

function toItem(r: PublicRow): SourcedListingItem {
  return {
    id: r.id,
    source: r.source,
    sourceUrl: r.sourceUrl,
    brandName: r.brandName,
    modelName: r.modelName,
    displayTitle: r.displayTitle,
    brandKey: r.brandKey,
    categorySlug: r.categorySlug,
    year: r.year,
    priceRaw: r.priceRaw,
    currency: r.currency,
    priceCny: r.priceCny,
    location: r.location,
    scrapedAt: r.scrapedAt.toISOString(),
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
  };
}

/** 判断某行是否为"客户急需车源"（与 urgent-whitelist 严格一致） */
export function isUrgent(item: Pick<SourcedListingItem, "categorySlug" | "modelName">): boolean {
  if (item.categorySlug && (URGENT_CATEGORY_SLUGS as readonly string[]).includes(item.categorySlug)) {
    return true;
  }
  const m = (item.modelName || "").toLowerCase();
  return (URGENT_MODEL_KEYWORDS as readonly string[]).some((k) => m.includes(k));
}

/** 当前站点允许的来源集合（供前端筛选项展示 / 调试） */
export function getSourcedSourceList(site: SiteVariant = SITE): Promise<string[]> {
  return prisma.rawListing
    .findMany({
      where: { isPublic: true, source: siteSourceFilter(site) },
      select: { source: true },
      distinct: ["source"],
      orderBy: { source: "asc" },
    })
    .then((rows) => rows.map((r) => r.source));
}

// ───────────────────────────────────────────────
// 主查询
// ───────────────────────────────────────────────

/**
 * 读取对外展示的采集挂牌（只读 / 去交易化）。
 *
 * 流程：取 isPublic=true + 分站来源 + 可选过滤 → 全量（≤500）→ 分区为
 * 急需置顶区与常规列表 → 常规列表分页返回。
 */
export async function listPublicSourced(q: SourcedListQuery = {}): Promise<SourcedListResult> {
  const site: SiteVariant = q.site ?? SITE;
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 30));

  const where: Prisma.RawListingWhereInput = {
    isPublic: true,
    source: siteSourceFilter(site),
  };
  if (q.source) where.source = q.source;
  if (q.brandKey) where.brandKey = q.brandKey;
  if (q.categorySlug) where.categorySlug = q.categorySlug;
  if (q.q) {
    where.OR = [
      { modelName: { contains: q.q } },
      { brandName: { contains: q.q } },
      { location: { contains: q.q } },
      { sourceUrl: { contains: q.q } },
    ];
  }

  const rows = (await prisma.rawListing.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: MAX_FETCH,
    select: PUBLIC_SELECT,
  })) as PublicRow[];

  const all = rows.map(toItem);

  const urgentItems = all.filter(isUrgent).slice(0, 30);
  const normal = all.filter((it) => !isUrgent(it));
  const total = normal.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = normal.slice(start, start + pageSize);

  return { items, urgentItems, total, page, pageSize, totalPages, site };
}
