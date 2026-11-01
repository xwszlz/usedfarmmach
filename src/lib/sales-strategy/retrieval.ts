/**
 * AI 销售策略 — 检索层（内部实时 + 外部快照）
 * ─────────────────────────────────────────────────────────
 * 决策 A/B 落地：为「AI 销售策略」第四个 AI 能力模块提供检索上下文。
 *
 * 内部实时（直连 DB）：
 *   - 本品 Product（品牌/型号/年份/品类/售价/地区/成色/工时/是否国产）
 *   - 同品类在售 Product（行情参考）
 *   - 全球基准价 BrandBenchmark
 *   - 市场情报 MarketIntel
 *   - Lead / Dealer 线索池候选（按品牌/型号/地区匹配，仅返回公开属性，不含明文 PII）
 *
 * 外部快照（文件 / 轻量）：
 *   - 神雕日报 getDailyReportData(brand, model)（国际报价 / 趋势 / 即时事件）
 *   - matchPortByLocation(location)（建议出口港口）
 *
 * 增量扩容（T07 / arch §1.2.7，全部 additive）：
 *   - A1 `webEvidence`    外部 Web 检索证据（`src/lib/search/web-evidence.ts`，四档降级）
 *   - A2 `rawListings`    站内真实在售 RawListing（按品牌/机型模糊匹配，**不用 locationCode/goodsRegion**）
 *   - A4 `benchmarkDetail` 基准价明细 + 区域聚合（顺手修 `retrieveBenchmarks` 的机型缺口）
 *
 * 合规红线：
 *   - .cn 数据不出境：本层「直连 DB / 本地日报」部分不向任何境外服务发送数据；
 *     唯一的外部出口是 `retrieveWebEvidence()`，后者对 `.cn` 强制走境内 ARK 节点，
 *     且入参结构层不含 PII / productId / 图片 URL，运行时再由 `sanitizeQuery()` 清洗（四道闸）。
 *   - Lead / Dealer 为新增表，可能尚未 db push；用 $queryRawUnsafe 并 try/catch 兜底，
 *     表不存在时返回空候选，绝不阻断主链路。
 */
import { prisma } from "@/lib/db";
import { getDailyReportData, type DailyReportData } from "@/lib/daily-report-parser";
import { matchPortByLocation } from "@/lib/port-matcher";
import { parseLocationText } from "@/lib/location-parser";
import { retrieveWebEvidence } from "@/lib/search/web-evidence";
import type { WebEvidence } from "@/lib/search/web-evidence";

export type { WebEvidence } from "@/lib/search/web-evidence";

export interface StrategyRetrievalInput {
  productId?: string;
  brandName?: string;
  modelName?: string;
  categoryName?: string;
  year?: number;
  location?: string;
  isChineseBrand?: boolean;
}

/** 线索/经销商候选（脱敏：仅公开属性，不含 phone/wechat/email 明文） */
export interface LeadCandidate {
  id: string; // 形如 "lead_<cuid>" / "dealer_<cuid>"，便于解锁路由解析
  type: "lead" | "dealer";
  name: string;
  brand: string | null;
  model: string | null;
  region: string | null;
  source: string;
}

export interface StrategyProductInfo {
  productId: string | null;
  brandName: string;
  modelName: string;
  year: number | null;
  categoryName: string;
  priceCny: number | null;
  location: string | null;
  condition: string | null;
  workingHours: number | null;
  isChineseBrand: boolean;
}

/**
 * 站内实时在售证据（A2，来源 `RawListing`）。
 *
 * ⚠️ 实测坑（arch §1.2.7）：`locationCode` 在 3958 行里几乎全空、`goodsRegion` 3922/3958 为 null
 * ⇒ **禁止**用这两列过滤（一过滤就返回空）。国别只能从 `location` 自由文本解析。
 */
export interface RawListingEvidence {
  brandName: string;
  modelName: string;
  year: number | null;
  priceCny: number | null;
  currency: string | null;
  location: string;
  /** 采集源：agroline / search_api / agriaffaires / mascus_ua …（prompt 据此判断价格口径可信度） */
  source: string;
  sourceUrl: string;
  /** 由 `location` 自由文本解析出的国别（ISO 3166-1 alpha-2），解析不出为 null */
  countryIso?: string | null;
  /** 采集时间（ISO 字符串） */
  scrapedAt?: string;
}

