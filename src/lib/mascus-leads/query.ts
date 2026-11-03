/**
 * mascus 线索池查询服务层（读取侧）
 *
 * 路由（`src/app/api/admin/mascus-listings/**`）只做 HTTP 适配，全部业务逻辑在本文件。
 * 覆盖：列表 / 按卖家聚合 / 按品牌聚合 / 单条详情 / 单条更新。
 *
 * 🔴 本表存在的**前提**就是「不按价格过滤」：
 *   mascus 只有约 57% 的挂牌有价（hay-and-forage 段低到 2.5%），但 95% 都带卖家电话。
 *   因此本文件任何筛选/排序都**不得把无价行默认丢掉**，否则等于把线索池最核心的部分扔掉。
 *   同理：`priceEuro` 排序必须 **null-last**（Postgres `desc` 默认 NULLS FIRST，会把无价行顶到最前）。
 *
 * 分层约定（与 `src/lib/raw-listing/review.ts` 一致）：
 *   - 领域错误用 `MascusQueryError`，路由用 `mapMascusError` 映射成 HTTP 信封；
 *   - 列表返回**只给掩码电话**（`maskPhone`），明文只在单条详情里给（且必须先写 PII 审计）。
 */
import { Prisma } from "@prisma/client";
import type { MascusListing } from "@prisma/client";
import { prisma } from "@/lib/db";
import { maskPhone } from "@/lib/pii";
import { MASCUS_SCAN_SEGMENTS } from "./parse";
import { describePhoneVariants, normalizePhoneKey } from "./phone";

// ───────────────────────────────────────────────
// 领域错误（供路由映射为 HTTP 错误码）
// ───────────────────────────────────────────────

export class MascusQueryError extends Error {
  constructor(message: string, public status = 400, public code = "VALIDATION_ERROR") {
    super(message);
    // 让 instanceof 在 ES5 目标下也成立（Next 编译目标不一定保留原型链）
    Object.setPrototypeOf(this, MascusQueryError.prototype);
    this.name = "MascusQueryError";
  }
}

/** 将领域错误 / 未预期异常映射为标准错误信封 */
export function mapMascusError(e: unknown): {
  status: number;
  body: { success: false; error: string; code: string };
} {
  if (e instanceof MascusQueryError) {
    return { status: e.status, body: { success: false, error: e.message, code: e.code } };
  }
  return {
    status: 500,
    body: {
      success: false,
      error: e instanceof Error ? e.message : "服务器内部错误",
      code: "INTERNAL_ERROR",
    },
  };
}

// ───────────────────────────────────────────────
// 常量与类型
// ───────────────────────────────────────────────

/** 跟进状态取值域（与 Dealer.followStatus 保持一致） */
export const MASCUS_FOLLOW_STATUSES = [
  "未联系",
  "已联系",
  "已回复",
  "已报价",
  "已成交",
  "已放弃",
] as const;
export type MascusFollowStatus = (typeof MASCUS_FOLLOW_STATUSES)[number];

/** 可被分配线索的 DB 角色（editor 也可作负责人，但**不能**访问后台） */
export const MASCUS_ASSIGNEE_ROLES = ["admin", "super_admin", "editor"] as const;

/** 「还在挂」判据窗口：`lastSeenAt >= now - 3 天` */
const ACTIVE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** 单页默认 30、上限 100（与 review.ts 同口径） */
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

/** 允许的排序字段白名单（非法值一律回落 `listedAt desc`） */
export const MASCUS_ORDER_FIELDS = ["listedAt", "lastSeenAt", "priceEuro", "year"] as const;
export type MascusOrderField = (typeof MASCUS_ORDER_FIELDS)[number];

/** `assignedTo` 的特殊取值：筛选「未分配」 */
export const UNASSIGNED_TOKEN = "unassigned";

