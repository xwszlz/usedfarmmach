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
