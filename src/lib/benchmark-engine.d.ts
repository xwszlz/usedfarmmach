// Ambient module declaration for the CommonJS benchmark engine
// (src/lib/benchmark-engine.js). Keeps the TS route type-safe without
// forcing allowJs on the whole project.
declare module '@/lib/benchmark-engine' {
  export interface SourceStat {
    ok: number;
    skip: number;
    failed: number;
    /** 该源最终是否开了熔断 */
    opened: boolean;
  }

  /** 数据源定义（SOURCES 数组元素） */
  export interface BenchmarkSource {
    key: string;
    name: string;
    region: string;
    currency: string;
    russian: boolean;
    /** 为 true 时 buildTargets() 跳过该源（mascus：URL 层筛选失效，改品类级扫描） */
    skipInTargets?: boolean;
  }

  /** 单个机型配置 */
  export interface BenchmarkModel {
    /** 机型字符串（mascus 侧必须与库存里的 `model` 字段原样一致，匹配靠它） */
    model: string;
    /** 品类：tractor / forage_harvester / combine / baler / mower_tedder / soil */
    category: string;
  }

  /** 18 个目标品牌（已按 mascus `brand` 字段实测校验过写法） */
  export interface BenchmarkBrand {
    slug: string;
    nameZh: string;
    nameEn: string;
    origin: string;
    primaryCategory: string;
  }

  export const BRANDS: BenchmarkBrand[];

  /**
   * 品牌 slug → 机型清单（旗舰 + 主流在售机型）。
   * 扩容规则见 benchmark-engine.js 里 MODELS 顶部注释：只按真实库存筛（有价 / 命中品牌 /
   * 样本 ≥3），model 必须与 mascus `model` 字段原样一致，category 依 `categoryName` 判定。
   * ⚠️ 机型数 × 6 个按型号靶标的源 = buildTargets() 长度，上限 500。
   */
  export const MODELS: Record<string, BenchmarkModel[]>;

  /** 首期数据源（含 mascus，但 mascus 标记 skipInTargets=true，不进靶标循环） */
  export const SOURCES: BenchmarkSource[];

  /**
   * mascus bulk 采集的品类段清单（与 src/lib/mascus-leads/parse.ts 的
   * MASCUS_SCAN_SEGMENTS 保持一致；改一处必须同步另一处）。
   */
  export const MASCUS_BULK_SEGMENTS: string[];
  /** mascus bulk 的 `lastcreateddays`（挂牌新鲜度窗口），当前 60 */
  export const MASCUS_BULK_RECENT_DAYS: number;
  /** mascus bulk 默认每段翻页数，当前 5 */
  export const MASCUS_BULK_MAX_PAGES: number;
  /** mascus 单组最少样本数（不足不写库），当前 3 */
  export const MASCUS_MIN_SAMPLES: number;

  /** 从 mascus 列表页 HTML 抽出 __NEXT_DATA__ 的**原始** items（不过滤，不抛错） */
  export function parseMascusNextDataItems(html: string): {
    ok: boolean;
    reason?: string;
    items: Array<Record<string, any>>;
    totalResults: number;
  };
  /** mascus 品牌匹配（归一化后相等或互相包含，空值/超短值一律 false） */
  export function mascusBrandMatches(itemBrand: unknown, nameEn: string): boolean;
  /** 目标机型 → 匹配 token（'8R 410' → ['8r','410']） */
  export function mascusModelTokens(model: string): string[];
  /** mascus 型号匹配（token 需作为独立词块全部命中） */
  export function mascusModelMatches(itemModel: unknown, tokens: string[]): boolean;
  /** 单条 mascus 挂牌 → EUR 金额；priceEURO / priceOriginal 都 ≤ 0 时返回 null */
  export function mascusItemPriceEur(
    item: Record<string, any>,
    fx: Record<string, number>
  ): { amount: number; currency: string } | null;

  /** mascus bulk 采集里单组（brand×model）的结果 */
  export interface MascusBulkGroup {
    brand: string;
    brandNameZh?: string;
    model: string;
    category?: string;
    samples: number;
    status: 'ok' | 'skip' | 'failed';
    reason: string | null;
    medianForeign?: number;
    currency?: string;
    medianCny?: number;
    exchangeRate?: number;
    listingCount?: number;
    sampleSize?: number;
    confidenceScore?: number;
    sourceDate?: string;
  }

