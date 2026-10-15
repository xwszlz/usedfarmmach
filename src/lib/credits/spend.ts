/**
 * 积分扣减（AI 功能计费核心）
 *
 * 积分按各站本位币计价（老板口径 2026-10-12，修订 2026-10-12-E；2026-10-13 单位细化）：
 *   - 充值：.cn 站 1 元 = 100 积分；.com 站 $1 = 100 积分；
 *   - AI 消耗 = 实际模型成本 × 2 反算积分，且**站点感知本位币**：
 *       · .com 站：USD 计价模型直接按 $ 计费（不折 ¥），与"$1=100 积分"充值口径对齐；
 *       · .cn 站 / CNY 计价模型：按 ¥ 计费（USD 模型仍按固定汇率 7.2 折 ¥）。
 *
 * 计费链路：四大 AI 功能按大模型 token 实际消耗成本 × 2 收费，反算积分消耗。
 *   1) 从 LLM provider 返回里取 usage（prompt_tokens / completion_tokens）与所用 model id；
 *   2) 用模型价格表算实际成本 actualCost（站点感知本位币）：
 *      - $ 计价模型 + .com 站：actualCost = actualCostUsd（直接以 $ 计，不做 ¥ 折算）；
 *      - $ 计价模型 + .cn 站：actualCost = actualCostUsd × 7.2 折 ¥；
 *      - ¥ 计价模型：actualCost = actualCostCny；
 *      - 价格表见下方 MODEL_PRICING；未知模型用兜底 ¥0.004/1K 混合价（标注"兜底，待校准"）。
 *   3) points = round(actualCost × 100 × 2)（×100 即 CREDITS_PER_UNIT：1 元/1 美元 = 100 积分）；
 *   4) 在 CreditTransaction.breakdown JSON 记录 currency + 全部计量字段
 *      （actualCostCny 字段存"计费货币下的成本"，配合 currency 区分 cny/usd）。
 *
 * 与 grant.ts 保持一致的写法：事务内读 User.credits → 不足整体拒绝（E7 红线：绝不产生负余额）→
 * FIFO 减 CreditLot → 写 CreditTransaction(type=ai_deduct) → 扣 User.credits。
 */
import { prisma } from "@/lib/db";
import { isComSite } from "@/config/site";
import { getCurrencyOfCountry, getUnit, getRdSync } from "./fx";

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
  /** 计费币种代码（CNY/USD/VND/...），由注册国解析得到；.cn 恒为 CNY */
  currency?: string;
  /** 豆包 CNY 实际成本（无论站点/国家，底价统一为 CNY） */
  actualCostCny: number;
  multiplier: number;
  points: number;
  /** 当时的积分单位换算（1 计价单位 = pointsPerUnit 积分），用于区分新旧单位时代的账本 */
  pointsPerUnit?: number;
  /** 统一渠道标记（恒为 doubao，5 路由统一国行火山方舟豆包） */
  channel?: string;
  /** 链路路径：b-channel（.com 经 HK/SG 代理）/ direct（.cn 直连） */
  linkPath?: "b-channel" | "direct";
  /** 计费国家（注册锁定的 AI 计费国） */
  country?: string | null;
  /** 豆包原始 CNY 成本（独立字段，便于核对） */
  cnyCost?: number;
  /** 使用的 CNY→本币 实时汇率 R_d(c)（.cn 不填） */
  fxRateUsed?: number;
}

/**
 * 模型价格表（元或美元 / 1K tokens，input/output 分开，见各条 currency）。
 * ⚠️ 单价以各厂商官方公示价为准，未核实的保留"待校准"标注；未知模型用兜底混合价。
 *    当前主流模型单价极低，单次调用 actualCost 多为小数——过去"1 元 = 1 积分"时
 *    round 后常为 0/1 积分，几乎收不到钱；现已通过细化计费单位解决：
 *    1 元 = 100 积分（CREDITS_PER_UNIT），单次调用即可扣出实在的积分，无需最低消费。
 */