/** 卖家聚合：单次 findMany 的行数阈值（超过则先取候选电话再反查） */
const SELLER_SAMPLE_LIMIT = 5000;
/** 卖家聚合：候选电话数量上限（按挂牌数降序取） */
const SELLER_CANDIDATE_LIMIT = 300;
/** 卖家聚合：返回分组数量上限 */
const SELLER_GROUP_LIMIT = 200;

export interface MascusListQuery {
  page?: number;
  pageSize?: number;
  /** 模糊搜 brandName / modelName / companyName */
  q?: string;
  /** `scanSegment` 精确 */
  segment?: string;
  /** `companyCountry` 精确 */
  country?: string;
  /** 只看有电话的 */
  hasPhone?: boolean;
  /** 只看 `lastSeenAt >= now-3天`（「还在挂」） */
  onlyActive?: boolean;
  /** `followStatus` 精确 */
  followStatus?: string;
  /** userId 精确；特殊值 `"unassigned"` 表示未分配 */
  assignedTo?: string;
  orderBy?: MascusOrderField | string;
  order?: "asc" | "desc";
}

export interface MascusListItem {
  id: string;
  productId: string;
  brandName: string | null;
  modelName: string | null;
  year: number | null;
  priceEuro: number | null;
  priceOriginal: number | null;
  priceCurrency: string | null;
  /** 🔴 列表**只给掩码**，明文只在单条详情接口（写审计后）下发 */
  sellerPhoneMasked: string | null;
  hasPhone: boolean;
  companyName: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  scanSegment: string | null;
  assetUrl: string | null;
  imageUrl: string | null;
  listedAt: Date | null;
  lastSeenAt: Date;
  followStatus: string;
  assignedTo: string | null;
  assignedToName: string | null;
  note: string | null;
}

export interface MascusAssigneeLookup {
  id: string;
  label: string;
}

export interface MascusListResult {
  items: MascusListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /**
   * followStatus 各档计数（供 Tab）：排除 followStatus 自身条件，但**保留 assignedTo**
   * 等其余筛选 —— 「我的线索」视图下的 Tab 计数不能是全库口径。
   */
  statusCounts: Record<string, number>;
  lookups: {
    /** 5 个扫描段 key */
    segments: string[];
    /** 库内实际出现过的 companyCountry（去重排序） */
    countries: string[];
    /** 可被分配的用户 */
    assignees: MascusAssigneeLookup[];
  };
}

/**
 * 按卖家聚合的返回分组。
 *
 * 🔴 本视图属「列表」性质，**不下发任何明文电话**：
 *   归一 key 与各种原始写法一律经 `maskPhone` 掩码后再下发；
 *   明文卖家电话只能走 `GET /api/admin/mascus-listings/[id]`（后端先写 PII 审计）。
 *   前端要看明文，用 `sampleListingId` 调详情接口。
 */
export interface MascusSellerGroup {
  /** 归一 key 的掩码，禁止下发可拨号明文；仅用于展示，**不可**用于分组/排序（掩码会碰撞） */
  phoneKeyMasked: string;
  /** 各原始写法的掩码 + 出现次数；数组长度＝写法种数（供「同号不同写法」提示，必须保留） */
  phoneVariants: { masked: string; count: number }[];
  /** 桶内任一条线索 id：供前端调详情接口查看明文电话（会写 PII 审计） */
  sampleListingId: string;
  companyName: string | null;
  locationCountry: string | null;
  locationCity: string | null;
  listingCount: number;
  brands: string[];
  segments: string[];
  priceMinEuro: number | null;
  priceMaxEuro: number | null;
  latestListedAt: Date | null;
  maxLastSeenAt: Date;
  sampleAssetUrl: string | null;
  assignedTo: string | null;
  followStatus: string;
}

export interface MascusBrandGroup {
  brandName: string;
  listingCount: number;
  withPhoneCount: number;
}

/** 单条详情（🔴 含**明文** `sellerPhone`，只允许在写完 PII 审计后下发） */
export type MascusListingDetail = MascusListing & { assignedToName: string | null };

