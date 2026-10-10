/**
 * 《采集数据上架》审核服务层
 *
 * 路由（`src/app/api/admin/raw-listings/**`）只做 HTTP 适配，全部业务逻辑在本文件。
 * 覆盖：列表 / 单条详情 / 单条动作 / 批量动作 / 重新评估。
 *
 * 关键设计（依据 `docs/采集数据上架-T03T04设计.md` §2、§5）：
 *  - `approve` 走「claim → convert → finalize」三步防并发双建：
 *    `updateMany({ where:{id, productId:null, status∈{pending,approved,needs_review}} , data:{status:"converting"} })`，
 *    `count===0` → 409 CLAIM_FAILED。
 *  - `converting` 为瞬态占位；惰性回收：`converting` 且 `updatedAt` 早于 10 分钟视为可重抢。
 *  - `Product.status` 一律先 `draft`（convert 内部保证）；仅 `publish` 置 `active`。
 *  - 幂等：转换类动作前提 `productId == null`；`publish`/`unpublish` 要求 `productId != null`。
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { evaluateSanity, resolveEffectivePriceCny } from "./sanity";
import {
  convertListing,
  inferCategory,
  normalizeBrandName,
  probeDuplicate,
  resolveBrandForListing,
  findScoutSellerId,
} from "./convert";
import type { SanityAction, SanityContext, SanityInput, RawListingLike, PreResolvedFks } from "./types";

// ───────────────────────────────────────────────
// 领域错误（供路由映射为 HTTP 错误码）
// ───────────────────────────────────────────────

export class ReviewError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/** 将领域错误 / 未预期异常映射为标准错误信封 */
export function mapReviewError(e: unknown): {
  status: number;
  body: { success: false; error: string; code: string } & Record<string, unknown>;
} {
  if (e instanceof ReviewError) {
    return { status: e.status, body: { success: false, error: e.message, code: e.code, ...e.extra } };
  }
  return {
    status: 500,
    body: { success: false, error: e instanceof Error ? e.message : "服务器内部错误", code: "INTERNAL_ERROR" },
  };
}

// ───────────────────────────────────────────────
// 类型
// ───────────────────────────────────────────────

export interface ListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  source?: string;
  rule?: string;
  q?: string;
  orderBy?: string;
  order?: "asc" | "desc";
}

export interface RawListingListItem {
  id: string;
  source: string;
  sourceUrl: string;
  status: string;
  brandName: string;
  brandNormalized: string;
  modelName: string;
  year: number | null;
  workingHours: number | null;
  condition: string | null;
  priceRaw: number | null;
  currency: string | null;
  priceCny: number | null;
  /** 折算后的人民币价（priceCny 为空但 priceRaw/currency 可折算时非空；供前端红标口径） */
  effectivePriceCny: number | null;
  location: string;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerWechat: string | null;
  sellerWhatsapp: string | null;
  images: string | null;
  scrapedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string | null;
  productId: string | null;
  convertedAt: string | null;
  /** Option D：是否已对外展示（/overseas 栏目可见性） */
  isPublic: boolean;
  publishedAt: string | null;
  /** Option D：人工修正展示标题 / 归一品牌键 / 自由品类标签 */
  displayTitle: string | null;
  brandKey: string | null;
  categorySlug: string | null;
  /** 由 notes 解析出的命中规则名（供前端 chips） */
  reasons: string[];
}

export interface ProductBrief {
  id: string;
  status: string;
  brandId: string;
  categoryId: string;
  modelName: string;
  priceCny: number;
  images: { url: string }[];
}

export interface ListResult {
  items: RawListingListItem[];
  total: number;
  /** 全库未过滤行数（各 status 计数之和），供「全部」Tab 计数 */
  allTotal: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<string, number>;
  lookups: { sources: string[] };
}

