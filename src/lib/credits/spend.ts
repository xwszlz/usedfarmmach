/**
 * 积分扣减（AI 功能计费核心）
 *
 * 积分按各站本位币计价（老板口径 2026-10-12，修订 2026-10-12-E）：
 *   - 充值：.cn 站 1 元 = 1 积分；.com 站 $1 = 1 积分；
 *   - AI 消耗 = 实际模型成本 × 2 反算积分，且**站点感知本位币**：
 *       · .com 站：USD 计价模型直接按 $ 计费（不折 ¥），与"$1=1 积分"充值口径对齐；
 *       · .cn 站 / CNY 计价模型：按 ¥ 计费（USD 模型仍按固定汇率 7.2 折 ¥）。
 *
 * 计费链路：四大 AI 功能按大模型 token 实际消耗成本 × 2 收费，反算积分消耗。
 *   1) 从 LLM provider 返回里取 usage（prompt_tokens / completion_tokens）与所用 model id；
 *   2) 用模型价格表算实际成本 actualCost（站点感知本位币）：
 *      - $ 计价模型 + .com 站：actualCost = actualCostUsd（直接以 $ 计，不做 ¥ 折算）；
 *      - $ 计价模型 + .cn 站：actualCost = actualCostUsd × 7.2 折 ¥；
 *      - ¥ 计价模型：actualCost = actualCostCny；
 *      - 价格表见下方 MODEL_PRICING；未知模型用兜底 ¥0.004/1K 混合价（标注"兜底，待校准"）。
 *   3) points = round(actualCost × 2)；
 *   4) 在 CreditTransaction.breakdown JSON 记录 currency + 全部计量字段
 *      （actualCostCny 字段存"计费货币下的成本"，配合 currency 区分 cny/usd）。
 *
 * 与 grant.ts 保持一致的写法：事务内读 User.credits → 不足整体拒绝（E7 红线：绝不产生负余额）→
 * FIFO 减 CreditLot → 写 CreditTransaction(type=ai_deduct) → 扣 User.credits。
 */
import { prisma } from "@/lib/db";
import { isComSite } from "@/config/site";

export interface DeductResult {
  ok: boolean;
  /** 余额不足（调用方应返回 402/403 带 rechargeUrl） */
  insufficient?: boolean;
  credits?: number;
  required?: number;
}

export interface AiCostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inPrice: number;
  outPrice: number;
  /** 计费货币：cny 或 usd（.com 站 USD 模型直接以 $ 计） */
  currency?: "cny" | "usd";
  /** 计费货币下的实际成本（cny 或 usd，配合 currency 字段） */
  actualCostCny: number;
  multiplier: number;
  points: number;
}

/**
 * 模型价格表（¥/1K tokens，input/output 分开）。
 * ⚠️ 单价均为"保守估计值"，实际以各厂商账单为准；未知模型用兜底混合价。
 *    当前主流模型单价极低，单次调用 actualCostCny 多为小数，round 后常为 0/1 积分——
 *    若希望 AI 调用有实在收费，需上调单价或设最低消费（见 spend.ts 报告）。
 */
interface ModelPrice {
  inPrice: number;
  outPrice: number;
  currency: "cny" | "usd";
  note?: string;
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  // 豆包（.cn 主用 / .com 国际品牌降级）：seed 2.1 pro 保守估
  "doubao-seed-2-1-pro-260915": { inPrice: 0.012, outPrice: 0.036, currency: "cny", note: "豆包 seed-2.1-pro 保守估，待校准" },
  // Gemini（估值/深度分析境外链路）
  "gemini-1.5-flash": { inPrice: 0.0003, outPrice: 0.0006, currency: "usd", note: "Gemini 1.5 Flash 保守估，待校准" },
  "gemini-2.5-flash": { inPrice: 0.0003, outPrice: 0.0025, currency: "usd", note: "Gemini 2.5 Flash 保守估，待校准" },
  // OpenRouter（深度分析 / 视频分析降级）
  "openai/gpt-4o": { inPrice: 0.0025, outPrice: 0.01, currency: "usd", note: "GPT-4o via OpenRouter 保守估，待校准" },
  "meta-llama/llama-3.2-11b-vision-instruct": { inPrice: 0.0001, outPrice: 0.0002, currency: "usd", note: "Llama 3.2 vision via OpenRouter，待校准" },
  "google/gemini-2.0-flash-001:free": { inPrice: 0, outPrice: 0, currency: "usd", note: "免费模型，0 成本" },
};

/** 兜底混合单价（未知模型） */
export const FALLBACK_PRICING: ModelPrice = {
  inPrice: 0.004,
  outPrice: 0.004,
  currency: "cny",
  note: "兜底混合价，待校准",
};