export interface MascusUpdateInput {
  followStatus?: string;
  assignedTo?: string | null;
  note?: string | null;
}

// ───────────────────────────────────────────────
// 行投影
// ───────────────────────────────────────────────

/** 列表用投影（含 `sellerPhone` 只是为了就地掩码，**绝不下发**） */
export const MASCUS_LIST_SELECT = {
  id: true,
  productId: true,
  brandName: true,
  modelName: true,
  year: true,
  priceEuro: true,
  priceOriginal: true,
  priceCurrency: true,
  sellerPhone: true,
  companyName: true,
  locationCity: true,
  locationCountry: true,
  scanSegment: true,
  assetUrl: true,
  imageUrl: true,
  listedAt: true,
  lastSeenAt: true,
  followStatus: true,
  assignedTo: true,
  note: true,
} satisfies Prisma.MascusListingSelect;

type MascusListRow = Prisma.MascusListingGetPayload<{ select: typeof MASCUS_LIST_SELECT }>;

/** 卖家聚合用投影（比列表多要 `assignedTo`/`followStatus`，少要价格原币种等） */
const SELLER_SELECT = {
  id: true,
  productId: true,
  brandName: true,
  year: true,
  priceEuro: true,
  sellerPhone: true,
  companyName: true,
  locationCountry: true,
  locationCity: true,
  scanSegment: true,
  assetUrl: true,
  listedAt: true,
  lastSeenAt: true,
  followStatus: true,
  assignedTo: true,
} satisfies Prisma.MascusListingSelect;

type SellerRow = Prisma.MascusListingGetPayload<{ select: typeof SELLER_SELECT }>;

// ───────────────────────────────────────────────
// where / orderBy 构造（导出以便单测直接断言口径）
// ───────────────────────────────────────────────

/**
 * 构造基础筛选（不含 followStatus / assignedTo）。
 *
 * 单独拆出是为了 `statusCounts`：Tab 计数必须**忽略** followStatus 本身，
 * 否则每个 Tab 只会显示自己的数量、其余为 0。
 */
export function buildMascusBaseWhere(q: MascusListQuery): Prisma.MascusListingWhereInput {
  const where: Prisma.MascusListingWhereInput = {};

  if (q.segment) where.scanSegment = q.segment;
  if (q.country) where.companyCountry = q.country;
  // 🔴 只在显式要求「有电话」时收紧；默认不过滤，否则会丢掉无价无电话之外的全部线索
  if (q.hasPhone === true) where.sellerPhone = { not: null };
  if (q.onlyActive === true) where.lastSeenAt = { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) };

  const term = typeof q.q === "string" ? q.q.trim() : "";
  if (term.length > 0) {
    where.OR = [
      { brandName: { contains: term, mode: "insensitive" } },
      { modelName: { contains: term, mode: "insensitive" } },
      { companyName: { contains: term, mode: "insensitive" } },
    ];
  }

  return where;
}

/** 在基础筛选上追加跟进相关条件（followStatus / assignedTo） */
export function withFollowFilters(
  where: Prisma.MascusListingWhereInput,
  q: MascusListQuery
): Prisma.MascusListingWhereInput {
  const next: Prisma.MascusListingWhereInput = { ...where };
  if (q.followStatus) next.followStatus = q.followStatus;
  if (q.assignedTo) {
    next.assignedTo = q.assignedTo === UNASSIGNED_TOKEN ? null : q.assignedTo;
  }
  return next;
}

