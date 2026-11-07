/**
 * .cn 补贴库 C 档明文 —— 独立通道 + 独立守卫（纯函数层）
 * ===========================================================================
 * 本模块是**与公开聚合层完全解耦的第二条通道**：不 import 聚合层模块，不复用其
 * 任何护栏符号，也不复用其错误类型。公开层面向 k-匿名聚合值，本通道面向逐行
 * 原始公示明细，二者语义相反，必须各自持有独立的守卫与错误类。
 *
 * 依赖方向（单向，无环）：
 *   raw-detail.ts  ──import type/函数──▶  raw-mode.ts ──▶ @/config/site
 *   raw-identity.ts ──▶ raw-detail.ts（只取 RawViewer / RawIdentitySource 类型）
 *   ❌ raw-detail.ts 绝不 import raw-identity.ts
 *
 * 关联键：6 元组 (batchCode, manufacturer, category, modelName, province,
 * purchaseDate.year)。厂家条件用 entry.manufacturer（schema L2523），不是
 * entry.brandName（schema L2520）——两列当前相等，但品牌归并是后续人工步骤。
 * 严禁用 contentHash 关联两表：catalog 是分组 MD5，raw 是逐行 MD5，语义不同。
 *
 * 时区：统一 UTC 年边界 Date.UTC(y,0,1) / Date.UTC(y+1,0,1)，再用
 * getUTCFullYear() 二次过滤，最后做严格计数断言 total === expectedSampleSize
 * （无容差）；不等 → consistent:false + 空 rows（不抛）= fail-closed「暂无明细」。
 *
 * 单测零 IO：模块顶层不 import 数据库；queryRawDetail 内部才动态 import，
 * 因此纯函数（组键 / 边界 / UTC 过滤 / 计数断言 / 门禁）可在无库环境直接跑。
 */

import { clampPageSize, getRawFeatureConfig, isRawMode } from "./raw-mode";
import type { RawMode } from "./raw-mode";

/* ─────────────────────────── 契约类型 ─────────────────────────── */

/** 身份来源标记。规范定义放在本模块（与 RawViewer 同处），由 raw-identity.ts 重导出。 */
export type RawIdentitySource = "db_user" | "public" | "wecom_jwt" | "miniapp_jwt";

export type RawDenyReason =
  | "site_not_cn"
  | "mode_off"
  | "mode_invalid"
  | "login_required"
  | "role_denied"
  | "locale_denied";

/** 独立错误类型：只用于 API 层把 denied 决策映射为 404/401，绝不复用其它错误类。 */
export class RawDetailForbiddenError extends Error {
  readonly reason: RawDenyReason;

  constructor(reason: RawDenyReason) {
    super(`补贴原始明细访问被拒绝：${reason}`);
    this.name = "RawDetailForbiddenError";
    this.reason = reason;
    Object.setPrototypeOf(this, RawDetailForbiddenError.prototype);
  }
}

export interface RawViewer {
  userId: string | null;
  role: string | null;
  isActive: boolean;
  anonKeyHash: string | null;
  identitySource: RawIdentitySource;
  subject: string | null;
}

export interface RawGateContext {
  site: "cn" | "com";
  mode: RawMode;
  /** v1.2 §12.2：nullable；null 表示未登录 / 身份解析失败。 */
  viewer: RawViewer | null;
  /** Q9：默认仅 "zh" 放行明细。 */
  locale: string;
}

export type RawGateDecision =
  | { showRaw: false; reason: RawDenyReason }
  | { showRaw: true; mode: "login" | "public" };

/** 与 Prisma SubsidyCatalog 模型结构兼容的最小输入（本纯函数层不依赖生成客户端）。 */
export interface SubsidyCatalog {
  batchCode: string;
  manufacturer: string;
  brandName: string;
  category: string;
  modelName: string;
  province: string;
  policyYear: number;
  sampleSize: number;
}

export interface SubsidyGroupKey {
  batchCode: string;
  manufacturer: string;
  category: string;
  modelName: string;
  province: string;
  policyYear: number;
}

/** §3.1 白名单（展示 + 条件展示）；id / goodsRegion / contentHash / createdAt 不进结果。 */
export interface RawDetailRow {
  batchCode: string;
  sourceFile: string | null;
  province: string;
  county: string;
  township: string;
  buyerName: string;
  manufacturer: string;
  category: string;
  productName: string;
  modelName: string;
  quantity: number;
  dealer: string;
  purchaseDate: string;
  salePriceCny: number;
  centralSubsidyCny: number | null;
  totalSubsidyCny: number | null;
  serialNo: string | null;
  status: string;
}

