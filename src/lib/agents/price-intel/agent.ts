/**
 * 国际价格采集 Agent（#3）— 核心 Agent
 *
 * 职责：
 *   1. 接收 PriceIntelInput
 *   2. 调度 5 个数据源采集器
 *   3. 品牌+型号 → 站内 Product 匹配
 *   4. 比价/去重 → 写入 InternationalPrice
 *   5. 触发套利榜单缓存刷新
 *   6. 返回 PriceIntelResult（带日志）
 */
import { prisma } from "@/lib/db";
import {
  resolveModelCandidates,
  normalizeModel,
} from "@/lib/model-alias";
import {
  PRICE_SOURCES,
  type CollectedPrice,
  type DiagnosticMatch,
  type MatchedPrice,
  type PriceIntelInput,
  type PriceSource,
  type PriceIntelResult,
  type PriceIntelStatus,
  type SourceRunResult,
} from "./types";
import { collectFromSource } from "./sources";
import {
  validateMatch,
  type MatchCandidate,
  type MatchStep,
  type OneToManyState,
} from "./match-validation";
import { VALIDATION_ALLOWLIST } from "@/lib/model-alias.config";

export const AGENT_NAME = "price-intel";
export const AGENT_VERSION = "0.1.0";

// ==================== 品牌映射（中文名 → brandId） ====================

const BRAND_MAP: Record<string, string> = {
  "克拉斯": "claas",
  "claas": "claas",
  "克罗尼": "krone",
  "krone": "krone",
  "纽荷兰": "new-holland",
  "new holland": "new-holland",
  "new-holland": "new-holland",
  "迪尔": "john-deere",
  "约翰迪尔": "john-deere",
  "john deere": "john-deere",
  "john-deere": "john-deere",
  "凯斯": "case-ih",
  "case ih": "case-ih",
  "case-ih": "case-ih",
  "库恩": "kuhn",
  "kuhn": "kuhn",
  "格兰": "grain",
  "奥库": "orke",
  "格立莫": "grimme",
  "grimme": "grimme",
  "康斯凯尔": "kongskilde",
  "kongskilde": "kongskilde",
  "都麦": "dormoy",
  "arcusin": "arcusin",
  "麦赛弗格森": "massey-ferguson",
  "爱科": "massey-ferguson",
  "massey ferguson": "massey-ferguson",
  "massey-ferguson": "massey-ferguson",
  "东洋": "toyo",
  "马赛": "massey",
};

// ==================== DB 驱动品牌解析（P0-1，新增；BRAND_MAP 降级为兜底） ====================

/** 进程内品牌索引（一次性预取，避免每条约 1 次 round-trip） */
interface BrandIndex {
  /** normalizeBrandKey(nameZh) → brandId */
  byNameZh: Map<string, string>;
  /** normalizeBrandKey(nameEn) → brandId */
  byNameEn: Map<string, string>;
  /** brand.id（含 slug 与 cuid 两种形态）→ brandId（恒等） */
  byId: Map<string, string>;
}