/**
 * 构造 orderBy（白名单 + **null-last**）。
 *
 * 🔴 null-last 的理由：Postgres 的 `ORDER BY col DESC` 默认是 **NULLS FIRST**，
 * 于是「按价格从高到低」会把**所有无价行**排到第一页 —— 而本表 43% 的行无价，
 * 一页 30 条会被无价行彻底占满，运营会以为「线索池里全是没价的」。
 *
 * Prisma 的 `SortOrderInput.nulls` 直接编译成 SQL `NULLS LAST`（Postgres 原生语法），
 * 因此用**单次查询**即可，不需要「两次查询拼接」。`listedAt` / `year` 同为可空列，
 * 同理必须显式 null-last，否则默认排序（`listedAt desc`）也会让缺挂牌时间的行顶到最前。
 *
 * 末尾固定追加 `{ id: "asc" }` 作为稳定二级键，避免同值行在翻页时跳动/漏行。
 */
export function buildMascusOrderBy(
  orderBy?: string,
  order?: "asc" | "desc"
): Prisma.MascusListingOrderByWithRelationInput[] {
  const sort: Prisma.SortOrder = order === "asc" ? "asc" : "desc";
  const field: MascusOrderField = (MASCUS_ORDER_FIELDS as readonly string[]).includes(orderBy ?? "")
    ? (orderBy as MascusOrderField)
    : "listedAt";

  // lastSeenAt 是 @updatedAt 非空列，不需要 nulls 处理
  const primary: Prisma.MascusListingOrderByWithRelationInput =
    field === "lastSeenAt"
      ? { lastSeenAt: sort }
      : ({ [field]: { sort, nulls: "last" } } as Prisma.MascusListingOrderByWithRelationInput);

  return [primary, { id: "asc" }];
}

// ───────────────────────────────────────────────
// 内部工具
// ───────────────────────────────────────────────

/** 页码/页大小钳制（与 review.ts:285-286 同口径） */
function clampPaging(q: MascusListQuery): { page: number; pageSize: number } {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(q.pageSize) || DEFAULT_PAGE_SIZE));
  return { page, pageSize };
}

/** 用户展示名：`username` 优先，回落 `email`，再回落 `id`（User 表**没有** name 列） */
function userLabel(u: { id: string; username: string | null; email: string | null }): string {
  return u.username ?? u.email ?? u.id;
}

/** 批量补 `assignedToName`（一次 `in` 查询，杜绝 N+1） */
async function resolveAssigneeNames(
  ids: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = Array.from(
    new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0))
  );
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, username: true, email: true },
  });
  for (const u of users) map.set(u.id, userLabel(u));
  return map;
}

/** 取众数（空串/null 不参与；并列取**最先出现**的非空值） */
function pickMostFrequent(values: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  let firstSeen: string | null = null;
  for (const v of values) {
    if (typeof v !== "string") continue;
    const text = v.trim();
    if (text.length === 0) continue;
    if (firstSeen === null) firstSeen = text;
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  // Map 按插入顺序迭代 → 严格大于才替换，保证并列时取最先出现的那个
  let best = firstSeen as string;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** 取第一个非空字符串 */
function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v !== "string") continue;
    const text = v.trim();
    if (text.length > 0) return text;
  }
  return null;
}

// ───────────────────────────────────────────────
// 列表
// ───────────────────────────────────────────────

/**
 * 线索列表（分页 / 筛选 / 搜索 / Tab 计数 / 下拉选项）。
 *
 * 🔴 返回的 `items` **不含明文 `sellerPhone`** —— 只给 `sellerPhoneMasked`。
 * 明文只能走 `GET /api/admin/mascus-listings/[id]`（该路由会先写 PII 审计）。
 */