/** queryRawDetail 内部使用的数据库行形状（Date 尚未序列化）。 */
interface RawDetailDbRow {
  batchCode: string;
  sourceFile: string;
  province: string;
  county: string;
  township: string;
  buyerName: string;
  manufacturer: string;
  category: string;
  productName: string;
  modelName: string;
  quantity: number;
  dealer: string;
  purchaseDate: Date;
  salePriceCny: number;
  centralSubsidyCny: number | null;
  totalSubsidyCny: number | null;
  serialNo: string;
  status: string;
}

export interface RawDetailQuery {
  key: SubsidyGroupKey;
  expectedSampleSize: number;
  page: number;
  pageSize: number;
}

export interface RawDetailResult {
  rows: RawDetailRow[];
  total: number;
  page: number;
  pageSize: number;
  /** total === expectedSampleSize；false 时 rows 必为空（fail-closed）。 */
  consistent: boolean;
}

/* ─────────────────────────── 门禁（6 道 fail-closed） ─────────────────────────── */

function deny(reason: RawDenyReason): RawGateDecision {
  return { showRaw: false, reason };
}

/**
 * 六道 fail-closed 判定，顺序固定：站点 → 模式合法性 → off → 语言 → 登录 → 角色。
 * 绝不抛异常给页面；调用方据 decision 决定是否额外渲染明文区（匿名/off 不 302）。
 */
export function assertRawDetailAllowed(ctx: RawGateContext): RawGateDecision {
  if (ctx.site !== "cn") return deny("site_not_cn");
  if (!isRawMode(ctx.mode)) return deny("mode_invalid");
  if (ctx.mode === "off") return deny("mode_off");
  if (ctx.locale !== "zh") return deny("locale_denied");

  if (ctx.mode === "login") {
    const viewer = ctx.viewer;
    if (viewer === null || viewer.isActive !== true) return deny("login_required");
    const roles = getRawFeatureConfig().roles;
    if (roles.length > 0) {
      const role = viewer.role;
      if (role === null || !roles.includes(role)) return deny("role_denied");
    }
  }

  return { showRaw: true, mode: ctx.mode === "public" ? "public" : "login" };
}

/** 给 API 层用：把 denied 决策转成独立错误类型（页面层请直接用上面的 decision）。 */
export function assertRawDetailAllowedOrThrow(
  ctx: RawGateContext
): { showRaw: true; mode: "login" | "public" } {
  const decision = assertRawDetailAllowed(ctx);
  if (!decision.showRaw) throw new RawDetailForbiddenError(decision.reason);
  return decision;
}

/* ─────────────────────────── 组键 ─────────────────────────── */

export function resolveGroupKey(entry: SubsidyCatalog): SubsidyGroupKey {
  return {
    batchCode: entry.batchCode,
    manufacturer: entry.manufacturer,
    category: entry.category,
    modelName: entry.modelName,
    province: entry.province,
    policyYear: entry.policyYear,
  };
}

/** 服务端下钻禁用键：县 / 乡 / 购机者 / 出厂编号 / 源文件 / 单条标识 / 去重哈希。 */
export const RAW_QUERY_FORBIDDEN_KEYS: readonly string[] = [
  "county",
  "township",
  "buyername",
  "serialno",
  "sourcefile",
  "id",
  "contenthash",
];

/** 纯函数：检测是否混入 PII / 单条 / 哈希类下钻键。 */
export function hasForbiddenRawQueryKeys(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (RAW_QUERY_FORBIDDEN_KEYS.includes(key.toLowerCase())) return true;
  }
  return false;
}

/* ─────────────────────────── UTC 边界与计数断言（可单测纯函数） ─────────────────────────── */

export interface RawDetailWhere {
  batchCode: string;
  manufacturer: string;
  category: string;
  modelName: string;
  province: string;
  goodsRegion: string;
  purchaseDate: { gte: Date; lt: Date };
}

/** 纯函数：构造 6 元组 + goodsRegion + UTC 年边界的查询条件，绝不含 contentHash。 */
export function buildRawDetailWhere(key: SubsidyGroupKey): RawDetailWhere {
  const year = key.policyYear;
  return {
    batchCode: key.batchCode,
    manufacturer: key.manufacturer,
    category: key.category,
    modelName: key.modelName,
    province: key.province,
    goodsRegion: "cn",
    purchaseDate: {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    },
  };
}

/** 纯函数：按 UTC 年取值；无效日期返回 null（会被二次过滤剔除）。 */
export function utcYearOf(value: Date | string): number | null {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : date.getUTCFullYear();
}

