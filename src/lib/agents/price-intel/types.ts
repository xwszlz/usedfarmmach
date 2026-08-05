/**
 * 国际价格采集 Agent（#3）— 类型定义
 *
 * 负责定义 Agent 的输入、输出、内部数据契约；
 * 让上层 API / CLI / 调度者 / 其它 Agent 都有统一接口。
 */
import { z } from "zod";

// ==================== 输入 ====================

/** Agent 支持的 4 个数据源 */
export const PRICE_SOURCES = [
  "snapshot",   // 套利报告/抓取快照 JSON  (D:/神雕农机/套利报告/snapshot_*.json)
  "brief",      // 智能体简报 JSON         (D:/神雕农机/套利报告/智能体简报_*.json)
  "daily_md",   // 神雕日报 Markdown        (D:/神雕农机/神雕日报/*_跨境套利日报.md)
  "manual",     // 人工高置信度数据（硬编码兜底）
] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

/** Agent 输入参数 schema */
export const PriceIntelInputSchema = z.object({
  /** 要采集的源；不传则全部 */
  sources: z.array(z.enum(PRICE_SOURCES)).optional(),
  /** 每个源最多处理的文件数（默认 3） */
  maxFilesPerSource: z.number().int().min(1).max(20).default(3),
  /** 强制重写最新数据，即使日期没变 */
  force: z.boolean().default(false),
  /** 是否仅 dry-run（不写数据库） */
  dryRun: z.boolean().default(false),
  /** 仅采集某一天（YYYYMMDD 格式），用于回填 */
  targetDate: z.string().regex(/^\d{8}$/).optional(),
});
export type PriceIntelInput = z.infer<typeof PriceIntelInputSchema>;

// ==================== 内部数据 ====================

/** 采集到的单条价格记录（已规范化） */
export interface CollectedPrice {
  source: string;               // 数据源：Agroline, e-farm, TractorHouse...
  brandNameZh: string;          // 中文品牌
  modelName: string;            // 型号（已清理括号注释）
  year: number | null;
  domesticPriceWan: number | null;
  priceEur: number | null;      // 欧元原始价格
  priceUsd: number | null;      // 美元原始价格
  exchangeRate: number;         // 当时汇率
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDate: string;           // YYYYMMDD
  country: string | null;       // ISO 3166-1 alpha-2
  opportunityLevel: string;     // 机会等级
  grossMarginPct: number | null;
  note: string;                 // 备注
}

/** 匹配后的最终落库结构 */
export interface MatchedPrice extends CollectedPrice {
  productId: string | null;     // 命中的产品 ID；未命中为 null
  matchStatus: "matched" | "skipped_no_price" | "skipped_no_product" | "skipped_up_to_date";
  priceForeignCny: number;      // 最终人民币金额（元）
  currency: "EUR" | "USD";
}

// ==================== 输出 ====================

/** 每个源执行结果 */
export interface SourceRunResult {
  source: PriceSource | "all";
  processed: number;            // 处理的总条数
  imported: number;             // 写入条数
  updated: number;              // 更新条数
  skipped: number;              // 跳过条数
  durationMs: number;
  errors: string[];
  /** 前 3 条样本，方便人工核对 */
  samples: MatchedPrice[];
}

/** Agent 总体执行结果 */
export interface PriceIntelResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalCollected: number;
  totalImported: number;
  totalUpdated: number;
  totalSkipped: number;
  perSource: SourceRunResult[];
  /** Agent 内部日志 */
  log: string[];
  /** 异常信息 */
  error?: string;
}

// ==================== HTTP ====================

/** GET /api/agents/price-intel 状态查询 */
export interface PriceIntelStatus {
  ok: boolean;
  agentName: "price-intel";
  version: string;
  lastRun?: {
    startedAt: string;
    finishedAt: string;
    totalImported: number;
    totalUpdated: number;
    durationMs: number;
  };
  dbStats: {
    internationalPriceRows: number;
    productsWithIntlPrice: number;
    sources: { source: string; count: number; latestDate: string | null }[];
  };
  sourcesSupported: readonly PriceSource[];
}
