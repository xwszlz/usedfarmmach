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
  export function report(): Promise<void>;
  export function disconnectBenchmark(): Promise<void>;
}