export async function listMascusListings(q: MascusListQuery): Promise<MascusListResult> {
  const { page, pageSize } = clampPaging(q);
  const baseWhere = buildMascusBaseWhere(q);
  const where = withFollowFilters(baseWhere, q);
  const orderBy = buildMascusOrderBy(q.orderBy, q.order);

  const [rows, total, statusGroups, countryGroups, assigneeUsers] = await Promise.all([
    prisma.mascusListing.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: MASCUS_LIST_SELECT,
    }),
    prisma.mascusListing.count({ where }),
    // Tab 计数：排除 followStatus 自身条件，但**保留 assignedTo**（「我的线索」不能显示全库口径）。
    // 走 withFollowFilters 而不是裸 baseWhere：后者只含 q/segment/country/hasPhone/onlyActive，
    // assignedTo 是在 withFollowFilters 里才追加的，漏了它会导致 Tab 计数误导运营。
    prisma.mascusListing.groupBy({
      by: ["followStatus"],
      where: withFollowFilters(baseWhere, { ...q, followStatus: undefined }),
      _count: { _all: true },
    }),
    // 国家下拉：全库口径（不跟随筛选，否则下拉会越筛越窄）
    prisma.mascusListing.groupBy({ by: ["companyCountry"] }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: [...MASCUS_ASSIGNEE_ROLES] } },
      select: { id: true, username: true, email: true },
    }),
  ]);

  const nameMap = await resolveAssigneeNames(rows.map((r) => r.assignedTo));

  const statusCounts: Record<string, number> = {};
  for (const s of MASCUS_FOLLOW_STATUSES) statusCounts[s] = 0;
  for (const g of statusGroups) {
    if (typeof g.followStatus === "string") {
      statusCounts[g.followStatus] = g._count._all;
    }
  }

  const countries = countryGroups
    .map((g) => g.companyCountry)
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    .map((c) => c.trim())
    .sort((a, b) => a.localeCompare(b));

  return {
    items: (rows as MascusListRow[]).map((r) => mapListItem(r, nameMap)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    statusCounts,
    lookups: {
      segments: MASCUS_SCAN_SEGMENTS.map((s) => s.key),
      countries: Array.from(new Set(countries)),
      assignees: assigneeUsers
        .map((u) => ({ id: u.id, label: userLabel(u) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    },
  };
}

/**
 * 行 → 列表项。
 *
 * ⚠️ 这里**显式逐字段构造**新对象（不做 `...row` 展开）：
 * 即使将来给 model 加了新的 PII 列，也不会因为展开而误泄漏到列表接口。
 */
function mapListItem(row: MascusListRow, nameMap: Map<string, string>): MascusListItem {
  const phone = row.sellerPhone;
  const masked = phone ? maskPhone(phone) : null;
  return {
    id: row.id,
    productId: row.productId,
    brandName: row.brandName,
    modelName: row.modelName,
    year: row.year,
    priceEuro: row.priceEuro,
    priceOriginal: row.priceOriginal,
    priceCurrency: row.priceCurrency,
    sellerPhoneMasked: masked && masked.length > 0 ? masked : null,
    hasPhone: typeof phone === "string" && phone.trim().length > 0,
    companyName: row.companyName,
    locationCity: row.locationCity,
    locationCountry: row.locationCountry,
    scanSegment: row.scanSegment,
    assetUrl: row.assetUrl,
    imageUrl: row.imageUrl,
    listedAt: row.listedAt,
    lastSeenAt: row.lastSeenAt,
    followStatus: row.followStatus,
    assignedTo: row.assignedTo,
    assignedToName: row.assignedTo ? nameMap.get(row.assignedTo) ?? null : null,
    note: row.note,
  };
}

// ───────────────────────────────────────────────
// 按卖家聚合
// ───────────────────────────────────────────────

/**
 * 按**卖家电话**聚合线索（「一个卖家挂了哪些机器」）。
 *
 * 🔴 `sellerPhone` 为空的行必须排除，否则 top1 永远是「null 卖家」。
 *
 * 归并在**应用层**用 `Map` 完成：DB 层没法归一（Prisma `groupBy` 只能按原字符串分组，
 * 同一卖家的三种写法会被算成三个组）。因此本函数的分组口径是
 * `normalizePhoneKey(sellerPhone)`，与本文件其它按原字符串筛选的条件口径不同 ——
 * 详见 `phone.ts` 的归一说明与已知局限。
 *
 * 🔴 **分组用明文 key，输出用掩码**：分组与排序 tiebreaker 必须用明文的 `phoneKey`
 * （`maskPhone` 只留前 3 后 4，不同号码会碰撞成同一个掩码，用它分组/排序会串组），
 * 但该明文 key **绝不放进输出对象**。输出只给 `phoneKeyMasked`、
 * `phoneVariants[].masked`（各写法的掩码）与 `sampleListingId`。
 * `phoneVariants` 的**数组长度＝原始写法种数**，这个信息要保留供前端提示「同号不同写法」；
 * 需要明文时前端拿 `sampleListingId` 去调详情接口（后端会先写 PII 审计）。
 *
 * 数据量保护：先 `count()`；≤5000 行直接全量拉；否则先按原始字符串 `groupBy`
 * 取挂牌数最多的 300 个电话做候选，再 `in` 反查明细。
 * ⚠️ 走候选路径时，若同一卖家的多种写法都没进候选，会有少量组缺失 ——
 * 这是「按原始串分组」的固有局限，已在 `phoneVariants` 的长度里如实体现写法种数。
 */
export async function aggregateBySeller(q: MascusListQuery): Promise<MascusSellerGroup[]> {
  const where: Prisma.MascusListingWhereInput = {
    ...withFollowFilters(buildMascusBaseWhere(q), q),
    // 🔴 无电话的行无法归属卖家，必须排除
    sellerPhone: { not: null },
  };

  const rowCount = await prisma.mascusListing.count({ where });
  let rows: SellerRow[] = [];

  if (rowCount <= SELLER_SAMPLE_LIMIT) {
    rows = (await prisma.mascusListing.findMany({
      where,
      select: SELLER_SELECT,
    })) as SellerRow[];
  } else {
    const candidates = await prisma.mascusListing.groupBy({
      by: ["sellerPhone"],
      where,
      _count: { _all: true },
      orderBy: { _count: { sellerPhone: "desc" } },
      take: SELLER_CANDIDATE_LIMIT,
    });
    const phones = candidates
      .map((c) => c.sellerPhone)
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0);
    if (phones.length > 0) {
      rows = (await prisma.mascusListing.findMany({
        where: { ...where, sellerPhone: { in: phones } },
        select: SELLER_SELECT,
      })) as SellerRow[];
    }
  }

  const buckets = new Map<string, SellerRow[]>();
  for (const row of rows) {
    const key = normalizePhoneKey(row.sellerPhone);
    // 电话里一个数字都没有（如 "n/a"）无法归并，直接跳过
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  /** 内部排序键 `_sortKey` 只在聚合阶段存在，返回前剥掉，绝不随 HTTP 响应下发 */
  const groups: Array<MascusSellerGroup & { _sortKey: string }> = [];
  for (const [phoneKey, bucket] of buckets) {
    const phones = bucket.map((r) => r.sellerPhone);
    const prices = bucket
      .map((r) => r.priceEuro)
      .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
    const listedAts = bucket
      .map((r) => r.listedAt)
      .filter((d): d is Date => d instanceof Date);
    let latestListedAt: Date | null = null;
    for (const d of listedAts) {
      if (!latestListedAt || d.getTime() > latestListedAt.getTime()) latestListedAt = d;
    }
    let maxLastSeenAt: Date | null = null;
    for (const r of bucket) {
      if (!maxLastSeenAt || r.lastSeenAt.getTime() > maxLastSeenAt.getTime()) {
        maxLastSeenAt = r.lastSeenAt;
      }
    }

    groups.push({
      // 🔴 明文 phoneKey 只作内部排序键，不进入输出投影
      _sortKey: phoneKey,
      phoneKeyMasked: maskPhone(phoneKey) || "***",
      phoneVariants: describePhoneVariants(phones).map((v) => ({
        masked: maskPhone(v.raw) || "***",
        count: v.count,
      })),
      sampleListingId: bucket[0].id,
      companyName: pickMostFrequent(bucket.map((r) => r.companyName)),
      locationCountry: pickMostFrequent(bucket.map((r) => r.locationCountry)),
      locationCity: pickMostFrequent(bucket.map((r) => r.locationCity)),
      listingCount: bucket.length,
      brands: Array.from(
        new Set(
          bucket
            .map((r) => r.brandName)
            .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
      segments: Array.from(
        new Set(
          bucket
            .map((r) => r.scanSegment)
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
      priceMinEuro: prices.length > 0 ? Math.min(...prices) : null,
      priceMaxEuro: prices.length > 0 ? Math.max(...prices) : null,
      latestListedAt,
      // 桶非空 ⇒ maxLastSeenAt 必非空；这里的兜底只用于类型收敛
      maxLastSeenAt: maxLastSeenAt ?? new Date(0),
      sampleAssetUrl: firstNonEmpty(bucket.map((r) => r.assetUrl)),
      assignedTo: firstNonEmpty(bucket.map((r) => r.assignedTo)),
      followStatus: pickMostFrequent(bucket.map((r) => r.followStatus)) ?? MASCUS_FOLLOW_STATUSES[0],
    });
  }

  return groups
    .sort((a, b) => (b.listingCount - a.listingCount) || a._sortKey.localeCompare(b._sortKey))
    .slice(0, SELLER_GROUP_LIMIT)
    .map(({ _sortKey, ...g }) => g);
}

// ───────────────────────────────────────────────
// 按品牌聚合
// ───────────────────────────────────────────────

/** 按品牌聚合（品牌基数小，应用层排序足够；`brandName` 为空的行剔除） */
export async function aggregateByBrand(q: MascusListQuery): Promise<MascusBrandGroup[]> {
  const where = withFollowFilters(buildMascusBaseWhere(q), q);

  const [all, withPhone] = await Promise.all([
    prisma.mascusListing.groupBy({
      by: ["brandName"],
      where,
      _count: { _all: true },
    }),
    prisma.mascusListing.groupBy({
      by: ["brandName"],
      where: { ...where, sellerPhone: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const phoneCounts = new Map<string, number>();
  for (const g of withPhone) {
    if (typeof g.brandName === "string") phoneCounts.set(g.brandName, g._count._all);
  }

  return all
    .map((g) => ({ name: g.brandName, count: g._count._all }))
    .filter((g): g is { name: string; count: number } => typeof g.name === "string" && g.name.trim().length > 0)
    .map((g) => ({
      brandName: g.name.trim(),
      listingCount: g.count,
      withPhoneCount: phoneCounts.get(g.name) ?? 0,
    }))
    .sort((a, b) => (b.listingCount - a.listingCount) || a.brandName.localeCompare(b.brandName));
}

// ───────────────────────────────────────────────
// 单条详情 / 更新
// ───────────────────────────────────────────────

/**
 * 单条详情（🔴 含**明文** `sellerPhone`）。
 *
 * 调用方（`GET /api/admin/mascus-listings/[id]`）必须在返回给前端**之前**
 * 先写 `writePiiAuditLog` —— 本函数只负责取数，不写审计（保持纯读）。
 */
export async function getMascusListingDetail(id: string): Promise<MascusListingDetail | null> {
  const key = typeof id === "string" ? id.trim() : "";
  if (key.length === 0) return null;

  const row = await prisma.mascusListing.findUnique({ where: { id: key } });
  if (!row) return null;

  const nameMap = await resolveAssigneeNames([row.assignedTo]);
  return {
    ...row,
    assignedToName: row.assignedTo ? nameMap.get(row.assignedTo) ?? null : null,
  };
}

/**
 * 更新跟进状态 / 负责人 / 备注。
 *
 * 🔴 **不使用 `prisma.mascusListing.update()`**：`lastSeenAt` 带 `@updatedAt`，
 * 任何 ORM 写操作都会把它刷成 `now()`，于是「手工标一下备注」就会让这条线索
 * 在「还在挂」视图（`lastSeenAt >= now-3天`）里假装仍在挂牌 —— 直接污染采集侧语义。
 * 因此这里走**定向 SQL UPDATE**，只碰 `followStatus` / `assignedTo` / `assignedAt` / `note` 四列。
 *
 * ⚠️ 维护提醒：本函数手写列名，若将来给 `MascusListing` 加 `@@map` 改表名，此处必须同步。
 *
 * 校验：
 *  - `followStatus` 必须 ∈ `MASCUS_FOLLOW_STATUSES`，否则 400；
 *  - `assignedTo` 非 null 时必须查得到用户，且 `role ∈ {admin,super_admin,editor}` 且 `isActive`；
 *  - 传 `""` 视同 `null`（取消分配）；
 *  - 同时同步 `assignedAt`：分配 → `now()`；取消 → `null`。
 */
export async function updateMascusListing(
  id: string,
  input: MascusUpdateInput,
  _actorId: string
): Promise<MascusListingDetail> {
  const key = typeof id === "string" ? id.trim() : "";
  if (key.length === 0) throw new MascusQueryError("线索 id 不能为空", 400, "VALIDATION_ERROR");

  const sets: Prisma.Sql[] = [];

  if (input.followStatus !== undefined) {
    const status = typeof input.followStatus === "string" ? input.followStatus.trim() : "";
    if (!(MASCUS_FOLLOW_STATUSES as readonly string[]).includes(status)) {
      throw new MascusQueryError(
        `跟进状态非法：${String(input.followStatus)}，必须为 ${MASCUS_FOLLOW_STATUSES.join("/")} 之一`,
        400,
        "VALIDATION_ERROR"
      );
    }
    sets.push(Prisma.sql`"followStatus" = ${status}`);
  }

  if (input.assignedTo !== undefined) {
    const raw = typeof input.assignedTo === "string" ? input.assignedTo.trim() : null;
    const target = raw === null || raw.length === 0 ? null : raw;
    if (target === null) {
      // 取消分配：负责人与分配时间一起清空
      sets.push(Prisma.sql`"assignedTo" = NULL, "assignedAt" = NULL`);
    } else {
      const user = await prisma.user.findUnique({
        where: { id: target },
        select: { id: true, role: true, isActive: true },
      });
      if (!user || !user.isActive) {
        throw new MascusQueryError(`负责人不存在或已停用：${target}`, 400, "ASSIGNEE_INVALID");
      }
      if (!(MASCUS_ASSIGNEE_ROLES as readonly string[]).includes(user.role)) {
        throw new MascusQueryError(
          `负责人角色不可用：${user.role}（仅 ${MASCUS_ASSIGNEE_ROLES.join("/")}）`,
          400,
          "ASSIGNEE_INVALID"
        );
      }
      sets.push(Prisma.sql`"assignedTo" = ${target}, "assignedAt" = ${new Date()}`);
    }
  }

  if (input.note !== undefined) {
    const note = typeof input.note === "string" ? input.note.trim() : null;
    if (note === null || note.length === 0) {
      sets.push(Prisma.sql`"note" = NULL`);
    } else {
      sets.push(Prisma.sql`"note" = ${note}`);
    }
  }

  if (sets.length === 0) {
    throw new MascusQueryError(
      "未提供任何可更新字段（followStatus/assignedTo/note）",
      400,
      "VALIDATION_ERROR"
    );
  }

  const affected = await prisma.$executeRaw(
    Prisma.sql`UPDATE "MascusListing" SET ${Prisma.join(sets, ", ")} WHERE "id" = ${key}`
  );
  if (typeof affected === "number" && affected === 0) {
    throw new MascusQueryError("线索不存在", 404, "NOT_FOUND");
  }

  const updated = await getMascusListingDetail(key);
  if (!updated) throw new MascusQueryError("线索不存在", 404, "NOT_FOUND");
  return updated;
}