/**
 * 基准价证据（`BrandBenchmark` 一行）。
 *
 * ★ `matchScope` 为新增**可选**字段：区分「同机型实测」与「品牌级参考」，
 *   避免 prompt 把品牌级价格当成机型锚点。可选是为了老调用方（含既有测试 mock）零破坏。
 */
export interface BenchmarkEvidence {
  brand: string;
  model: string;
  priceCny: number | null;
  region: string | null;
  sourceSite: string | null;
  matchScope?: "model" | "brand";
}

/** 基准价区域聚合（A4，`byRegion` 元素） */
export interface BenchmarkRegionStat {
  region: string;
  count: number;
  minCny: number | null;
  maxCny: number | null;
  medianCny: number | null;
}

/** 基准价明细（A4）：机型级 / 品牌级 / 区域聚合三视图 */
export interface BenchmarkDetail {
  /** 同机型实测（`matchScope:"model"`） */
  byModel: BenchmarkEvidence[];
  /** 品牌级参考（`matchScope:"brand"`） */
  byBrand: BenchmarkEvidence[];
  /** 按 `BrandBenchmark.region` 分组统计（EU / US / GLOBAL …） */
  byRegion: BenchmarkRegionStat[];
}

export interface StrategyContext {
  product: StrategyProductInfo | null;
  candidates: LeadCandidate[];
  similarProducts: Array<{
    brandName: string;
    modelName: string;
    year: number | null;
    priceCny: number | null;
    location: string | null;
  }>;
  /** 基准价（元素类型 additive 扩了 `matchScope`） */
  benchmarks: BenchmarkEvidence[];
  dailyReport: DailyReportData | null;
  portSuggestion: string;
  marketIntel: Array<{ title: string; content: string; region: string; priority: string }>;
  /** 外部快照是否真实命中（日报存在即为 true） */
  realtimeExternal: boolean;

  // ── T07 增量块（全部可选：老调用方 / 测试 mock 零破坏） ──
  /** A1 外部 Web 检索证据（四档降级；**失败也是有值**，用 status 表达） */
  webEvidence?: WebEvidence;
  /** A2 站内真实在售（RawListing，按品牌/机型模糊匹配） */
  rawListings?: RawListingEvidence[];
  /** A4 基准价明细 + 区域聚合 */
  benchmarkDetail?: BenchmarkDetail;
}

/**
 * DB 查询默认超时。
 *
 * ⚠️ 2026-11 由 3_000 提到 **8_000**（`.com` 上「策略不好用」的**隐性第二原因**）：
 *    `.com` 跑 Neon（Vercel + Neon 海外库），计算实例在无请求时会挂起，
 *    **冷启动唤醒本身常需 1-3s，唤醒后的首批查询还要再等 1-2s**。
 *    本文件共 6 个查询全部走这道 3s 硬闸 ⇒ 冷启动那一次几乎**全部返回 null**
 *    ⇒ prompt 里落成「本品信息：（未提供产品）」「基准价：无」「站内实时在售：无」
 *    ⇒ 模型手里没有任何事实，只能编 —— 而深度分析不查库，所以"深度分析好用、策略不好用"。
 *    总预算提到 280s 后，这里放开到 8s 完全放得下：本文件的检索分块走 `Promise.all`
 *    并发，最坏情况也只多花十几秒，远小于预算余量。
 */
const DB_TIMEOUT_MS = 8_000;
/** 站内真实在售条数上限（够 prompt 归纳价格带，又不至于撑爆 token） */
const RAW_LISTING_TAKE = 40;
/** 机型级基准价条数上限 */
const BENCHMARK_MODEL_TAKE = 12;
/** 品牌级基准价条数上限（沿用既有"品牌 Top12"行为） */
const BENCHMARK_BRAND_TAKE = 12;
/** 区域聚合取样上限（只为统计 min/max/median，不需要全表） */
const BENCHMARK_REGION_TAKE = 300;
/** 机型级结果少于该条数时回落品牌级 */
const BENCHMARK_MODEL_MIN = 3;

