/**
 * 国内经销商 + 挂牌统一查询层（T2）
 *
 * 把「人工录入的经销商线索（dealer）」与「采集挂牌（listing）」按站点（cn/com）统一拉出，
 * 复用 T1 的机型/品牌两级常量做筛选与软分组，供《国内经销商与挂牌整合方案》前端做
 * 「同一马力档 + 品牌」下经销商与挂牌的对照。
 *
 * 设计要点（零新增列，全部复用既有字段与 T1 派生函数）：
 *  - 源集合按站点切分，复用 publish.ts#siteSourceFilter 的分站语义：
 *      cn  → dealer 源 = "manual_dealer"，listing 源 = source startsWith "domestic_"
 *      com → dealer 源 = "manual_dealer_intl"，listing 源 = source NOT startsWith "domestic_"
 *  - 行标注复用 T1 的 rowKind / channel / derivePlatform（零新增列）。
 *  - 机型/品牌筛选复用 T1 的 resolveModelFilter（双通道：brandName ∪ modelName）。
 *  - kind / channel 在内存中按 rowKind / channel 过滤（一次拉取 dealer+listing 两类源）。
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  MODEL_TIERS,
  BRAND_MODEL_TOKENS,
  resolveBrandKey,
  buildModelBrandWhere,
} from "./model-aliases";
import {
  rowKind,
  channel,
  derivePlatform,
  type Channel,
  type RowKind,
} from "./source-catalog";

// ───────────────────────────────────────────────
// 类型
// ───────────────────────────────────────────────

/** 统一查询入参 */
export interface UnifiedLeadQuery {
  /** 机型筛选（俗称/官方均可；双通道，见 resolveModelFilter） */
  model?: string;
  /** 品牌筛选（中英均可、可为合并串；双通道） */
  brand?: string;
  /** 行类型过滤：all / 仅经销商 / 仅挂牌 */
  kind?: "all" | "dealer" | "listing";
  /** 获取渠道过滤：all / crawler / websearch / manual */
  channel?: "all" | "crawler" | "websearch" | "manual";
  /** 站点：cn（国内）/ com（国际） */
  site: "cn" | "com";
}

/** 单行（已标注 rowKind / channel / platform / scope / tier / brandKey） */
export interface UnifiedLeadRow {
  id: string;
  source: string;
  sourceUrl: string;
  status: string;
  brandName: string;
  modelName: string;
  year: number | null;
  workingHours: number | null;
  condition: string | null;
  priceRaw: number | null;
  currency: string | null;
  priceCny: number | null;
  location: string;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerWechat: string | null;
  sellerWhatsapp: string | null;
  sellerEmail: string | null;
  images: string | null;
  scrapedAt: Date;
  /** 行类型（dealer / listing），由 rowKind(source) 派生 */
  rowKind: RowKind;
  /** 获取渠道（crawler / websearch / manual），由 channel(source) 派生 */
  channel: Channel;
  /** 平台裸域名（由 derivePlatform(sourceUrl) 派生） */
  platform: string;
  /** 站点（cn / com） */
  scope: "cn" | "com";
  /** 马力档（命中 MODEL_TIERS 的 tier；归不到为 "other"） */
  tier: string;
  /** 品牌规范 key；归不到为 "unknown" */
  brandKey: string;
}

/** 马力档 + 品牌 软分组结果 */
export interface TierBrandGroup {
  tier: string;
  brandKey: string;
  dealers: UnifiedLeadRow[];
  listings: UnifiedLeadRow[];
}

// ───────────────────────────────────────────────
// 内部工具
// ───────────────────────────────────────────────

/** 由 modelName 命中 MODEL_TIERS 归档马力档；归不到返回 "other" */
function resolveTier(modelName: string): string {
  const lower = (modelName ?? "").toLowerCase().trim();
  if (!lower) return "other";
  for (const t of MODEL_TIERS) {
    const slangHit = t.slang.some((s) => {
      const ns = s.toLowerCase().trim();
      return ns.length > 0 && (lower.includes(ns) || ns.includes(lower));
    });
    if (slangHit) return t.tier;
    const officialHit = Object.values(t.officialByBrand)
      .flat()
      .some((o) => {
        const no = o.toLowerCase().trim();
        return no.length > 0 && (lower.includes(no) || no.includes(lower));
      });
    if (officialHit) return t.tier;
  }
  return "other";
}

