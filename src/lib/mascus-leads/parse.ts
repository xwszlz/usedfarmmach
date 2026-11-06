/**
 * mascus 线索解析 + 集计判定（纯函数模块，**不 import 数据库**，单测可独立运行）
 *
 * 背景（2026-11 实测，勿推翻）：
 *   - mascus 整站已改版为 Next.js，页面数据不再在 HTML 表格里，而是整体塞进
 *     `<script id="__NEXT_DATA__">` 的 `props.pageProps.searchRes.searchData.items` 中，
 *     每页固定 40 条，同层 `totalResults` 为总条数。
 *   - 每条 item 约 48 个字段，`sellerPhone` / `companyName` / `locationCity` / `productId` /
 *     `createDate` 覆盖率 95%+（个别拍卖行条目没有直连电话，实测 tractors 段 38/40 = 95%）。
 *   - `priceEURO > 0` 的比例**随品类差异极大**（2026-11 实测，3 段各 40 条）：
 *     tractors 27/40、agricultural-harvesters 24/40、**hay-and-forage-machines 仅 1/40**，
 *     三段加权约 57% 有价 ⇒ 加权无价率约 43%。
 *   - 因此本模块**严禁按价格过滤**：hay-and-forage 段 97.5% 的条目没有价格，但整段都带卖家电话，
 *     那恰恰是本线索池最核心的品类。按价格过滤正是 benchmark-engine 那套解析器丢线索的地方
 *     （它把 mascus 当价格基准源用，只保留有价格的条目）。
 *   - ⚠️ 口径纪律：不要把这个数字写成「全站 97.5% 无价」—— 那会误导后人以为 mascus 价格字段整体是空的，
 *     从而砍掉 `priceEuro` 列或放弃价格采集。全站口径是「加权约 57% 有价」。
 *
 * 设计约束：
 *   - 解析失败一律「降级为空结果」，**不抛异常**（cron 里单页解析失败不该炸整轮采集）。
 *   - 相对路径统一补成绝对 URL，避免下游拿到 `/agriculture/...` 无法点开。
 *   - `createDate` 无时区（如 `2026-11-03T00:02:53.857`），一律按 UTC 解析，
 *     否则部署机本地时区（如 Asia/Shanghai）会让时间整体漂 8 小时。
 */

/** mascus 站点根（相对路径补全用；`.cn` 侧不采集，故硬编码国际站域名） */
export const MASCUS_ORIGIN = "https://www.mascus.com";

/**
 * 品类级扫描段（顺序按实测量排，先扫高产的）。
 *
 * 2026-11 线上探针实测（真实请求 / 2 天窗口 / page=1）：
 *   /agriculture/tractors                    items=40  total=163
 *   /agriculture/tillage-machines            items=40  total=166  ← Tillage Machines（耕整机械）
 *   /agriculture/hay-and-forage-machines     items=40  total=151
 *   /agriculture/other-agricultural-machines items=40  total=106  ← Farm Equipment - Others，量大
 *   /agriculture/agricultural-harvesters     items=40  total=43
 *   /agriculture/trailers                    items=40  total=40   （仍排除：0 个目标品牌命中，QA 实测）
 *   /agriculture/sprayers                    items=17  total=17   （sprayers 已纳入 B 档，2026-11-06）
 *
 * ⛔ 实测「0 条 / 404」黑名单 —— **不要再从 benchmark-engine 的旧品类映射里抄路径**：
 *   /agriculture/soil-preparation   → items=0 total=0，页面实际是 "Wine Growing Equipment"
 *                                     （葡萄酒种植设备）。旧映射在这里已指错品类，
 *                                     等于每天白打 2 页换 0 条，且静默无告警 —— 已废弃（2026-11）。
 *   /agriculture/tillage-equipment  → HTTP 404（要耕整机械请用 tillage-machines）
 *   /agriculture/loaders            → items=0 total=0
 *   /agriculture（根路径）           → items=0 total=0
 *
 * `key` 会写入 `MascusListing.scanSegment`，用于事后判断「这条线索是扫哪个品类段捞到的」；
 * 整段 0 条会被 ingest 收进 `emptySegments` 并打告警（这是发现路径失效的唯一防线）。
 */
export const MASCUS_SCAN_SEGMENTS: { key: string; path: string }[] = [
  { key: "tractors", path: "/agriculture/tractors" },
  { key: "tillage-machines", path: "/agriculture/tillage-machines" },
  { key: "hay-and-forage-machines", path: "/agriculture/hay-and-forage-machines" },
  { key: "other-agricultural-machines", path: "/agriculture/other-agricultural-machines" },
  { key: "agricultural-harvesters", path: "/agriculture/agricultural-harvesters" },
  { key: "sprayers", path: "/agriculture/sprayers" }, // B 档 2026-11-06 纳入
];

/** 单页固定条数（mascus 服务端固定 40，用于判断是否还有下一页） */
export const MASCUS_PAGE_SIZE = 40;