export type SingleAction =
  | "approve"
  | "reject"
  | "reevaluate"
  | "publish"
  | "unpublish"
  /** Option D：设为/取消「去交易化只读栏目」对外展示（直接操作 RawListing.isPublic，不转 Product） */
  | "publish-to-sourced"
  | "unpublish-sourced";

export interface SingleActionInput {
  action: SingleAction;
  actorId: string;
  brandId?: string;
  categoryId?: string;
  year?: number;
  priceCny?: number;
  note?: string;
}

export interface SingleActionResult {
  action: SingleAction;
  status: string;
  /** Option D: isPublic switch result (publish-to-sourced / unpublish-sourced) */
  isPublic?: boolean;
  productId?: string | null;
  productStatus?: string | null;
  skippedReason?: string;
  missing?: string[];
}

export interface BatchActionInput {
  action: SingleAction;
  actorId: string;
  mode?: "ids" | "by_model";
  ids?: string[];
  modelName?: string;
  overrides?: { brandId?: string; categoryId?: string };
  limit?: number;
}

export interface BatchActionResult {
  results: Array<SingleActionResult & { id: string; ok: boolean }>;
  summary: Record<string, number>;
}

export const SINGLE_ACTIONS: readonly SingleAction[] = [
  "approve",
  "reject",
  "reevaluate",
  "publish",
  "unpublish",
  "publish-to-sourced",
  "unpublish-sourced",
];
const ALL_STATUSES = [
  "pending",
  "auto_rejected",
  "needs_review",
  "approved",
  "rejected",
  "converted",
  "published",
  "converting",
] as const;
const RULE_IDS = new Set([
  "domain_blacklist",
  "source_url_missing",
  "source_url_invalid",
  "model_noise",
  "price_hard_bound",
  "price_outlier",
  "no_price",
  "invalid_year",
  "brand_unmatched",
  "category_undetermined",
  "duplicate_product",
]);

/** 批量上限（老板裁决：ids ≤ 100 / by_model ≤ 200） */
export const MAX_BATCH_IDS = 100;
export const MAX_BY_MODEL = 200;
/** converting 惰性回收阈值（分钟） */
const CONVERTING_STALE_MINUTES = 10;

// ───────────────────────────────────────────────
// 行投影工具
// ───────────────────────────────────────────────

const RAW_SELECT = {
  id: true, source: true, sourceUrl: true, status: true, brandName: true, modelName: true,
  year: true, workingHours: true, condition: true, priceRaw: true, currency: true, priceCny: true,
  location: true, sellerName: true, sellerPhone: true, sellerWechat: true, sellerWhatsapp: true,
  images: true, scrapedAt: true, reviewedAt: true, reviewedBy: true, notes: true,
  productId: true, convertedAt: true,
  // Option D additive 可见性字段
  isPublic: true, publishedAt: true, displayTitle: true, brandKey: true, categorySlug: true,
} satisfies Prisma.RawListingSelect;

type RawListingRow = {
  id: string; source: string; sourceUrl: string; status: string; brandName: string; modelName: string;
  year: number | null; workingHours: number | null; condition: string | null; priceRaw: number | null;
  currency: string | null; priceCny: number | null; location: string; sellerName: string | null;
  sellerPhone: string | null; sellerWechat: string | null; sellerWhatsapp: string | null;
  images: string | null; scrapedAt: Date; reviewedAt: Date | null; reviewedBy: string | null;
  notes: string | null; productId: string | null; convertedAt: Date | null;
  isPublic: boolean; publishedAt: Date | null; displayTitle: string | null;
  brandKey: string | null; categorySlug: string | null;
};

function toListingLike(r: RawListingRow): RawListingLike {
  return {
    id: r.id, source: r.source, sourceUrl: r.sourceUrl, brandName: r.brandName, modelName: r.modelName,
    year: r.year, workingHours: r.workingHours, condition: r.condition, priceRaw: r.priceRaw,
    currency: r.currency, priceCny: r.priceCny, location: r.location, sellerName: r.sellerName,
    sellerPhone: r.sellerPhone, sellerWechat: r.sellerWechat, sellerWhatsapp: r.sellerWhatsapp,
  };
}