/** 由 brandName（优先）或 modelName（兜底机型 token）收敛品牌规范 key */
function resolveBrandKeyFromRow(modelName: string, brandName: string): string {
  const fromBrand = resolveBrandKey(brandName ?? "");
  if (fromBrand) return fromBrand;
  const lower = (modelName ?? "").toLowerCase();
  for (const [key, tokens] of Object.entries(BRAND_MODEL_TOKENS)) {
    if (tokens.some((tok) => tok && lower.includes(tok.toLowerCase()))) return key;
  }
  return "unknown";
}

/** 统一投影（不含审批/转换冗余字段；够 dealer/listing 对照用） */
const UNIFIED_SELECT = {
  id: true,
  source: true,
  sourceUrl: true,
  status: true,
  brandName: true,
  modelName: true,
  year: true,
  workingHours: true,
  condition: true,
  priceRaw: true,
  currency: true,
  priceCny: true,
  location: true,
  sellerName: true,
  sellerPhone: true,
  sellerWechat: true,
  sellerWhatsapp: true,
  sellerEmail: true,
  images: true,
  scrapedAt: true,
} satisfies Prisma.RawListingSelect;

// ───────────────────────────────────────────────
// 主查询
// ───────────────────────────────────────────────

/**
 * 拉取某站点的「经销商 + 挂牌」统一集合（不过滤 status）。
 *
 * @returns 已逐行标注 rowKind / channel / platform / scope / tier / brandKey 的行；
 *          并按 kind / channel 在内存中过滤（因一次拉取 dealer+listing 两类源）。
 */
export async function listUnifiedLeads(q: UnifiedLeadQuery): Promise<UnifiedLeadRow[]> {
  const site: "cn" | "com" = q.site === "com" ? "com" : "cn";

  // 1) 源集合：dealer 源精确匹配；listing 源按 domestic_ 前缀判定（复用 siteSourceFilter 语义）
  const dealerSource = site === "cn" ? "manual_dealer" : "manual_dealer_intl";
  const sourceClause: Prisma.RawListingWhereInput = {
    OR: [
      { source: dealerSource },
      site === "cn"
        ? { source: { startsWith: "domestic_" } }
        : { NOT: { source: { startsWith: "domestic_" } } },
    ],
  };

  // 2) 机型/品牌筛选（双通道），复用 resolveModelFilter
  const modelBrandWhere = buildModelBrandWhere(q.model, q.brand);
  const where: Prisma.RawListingWhereInput = modelBrandWhere
    ? { AND: [sourceClause, modelBrandWhere] }
    : sourceClause;

  const raw = await prisma.rawListing.findMany({
    where,
    orderBy: { scrapedAt: "desc" },
    select: UNIFIED_SELECT,
  });

  const base = raw as unknown as Array<
    Omit<UnifiedLeadRow, "rowKind" | "channel" | "platform" | "scope" | "tier" | "brandKey">
  >;

  const kindFilter = q.kind ?? "all";
  const channelFilter = q.channel ?? "all";

  const out: UnifiedLeadRow[] = [];
  for (const r of base) {
    const rk = rowKind(r.source);
    const ch = channel(r.source);
    if (kindFilter !== "all" && rk !== kindFilter) continue;
    if (channelFilter !== "all" && ch !== channelFilter) continue;
    out.push({
      ...r,
      rowKind: rk,
      channel: ch,
      platform: derivePlatform(r.sourceUrl),
      scope: site,
      tier: resolveTier(r.modelName),
      brandKey: resolveBrandKeyFromRow(r.modelName, r.brandName),
    });
  }
  return out;
}

// ───────────────────────────────────────────────
// 软分组
// ───────────────────────────────────────────────

/**
 * 结果集内按「马力档(tier) + 品牌(brandKey)」软分组：
 * 每组同时给出 dealer 行（谁，含联系方式）与 listing 行（机器，含价格/年份）。
 * 归不到马力档的行 tier = "other"。
 */
export function groupByTierBrand(rows: UnifiedLeadRow[]): TierBrandGroup[] {
  const map = new Map<string, TierBrandGroup>();
  for (const r of rows) {
    const key = `${r.tier}::${r.brandKey}`;
    let g = map.get(key);
    if (!g) {
      g = { tier: r.tier, brandKey: r.brandKey, dealers: [], listings: [] };
      map.set(key, g);
    }
    if (r.rowKind === "dealer") g.dealers.push(r);
    else g.listings.push(r);
  }
  // 稳定排序：先 tier，再 brandKey
  return Array.from(map.values()).sort((a, b) =>
    a.tier === b.tier ? a.brandKey.localeCompare(b.brandKey) : a.tier.localeCompare(b.tier)
  );
}
