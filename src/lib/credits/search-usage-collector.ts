/**
 * 检索用量归集器（进程内，**AsyncLocalStorage 请求作用域**）
 * ─────────────────────────────────────────────────────────
 * 用途：AI 销售策略链路里「火山方舟联网检索」的真实用量发生在 `web-evidence.ts` 的
 *       `searchViaArk()` 内部（5 条 query 并发、每条内部模型自主多轮检索），
 *       而扣费发生在 `sales-strategy/route.ts`。两者隔了 `retrieval.ts` 与
 *       `retrieveWebEvidence()`，为计费去改它们的返回签名会波及
 *       `WebEvidence` 的全部消费方（前端卡片 / PDF / Excel / 缓存字段白名单）。
 *       因此用一个**请求作用域**归集器：
 *         检索层每次拿到 usage → `recordWebSearchUsage(...)`
 *         路由在扣费前           → `drainWebSearchUsage()` → 汇总 → 喂给 `computeAiCost()`
 *
 * 🔴 与 `usage-collector.ts` 的关系：**严禁混用**。
 *     `usage-collector.ts` 的 `recordUsage()` 记录的是「主链路 LLM token」，它的
 *     `drainUsage()` 被 `valuation / recognize / internal-products` 三条链路消费。
 *     `sales-strategy` **从不调用** `drainUsage()`，检索用量一旦混进去就会漂移到
 *     **下一个 valuation / recognize 请求**上被 drain 走 ⇒ **A 用户花的钱算到 B 用户头上**。
 *     故检索用量必须走本文件，另起一个桶。
 *
 * 🔴 为什么必须是 AsyncLocalStorage 而不是模块级数组：
 *     检索阶段墙钟实测 61s，5 条 query 并发，期间同一 Node 进程完全可以同时处理
 *     另一个用户的请求（Next.js route handler 是并发的）。模块级数组会让两条请求的
 *     记录混进同一个桶 ⇒ 串账。ALS 的 store 会自动穿透 `await` 与 `Promise.all`，
 *     且**零参数透传**（不需要改 `retrieveStrategyContext` / `retrieveWebEvidence` /
 *     `searchViaArk` 的任何签名）。
 *
 * 四道防线（缺一不可）：
 *   ① ALS 作用域：只有 `runWithSearchBillingScope()` 回调内（含其 await 的子调用）的
 *      record 才会落进本请求的桶；
 *   ② 唯一消费点：路由扣费前 drain 一次，结果存起来复用（drain 取完即清空，天然幂等）；
 *   ③ 作用域回调的 `finally` 里无条件再 drain 一次 ⇒ 覆盖所有提前 return 出口
 *      （400 / 402 / 429 / 502 / 503 / 500），绝不把用量留给下一个请求；
 *   ④ 无 scope 时**不静默丢弃**：写模块级 fallback 数组 + 打
 *      `console.warn("[search-usage] no-scope-fallback")` ⇒ 一旦有人破坏了作用域，
 *      日志里立刻可见（红线 5：不静默吞掉）。
 *
 * 只记录用量，绝不碰数据库、绝不参与计价：算钱交给 `spend.ts` 的 `computeAiCost()`，
 * 落库交给 `deductCredits()`。本文件里**禁止**出现 `computeAiCost` / `deductCredits` /
 * `AI_COST_MULTIPLIER`。
 */
import { AsyncLocalStorage } from "node:async_hooks";

/** 检索用量记录（检索层 → 计费层的唯一载体） */
export interface WebSearchUsageRecord {
  /** 计量来源：`"ark_web_search"` | `"tavily"` | `"serper"` | `"brave"` */
  kind: string;
  /**
   * `usage.tool_usage.web_search` —— 按次计量的联网检索次数。
   * ⚠️ 决策 1：按次费用（¥0.004/次）**由平台吸收**，本字段只留痕，绝不转成用户积分。
   */
  searchCalls: number;
  /** 检索侧 input token（已按 `web-evidence.ts` 的拆分/兜底口径得出） */
  inputTokens: number;
  /** 检索侧 output token（含 reasoning —— `output_tokens` 已含 reasoning，不得重复相加） */
  outputTokens: number;
  /** true = 响应里拿不到可用 usage，上面两个 token 是经验值（不是静默记 0） */
  estimated: boolean;
  /** true = 本次尝试 HTTP 失败/超时：用量取不到，只留痕，不计任何费用 */
  failed?: boolean;
  /** true = 本条 query 的 searchCalls 超过软上限（决策 3：只观测，不硬截断） */
  overLimit?: boolean;
  /** 归属 query（截断 40 字，已 sanitize，不含 PII） */
  query?: string;
  /** 站点（审计用） */
  site?: "cn" | "com";
  /** 本条 query 墙钟耗时（ms） */
  elapsedMs?: number;
}

/** `drainWebSearchUsage()` 结果的汇总（可直接喂给 `computeAiCost` 的 extra* 入参） */
export interface SearchUsageSummary {
  /** 检索侧 input token 合计 */
  inputTokens: number;
  /** 检索侧 output token 合计 */
  outputTokens: number;
  /** 检索次数合计（只留痕，不计费） */
  searchCalls: number;
  /** 任一条为经验值 ⇒ true（对账时用来筛「哪些是估的」） */
  estimated: boolean;
  /** HTTP 失败 / 超时的尝试条数（该部分用量取不到，按 0 记） */
  failedAttempts: number;
  /** 任一条超软上限 ⇒ true（决策 3 的事后观测出口） */
  overLimit: boolean;
  /** 记录条数（含失败留痕条） */
  records: number;
}

/** 请求作用域：桶是「本请求内所有 record 的容器」 */
const storage = new AsyncLocalStorage<WebSearchUsageRecord[]>();

