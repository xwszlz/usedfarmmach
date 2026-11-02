/**
 * LLM token 用量归集（纯函数，零运行时依赖）
 * ─────────────────────────────────────────────────────────
 * 背景：一次 AI 请求可能发起**多次** LLM 调用（例如深度分析的「初稿 + 输出被
 * `max_tokens` 截断后的续写轮」）。每一次调用都会真实产生 token 费用，因此计费
 * 口径必须是**逐字段累加**，而不是「最后一次调用的用量覆盖前面的」。
 *
 * 为什么单独成文件：
 *   - 覆盖式归集是**静默**的 —— 不报错、不告警，只是平台少扣积分，只能靠单测钉住；
 *   - 路由文件（`src/app/api/agents/**`）会 import `next/server` / prisma 等重依赖，
 *     直接测路由成本高，把这段纯逻辑抽出来才能低成本单测。
 *
 * 字段口径：与 `ark-client.ts` 的 `DoubaoUsage`（`prompt_tokens` / `completion_tokens`）
 * 一一对应，归一化成 `inputTokens` / `outputTokens`；与 `spend.ts` 的 `computeAiCost`
 * 入参同名，可直接透传。
 */

/** 归一化后的 token 用量（输入 / 输出，均为非负整数） */
export interface LlmTokenUsage {
  /** 输入 token（对应 provider 的 `prompt_tokens`） */
  inputTokens: number;
  /** 输出 token（对应 provider 的 `completion_tokens`） */
  outputTokens: number;
}

/**
 * 把任意入参折成非负整数 token 数。
 *
 * provider 未返回 usage 字段、返回 `null`、或返回了非数值时一律按 0 处理 ——
 * 「没计量到」不等于「可以整笔丢掉前面已经计量到的用量」。
 */
function toTokenCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** 零用量（每次返回新对象，避免共享可变常量被误改） */
export function emptyUsage(): LlmTokenUsage {
  return { inputTokens: 0, outputTokens: 0 };
}

/**
 * 累加两次 LLM 调用的 token 用量（**纯函数**，不修改入参）。
 *
 * 逐字段相加，`base` / `delta` 任一侧缺失该字段（或字段非法）时按 0 处理；
 * 结果与累加顺序无关，因此调用点无论放在「首次调用之后」还是「续写之后」都不会丢量。
 *
 * @param base  已归集的用量（可为 `null` / `undefined`，按 0 处理）
 * @param delta 本次调用新增的用量（可为 `null` / `undefined`，按 0 处理）
 * @returns 累加后的新用量对象
 */
export function accumulateUsage(
  base: Partial<LlmTokenUsage> | null | undefined,
  delta: Partial<LlmTokenUsage> | null | undefined
): LlmTokenUsage {
  return {
    inputTokens: toTokenCount(base?.inputTokens) + toTokenCount(delta?.inputTokens),
    outputTokens: toTokenCount(base?.outputTokens) + toTokenCount(delta?.outputTokens),
  };
}

/**
 * 把多次调用的用量一次性归集（按调用顺序累加，等价于依次 `accumulateUsage`）。
 *
 * @param usages 各次调用的用量列表（允许含 `null` / `undefined` / 缺字段项）
 */
export function accumulateUsages(
  usages: ReadonlyArray<Partial<LlmTokenUsage> | null | undefined>
): LlmTokenUsage {
  let total = emptyUsage();
  for (const usage of usages) {
    total = accumulateUsage(total, usage);
  }
  return total;
}