function toSanityInput(r: RawListingRow): SanityInput {
  return {
    source: r.source, sourceUrl: r.sourceUrl, brandName: r.brandName, modelName: r.modelName,
    year: r.year, priceRaw: r.priceRaw, currency: r.currency, priceCny: r.priceCny,
  };
}

/** 从 notes 中解析命中规则名（notes 生成格式见 sanity.ts） */
export function parseReasons(notes: string | null): string[] {
  if (!notes) return [];
  const out: string[] = [];
  const re = /([a-z][a-z_]+)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(notes)) !== null) {
    const id = m[1];
    if (RULE_IDS.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

function appendNotes(oldNotes: string | null, addition: string): string {
  const base = (oldNotes || "").trim();
  const merged = base ? `${base} ; ${addition}` : addition;
  return merged.length > 2000 ? merged.slice(merged.length - 2000) : merged; // 超长截断最旧片段
}

function mapItem(r: RawListingRow): RawListingListItem {
  return {
    id: r.id, source: r.source, sourceUrl: r.sourceUrl, status: r.status,
    brandName: r.brandName, brandNormalized: normalizeBrandName(r.brandName), modelName: r.modelName,
    year: r.year, workingHours: r.workingHours, condition: r.condition,
    priceRaw: r.priceRaw, currency: r.currency, priceCny: r.priceCny, location: r.location,
    effectivePriceCny: resolveEffectivePriceCny({ priceCny: r.priceCny, priceRaw: r.priceRaw, currency: r.currency }),
    sellerName: r.sellerName, sellerPhone: r.sellerPhone, sellerWechat: r.sellerWechat, sellerWhatsapp: r.sellerWhatsapp,
    images: r.images,
    scrapedAt: r.scrapedAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    reviewedBy: r.reviewedBy, notes: r.notes,
    productId: r.productId, convertedAt: r.convertedAt ? r.convertedAt.toISOString() : null,
    isPublic: r.isPublic,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    displayTitle: r.displayTitle,
    brandKey: r.brandKey,
    categorySlug: r.categorySlug,
    reasons: parseReasons(r.notes),
  };
}

// ───────────────────────────────────────────────
// 列表 / 详情
// ───────────────────────────────────────────────

export async function listRawListings(q: ListQuery): Promise<ListResult> {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 30));
  const status = q.status ?? "needs_review";

  const where: Prisma.RawListingWhereInput = {};
  if (status && status !== "all") where.status = status;
  if (q.source) where.source = q.source;
  if (q.rule) where.notes = { contains: q.rule };
  if (q.q) {
    where.OR = [
      { modelName: { contains: q.q } },
      { brandName: { contains: q.q } },
      { location: { contains: q.q } },
      { sourceUrl: { contains: q.q } },
    ];
  }

  const orderField = ["scrapedAt", "createdAt", "priceCny"].includes(q.orderBy ?? "") ? (q.orderBy as string) : "scrapedAt";
  const order = q.order === "asc" ? "asc" : "desc";

  const [rows, total, grouped, distinctSources] = await Promise.all([
    prisma.rawListing.findMany({
      where,
      orderBy: { [orderField]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: RAW_SELECT,
    }),
    prisma.rawListing.count({ where }),
    prisma.rawListing.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.rawListing.findMany({ select: { source: true }, distinct: ["source"], orderBy: { source: "asc" } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const s of ALL_STATUSES) statusCounts[s] = 0;
  for (const g of grouped) statusCounts[g.status] = g._count._all;

  // 全库未过滤行数 = 各 status 计数之和（grouped 无 where，零额外查询）
  const allTotal = grouped.reduce((sum, g) => sum + g._count._all, 0);

  return {
    items: (rows as RawListingRow[]).map(mapItem),
    total,
    allTotal,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    statusCounts,
    lookups: { sources: distinctSources.map((s) => s.source) },
  };
}

export async function getRawListing(
  id: string
): Promise<(RawListingListItem & { product: ProductBrief | null }) | null> {
  const r = (await prisma.rawListing.findUnique({ where: { id }, select: RAW_SELECT })) as RawListingRow | null;
  if (!r) return null;
  let product: ProductBrief | null = null;
  if (r.productId) {
    product = await prisma.product.findUnique({
      where: { id: r.productId },
      select: {
        id: true, status: true, brandId: true, categoryId: true, modelName: true, priceCny: true,
        images: { select: { url: true }, orderBy: { sortOrder: "asc" } },
      },
    });
  }
  return { ...mapItem(r), product };
}

// ───────────────────────────────────────────────
// sanity 上下文探测 + 重新评估
// ───────────────────────────────────────────────

/** 同品牌（归一后）中位人民币价 */
export async function computeBrandMedianCny(brandName: string): Promise<number | null> {
  const key = normalizeBrandName(brandName).toLowerCase();
  const rows = await prisma.rawListing.findMany({
    select: { brandName: true, priceRaw: true, currency: true, priceCny: true },
  });
  const nums: number[] = [];
  for (const r of rows) {
    if (normalizeBrandName(r.brandName).toLowerCase() !== key) continue;
    const p = resolveEffectivePriceCny({ priceCny: r.priceCny, priceRaw: r.priceRaw, currency: r.currency });
    if (p != null) nums.push(p);
  }
  if (nums.length === 0) return null;
  nums.sort((a, b) => a - b);
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

/** 探测 evaluateSanity 所需上下文（与 CLI 同源逻辑） */
export async function probeSanityContext(
  listing: RawListingLike,
  brandMedianCny: number | null,
  scoutSellerId: string | null
): Promise<SanityContext> {
  const brandRes = await resolveBrandForListing(listing.brandName);
  const catRes = await inferCategory(listing.modelName, prisma);
  let isDuplicate = false;
  const year = listing.year;
  if (scoutSellerId && brandRes.brandId && year != null && year >= 1980 && year <= new Date().getFullYear() + 1) {
    isDuplicate = await probeDuplicate(scoutSellerId, brandRes.brandId, listing.modelName.trim(), year, prisma);
  }
  return {
    brandMatched: brandRes.matched,
    categoryInferable: catRes.matched && !catRes.usedFallback,
    brandMedianCny,
    isDuplicate,
  };
}

function actionToStatus(action: SanityAction): string {
  if (action === "auto_reject") return "auto_rejected";
  if (action === "needs_review") return "needs_review";
  return "approved";
}

/** 重新评估单条：重跑 sanity 并按结果回写状态 */
export async function reevaluateOne(
  id: string,
  actorId = "auto"
): Promise<{ action: SanityAction; status: string; reasons: string[]; notes: string }> {
  const r = (await prisma.rawListing.findUnique({ where: { id }, select: RAW_SELECT })) as RawListingRow | null;
  if (!r) throw new ReviewError(404, "NOT_FOUND", "采集记录不存在");
  const median = await computeBrandMedianCny(r.brandName);
  const scoutSellerId = await findScoutSellerId(prisma);
  const ctx = await probeSanityContext(toListingLike(r), median, scoutSellerId);
  const res = evaluateSanity(toSanityInput(r), ctx);
  const status = actionToStatus(res.action);
  const now = new Date();
  await prisma.rawListing.update({
    where: { id },
    data: { status, reviewedAt: now, reviewedBy: actorId, notes: res.notes },
  });
  return { action: res.action, status, reasons: res.reasons, notes: res.notes };
}

// ───────────────────────────────────────────────
// 单条动作
// ───────────────────────────────────────────────

async function unresolvedBrandName(brandId: string): Promise<string> {
  const b = await prisma.brand.findUnique({ where: { id: brandId }, select: { nameZh: true } });
  return b?.nameZh ?? "";
}
async function unresolvedCategoryName(categoryId: string): Promise<string> {
  const c = await prisma.category.findUnique({ where: { id: categoryId }, select: { nameZh: true } });
  return c?.nameZh ?? "";
}

export async function applySingleAction(id: string, input: SingleActionInput): Promise<SingleActionResult> {
  switch (input.action) {
    case "approve":
      return approveOne(id, input);
    case "reject":
      return rejectOne(id, input);
    case "reevaluate": {
      const r = await reevaluateOne(id, input.actorId);
      return { action: "reevaluate", status: r.status };
    }
    case "publish":
      return setPublishState(id, input, true);
    case "unpublish":
      return setPublishState(id, input, false);
    case "publish-to-sourced":
      return setSourcedPublic(id, input, true);
    case "unpublish-sourced":
      return setSourcedPublic(id, input, false);
    default:
      throw new ReviewError(400, "VALIDATION_ERROR", `未知动作：${String(input.action)}`);
  }
}

/**
 * Option D —— 设置 / 取消「去交易化只读栏目」对外展示。
 *
 * 直接操作 `RawListing.isPublic` / `publishedAt`，**不生成 Product、不触碰 status 转换链路**。
 * 与既有 `publish/unpublish`（Product 路径）完全解耦：采集数据从此分两路——
 *   - 转 Product（自营货架 /products，既有链路，保持不变）；
 *   - 仅对外展示（只读 /overseas，本动作，新增）。
 */
async function setSourcedPublic(id: string, input: SingleActionInput, makePublic: boolean): Promise<SingleActionResult> {
  const existing = (await prisma.rawListing.findUnique({ where: { id }, select: RAW_SELECT })) as RawListingRow | null;
  if (!existing) throw new ReviewError(404, "NOT_FOUND", "采集记录不存在");
  const now = new Date();
  await prisma.rawListing.update({
    where: { id },
    data: {
      isPublic: makePublic,
      publishedAt: makePublic ? now : null,
      reviewedBy: input.actorId,
      reviewedAt: now,
      notes: appendNotes(
        existing.notes,
        `[sourced] ${makePublic ? "published" : "unpublished"} by ${input.actorId}${input.note ? `: ${input.note}` : ""}`
      ),
    },
  });
  return {
    action: makePublic ? "publish-to-sourced" : "unpublish-sourced",
    status: makePublic ? "sourced_published" : "sourced_unpublished",
    isPublic: makePublic,
  };
}

async function approveOne(id: string, input: SingleActionInput): Promise<SingleActionResult> {
  const existing = (await prisma.rawListing.findUnique({ where: { id }, select: RAW_SELECT })) as RawListingRow | null;
  if (!existing) throw new ReviewError(404, "NOT_FOUND", "采集记录不存在");
  if (existing.productId) throw new ReviewError(409, "ALREADY_CONVERTED", "该采集记录已生成产品");

  const now = new Date();
  const staleBefore = new Date(Date.now() - CONVERTING_STALE_MINUTES * 60 * 1000);

  // ── 1) claim（防并发双建；含 converting 惰性回收）──
  const claimData: Prisma.RawListingUpdateManyMutationInput = {
    status: "converting",
    reviewedBy: input.actorId,
    reviewedAt: now,
  };
  if (input.year != null) claimData.year = input.year;
  if (input.priceCny != null) claimData.priceCny = input.priceCny;

  const claim = await prisma.rawListing.updateMany({
    where: {
      id,
      productId: null,
      OR: [
        { status: { in: ["pending", "approved", "needs_review"] } },
        { status: "converting", updatedAt: { lt: staleBefore } }, // 惰性回收卡死行
      ],
    },
    data: claimData,
  });
  if (claim.count === 0) {
    const reread = await prisma.rawListing.findUnique({ where: { id }, select: { productId: true, status: true } });
    if (reread?.productId) throw new ReviewError(409, "ALREADY_CONVERTED", "该采集记录已生成产品");
    throw new ReviewError(409, "CLAIM_FAILED", "并发抢占失败，请刷新后重试");
  }

  // claim 成功后重新读取（含 overrides 已写入的 year/priceCny）
  const row = (await prisma.rawListing.findUnique({ where: { id }, select: RAW_SELECT })) as RawListingRow;

  const release = async (reason: string) => {
    await prisma.rawListing.update({
      where: { id },
      data: { status: "needs_review", reviewedBy: input.actorId, reviewedAt: new Date(), notes: appendNotes(row.notes, `[convert-skip] ${reason}`) },
    });
  };

  try {
    // ── 2) 外键解析（人工指定优先）──
    const brandRes = await resolveBrandForListing(row.brandName);
    const brandId = input.brandId ?? brandRes.brandId;
    if (!brandId) {
      await release("brandId 无法确定（请人工指定品牌）");
      throw new ReviewError(422, "FK_UNRESOLVED", "品牌无法确定，请人工指定", { missing: ["brandId"] });
    }

    const catRes = await inferCategory(row.modelName, prisma);
    const categoryId = input.categoryId ?? catRes.categoryId;
    if (!categoryId) {
      await release("categoryId 无法确定（请人工指定品类）");
      throw new ReviewError(422, "FK_UNRESOLVED", "品类无法确定，请人工指定", { missing: ["categoryId"] });
    }

    const year = row.year;
    if (year == null || year < 1980 || year > new Date().getFullYear() + 1) {
      await release(`year 非法或缺失（${year == null ? "null" : year}）`);
      throw new ReviewError(422, "FIELD_REQUIRED", "年份缺失或非法，请人工补全", { field: "year" });
    }

    const fks: PreResolvedFks = {
      brandId,
      brandDisplayName: input.brandId ? await unresolvedBrandName(brandId) : (brandRes.displayName ?? brandRes.normalized),
      categoryId,
      categoryDisplayName: input.categoryId ? await unresolvedCategoryName(categoryId) : (catRes.displayName ?? ""),
      usedCategoryFallback: input.categoryId ? false : catRes.usedFallback,
    };

    // ── 3) convert ──
    const conv = await convertListing(toListingLike(row), prisma, fks);
    if (conv.status === "converted") {
      const finalized = await prisma.rawListing.update({
        where: { id },
        data: {
          status: "converted",
          productId: conv.productId,
          convertedAt: new Date(),
          reviewedBy: input.actorId,
          reviewedAt: new Date(),
          notes: appendNotes(row.notes, `[review] approved by ${input.actorId}${input.note ? `: ${input.note}` : ""}`),
        },
      });
      void finalized;
      return { action: "approve", status: "converted", productId: conv.productId, productStatus: "draft" };
    }

    // skip → 回落 needs_review
    await release(conv.reason);
    return { action: "approve", status: "needs_review", skippedReason: conv.reason };
  } catch (e) {
    if (e instanceof ReviewError) throw e;
    // 未预期异常：尽量把 converting 释放回 needs_review
    try {
      await release(`未预期异常：${e instanceof Error ? e.message : String(e)}`);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

async function rejectOne(id: string, input: SingleActionInput): Promise<SingleActionResult> {
  const existing = (await prisma.rawListing.findUnique({ where: { id }, select: RAW_SELECT })) as RawListingRow | null;
  if (!existing) throw new ReviewError(404, "NOT_FOUND", "采集记录不存在");
  if (existing.productId) throw new ReviewError(409, "STATE_CONFLICT", "已生成产品的记录不可拒绝（如需下线请用 unpublish）");
  const now = new Date();
  await prisma.rawListing.update({
    where: { id },
    data: {
      status: "rejected",
      reviewedBy: input.actorId,
      reviewedAt: now,
      notes: appendNotes(existing.notes, `[review] rejected${input.note ? `: ${input.note}` : ""} by ${input.actorId}`),
    },
  });
  return { action: "reject", status: "rejected" };
}

async function setPublishState(id: string, input: SingleActionInput, publish: boolean): Promise<SingleActionResult> {
  const existing = (await prisma.rawListing.findUnique({ where: { id }, select: RAW_SELECT })) as RawListingRow | null;
  if (!existing) throw new ReviewError(404, "NOT_FOUND", "采集记录不存在");
  if (!existing.productId) throw new ReviewError(409, "STATE_CONFLICT", "该记录尚未生成产品，无法发布/下线");
  const now = new Date();
  await prisma.product.update({ where: { id: existing.productId }, data: { status: publish ? "active" : "draft" } });
  await prisma.rawListing.update({
    where: { id },
    data: {
      status: publish ? "published" : "converted",
      reviewedBy: input.actorId,
      reviewedAt: now,
      notes: appendNotes(existing.notes, `[review] ${publish ? "published" : "unpublished"} by ${input.actorId}`),
    },
  });
  return {
    action: publish ? "publish" : "unpublish",
    status: publish ? "published" : "converted",
    productId: existing.productId,
    productStatus: publish ? "active" : "draft",
  };
}

// ───────────────────────────────────────────────
// 批量动作
// ───────────────────────────────────────────────

export async function applyBatchAction(input: BatchActionInput): Promise<BatchActionResult> {
  const mode = input.mode ?? "ids";
  const overrides = input.overrides ?? {};
  let ids: string[] = [];

  if (mode === "by_model") {
    const modelName = (input.modelName || "").trim();
    if (!modelName) throw new ReviewError(400, "VALIDATION_ERROR", "mode=by_model 需要 modelName");
    const limit = Math.min(MAX_BY_MODEL, Math.max(1, Number(input.limit) || MAX_BY_MODEL));
    const found = await prisma.rawListing.findMany({
      where: { modelName: modelName, productId: null, status: { in: ["pending", "approved", "needs_review"] } },
      select: { id: true },
      take: limit + 1,
    });
    if (found.length > limit) {
      throw new ReviewError(422, "TOO_MANY_IDS", `同型号匹配超过上限 ${limit} 条，请缩小范围`, { limit });
    }
    ids = found.map((f) => f.id);
  } else {
    ids = Array.isArray(input.ids) ? input.ids : [];
    if (ids.length > MAX_BATCH_IDS) {
      throw new ReviewError(422, "TOO_MANY_IDS", `单次 ids 数量超过上限 ${MAX_BATCH_IDS}`, { limit: MAX_BATCH_IDS });
    }
  }

  if (ids.length === 0) throw new ReviewError(400, "VALIDATION_ERROR", "未选中任何记录");

  const results: Array<SingleActionResult & { id: string; ok: boolean }> = [];
  let ok = 0;
  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      const r = await applySingleAction(id, {
        action: input.action,
        actorId: input.actorId,
        brandId: overrides.brandId,
        categoryId: overrides.categoryId,
      });
      const isOk = r.status === "converted" || r.status === "published" || r.status === "rejected" || r.status === "sourced_published" || r.status === "sourced_unpublished";
      if (isOk) ok++;
      if (r.status === "converted") converted++;
      if (r.skippedReason) skipped++;
      results.push({ id, ok: isOk, ...r });
    } catch (e) {
      failed++;
      const msg = e instanceof ReviewError ? e.message : e instanceof Error ? e.message : String(e);
      results.push({ id, ok: false, action: input.action, status: "failed", skippedReason: msg });
    }
  }

  return { results, summary: { total: ids.length, ok, converted, skipped, failed } };
}
