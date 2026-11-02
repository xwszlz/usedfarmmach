/**
 * AI 调用 token 用量归集器（轻量、进程内）
 *
 * 用途：估值链路的真实 LLM 调用点在 image-analyzer / video-analyzer 内部，
 *      这两个 analyzer 的返回签名是业务结果对象（ImageAnalysisResult / VideoAnalysisResult），
 *      为计费去改它们的返回签名会波及全链路。因此用一个模块级收集器：
 *        analyzer 每拿到一次 provider usage → recordUsage(...)
 *        route 在估值计算完成后 → drainUsage() → 按模型分组 computeAiCost → 扣一次积分。
 *
 * 作用域与红线：
 *   - 仅在「单次请求的 Node runtime」内有效（Next route handler 同步生命周期）。
 *   - 只记录 usage，绝不碰数据库；扣积分由 route 显式调用 deductCredits 完成。
 *   - 处理链路结尾必须 drainUsage()，避免模块级数组跨请求串账。
 *   - 若 provider 未返回 usage：由调用方用 ESTIMATED_TOKENS 兜底并标 estimated=true，
 *     breakdown 里能一眼看出"这一笔是估的还是实测的"。
 *
 * 🔴 2026-11-01 补充：**检索用量不要用本文件的 `recordUsage()`**。
 *    本归集器的 `drainUsage()` 被 `valuation` / `recognize` / `internal-products`
 *    三条链路消费，而 `sales-strategy` **从不调用** `drainUsage()` ——
 *    检索用量一旦记进来就会漂移到**下一个** valuation / recognize 请求上被 drain 走
 *    ⇒ **A 用户花的钱算到 B 用户头上**（跨链路串账）。
 *    检索用量请走 `search-usage-collector.ts`（AsyncLocalStorage 请求作用域 + 独立桶）。
 */
export interface UsageRecord {
  /** 必须与 src/lib/credits/spend.ts 的 MODEL_PRICING 键一致 */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** true = provider 未返回 usage，tokens 为保守估算值 */
  estimated?: boolean;
}

/** provider 未返回 usage 时的保守估算 token 数（用于兜底计费，并标 estimated=true） */
export const ESTIMATED_TOKENS = { input: 1500, output: 500 };

const records: UsageRecord[] = [];

/**
 * 记录一次 LLM 调用的 token 用量。
 *
 * @param model        模型标识（须命中 spend.ts 的 MODEL_PRICING）
 * @param inputTokens  输入 token
 * @param outputTokens 输出 token
 * @param opts.estimated true 表示 provider 没给 usage，上面两个值是估算的
 */
export function recordUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  opts?: { estimated?: boolean }
): void {
  records.push({
    model,
    inputTokens: Math.max(0, Math.floor(inputTokens || 0)),
    outputTokens: Math.max(0, Math.floor(outputTokens || 0)),
    ...(opts?.estimated ? { estimated: true } : {}),
  });
}

/** 取出全部记录并清空（防止跨请求串账） */
export function drainUsage(): UsageRecord[] {
  if (records.length === 0) return [];
  const out = [...records];
  records.length = 0;
  return out;
}

/** 当前是否已归集到任何用量（无需 drain 的只读探针） */
export function hasUsage(): boolean {
  return records.length > 0;
}