/** 纯函数：UTC 二次过滤，与 Python naive datetime.year 同口径；禁用本地时区方法。 */
export function filterRowsByUtcYear<T extends { purchaseDate: Date | string }>(
  rows: readonly T[],
  policyYear: number
): T[] {
  return rows.filter((row) => utcYearOf(row.purchaseDate) === policyYear);
}

/** 纯函数：严格计数断言，无容差；任一非整数 / 负数也判不一致。 */
export function isRawDetailConsistent(total: number, expectedSampleSize: number): boolean {
  if (!Number.isInteger(total) || total < 0) return false;
  if (!Number.isInteger(expectedSampleSize) || expectedSampleSize < 0) return false;
  return total === expectedSampleSize;
}

export function normalizePage(page: number): number {
  if (!Number.isFinite(page) || !Number.isInteger(page) || page < 1) return 1;
  return page;
}

function formatPurchaseDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toRawDetailRow(row: RawDetailDbRow): RawDetailRow {
  return {
    batchCode: row.batchCode,
    sourceFile: row.sourceFile ?? null,
    province: row.province,
    county: row.county,
    township: row.township,
    buyerName: row.buyerName,
    manufacturer: row.manufacturer,
    category: row.category,
    productName: row.productName,
    modelName: row.modelName,
    quantity: row.quantity,
    dealer: row.dealer,
    purchaseDate: formatPurchaseDate(row.purchaseDate),
    salePriceCny: row.salePriceCny,
    centralSubsidyCny: row.centralSubsidyCny ?? null,
    totalSubsidyCny: row.totalSubsidyCny ?? null,
    serialNo: row.serialNo ?? null,
    status: row.status,
  };
}

/** §3.1 白名单 select；id / goodsRegion / contentHash / createdAt 一律不取。 */
export const RAW_DETAIL_SELECT = {
  batchCode: true,
  sourceFile: true,
  province: true,
  county: true,
  township: true,
  buyerName: true,
  manufacturer: true,
  category: true,
  productName: true,
  modelName: true,
  quantity: true,
  dealer: true,
  purchaseDate: true,
  salePriceCny: true,
  centralSubsidyCny: true,
  totalSubsidyCny: true,
  serialNo: true,
  status: true,
} as const;

/**
 * 纯函数：把「UTC 二次过滤 + 计数断言」收口成最终出站结果。
 * consistent:false ⇒ rows 必为空，绝不拿聚合值冒充明文。
 * 本函数不碰数据库，单测可全覆盖（含 total≠sampleSize 分支）。
 */
export function finalizeRawDetailResult(
  candidates: readonly RawDetailRow[],
  total: number,
  q: RawDetailQuery
): RawDetailResult {
  const page = normalizePage(q.page);
  const pageSize = clampPageSize(q.pageSize);
  const consistent = isRawDetailConsistent(total, q.expectedSampleSize);
  const rows = consistent ? filterRowsByUtcYear(candidates, q.key.policyYear) : [];
  return { rows: [...rows], total, page, pageSize, consistent };
}

/* ─────────────────────────── 数据库通道（唯一 IO 出口） ─────────────────────────── */

/**
 * 查询某 6 元组下的原始公示明细。
 * 任一步失败 / 混入禁用键 → fail-closed 返回空 rows + consistent:false，不抛。
 * 数据库只在函数内动态 import，模块顶层零 IO，保证纯函数单测不连库。
 */
export async function queryRawDetail(q: RawDetailQuery): Promise<RawDetailResult> {
  const page = normalizePage(q.page);
  const pageSize = clampPageSize(q.pageSize);
  const failClosed = (): RawDetailResult => ({
    rows: [],
    total: 0,
    page,
    pageSize,
    consistent: false,
  });

  if (hasForbiddenRawQueryKeys(q.key)) {
    console.warn("[subsidy-raw] 检测到禁用下钻键，fail-closed 返回空明细");
    return failClosed();
  }

  const where = buildRawDetailWhere(q.key);
  try {
    const { prisma } = await import("@/lib/db");
    const [total, rawRows] = await Promise.all([
      prisma.subsidyRecordRaw.count({ where }),
      prisma.subsidyRecordRaw.findMany({
        where,
        select: RAW_DETAIL_SELECT,
        orderBy: [{ purchaseDate: "asc" as const }, { id: "asc" as const }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const candidates = (rawRows as unknown as RawDetailDbRow[]).map(toRawDetailRow);
    return finalizeRawDetailResult(candidates, total, { ...q, page, pageSize });
  } catch (error) {
    console.warn("[subsidy-raw] 明细查询失败，fail-closed 返回空明细", error);
    return failClosed();
  }
}