/** 品牌名归一化：trim + 小写 + 去空格（中文品牌名可能含空格，如 "凯 斯"） */
function normalizeBrandKey(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * 修复2：确定性择优 —— 多个候选等价命中同一型号时，按确定性规则排序：
 *   ① 精确相等优先（normalizeModel(product.modelName) === candNorm）
 *   ② 长度差最小（|productNorm.length - candNorm.length| 最小）
 *   ③ id 字典序（升序）
 * 纯函数、零副作用 ⇒ 同一输入多次运行结果完全一致（替代 findFirst 先到先得）。
 */
function pickBestProducts<T extends { id: string; modelName: string }>(
  list: T[],
  candNorm: string
): T[] {
  return [...list].sort((a, b) => {
    const an = normalizeModel(a.modelName);
    const bn = normalizeModel(b.modelName);
    const aExact = an === candNorm ? 0 : 1;
    const bExact = bn === candNorm ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aDiff = Math.abs(an.length - candNorm.length);
    const bDiff = Math.abs(bn.length - candNorm.length);
    if (aDiff !== bDiff) return aDiff - bDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ==================== 修复B：两趟全局裁决（Pass1 收集 + Pass2 裁决） ====================

/**
 * Pass 1 产物：单条榜单的候选命中（**未**应用一对多）。
 * 若 productId 为 null，表示该条在 Pass 1 未命中任何库存产品。
 */
export interface ProductClaim {
  /** 源数组下标（仅最终 tie-break；不影响命中集） */
  index: number;
  /** 解析所得品牌 id（null = 品牌未解析） */
  brandId: string | null;
  /** 原始榜单型号（c.modelName） */
  rawListingModel: string;
  /** 归一化榜单型号 */
  listingNorm: string;
  /** 命中的库存产品 id（null = 未命中） */
  productId: string | null;
  /** 命中的库存型号（Product.modelName） */
  productModelName: string | null;
  /** 归一化库存型号（无命中为 ""） */
  productNorm: string;
  /** Pass 1 为该条累积的拒绝规则（①③④；供诊断） */
  rejectRules: string[];
}

/** Pass 2 之后，单条榜单的最终裁决结果 */
export interface ResolvedItem {
  index: number;
  brandId: string | null;
  productId: string | null;
  productModelName: string | null;
  rejectRules: string[];
}

/** 裁决裁决表：index → { productId, productModelName, rejectRules } */
export type Arbitration = Map<
  number,
  { productId: string | null; productModelName: string | null; rejectRules: string[] }
>;

/** 求两字符串的公共前缀长度（用于 Pass 2 打分第②键） */
function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * Pass 2：全局裁决（**纯函数，结果与输入顺序无关**）。
 *
 * 背景：旧实现用 `seenByProduct` 在遍历过程中"边遍历边占坑"，率先被处理者获胜 ⇒ 结果随
 *       `collectFromSource` 行序漂移（同一 92 行倒序喂入命中集 5→4）。本函数改为：
 *   - 先按 productId 分组（分组只依赖每条自身，与遍历顺序无关）；
 *   - 组内按「确定性打分」选出**唯一胜者**；
 *   - 与胜者**归一化榜单型号相同**的候选一并保留（同一型号的两种写法不算一对多，AC-5 语义不变）；
 *   - 组内其余（语义不同型号）判 `one_to_many` 拒绝，其命中置空。
 *
 * 打分（全序，恒与输入顺序无关）：
 *   ① 精确相等（listingNorm === productNorm）优先；
 *   ② 归一化公共前缀更长优先；
 *   ③ 候选原始榜单串字典序更小优先；
 *   ④ 源数组下标更小优先（仅当 ①②③ 完全并列——此时两候选同型号，不影响命中集）。
 */
export function arbitrateClaims(claims: ProductClaim[]): Arbitration {
  const out: Arbitration = new Map();
  const byProduct = new Map<string, ProductClaim[]>();
  for (const c of claims) {
    if (!c.productId) {
      out.set(c.index, {
        productId: null,
        productModelName: null,
        rejectRules: [...c.rejectRules],
      });
      continue;
    }
    const arr = byProduct.get(c.productId) ?? [];
    arr.push(c);
    byProduct.set(c.productId, arr);
  }

  const better = (a: ProductClaim, b: ProductClaim): boolean => {
    // ① 精确相等优先
    const ae = a.listingNorm === a.productNorm ? 0 : 1;
    const be = b.listingNorm === b.productNorm ? 0 : 1;
    if (ae !== be) return ae < be;
    // ② 归一化公共前缀更长优先
    const ap = commonPrefixLen(a.listingNorm, a.productNorm);
    const bp = commonPrefixLen(b.listingNorm, b.productNorm);
    if (ap !== bp) return ap > bp;
    // ③ 候选原始榜单串字典序更小优先
    if (a.rawListingModel !== b.rawListingModel) return a.rawListingModel < b.rawListingModel;
    // ④ 源数组下标更小优先
    return a.index < b.index;
  };

  for (const [pid, group] of byProduct) {
    let winner = group[0];
    for (const g of group) if (better(g, winner)) winner = g;
    for (const g of group) {
      if (g.listingNorm === winner.listingNorm) {
        out.set(g.index, {
          productId: pid,
          productModelName: g.productModelName,
          rejectRules: [...g.rejectRules],
        });
      } else {
        out.set(g.index, {
          productId: null,
          productModelName: null,
          rejectRules: [...g.rejectRules, "one_to_many"],
        });
      }
    }
  }
  return out;
}

// ==================== Agent 主体 ====================

export class PriceIntelAgent {
  private logs: string[] = [];
  /** P0-1：品牌索引缓存（DB 驱动，进程内一次性预取） */
  private brandIndex: BrandIndex | null = null;
  /** P0-1：并发去重，避免同时多次预取 */
  private brandIndexLoading: Promise<void> | null = null;

  private log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    this.logs.push(line);
    console.log(line);
  }

  /**
   * P0-1：一次性预取品牌索引并缓存（Brand 表 ~157 行）。
   * 并发安全：多个调用共享同一 Promise。失败不抛出（品牌解析退化为 BRAND_MAP 兜底）。
   */
  private async loadBrandIndex(): Promise<void> {
    if (this.brandIndex) return;
    if (this.brandIndexLoading) return this.brandIndexLoading;
    this.brandIndexLoading = (async () => {
      try {
        const rows = await prisma.brand.findMany({
          orderBy: { id: "asc" }, // 修复2：稳定行序（后续消歧 pick 本身已确定性）
          select: {
            id: true,
            nameZh: true,
            nameEn: true,
            // 消歧用：仅统计 active 产品数（与"优先取 active 产品数多的品牌"规则一致）
            _count: { select: { products: { where: { status: "active" } } } },
          },
        });
        // 先建 id→row 映射，避免循环内 rows.find 的 O(n²)
        const rowById = new Map<string, (typeof rows)[number]>();
        for (const r of rows) rowById.set(r.id, r);
        const pick = (aId: string, bId: string): string => {
          const a = rowById.get(aId);
          const b = rowById.get(bId);
          if (!a) return bId;
          if (!b) return aId;
          const pa = a._count.products;
          const pb = b._count.products;
          if (pa !== pb) return pa > pb ? aId : bId;
          return aId < bId ? aId : bId; // 确定性 tie-break
        };
        const byNameZh = new Map<string, string>();
        const byNameEn = new Map<string, string>();
        const byId = new Map<string, string>();
        for (const r of rows) {
          byId.set(r.id, r.id);
          const kz = normalizeBrandKey(r.nameZh);
          if (kz) byNameZh.set(kz, byNameZh.has(kz) ? pick(byNameZh.get(kz)!, r.id) : r.id);
          const ke = normalizeBrandKey(r.nameEn);
          if (ke) byNameEn.set(ke, byNameEn.has(ke) ? pick(byNameEn.get(ke)!, r.id) : r.id);
        }
        this.brandIndex = { byNameZh, byNameEn, byId };
        this.log(`🏷️ 品牌索引已加载：${rows.length} 条`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log(`⚠️ 品牌索引加载失败，回落 BRAND_MAP：${msg.slice(0, 160)}`);
        this.brandIndex = null;
      } finally {
        this.brandIndexLoading = null;
      }
    })();
    return this.brandIndexLoading;
  }

  /**
   * P0-1：品牌解析（新）—— DB 索引优先，BRAND_MAP 兜底。
   * 优先级：nameZh 精确 > nameEn 精确 > id 相等；均未命中返回 null 交调用方兜底。
   */
  private async resolveBrandIdAsync(nameZh: string): Promise<string | null> {
    const key = nameZh?.trim();
    if (!key) return null;
    let idx = this.brandIndex;
    if (!idx) {
      await this.loadBrandIndex();
      idx = this.brandIndex;
    }
    if (idx) {
      const k = normalizeBrandKey(key);
      const hit =
        idx.byNameZh.get(k) ?? idx.byNameEn.get(k) ?? idx.byId.get(key) ?? null;
      if (hit) return hit;
    }
    return null;
  }

  /**
   * 品牌名 → brandId（BRAND_MAP 兜底，本体未改）
   */
  private resolveBrandId(nameZh: string): string | null {
    const key = nameZh?.trim();
    if (!key) return null;
    return BRAND_MAP[key] || BRAND_MAP[key.toLowerCase()] || null;
  }

  /**
   * Pass 1：为单条榜单解析「品牌 → 五个匹配步 → 首个过闸 Product」。
   *
   * **只应用规则①③④（不含一对多）**：跨条一对多统一交 Pass 2（arbitrateClaims）裁决，
   * 以消除"边遍历边占坑"的顺序敏感。返回值完整携带 brandId / 归一化型号 / 拒绝规则（供诊断）。
   */
  private async claimProduct(c: CollectedPrice, index: number): Promise<ProductClaim> {
    const rejectRules: string[] = [];
    const brandId =
      (await this.resolveBrandIdAsync(c.brandNameZh)) ??
      this.resolveBrandId(c.brandNameZh);
    const model = c.modelName?.trim();
    const listingNorm = normalizeModel(model ?? "");
    const mk = (
      productId: string | null,
      productModelName: string | null
    ): ProductClaim => ({
      index,
      brandId,
      rawListingModel: model ?? "",
      listingNorm,
      productId,
      productModelName,
      productNorm: normalizeModel(productModelName ?? ""),
      rejectRules: [...rejectRules],
    });
    if (!brandId || !model) return mk(null, null);

    // 单条内部仍需白名单能力；本条的"一对多"天然不会触发（命中即返回）
    const vstate: OneToManyState = {
      seenByProduct: new Map(),
      allowlist: VALIDATION_ALLOWLIST,
    };
    const gateOnce = (cand: MatchCandidate): boolean => {
      const r = validateMatch(cand, vstate);
      if (!r.ok) {
        rejectRules.push(r.rejection!.rule);
        this.log(`⛔ 拒绝候选 [${r.rejection!.rule}] ${r.rejection!.reason}`);
        return false;
      }
      return true;
    };

    // 1) 精确：brand + model + year（修复2：补 orderBy，稳定命中）
    if (c.year) {
      const p = await prisma.product.findFirst({
        where: { brandId, modelName: model, year: c.year },
        orderBy: { id: "asc" },
        select: { id: true, modelName: true },
      });
      if (p) return mk(p.id, p.modelName);
    }
    // 2) 精确：brand + model（去 year）（修复2：补 orderBy，稳定命中）
    const p2 = await prisma.product.findFirst({
      where: { brandId, modelName: model },
      orderBy: [{ year: "desc" }, { id: "asc" }],
      select: { id: true, modelName: true },
    });
    if (p2) return mk(p2.id, p2.modelName);

    // 3) 模糊：brand + model contains（修复2：findMany + 确定性打分，替代 findFirst 先到先得）
    const list3 = await prisma.product.findMany({
      where: { brandId, modelName: { contains: model } },
      orderBy: { id: "asc" },
      select: { id: true, modelName: true },
    });
    for (const pm of pickBestProducts(list3, listingNorm)) {
      if (gateOnce({ brandSlug: brandId, rawListingModel: model, productId: pm.id, productModelName: pm.modelName, viaStep: 3 })) {
        return mk(pm.id, pm.modelName);
      }
    }

    // 4) 反向：product contains brand model 首词（修复2：findMany + 确定性打分）
    const list4 = await prisma.product.findMany({
      where: { brandId, modelName: { contains: model.split(/\s+/)[0] } },
      orderBy: { id: "asc" },
      select: { id: true, modelName: true },
    });
    for (const pm of pickBestProducts(list4, listingNorm)) {
      if (gateOnce({ brandSlug: brandId, rawListingModel: model, productId: pm.id, productModelName: pm.modelName, viaStep: 4 })) {
        return mk(pm.id, pm.modelName);
      }
    }

    // 5) 【2026-09-07 新增】ModelAlias 归一化匹配
    //    解决"抓取型号带系列名（Jaguar 970 / BiG Pack 1290）配不上库存裸型号（970 / 1290XC）"。
    //    候选已按优先级排序，依次尝试，命中即返回。
    //    修复2：候选内改用 findMany + 确定性打分（精确相等优先 → 长度差最小 → id 字典序）。
    const candidates = resolveModelCandidates(brandId, model);
    for (const cand of candidates) {
      if (!cand || cand === listingNorm) continue; // 已在上面试过原始型号
      // 用 startsWith 而非 contains：避免 "6R 250"→"250" 误吃库存 "7250" 这类错配
      const list5 = await prisma.product.findMany({
        where: { brandId, modelName: { startsWith: cand, mode: "insensitive" } },
        orderBy: { id: "asc" },
        select: { id: true, modelName: true },
      });
      for (const pm of pickBestProducts(list5, cand)) {
        if (gateOnce({ brandSlug: brandId, rawListingModel: model, productId: pm.id, productModelName: pm.modelName, viaStep: 5 })) {
          return mk(pm.id, pm.modelName);
        }
      }
    }
    return mk(null, null);
  }

  /**
   * 两趟全局裁决（修复B）：
   *   Pass 1：逐条解析候选（`claimProduct`，**不**应用一对多）；
   *   Pass 2：按 productId 全局裁决唯一胜者（`arbitrateClaims`，纯函数）。
   * 结果的**命中集**与 items 的输入顺序无关（恒等）。
   */
  async resolveItems(items: CollectedPrice[]): Promise<ResolvedItem[]> {
    const { resolved } = await this.resolveItemsDetailed(items);
    return resolved;
  }

  /**
   * 同 `resolveItems`，但额外返回 Pass 1 的逐条候选 `claims`。
   *
   * 用途：Pass 1 **逐条独立**（每条只查自己的品牌/型号，与遍历顺序无关）；
   * 故「顺序不变性」验证可复用同一批 claims，仅对 Pass 2 施加不同顺序，
   * 既避免 4 次全量 DB 往返，又保证与真实生产路径 `resolveItems` 完全一致。
   */
  async resolveItemsDetailed(
    items: CollectedPrice[]
  ): Promise<{ resolved: ResolvedItem[]; claims: ProductClaim[] }> {
    await this.loadBrandIndex();
    const claims: ProductClaim[] = [];
    for (let i = 0; i < items.length; i++) {
      claims.push(await this.claimProduct(items[i], i));
    }
    const verdict = arbitrateClaims(claims);
    const resolved = claims.map((c) => {
      const v = verdict.get(c.index) ?? {
        productId: c.productId,
        productModelName: c.productModelName,
        rejectRules: [...c.rejectRules],
      };
      return {
        index: c.index,
        brandId: c.brandId,
        productId: v.productId,
        productModelName: v.productModelName,
        rejectRules: v.rejectRules,
      };
    });
    return { resolved, claims };
  }

  /**
   * 把单条 CollectedPrice + 已裁决的 productId 转成 MatchedPrice（含落库决策）
   */
  private toMatched(c: CollectedPrice, productId: string | null): MatchedPrice {
    const currency: "EUR" | "USD" = c.priceEur ? "EUR" : c.priceUsd ? "USD" : "EUR";
    const priceRaw = c.priceEur ?? c.priceUsd ?? 0;
    const priceForeignCny = Math.round(priceRaw * c.exchangeRate);

    if (priceRaw <= 0) {
      return { ...c, productId: null, matchStatus: "skipped_no_price", priceForeignCny: 0, currency };
    }
    if (!productId) {
      return { ...c, productId: null, matchStatus: "skipped_no_product", priceForeignCny, currency };
    }
    return { ...c, productId, matchStatus: "matched", priceForeignCny, currency };
  }

  /**
   * 把单条 MatchedPrice 写入 InternationalPrice（带去重/更新）
   */
  private async upsertPrice(m: MatchedPrice, force: boolean): Promise<"imported" | "updated" | "skipped"> {
    if (!m.productId || m.matchStatus !== "matched") return "skipped";

    // 找现有同源记录
    const existing = await prisma.internationalPrice.findFirst({
      where: { productId: m.productId, source: m.source },
    });

    const data = {
      productId: m.productId,
      priceForeignCny: m.priceForeignCny,
      priceForeignRaw: m.priceEur ?? m.priceUsd ?? null,
      currency: m.currency,
      exchangeRate: m.exchangeRate,
      source: m.source,
      sourceUrl: m.sourceUrl,
      sourceDate: m.sourceDate,
      country: m.country,
      confidenceScore: 0.85,    // Agent 写入默认高置信
      isActive: true,
      lastVerified: new Date(),
      notes: [
        m.note,
        m.grossMarginPct != null ? `毛利率${(m.grossMarginPct * 100).toFixed(1)}%` : null,
        m.opportunityLevel ? `机会等级:${m.opportunityLevel}` : null,
      ].filter(Boolean).join(" | "),
    };

    if (!existing) {
      await prisma.internationalPrice.create({ data });
      return "imported";
    }
    if (!force && existing.sourceDate && existing.sourceDate >= m.sourceDate) {
      return "skipped";
    }
    await prisma.internationalPrice.update({ where: { id: existing.id }, data });
    return "updated";
  }

  /**
   * 跑单源
   */
  private async runSource(
    source: PriceSource,
    maxFiles: number,
    targetDate: string | undefined,
    force: boolean,
    dryRun: boolean,
    diagnostics: boolean
  ): Promise<SourceRunResult> {
    const start = Date.now();
    const result: SourceRunResult = {
      source,
      processed: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      durationMs: 0,
      errors: [],
      samples: [],
    };
    // 修复3/诊断：diagnostics=true 时逐条收集匹配明细（默认不产生 ⇒ 输出不变）
    const allMatches: DiagnosticMatch[] = [];
    try {
      this.log(`▶ source=${source} maxFiles=${maxFiles} dryRun=${dryRun}`);
      const items = await collectFromSource(source, maxFiles, targetDate);
      result.processed = items.length;
      // 修复B：两趟全局裁决（Pass1 收集 + Pass2 裁决），命中集与输入顺序无关
      const resolved = await this.resolveItems(items);
      for (const r of resolved) {
        try {
          const c = items[r.index];
          const m = this.toMatched(c, r.productId);
          if (diagnostics) {
            allMatches.push({
              ...m,
              brandId: r.brandId,
              productModelName: r.productModelName,
              rejectRules: r.rejectRules,
            });
          }
          if (dryRun || !m.productId) {
            // 仅记入样本，不写库
            if (result.samples.length < 3) result.samples.push(m);
            result.skipped++;
            continue;
          }
          const action = await this.upsertPrice(m, force);
          if (action === "imported") result.imported++;
          else if (action === "updated") result.updated++;
          else result.skipped++;
          if (result.samples.length < 3) result.samples.push(m);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          result.errors.push(msg);
          result.skipped++;
          if (result.errors.length <= 5) this.log(`  ✗ item error: ${msg}`);
        }
      }
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
    result.durationMs = Date.now() - start;
    if (diagnostics) result.allMatches = allMatches;
    this.log(`  ↳ processed=${result.processed} imported=${result.imported} updated=${result.updated} skipped=${result.skipped} ${result.durationMs}ms`);
    return result;
  }

  /**
   * Agent 主入口
   */
  async run(input: PriceIntelInput): Promise<PriceIntelResult> {
    const startedAt = new Date();
    this.logs = [];
    this.log(`🤖 ${AGENT_NAME}@${AGENT_VERSION} 启动`);
    // P0-1：一次性预取品牌索引（失败已内部兜底为 BRAND_MAP）
    await this.loadBrandIndex();
    const sources = input.sources && input.sources.length > 0
      ? input.sources
      : [...PRICE_SOURCES];
    const perSource: SourceRunResult[] = [];
    let totalImported = 0, totalUpdated = 0, totalSkipped = 0, totalCollected = 0;
    try {
      for (const s of sources) {
        const r = await this.runSource(s, input.maxFilesPerSource, input.targetDate, input.force, input.dryRun, input.diagnostics === true);
        perSource.push(r);
        totalImported += r.imported;
        totalUpdated += r.updated;
        totalSkipped += r.skipped;
        totalCollected += r.processed;
      }
      // 触发套利榜单缓存刷新（仅在有写入时；Neon 冷启动可能 P1001，重试一次）
      if (!input.dryRun && (totalImported + totalUpdated) > 0) {
        const tryRefresh = async (attempt: number): Promise<boolean> => {
          try {
            const { topArbitrageService } = await import("@/lib/services/top-arbitrage-service");
            await topArbitrageService.refreshCache();
            this.log(`🔄 套利榜单缓存已刷新 (attempt ${attempt})`);
            return true;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.log(`⚠️ 套利缓存刷新失败 (attempt ${attempt}): ${msg.slice(0, 200)}`);
            return false;
          }
        };
        if (!(await tryRefresh(1))) {
          await new Promise(r => setTimeout(r, 1500));
          await tryRefresh(2);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log(`❌ Agent 异常: ${msg}`);
      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        totalCollected, totalImported, totalUpdated, totalSkipped,
        perSource, log: this.logs, error: msg,
      };
    }
    const finishedAt = new Date();
    const result: PriceIntelResult = {
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      totalCollected, totalImported, totalUpdated, totalSkipped,
      perSource, log: this.logs,
    };
    this.log(`✅ 完成: collected=${totalCollected} imported=${totalImported} updated=${totalUpdated} skipped=${totalSkipped} ${result.durationMs}ms`);
    return result;
  }

  /**
   * 状态查询（不执行）
   */
  async getStatus(lastRun?: PriceIntelResult): Promise<PriceIntelStatus> {
    const rows = await prisma.internationalPrice.findMany({
      select: { source: true, sourceDate: true, productId: true },
    });
    const sourceMap = new Map<string, { count: number; latestDate: string | null }>();
    const productIds = new Set<string>();
    for (const r of rows) {
      const cur = sourceMap.get(r.source) || { count: 0, latestDate: null };
      cur.count++;
      if (r.sourceDate && (!cur.latestDate || r.sourceDate > cur.latestDate)) {
        cur.latestDate = r.sourceDate;
      }
      sourceMap.set(r.source, cur);
      productIds.add(r.productId);
    }
    return {
      ok: true,
      agentName: AGENT_NAME,
      version: AGENT_VERSION,
      lastRun: lastRun ? {
        startedAt: lastRun.startedAt,
        finishedAt: lastRun.finishedAt,
        totalImported: lastRun.totalImported,
        totalUpdated: lastRun.totalUpdated,
        durationMs: lastRun.durationMs,
      } : undefined,
      dbStats: {
        internationalPriceRows: rows.length,
        productsWithIntlPrice: productIds.size,
        sources: Array.from(sourceMap.entries()).map(([source, v]) => ({ source, ...v })),
      },
      sourcesSupported: PRICE_SOURCES,
    };
  }
}

// ==================== 单例 ====================

export const priceIntelAgent = new PriceIntelAgent();