/** 归一化后的单条线索（数据库无关表示，写库由 ingest.ts 负责） */
export interface ParsedMascusListing {
  /** mascus 商品 GUID，保留花括号原样；同时作为幂等键 */
  productId: string;
  brandName: string | null;
  modelName: string | null;
  categoryName: string | null;
  catalogName: string | null;
  year: number | null;
  priceEuro: number | null;
  priceOriginal: number | null;
  priceCurrency: string | null;
  sellerPhone: string | null;
  companyName: string | null;
  companyCountry: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  assetUrl: string | null;
  imageUrl: string | null;
  /** 挂牌时间（mascus createDate），按 UTC 解析 */
  listedAt: Date | null;
  /** 原始 item 对象，原样入库便于回溯字段变化 */
  raw: Record<string, unknown>;
}

/** `<script id="__NEXT_DATA__">` 抓取正则（属性顺序无关，容忍单/双引号） */
const NEXT_DATA_SCRIPT_RE =
  /<script\b[^>]*\bid\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;

/** `2026-11-03T00:02:53.857` / `2026-11-03 00:02:53` 这类「无时区」形态 */
const NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

/**
 * 构造搜索页 URL（唯一可靠的分页入口）。
 *
 * 注意：旧的 `?q=` / 品牌型号参数已被 mascus 服务端**完全忽略**，
 * 只有 `lastcreateddays`（最近 N 天上新）与 `page` 生效。
 *
 * @param path 品类路径，如 `/agriculture/hay-and-forage-machines`
 * @param opts `recentDays` 默认 2，`page` 默认 1
 * @returns 形如 `https://www.mascus.com/agriculture/hay-and-forage-machines?lastcreateddays=2&page=1`
 */
export function buildMascusSearchUrl(
  path: string,
  opts: { recentDays?: number; page?: number } = {}
): string {
  const recentDays = Math.max(1, Math.trunc(opts.recentDays ?? 2) || 2);
  const page = Math.max(1, Math.trunc(opts.page ?? 1) || 1);
  const normalized = normalizeSegmentPath(path);
  const query = new URLSearchParams({
    lastcreateddays: String(recentDays),
    page: String(page),
  });
  return `${MASCUS_ORIGIN}${normalized}?${query.toString()}`;
}

/**
 * 解析搜索页 HTML 中的 `__NEXT_DATA__`，抽出线索条目。
 *
 * 一切异常路径（无 script / JSON 损坏 / 结构变更）均返回空结果，**不抛异常**。
 * **不做价格过滤**：`priceEURO` 为 0 或缺失的条目照样保留。
 *
 * @param html 搜索页完整 HTML
 * @returns 归一化条目（丢弃 `productId` 为空的脏数据）与 `totalResults`
 */
export function parseMascusNextData(html: string): {
  items: ParsedMascusListing[];
  totalResults: number;
} {
  if (typeof html !== "string" || html.length === 0) {
    return { items: [], totalResults: 0 };
  }
  const matched = html.match(NEXT_DATA_SCRIPT_RE);
  if (!matched || !matched[1]) {
    return { items: [], totalResults: 0 };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(matched[1]);
  } catch {
    return { items: [], totalResults: 0 };
  }

  const searchRes = readPath(payload, ["props", "pageProps", "searchRes"]);
  const searchData = readPath(searchRes, ["searchData"]);
  const rawItems = readPath(searchData, ["items"]);
  if (!Array.isArray(rawItems)) {
    return { items: [], totalResults: 0 };
  }

  // totalResults 与 items 同层；个别页面版本把它上提到 searchRes 层，两处都兼容。
  const totalRaw =
    readPath(searchData, ["totalResults"]) ?? readPath(searchRes, ["totalResults"]);
  const totalNumber = toNumber(totalRaw);
  const totalResults = totalNumber === null ? 0 : Math.max(0, Math.trunc(totalNumber));

  const items: ParsedMascusListing[] = [];
  for (const entry of rawItems) {
    const parsed = parseItem(entry);
    if (parsed) items.push(parsed);
  }
  return { items, totalResults };
}

/**
 * 同批次按 `productId` 去重（保留首次出现）。
 *
 * 品类段之间会重叠（同一台机可能同时出现在 tractors 与 soil-preparation 里），
 * 入库前必须先去重，否则同一轮采集会重复计数。
 */
export function dedupeByProductId<T extends { productId: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    if (!row || typeof row.productId !== "string" || row.productId.length === 0) continue;
    if (seen.has(row.productId)) continue;
    seen.add(row.productId);
    unique.push(row);
  }
  return unique;
}

/**
 * 单品类段「一轮扫描」的集计结果（由 ingest 边扫边填，判定逻辑见 {@link findEmptySegments}）。
 *
 * 单独抽成纯结构 + 纯函数，是为了让「死段判定」可以脱离数据库/网络单测：
 * 2026-11 线上事故形态就是「路径指错品类 → 每天 0 条、静默无告警」，
 * 这条判定必须有回归测试把守。
 */