/**
 * 模块级兜底桶：仅在**没有 ALS scope** 时启用（单测直调、脱离 async context 的定时器、
 * 或有人忘了包作用域）。它不提供并发隔离，所以每次写入都会打 warn —— 生产日志里
 * 出现 `[search-usage] no-scope-fallback` 就说明作用域被破坏了，必须修调用方。
 */
let fallbackRecords: WebSearchUsageRecord[] = [];
let noScopeWarnCount = 0;

/** record 入参归一（防 NaN / 负数 / 超长 query 进账） */
function normalizeRecord(rec: WebSearchUsageRecord): WebSearchUsageRecord {
  const out: WebSearchUsageRecord = {
    kind: typeof rec?.kind === "string" && rec.kind ? rec.kind : "unknown",
    searchCalls: Math.max(0, Math.trunc(Number(rec?.searchCalls) || 0)),
    inputTokens: Math.max(0, Math.trunc(Number(rec?.inputTokens) || 0)),
    outputTokens: Math.max(0, Math.trunc(Number(rec?.outputTokens) || 0)),
    estimated: rec?.estimated === true,
  };
  if (rec?.failed === true) out.failed = true;
  if (rec?.overLimit === true) out.overLimit = true;
  if (typeof rec?.query === "string" && rec.query) out.query = rec.query.slice(0, 40);
  if (rec?.site === "cn" || rec?.site === "com") out.site = rec.site;
  if (typeof rec?.elapsedMs === "number" && Number.isFinite(rec.elapsedMs)) {
    out.elapsedMs = Math.max(0, Math.trunc(rec.elapsedMs));
  }
  return out;
}

/**
 * 建立检索计费作用域：把「检索 + LLM + 扣费」整段包进来。
 *
 * `fn` 内部（含其 await 的所有子调用）的 `recordWebSearchUsage()` 都落在同一桶里，
 * 与其它并发请求天然隔离。
 *
 * @example
 * ```ts
 * return await runWithSearchBillingScope(async () => {
 *   try {
 *     // retrieveStrategyContext() → searchViaArk() → recordWebSearchUsage()
 *     ...
 *   } finally {
 *     drainWebSearchUsage(); // ③ 兜底：任何提前 return 都不留残留
 *   }
 * });
 * ```
 */
export function runWithSearchBillingScope<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run([], fn);
}

/**
 * 记录一次检索用量（检索层唯一出口，永不抛错）。
 *
 * ⚠️ 记账点必须在 `parseArkOutput` / `extractJsonObject` **之前**：
 *    HTTP 一旦 200，钱就已经花了，与后续 JSON 是否解析得出来无关。
 */
export function recordWebSearchUsage(rec: WebSearchUsageRecord): void {
  const bucket = storage.getStore();
  const normalized = normalizeRecord(rec);
  if (!bucket) {
    // ④ 不静默丢弃：留痕 + 可见告警
    fallbackRecords.push(normalized);
    noScopeWarnCount += 1;
    // eslint-disable-next-line no-console
    console.warn("[search-usage] no-scope-fallback", {
      kind: normalized.kind,
      searchCalls: normalized.searchCalls,
      inputTokens: normalized.inputTokens,
      outputTokens: normalized.outputTokens,
      estimated: normalized.estimated,
      failed: normalized.failed === true,
      count: noScopeWarnCount,
    });
    return;
  }
  bucket.push(normalized);
}

/**
 * 取出本作用域（或兜底桶）的全部记录并**清空**（幂等：第二次恒返回 `[]`）。
 *
 * 这是**唯一**的消费点：同一份用量绝不会被扣两次。
 */
export function drainWebSearchUsage(): WebSearchUsageRecord[] {
  const bucket = storage.getStore();
  if (!bucket) {
    if (fallbackRecords.length === 0) return [];
    const out = fallbackRecords;
    fallbackRecords = [];
    return out;
  }
  if (bucket.length === 0) return [];
  const out = [...bucket];
  bucket.length = 0;
  return out;
}

/** 当前作用域内是否已归集到用量（只读探针，不清空） */
export function hasWebSearchUsage(): boolean {
  const bucket = storage.getStore();
  if (!bucket) return fallbackRecords.length > 0;
  return bucket.length > 0;
}

/**
 * 汇总记录（供路由直接喂给 `computeAiCost` 的 `extraInputTokens` / `extraOutputTokens` / `metered`）。
 *
 * ⚠️ `failed:true` 的记录**不贡献任何 token**（用量取不到就按 0 记，见设计 §9.1），
 *    但会计入 `failedAttempts` 留痕 —— 不静默、也不虚构。
 */
export function summarizeWebSearchUsage(recs: WebSearchUsageRecord[]): SearchUsageSummary {
  const summary: SearchUsageSummary = {
    inputTokens: 0,
    outputTokens: 0,
    searchCalls: 0,
    estimated: false,
    failedAttempts: 0,
    overLimit: false,
    records: 0,
  };
  if (!Array.isArray(recs) || recs.length === 0) return summary;

  for (const rec of recs) {
    summary.records += 1;
    if (rec.failed === true) {
      summary.failedAttempts += 1;
      // 失败尝试也可能带检索次数留痕（若响应体里有 usage），但不带 token
      summary.searchCalls += Math.max(0, Math.trunc(Number(rec.searchCalls) || 0));
      continue;
    }
    summary.inputTokens += Math.max(0, Math.trunc(Number(rec.inputTokens) || 0));
    summary.outputTokens += Math.max(0, Math.trunc(Number(rec.outputTokens) || 0));
    summary.searchCalls += Math.max(0, Math.trunc(Number(rec.searchCalls) || 0));
    if (rec.estimated === true) summary.estimated = true;
    if (rec.overLimit === true) summary.overLimit = true;
  }
  return summary;
}