/** 固定美元→人民币汇率（仅用于把 $ 计价模型的 USD 成本折算成 ¥） */
export const DEFAULT_USD_TO_CNY = 7.2;

/** AI 计费倍率（实际支出 × 2） */
export const AI_COST_MULTIPLIER = 2;

/**
 * 依据模型单价与 token 用量计算实际成本与应扣积分。
 * 站点感知本位币（老板口径 2026-10-12-E）：
 *   - .com 站 + USD 计价模型：actualCost 直接取 $ 值（不折 ¥），与"$1=1 积分"充值对齐；
 *   - 其余（.cn 站 / CNY 计价模型）：USD 模型仍按 7.2 折 ¥，CNY 模型直接按 ¥。
 * 最终 points = round(actualCost × 2)。
 */
export function computeAiCost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): AiCostBreakdown {
  const p: ModelPrice = MODEL_PRICING[params.model] || FALLBACK_PRICING;
  const inputTokens = Math.max(0, Math.floor(params.inputTokens || 0));
  const outputTokens = Math.max(0, Math.floor(params.outputTokens || 0));

  const rawCost =
    (inputTokens / 1000) * p.inPrice + (outputTokens / 1000) * p.outPrice;

  // 站点感知本位币：
  //   comUsd = 在 .com 站且模型以 USD 计价 → 直接以 $ 计费，不折 ¥。
  const comUsd = isComSite() && p.currency === "usd";
  const actualCost = comUsd
    ? rawCost
    : p.currency === "usd"
      ? rawCost * DEFAULT_USD_TO_CNY
      : rawCost;
  const currency: "cny" | "usd" = comUsd ? "usd" : "cny";

  const points = Math.round(actualCost * AI_COST_MULTIPLIER);

  return {
    model: params.model,
    inputTokens,
    outputTokens,
    inPrice: p.inPrice,
    outPrice: p.outPrice,
    currency,
    actualCostCny: Math.round(actualCost * 1000) / 1000,
    multiplier: AI_COST_MULTIPLIER,
    points,
  };
}

/**
 * 扣减积分（AI 功能调用计费入口）。
 *
 * 余额不足时整体拒绝（返回 { ok:false, insufficient:true }），调用方据此返回
 * 402/403 并带 rechargeUrl=/${locale}/credits；绝不让 User.credits 变负。
 *
 * breakdown 为可选 JSON 对象（通常传 AiCostBreakdown），写入 CreditTransaction.breakdown 文本列。
 */
export async function deductCredits(
  userId: string,
  points: number,
  reason: string,
  breakdown?: Record<string, unknown>
): Promise<DeductResult> {
  const need = Math.max(0, Math.floor(points));

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      const current = user?.credits ?? 0;

      // 余额不足：整体拒绝，零写操作
      if (current < need) {
        return { insufficient: true as const, credits: current, required: need };
      }

      if (need > 0) {
        // FIFO 扣减 CreditLot（按过期时间升序，先扣快过期的）
        let remaining = need;
        const lots = await tx.creditLot.findMany({
          where: {
            userId,
            remainingAmount: { gt: 0 },
            expiresAt: { gt: new Date() },
          },
          orderBy: { expiresAt: "asc" },
        });
        for (const lot of lots) {
          if (remaining <= 0) break;
          const take = Math.min(lot.remainingAmount, remaining);
          await tx.creditLot.update({
            where: { id: lot.id },
            data: { remainingAmount: { decrement: take } },
          });
          remaining -= take;
        }
        const account = lots.length > 1 ? "mixed" : (lots[0]?.account ?? "recharge");
        const newBalance = current - need;
        await tx.creditTransaction.create({
          data: {
            userId,
            type: "ai_deduct",
            amount: -need,
            balance: newBalance,
            reason,
            account,
            breakdown: breakdown ? JSON.stringify(breakdown) : null,
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: need } },
        });
        return { insufficient: false as const, credits: newBalance, required: need };
      }

      // need === 0：仍记录一条 0 金额账本（审计 AI 调用 / token 用量），不动余额与批次
      await tx.creditTransaction.create({
        data: {
          userId,
          type: "ai_deduct",
          amount: 0,
          balance: current,
          reason,
          account: "recharge",
          breakdown: breakdown ? JSON.stringify(breakdown) : null,
        },
      });
      return { insufficient: false as const, credits: current, required: 0 };
    });

    if (result.insufficient) {
      return {
        ok: false,
        insufficient: true,
        credits: result.credits,
        required: result.required,
      };
    }
    return { ok: true, credits: result.credits, required: result.required };
  } catch (error) {
    console.error("[credits/spend] deductCredits 失败:", error);
    throw error;
  }
}