export interface SegmentScanStat {
  /** 品类段 key（写入 `MascusListing.scanSegment`） */
  key: string;
  /** 本轮该段抓到的条目数（去重前） */
  items: number;
  /** 该段页面自报的总条数（多页取最大值；整段抓取全失败时为 0） */
  totalResults: number;
  /** 成功抓取的页数 */
  pages: number;
  /** 失败的页数 */
  failedPages: number;
}

/**
 * 找出一轮扫描里「0 条」的品类段（死段告警用）。
 *
 * 判定口径：`items === 0` 且 `totalResults === 0`。
 * 含两种情况，都需要人工核对：
 *   1. 路径已失效 / 品类被改名（线上 `soil-preparation` 就是这样指到了葡萄酒种植设备）；
 *   2. 该段所有分页都抓取失败（此时也会同时计入 `failedPages`）。
 *
 * 未被真正尝试扫描的段不应出现在 `stats` 里（由调用方保证），否则预算耗尽等情况会误报。
 */
export function findEmptySegments(stats: SegmentScanStat[]): string[] {
  const empty: string[] = [];
  for (const stat of stats) {
    if (!stat || typeof stat.key !== "string" || stat.key.length === 0) continue;
    if (stat.items > 0) continue;
    if (stat.totalResults > 0) continue;
    empty.push(stat.key);
  }
  return empty;
}

/* ------------------------------------------------------------------ *
 * 内部工具（不导出，保持公共面最小）
 * ------------------------------------------------------------------ */

/** 把品类路径归一化为「以 / 开头、去掉 query/hash 与尾斜杠」 */
function normalizeSegmentPath(path: string): string {
  const text = typeof path === "string" ? path.trim() : "";
  let body = text;
  if (body.startsWith(MASCUS_ORIGIN)) body = body.slice(MASCUS_ORIGIN.length);
  const cutIndex = body.search(/[?#]/);
  if (cutIndex >= 0) body = body.slice(0, cutIndex);
  if (!body.startsWith("/")) body = `/${body}`;
  while (body.length > 1 && body.endsWith("/")) body = body.slice(0, -1);
  return body;
}

/** 安全按路径读取嵌套字段，任意一层缺失/类型不符都返回 undefined */
function readPath(node: unknown, keys: string[]): unknown {
  let current: unknown = node;
  for (const key of keys) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** 单条 item → ParsedMascusListing；`productId` 缺失则丢弃该条 */
function parseItem(entry: unknown): ParsedMascusListing | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const item = entry as Record<string, unknown>;

  const productId = toText(item.productId);
  if (!productId) return null;

  return {
    productId,
    brandName: toText(item.brand),
    modelName: toText(item.model),
    categoryName: toText(item.categoryName),
    catalogName: toText(item.catalogName),
    year: toYear(item.yearOfManufacture),
    priceEuro: toNumber(item.priceEURO),
    priceOriginal: toNumber(item.priceOriginal),
    priceCurrency: toText(item.priceOriginalUnit),
    sellerPhone: toText(item.sellerPhone),
    companyName: toText(item.companyName),
    companyCountry: toText(item.companyCountry),
    locationCity: toText(item.locationCity),
    // 先取 ISO 国别码（locationCountryCode），回落自由文本字段
    locationCountry: toText(item.locationCountryCode) ?? toText(item.locationCountry),
    assetUrl: toAbsoluteUrl(item.assetUrl),
    imageUrl: toAbsoluteUrl(item.imageUrl),
    listedAt: parseMascusDate(item.createDate),
    raw: item,
  };
}

/** 字符串归一化：去首尾空白，空串 → null（`sellerPhone: ""` 必须变成 null） */
function toText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** 数字归一化：`0` 是有效值（价格 0 的条目必须保留，不能转 null） */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "");
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** 年份归一化：非正数（0 / 负数）视为无效，避免脏年份污染索引 */
function toYear(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  const year = Math.trunc(parsed);
  return year > 0 ? year : null;
}

/** 相对路径补成 mascus 绝对 URL；已是 http(s) 的原样返回 */
function toAbsoluteUrl(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("//")) return `https:${text}`;
  return `${MASCUS_ORIGIN}${text.startsWith("/") ? "" : "/"}${text}`;
}

/**
 * 解析 mascus `createDate`。
 *
 * 形如 `2026-11-03T00:02:53.857`（**无时区**）：按 UTC 处理（末尾补 `Z`），
 * 否则 `new Date()` 会按宿主机本地时区解释，部署机（Asia/Shanghai）会让挂牌时间漂移 8 小时。
 * 解析失败返回 `null`。
 */
function parseMascusDate(value: unknown): Date | null {
  const text = toText(value);
  if (!text) return null;
  const isoText = text.replace(" ", "T");
  const candidate = NAIVE_DATETIME_RE.test(text) ? `${isoText}Z` : text;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date;
}