/**
 * 给 Prisma 查询加超时闸：超时 / 异常都返回 `null`（调用方按"空"处理）。
 *
 * 实现要点：内部 `p.catch(() => null)` 先吞掉迟到异常，避免 `Promise.race` 之后的
 * unhandledRejection（Node 会把进程日志刷成红色，甚至影响 serverless 实例）。
 */
async function withDbTimeout<T>(p: Promise<T>, ms: number = DB_TIMEOUT_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const guarded: Promise<T | null> = p.catch(() => null);
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    });
    return await Promise.race([guarded, timeout]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}


/** 从 Lead / Dealer 表检索与本品匹配的候选（不含明文 PII） */
async function retrieveCandidates(input: StrategyRetrievalInput): Promise<LeadCandidate[]> {
  const brand = (input.brandName || "").trim();
  const model = (input.modelName || "").trim();
  const region = (input.location || "").trim();
  if (!brand && !model && !region) return [];

  const toCandidate = (row: any, type: "lead" | "dealer"): LeadCandidate => {
    if (type === "dealer") {
      const brands = Array.isArray(row.brands) ? (row.brands as string[]) : [];
      const regions = Array.isArray(row.regions) ? (row.regions as string[]) : [];
      return {
        id: `dealer_${row.id}`,
        type: "dealer",
        name: row.name || "渠道经销商",
        // Dealer.brands / Dealer.regions 为数组列，取首个代表；Dealer 无 model 列
        brand: brands[0] ?? null,
        model: "",
        region: regions[0] ?? null,
        source: row.source || "dealer_pool",
      };
    }
    return {
      id: `lead_${row.id}`,
      type: "lead",
      name: row.name || "潜在买家",
      brand: row.brand ?? null,
      model: row.model ?? null,
      region: row.region ?? null,
      source: row.source || "lead_pool",
    };
  };

  try {
    const leads =
      (await withDbTimeout(
        prisma.$queryRawUnsafe<
          Array<{ id: string; name: string; brand: string | null; model: string | null; region: string | null; source: string | null }>
        >(
          `SELECT id, name, brand, model, region, source
         FROM "Lead"
         WHERE ($1 = '' OR brand ILIKE '%' || $1 || '%'
                OR model ILIKE '%' || $1 || '%'
                OR region ILIKE '%' || $1 || '%')
         ORDER BY "createdAt" DESC
         LIMIT 10`,
          brand
        )
      )) ?? [];

    const dealers =
      (await withDbTimeout(
        prisma.$queryRawUnsafe<
          Array<{ id: string; name: string; brands: string[] | null; regions: string[] | null; source: string | null }>
        >(
          `SELECT id, name, source, brands, regions
         FROM "Dealer"
         WHERE ($1 = '' OR regions::text ILIKE '%' || $1 || '%')
           AND ($2 = '' OR brands::text ILIKE '%' || $2 || '%')
         ORDER BY "createdAt" DESC
         LIMIT 10`,
          region,
          brand
        )
      )) ?? [];

    return [
      ...(leads || []).map((r) => toCandidate(r, "lead")),
      ...(dealers || []).map((r) => toCandidate(r, "dealer")),
    ].slice(0, 12);
  } catch {
    return [];
  }
}

/** 加载本品结构化信息（复用产品页同一份字段） */
async function loadProductInfo(productId: string): Promise<StrategyProductInfo | null> {
  try {
    const p = await withDbTimeout(
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          modelName: true,
          year: true,
          priceCny: true,
          location: true,
          condition: true,
          workingHours: true,
          brand: { select: { nameZh: true, nameEn: true, isChineseBrand: true } },
          category: { select: { nameZh: true, nameEn: true } },
        },
      })
    );
    if (!p) return null;
    const brandName = p.brand?.nameZh || p.brand?.nameEn || "";
    const categoryName = p.category?.nameZh || p.category?.nameEn || "";
    return {
      productId: p.id,
      brandName,
      modelName: p.modelName,
      year: p.year,
      categoryName,
      priceCny: p.priceCny,
      location: p.location,
      condition: p.condition,
      workingHours: p.workingHours,
      isChineseBrand: !!p.brand?.isChineseBrand,
    };
  } catch {
    return null;
  }
}

