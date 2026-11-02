// Ambient module declaration for the CommonJS benchmark engine
// (src/lib/benchmark-engine.js). Keeps the TS route type-safe without
// forcing allowJs on the whole project.
declare module '@/lib/benchmark-engine' {
  export interface RefreshStats {
    ok: number;
    skip: number;
    failed: number;
    total: number;
    bySource: Record<string, { ok: number; skip: number; failed: number }>;
  }
  export function getFxRates(): Promise<Record<string, number>>;
  export function buildTargets(): Array<Record<string, any>>;
  export function runRefresh(opts?: {
    fx?: Record<string, number>;
    concurrency?: number;
    timeoutMs?: number;
    targets?: Array<Record<string, any>>;
    sources?: string[];
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