interface ModelPrice {
  inPrice: number;
  outPrice: number;
  currency: "cny" | "usd";
  note?: string;
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  // 豆包（.cn 主用 / .com 经 B 通道降级）：火山方舟官方价（推理输入 6 元/百万、输出 30 元/百万）
  "doubao-seed-2-1-pro-260915": { inPrice: 0.006, outPrice: 0.03, currency: "cny", note: "火山方舟官方：推理输入 6 元/百万 tokens、输出 30 元/百万 tokens" },
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

/**
 * 计费单位换算：1 元人民币 = 100 积分，1 美元 = 100 积分。
 * 即 1 积分 = 1 分钱（0.01 元）/ 1 美分（$0.01）。
 */
export const CREDITS_PER_UNIT = 100;

/** AI 计费倍率（实际支出 × 2） */
export const AI_COST_MULTIPLIER = 2;

/**
 * 依据模型单价与 token 用量计算实际成本与应扣积分。
 * 站点感知本位币（老板口径 2026-10-12-E）：
 *   - .com 站 + USD 计价模型：actualCost 直接取 $ 值（不折 ¥），与"$1=100 积分"充值对齐；
 *   - 其余（.cn 站 / CNY 计价模型）：USD 模型仍按 7.2 折 ¥，CNY 模型直接按 ¥。
 * 最终 points = round(actualCost × 100 × 2)。
 */
export function computeAiCost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** 注册锁定的 AI 计费国家（R-04/R-05 落库字段），缺省回落 USD */
  billingCountry?: string;
  /** CNY→本币 实时汇率 R_d(c)；缺省走同步静态兜底（getRdSync） */
  rd?: number;
}): AiCostBreakdown {
  const p: ModelPrice = MODEL_PRICING[params.model] || FALLBACK_PRICING;
  const inputTokens = Math.max(0, Math.floor(params.inputTokens || 0));
  const outputTokens = Math.max(0, Math.floor(params.outputTokens || 0));

  // 底价统一为豆包 CNY 成本（5 路由统一国行火山方舟豆包，不再有 USD 计价模型）
  const cnyCost =
    (inputTokens / 1000) * p.inPrice + (outputTokens / 1000) * p.outPrice;

  // 注册国感知：国家 → 币种 → 计价单位 U(c) + 汇率 R_d(c)（CNY→本币）
  const currency = getCurrencyOfCountry(params.billingCountry);
  const unit = getUnit(currency);
  const rd =
    typeof params.rd === "number" && params.rd > 0 ? params.rd : getRdSync(currency);
  const linkPath: "b-channel" | "direct" =
    isComSite() && process.env.ARK_PROXY_URL ? "b-channel" : "direct";

  // 公式：points = round( 豆包CNY成本 × R_d(c) ÷ U(c) × 100 × 2 )
  // .cn：R=1、U=1 → 退化为 round(成本 × 100 × 2)，与改动前完全一致（验收 I-1）。
  const points = Math.round(
    (cnyCost * rd) / unit * CREDITS_PER_UNIT * AI_COST_MULTIPLIER
  );

  return {
    model: params.model,
    inputTokens,
    outputTokens,
    inPrice: p.inPrice,
    outPrice: p.outPrice,
    currency,
    actualCostCny: Math.round(cnyCost * 1000) / 1000,
    multiplier: AI_COST_MULTIPLIER,
    points,
    pointsPerUnit: CREDITS_PER_UNIT,
    channel: "doubao",
    linkPath,
    country: params.billingCountry ?? null,
    cnyCost: Math.round(cnyCost * 1000) / 1000,
    fxRateUsed: currency === "CNY" ? undefined : rd,
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
  breakdown?: Record<string, unknown>,
  type: string = "ai_deduct"
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
            type,
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
          type,
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