  /** 单个品类段的扫描统计 */
  export interface MascusBulkSegmentStat {
    items: number;
    priced: number;
    totalResults: number;
    pages: number;
    failedPages: number;
    ok: boolean;
  }

  /** fetchMascusBulk() 的返回值 */
  export interface MascusBulkResult {
    /** 至少有一页成功解析（全失败 / 预算耗尽 / 抛错时为 false） */
    ok: boolean;
    dryRun?: boolean;
    budgetExhausted?: boolean;
    error?: string | null;
    recentDays?: number;
    maxPages?: number;
    totalPages: number;
    fetchedPages: number;
    failedPages: number;
    /** 抓到的条目总数（去重前） */
    items: number;
    /** 按 productId 去重后的条目数 */
    uniqueItems: number;
    /** 有价条目数（priceEURO>0，或 priceOriginal>0 且能折成 EUR） */
    pricedItems: number;
    /** 参与匹配的 (brand×model) 组数 */
    groups: number;
    written: number;
    skipped: number;
    failed: number;
    /** 写入成功的组（含 brand/model/samples/medianForeign/currency/medianCny/sourceDate） */
    rows: MascusBulkGroup[];
    /** 全部分组明细（含 skip / failed） */
    groupDetail: MascusBulkGroup[];
    byReason: Record<string, number>;
    bySegment: Record<string, MascusBulkSegmentStat>;
    /** items 与 totalResults 都为 0 的段（路径失效的唯一信号） */
    emptySegments: string[];
    durationMs: number;
  }

  /**
   * mascus 品类级 bulk 采集：按段拉列表页 → 合并去重 → 本地按 (brand,model) 匹配
   * → 折 EUR → 聚合（3 条起）→ upsertBenchmark。
   */
  export function fetchMascusBulk(opts?: {
    fx?: Record<string, number>;
    maxPages?: number;
    timeoutMs?: number;
    recentDays?: number;
    minSamples?: number;
    concurrency?: number;
    budgetMs?: number;
    dryRun?: boolean;
  }): Promise<MascusBulkResult>;

  export interface RefreshStats {
    ok: number;
    skip: number;
    failed: number;
    total: number;
    bySource: Record<string, SourceStat>;
    /** 跳过原因分布（'no-listing' / 'no-agg' / 'circuit-open' / 'no-source' …） */
    skipReasons: Record<string, number>;
    /** 因总预算耗尽而未派发的目标数 */
    skippedByBudget: number;
    /** true = 触发了 budgetMs 兜底 */
    budgetExhausted: boolean;
    /** 最终打开熔断的源站列表 */
    circuitOpen: string[];
    /** 本次刷新总耗时（毫秒） */
    durationMs: number;
    /**
     * mascus bulk 通道的明细（未启用 mascus 时为 null）。
     * 注意：mascus 的计数单位是「组（brand×model）」，其 ok/skip/failed **已汇入**
     * 顶层的 ok/skip/failed 与 total，本字段只作诊断，不要重复累加。
     */
    mascus: null | {
      ok: number;
      skip: number;
      failed: number;
      total: number;
      items: number;
      uniqueItems: number;
      pricedItems: number;
      fetchedPages: number;
      failedPages: number;
      totalPages: number;
      budgetExhausted: boolean;
      byReason: Record<string, number>;
      bySegment: Record<string, MascusBulkSegmentStat>;
      emptySegments: string[];
      rows: Array<{
        brand: string;
        model: string;
        samples: number;
        medianForeign?: number;
        currency?: string;
        medianCny?: number;
        sourceDate?: string;
      }>;
      durationMs: number;
      error: string | null;
    };
  }

  export interface SourceCircuit {
    shouldSkip(site: string): boolean;
    record(site: string, status: 'ok' | 'skip' | 'failed'): {
      consecutiveFails: number;
      open: boolean;
    };
    snapshot(): Record<string, { consecutiveFails: number; open: boolean }>;
  }

  /** 源级熔断器（纯逻辑，无 I/O） */
  export function makeSourceCircuit(opts?: { failureThreshold?: number }): SourceCircuit;