/** 同品类在售（行情参考） */
async function retrieveSimilarProducts(
  brandName: string,
  categoryName: string,
  excludeProductId?: string
): Promise<StrategyContext["similarProducts"]> {
  if (!brandName && !categoryName) return [];
  try {
    const rows =
      (await withDbTimeout(
        prisma.product.findMany({
          where: {
            status: "active",
            ...(excludeProductId ? { NOT: { id: excludeProductId } } : {}),
            ...(brandName
              ? { OR: [{ brand: { nameZh: brandName } }, { brand: { nameEn: brandName } }] }
              : {}),
          },
          select: {
            modelName: true,
            year: true,
            priceCny: true,
            location: true,
            brand: { select: { nameZh: true, nameEn: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      )) ?? [];
    const out = rows
      .map((r) => ({
        brandName: r.brand?.nameZh || r.brand?.nameEn || "",
        modelName: r.modelName,
        year: r.year,
        priceCny: r.priceCny,
        location: r.location,
      }));
    // 品类过滤延后到 prompt 软匹配，此处不再做恒真 filter
    return out.slice(0, 12);
  } catch {
    return [];
  }
}

/**
 * 从机型名拆出可检索 token（`"VBP 3165"` → `["VBP 3165","VBP","3165"]`）。
 *
 * 用途：`BrandBenchmark.model` 的写法千奇百怪（`"VBP 3165"` / `"VBP3165"` / `"Comprima F155"`），
 * 整串包含匹配命中率低，必须再退回单词级包含匹配。长度 <2 的碎片（`"F"`）丢弃，避免噪音。
 */
function modelTokens(modelName: string): string[] {
  const raw = (modelName || "").trim();
  if (!raw) return [];
  const tokens = new Set<string>();
  tokens.add(raw);
  for (const part of raw.split(/[\s\-_/]+/)) {
    const t = part.trim();
    if (t.length >= 2) tokens.add(t);
  }
  return [...tokens];
}

/** 中位数（空数组返回 null；偶数取中间两值均值，与 prisma 侧口径无关，纯展示用） */
function medianOf(values: number[]): number | null {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return nums[mid];
  return Math.round((nums[mid - 1] + nums[mid]) / 2);
}

/** 品牌匹配条件（对齐既有口径：`brand` 存小写英文标识，`brandNameZh` 存中文名） */
function benchmarkBrandWhere(brandName: string): Record<string, unknown> {
  const brand = (brandName || "").trim();
  if (!brand) return {};
  return { OR: [{ brand: brand.toLowerCase() }, { brandNameZh: brand }] };
}

/** 基准价单行 → 证据（附带匹配层级） */
function toBenchmarkEvidence(
  row: { brand: string; model: string; priceCny: number; region: string | null; sourceSite: string },
  matchScope: "model" | "brand"
): BenchmarkEvidence {
  return {
    brand: row.brand,
    model: row.model,
    priceCny: row.priceCny,
    region: row.region,
    sourceSite: row.sourceSite,
    matchScope,
  };
}

/** 去重指纹（同一行可能同时出现在机型级与品牌级结果里） */
function benchmarkKey(b: BenchmarkEvidence): string {
  return [b.brand, b.model, b.region ?? "", b.sourceSite ?? "", b.priceCny ?? ""].join("|");
}

/**
 * 全球基准价 `BrandBenchmark`（A4：机型级 + 品牌级 + 区域聚合）。
 *
 * 修正的既有缺口（arch §1.2.7）：原实现 `modelName` **只用于早退判断、从未进 where**，
 * 于是永远返回"品牌全机型 Top12 高价"，机型匹配为零 —— 价格锚点矩阵（G3）的直接障碍。
 *
 * 行为契约（**既有行为不能变差**）：
 *   - `byModel`：`model` 模糊/包含匹配（整串 + 单词级 token），≤12 条，`matchScope:"model"`；
 *   - `byBrand`：品牌级 Top12（= 原实现），仅当机型级 <3 条时用于**回落填充**，`matchScope:"brand"`；
 *   - `benchmarks`（老字段）= `byModel` + `byBrand` 填充至 12 条 ⇒ 机型匹配失败时与旧行为一致；
 *   - `byRegion`：按 `BrandBenchmark.region` 分组统计 min/max/median/count（不看机型，看品牌盘子）。
 */
async function retrieveBenchmarkDetail(brandName: string, modelName: string): Promise<BenchmarkDetail> {
  const empty: BenchmarkDetail = { byModel: [], byBrand: [], byRegion: [] };
  if (!brandName && !modelName) return empty;

  const brandWhere = benchmarkBrandWhere(brandName);
  const tokens = modelTokens(modelName);

  try {
    const modelWhere = tokens.length
      ? {
          isActive: true,
          ...brandWhere,
          // 机型条件单独放进 AND，避免与品牌 OR 混在一起互相覆盖
          AND: [
            {
              OR: tokens.map((t) => ({ model: { contains: t, mode: "insensitive" as const } })),
            },
          ],
        }
      : null;

    const [modelRows, brandRows, regionRows] = await Promise.all([
      modelWhere
        ? withDbTimeout(
            prisma.brandBenchmark.findMany({
              where: modelWhere,
              select: { brand: true, model: true, priceCny: true, region: true, sourceSite: true },
              orderBy: { priceCny: "desc" },
              take: BENCHMARK_MODEL_TAKE,
            })
          )
        : Promise.resolve([]),
      withDbTimeout(
        prisma.brandBenchmark.findMany({
          where: { isActive: true, ...brandWhere },
          select: { brand: true, model: true, priceCny: true, region: true, sourceSite: true },
          orderBy: { priceCny: "desc" },
          take: BENCHMARK_BRAND_TAKE,
        })
      ),
      withDbTimeout(
        prisma.brandBenchmark.findMany({
          where: { isActive: true, ...brandWhere },
          select: { region: true, priceCny: true },
          take: BENCHMARK_REGION_TAKE,
        })
      ),
    ]);

    const byModel = (modelRows ?? []).map((r) => toBenchmarkEvidence(r, "model"));
    const modelKeys = new Set(byModel.map(benchmarkKey));

    // 机型级不足 3 条时才回落品牌级（既保留旧行为，又不让品牌高价盖掉同机型实测）
    const needBrandFill = byModel.length < BENCHMARK_MODEL_MIN;
    const byBrand = needBrandFill
      ? (brandRows ?? [])
          .map((r) => toBenchmarkEvidence(r, "brand"))
          .filter((b) => !modelKeys.has(benchmarkKey(b)))
      : [];

    // 区域聚合：null 区域记 `未标注`（实测该列为 EU/US/GLOBAL/空）
    const grouped = new Map<string, number[]>();
    for (const r of regionRows ?? []) {
      const key = (r.region || "").trim() || "未标注";
      const price = typeof r.priceCny === "number" ? r.priceCny : null;
      if (price === null) continue;
      const list = grouped.get(key);
      if (list) list.push(price);
      else grouped.set(key, [price]);
    }
    const byRegion: BenchmarkRegionStat[] = [...grouped.entries()]
      .map(([region, prices]) => ({
        region,
        count: prices.length,
        minCny: Math.min(...prices),
        maxCny: Math.max(...prices),
        medianCny: medianOf(prices),
      }))
      .sort((a, b) => b.count - a.count);

    return { byModel, byBrand, byRegion };
  } catch {
    return empty;
  }
}

/** `RawListing` 查询字段（`id` 仅用于去重，不对外暴露） */
const RAW_LISTING_SELECT = {
  id: true,
  source: true,
  sourceUrl: true,
  brandName: true,
  modelName: true,
  year: true,
  priceCny: true,
  currency: true,
  location: true,
  scrapedAt: true,
} as const;

/**
 * 站内真实在售（A2，`RawListing`）。
 *
 * ⚠️ 实测坑：**禁止**用 `locationCode`（3958 行几乎全空）或 `goodsRegion`（3922/3958 为 null）过滤，
 *    一过滤就返回空。国别只能从 `location` 自由文本解析（`parseLocationText`）。
 * ⚠️ `sellerPhone/sellerEmail/images` **一律不 select**（PII / 媒体不出内网）。
 */
async function retrieveRawListings(brandName: string, modelName: string): Promise<RawListingEvidence[]> {
  const brand = (brandName || "").trim();
  const tokens = modelTokens(modelName);
  if (!brand && tokens.length === 0) return [];

  const baseWhere = {
    priceCny: { not: null },
    // 有效挂牌：排除被审核拒绝的行（`pending/active/...` 都算有效）
    status: { not: "rejected" },
    ...(brand ? { brandName: { contains: brand, mode: "insensitive" as const } } : {}),
  };

  const toEvidence = (row: {
    source: string;
    sourceUrl: string;
    brandName: string;
    modelName: string;
    year: number | null;
    priceCny: number | null;
    currency: string | null;
    location: string;
    scrapedAt: Date;
  }): RawListingEvidence => ({
    brandName: row.brandName,
    modelName: row.modelName,
    year: row.year,
    priceCny: row.priceCny,
    currency: row.currency,
    location: row.location ?? "",
    source: row.source,
    sourceUrl: row.sourceUrl,
    countryIso: parseLocationText(row.location ?? "").country ?? null,
    scrapedAt: row.scrapedAt instanceof Date ? row.scrapedAt.toISOString() : String(row.scrapedAt ?? ""),
  });

  try {
    const withModel = tokens.length
      ? (await withDbTimeout(
          prisma.rawListing.findMany({
            where: {
              ...baseWhere,
              OR: tokens.map((t) => ({ modelName: { contains: t, mode: "insensitive" as const } })),
            },
            select: RAW_LISTING_SELECT,
            orderBy: { scrapedAt: "desc" },
            take: RAW_LISTING_TAKE,
          })
        )) ?? []
      : [];

    // 机型命中足够多就直接用；否则回落品牌级（机型匹配不到时不让 rawListings 空着）
    if (withModel.length >= BENCHMARK_MODEL_MIN) {
      return withModel.map(toEvidence);
    }

    const brandOnly =
      (await withDbTimeout(
        prisma.rawListing.findMany({
          where: baseWhere,
          select: RAW_LISTING_SELECT,
          orderBy: { scrapedAt: "desc" },
          take: RAW_LISTING_TAKE,
        })
      )) ?? [];

    // 机型命中优先排序，其余品牌级补足（按 sourceUrl+price 去重）
    const seen = new Set<string>();
    const merged: RawListingEvidence[] = [];
    for (const row of [...withModel, ...brandOnly]) {
      const key = `${row.sourceUrl}|${row.priceCny ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(toEvidence(row));
      if (merged.length >= RAW_LISTING_TAKE) break;
    }
    return merged;
  } catch {
    return [];
  }
}

/** 市场情报（取最新活跃，调用方按品牌/品类/地区软过滤） */
async function retrieveMarketIntel(): Promise<StrategyContext["marketIntel"]> {
  try {
    const rows =
      (await withDbTimeout(
        prisma.marketIntel.findMany({
          where: { isActive: true },
          // MarketIntel 模型没有 title 字段（只有 text/region/tags），标题由正文首行派生
          select: { text: true, region: true, tags: true },
          orderBy: { date: "desc" },
          take: 20,
        })
      )) ?? [];
    return rows.map((r) => ({
      title: (r.text ?? "").split("\n")[0].slice(0, 40),
      content: r.text,
      region: r.region,
      priority: r.tags?.includes("高") ? "高" : r.tags?.includes("低") ? "低" : "中",
    }));
  } catch {
    return [];
  }
}

/**
 * 从本品信息派生「检索目标市场」提示（只用于拼检索问题，不含任何 PII / 价格）。
 *
 * 规则：
 *   - 无 location ⇒ 默认三大出口市场（PRD 主战场：欧洲 / 中亚 / 非洲）；
 *   - location 解析为 CN（国内货源）⇒ 同上（要查的是「卖去哪」的准入政策）；
 *   - location 解析为境外国家 ⇒ 把该地作为首选市场 + 欧洲兜底。
 */
function deriveMarketHints(location: string): string[] {
  const loc = (location || "").trim();
  if (!loc) return ["欧洲", "中亚", "非洲"];
  try {
    const parsed = parseLocationText(loc);
    if (parsed.country && parsed.country !== "CN") return [loc, "欧洲"];
  } catch {
    return [loc];
  }
  return ["欧洲", "中亚", "非洲"];
}

/** 年段提示（"2016-2022"）：检索「同代际机型」的价格，避免跨代错配 */
function deriveYearRange(year: number | null | undefined): string | undefined {
  if (typeof year !== "number" || !Number.isFinite(year) || year < 1950 || year > 2100) return undefined;
  return `${year - 6}-${year}`;
}

/**
 * 组装销售策略检索上下文。
 * 任何子查询失败都被 try/catch 兜成空，主链路永不中断。
 *
 * T07 起新增三块并发查询（`webEvidence` / `rawListings` / `benchmarkDetail`）：
 *   - 全部走 `Promise.all` 并发，不串行叠加延迟；
 *   - `retrieveWebEvidence()` 永不抛错；预算按 provider 取默认（ark ⇒ 110s/110s，
 *     第三方 ⇒ 8s/20s）⇒ 最坏情况慢 110s，但绝不阻断，且这段时间算在路由的
 *     `LLM_TOTAL_BUDGET_MS`(280s) 共享预算里（不是额外叠加，见 route.ts 的注释）；
 *   - 其余新查询失败一律返回空数组 / undefined（沿用既有降级风格）。
 */
export async function retrieveStrategyContext(input: StrategyRetrievalInput): Promise<StrategyContext> {
  const product = input.productId ? await loadProductInfo(input.productId) : null;
  const brandName = product?.brandName || input.brandName || "";
  const modelName = product?.modelName || input.modelName || "";
  const categoryName = product?.categoryName || input.categoryName || "";
  const location = product?.location || input.location || "";
  const year = product?.year ?? input.year ?? null;

  const [candidates, similarProducts, benchmarkDetail, marketIntel, rawListings, webEvidence] =
    await Promise.all([
      retrieveCandidates({ ...input, brandName, modelName, location }),
      retrieveSimilarProducts(brandName, categoryName, input.productId),
      retrieveBenchmarkDetail(brandName, modelName),
      retrieveMarketIntel(),
      retrieveRawListings(brandName, modelName),
      retrieveWebEvidence({
        brand: brandName,
        model: modelName,
        category: categoryName,
        yearRange: deriveYearRange(year),
        markets: deriveMarketHints(location),
      }),
    ]);

  // 老字段口径：机型级优先 + 品牌级填充（填充到 12 条即与旧行为等价）
  const benchmarks: StrategyContext["benchmarks"] = [
    ...(benchmarkDetail?.byModel ?? []),
    ...(benchmarkDetail?.byBrand ?? []),
  ].slice(0, BENCHMARK_BRAND_TAKE);

  const dailyReport = getDailyReportData(brandName || undefined, modelName || undefined);
  const portSuggestion = matchPortByLocation(location);

  return {
    product,
    candidates,
    similarProducts,
    benchmarks,
    dailyReport,
    portSuggestion,
    marketIntel,
    realtimeExternal: !!dailyReport,
    // ── T07 增量块 ──
    webEvidence,
    rawListings,
    benchmarkDetail,
  };
}

/** 解锁用：按 candidateId（lead_/dealer_ 前缀）取明文联系方式（仅服务端使用，绝不进前端明文） */
export interface LeadDealerContact {
  candidateId: string;
  type: "lead" | "dealer";
  name: string;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  productId: string | null;
}

export async function fetchLeadDealerContact(candidateId: string): Promise<LeadDealerContact | null> {
  const m = /^(lead|dealer)_(.+)$/.exec(candidateId || "");
  if (!m) return null;
  const type = m[1] === "dealer" ? "dealer" : "lead";
  const rawId = m[2];
  const table = type === "dealer" ? "Dealer" : "Lead";
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; name: string; phone: string | null; wechat: string | null; email: string | null; productId: string | null }>
    >(
      `SELECT id, name, phone, wechat, email, "productId" FROM "${table}" WHERE id = $1 LIMIT 1`,
      rawId
    );
    const r = rows?.[0];
    if (!r) return null;
    return {
      candidateId,
      type,
      name: r.name || "",
      phone: r.phone ?? null,
      wechat: r.wechat ?? null,
      email: r.email ?? null,
      productId: r.productId ?? null,
    };
  } catch {
    return null;
  }
}