  export function getFxRates(): Promise<Record<string, number>>;
  /**
   * 裸 GET（带浏览器 UA / 超时 / 可选住宅代理）。
   * 3xx 会自动跟随（Location 支持相对路径），非 200 或超时抛错，由调用方降级。
   */
  export function httpGet(
    url: string,
    opts?: {
      timeout?: number;
      headers?: Record<string, string>;
      proxy?: string | null;
    }
  ): Promise<string>;
  export function buildTargets(): Array<Record<string, any>>;

  /** 按源站 + 目标构造搜索 URL（mascus 已改用真实品类路径 + lastcreateddays） */
  export function buildSearchUrl(
    source: Record<string, any>,
    target: Record<string, any>
  ): string;

  /** mascus 改版后（Next.js）结构化商品行（仅保留有价 + 相关机型） */
  export interface MascusNextDataListing {
    priceForeign: number;
    currency: string;
    title: string;
    url?: string;
    sourceDate?: string;
    listingId?: string | number;
    sellerPhone?: string;
    companyName?: string;
    country?: string;
    city?: string;
    yearOfManufacture?: number | string;
    meterReadout?: number | string;
    categoryName?: string;
  }

  /** 从 mascus 页面 <script id="__NEXT_DATA__"> 的 searchData.items 解析商品 */
  export function parseMascusNextData(
    html: string,
    target: Record<string, any>,
    source?: Record<string, any>
  ): MascusNextDataListing[];

  /** mascus 抓取诊断（运维排查用，不参与价格聚合） */
  export type MascusDiagnostics =
    | { ok: false; reason: string }
    | {
        ok: true;
        totalResults: number | null;
        searchTitle: string | null;
        resolvedCategory: string | null;
        errorMessage: string | null;
        itemCount: number;
        withPrice: number;
      };

  export function parseMascusDiagnostics(html: string): MascusDiagnostics;
  export function runRefresh(opts?: {
    fx?: Record<string, number>;
    concurrency?: number;
    timeoutMs?: number;
    targets?: Array<Record<string, any>>;
    sources?: string[];
    /** 源级熔断阈值，默认 3 */
    failureThreshold?: number;
    /** 总预算兜底（毫秒），默认 260000 */
    budgetMs?: number;
    /** true = 只统计不写库（验证用） */
    dryRun?: boolean;
    /** mascus bulk 每段翻页数（默认 5，见 fetchMascusBulk） */
    mascusMaxPages?: number;
    /** mascus bulk 单页超时（默认取 max(timeoutMs, 25000)） */
    mascusTimeoutMs?: number;
    /** mascus 单组最少样本数（默认 3） */
    mascusMinSamples?: number;
    /**
     * false = 显式关闭 mascus bulk 通道。
     * 另注：只要调用方注入了 `targets`，mascus bulk 一律不跑（注入 targets = 明确只要跑这些靶标）。
     */
    mascus?: boolean;
  }): Promise<RefreshStats>;
  export function seedFromResearch(jsonPath: string): Promise<{ n: number; err: number }>;
  export function seedEuEvidence(
    jsonRelPath?: string
  ): Promise<{ ok: boolean; n: number; skipped: number; err: number; records: number }>;

  /** 单个源站的数据陈旧情况 */
  export interface SourceStalenessEntry {
    site: string;
    rows: number;
    /** 最新 sourceDate（'YYYY-MM-DD'）；该源所有行都没有可解析日期时为 null */
    lastDate: string | null;
    /** 距今天数；lastDate 为 null 时为 null（无法判断新鲜度，按陈旧上报） */
    ageDays: number | null;
    /** crawl-failed = 在抓取清单里但抓不到；not-in-crawl-list = 只有历史种子，无抓取通道 */
    kind: "crawl-failed" | "not-in-crawl-list";
  }

  /** checkSourceStaleness() 的返回值（只读诊断） */
  export interface SourceStalenessReport {
    /** 参与统计的行数（isActive=true） */
    checked: number;
    /** sourceDate 为空/不可解析的行数 */
    noDate: number;
    /** 陈旧阈值（天） */
    staleDays: number;
    /** 超过阈值的源（按 ageDays 降序，无日期的排最前） */
    stale: SourceStalenessEntry[];
    /** 在 SOURCES 抓取清单里但库里一行都没有的源 */
    missingSources: string[];
  }

  export function checkSourceStaleness(opts?: { staleDays?: number }): Promise<SourceStalenessReport>;

  export function report(): Promise<void>;
  export function disconnectBenchmark(): Promise<void>;
}
