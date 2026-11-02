/**
 * 积分扣减（AI 功能计费核心）
 *
 * 积分计价口径（老板口径 2026-10-12，修订 2026-10-12-E；2026-10-13 单位细化；2026-10-28 全球统一）：
 *   - 充值：**全球统一购买力 —— 1 元人民币 = 100 积分**。.cn 站直接 1 元 = 100 积分；
 *     .com 站以美元支付，按当日人民币汇率折回人民币后再换积分（`fx.creditsFromLocalAmount`）。
 *   - AI 消耗：同样按人民币口径折算（见下），1 积分 = ¥0.01，各国用户 1000 积分购买力一致。
 *
 * 计费链路：AI 功能按大模型 token 的实际成本乘以运营定价倍率（`AI_COST_MULTIPLIER`）反算积分。
 *   1) 从 LLM provider 返回里取 usage（prompt_tokens / completion_tokens）与所用 model id；
 *   2) 用模型价格表算实际成本 cnyCost（底价统一为豆包 CNY 成本，见 `MODEL_PRICING`；
 *      未知模型用兜底 ¥0.004/1K 混合价，标注「兜底，待校准」）；
 *   3) points = round(cnyCost × CREDITS_PER_UNIT × AI_COST_MULTIPLIER)；
 *   4) 在 CreditTransaction.breakdown JSON 记录 currency + 全部计量字段（见 `AiCostBreakdown`）。
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
  /** 计费币种代码：2026-10-28 起 AI 消耗侧全球统一 CNY（充值侧另论） */
  currency?: string;
  /** 豆包 CNY 实际成本（消耗侧唯一计费成本口径） */
  actualCostCny: number;
  /** 运营定价倍率（[商业机密·内部]，取自 `AI_COST_MULTIPLIER`） */
  multiplier: number;
  points: number;
  /** 当时的积分单位换算（1 计价单位 = pointsPerUnit 积分），用于区分新旧单位时代的账本 */
  pointsPerUnit?: number;
  /** 统一渠道标记（恒为 doubao，5 路由统一国行火山方舟豆包） */
  channel?: string;
  /** 链路路径：b-channel（.com 经 HK/SG 代理）/ direct（.cn 直连） */
  linkPath?: "b-channel" | "direct";
  /** 用户注册锁定的 AI 计费国（仅作审计留痕，2026-10-28 起不参与消耗计价） */
  country?: string | null;
  /** 豆包原始 CNY 成本（独立字段，便于核对） */
  cnyCost?: number;
  /** CNY→本币 汇率：消耗侧全球统一人民币口径，恒为 undefined（字段保留供读旧账本） */
  fxRateUsed?: number;

  // ── 2026-11-01 检索成本并入（**全部 optional**，不传新参数时这些字段根本不出现）──

  /** 检索侧 input token 合计（已按 input 单价并入 `cnyCost`，是它的一部分，不是额外） */
  searchInputTokens?: number;
  /** 检索侧 output token 合计（已按 output 单价并入 `cnyCost`） */
  searchOutputTokens?: number;
  /** 检索 token 折算的 CNY —— `cnyCost` 的**子集**，不是额外加在它上面 */
  searchCostCny?: number;
  /** 任一条检索用量为经验值 ⇒ true（对账时筛「哪些是估的」） */
  searchEstimated?: boolean;
  /** 检索整体命中缓存 ⇒ true（此时检索 token 为 0 —— 成本确实没发生） */
  searchCached?: boolean;
  /** `usage.tool_usage.web_search` 合计（只留痕，见决策 1） */
  searchCalls?: number;
  /** `searchCalls × ARK_WEB_SEARCH_UNIT_PRICE_CNY`：平台侧真实支出，**仅供对账** */
  searchCallCostCny?: number;
  /** **恒 false** —— 检索按次费用由平台吸收，账本上「看得见没收」的显式留痕（决策 1） */
  searchCallChargedToUser?: boolean;
  /** 失败/超时的检索尝试条数（该部分用量取不到，按 0 记） */
  searchFailedAttempts?: number;
  /** 任一 query 的检索次数超过软上限 ⇒ true（决策 3 的事后观测出口） */
  searchOverLimit?: boolean;
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
 * 计费单位换算：1 元人民币 = 100 积分（AI 消耗侧全球统一人民币口径，见 `computeAiCost`）。
 * 充值侧口径一致：本币金额先按汇率折回人民币，再 × 100 得积分（见 `fx.creditsFromLocalAmount`）。
 * 即 1 积分 = 0.01 元。
 */
export const CREDITS_PER_UNIT = 100;

/**
 * 运营定价倍率（[商业机密·内部]）。
 * ⚠️ 具体数值只在此处维护：注释、文档、commit message、对外文案均不得展开其取值。
 * 调整本常量属于定价决策，需与 `getAiCostGuardrail()` 的单次护栏联动复核。
 */
export const AI_COST_MULTIPLIER = 10;

/**
 * 火山方舟「联网内容插件 · 联网资源」官方单价：**4 元 / 千次 = ¥0.004 一次**。
 *
 * 🔴 老板决策 1：这笔按次费用**由平台吸收**，不转嫁给用户 ⇒ 本常量只用于折算
 *    `searchCallCostCny`（对账留痕），**绝不**进入 `cnyCost` / `points` 的任何计算。
 *    （另：官方有每月 2 万次免费额度，见下。）
 *
 * ⚠️ 这是火山方舟**公示价**，不是商业机密；本文件的机密只有 `AI_COST_MULTIPLIER`。
 */
export const ARK_WEB_SEARCH_UNIT_PRICE_CNY = 0.004;

/**
 * 火山方舟「联网资源」官方月度免费额度（2 万次/月）。
 * 仅作平台成本核算与对账留痕，**不参与任何计价分支**（决策 1）。
 */
export const ARK_WEB_SEARCH_MONTHLY_FREE_CALLS = 20_000;

/**
 * 依据模型单价与 token 用量计算实际成本与应扣积分（成本加成口径）。
 *
 * 2026-10-28 运营决策：AI 消耗计费全球统一按人民币口径折算（1 元 = 100 积分，
 * 1 积分 = ¥0.01），不再按注册国币种差异化，以保证各国用户 1000 积分购买力一致。
 * 汇率仍用于充值侧折算，与本函数无关。
 *
 * 因此：`billingCountry` / `rd` 保留在签名里仅为兼容既有调用方（5 个 AI 路由仍在传，
 * 立刻删除会引发编译错误），函数内部一律忽略它们，恒定按 CNY（R=1、U=1）计价。
 *
 * 公式：points = round(cnyCost × 100 × AI_COST_MULTIPLIER)
 */
export function computeAiCost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /**
   * @deprecated 2026-10-28 起消耗计费全球统一人民币口径，本参数被忽略。
   *   保留仅为兼容既有调用方签名；新代码不需要传。
   */
  billingCountry?: string;
  /**
   * @deprecated 2026-10-28 起消耗计费固定 R=1（CNY），本参数被忽略。
   *   汇率仍用于充值侧折算（见 fx.ts / grant.ts）。
   */
  rd?: number;

  // ── 2026-11-01 新增（**additive**：不传时行为与改前逐位一致）──

  /**
   * 追加计入成本的 input token（火山方舟联网检索等非主链路用量），按当前模型 input 单价计价。
   *
   * 背景：检索的真实成本（实测单份 ≈ ¥0.9）过去完全没进账 —— 只按主 LLM 的
   * prompt/completion token 计费 ⇒ 单份漏收约 67%。本参数把它并进来。
   */
  extraInputTokens?: number;
  /** 追加计入成本的 output token（同上），按当前模型 output 单价计价 */
  extraOutputTokens?: number;
  /**
   * 按次计量项（火山方舟联网检索次数）。
   *
   * 🔴 老板决策 1：**只留痕，绝不并入 `cnyCost` / `points`** —— 按次费用由平台吸收。
   *    本函数只把它折算成 `searchCallCostCny` 写进 breakdown。
   */
  metered?: {
    /** 计量来源，如 `"ark_web_search"` */
    kind: string;
    /** 次数（如 `usage.tool_usage.web_search` 合计） */
    calls: number;
    /** 单次单价（CNY），传 `ARK_WEB_SEARCH_UNIT_PRICE_CNY` */
    unitPriceCny: number;
  };
}): AiCostBreakdown {
  const p: ModelPrice = MODEL_PRICING[params.model] || FALLBACK_PRICING;
  const inputTokens = Math.max(0, Math.floor(params.inputTokens || 0));
  const outputTokens = Math.max(0, Math.floor(params.outputTokens || 0));

  // 检索侧追加用量（additive：不传 ⇒ 恒为 0 ⇒ 下面所有式子退化成改前的原式）
  const extraInputTokens = Math.max(0, Math.floor(params.extraInputTokens || 0));
  const extraOutputTokens = Math.max(0, Math.floor(params.extraOutputTokens || 0));
  const billableInputTokens = inputTokens + extraInputTokens;
  const billableOutputTokens = outputTokens + extraOutputTokens;

  // 底价统一为豆包 CNY 成本（5 路由统一国行火山方舟豆包，不再有 USD 计价模型）
  // ⚠️ 仅把两个「因子」换成含 extra 的合成值；单价系数与加法结构一字未动。
  const cnyCost =
    (billableInputTokens / 1000) * p.inPrice + (billableOutputTokens / 1000) * p.outPrice;

  // 检索 token 折算的 CNY —— 是 `cnyCost` 的**子集**（对账用：检索占比多少一眼可见）。
  // 🔴 决策 2：`cached_tokens` 维持全价当利润缓冲 ⇒ 这里**没有任何** cached 计价分支。
  const searchCostCny =
    (extraInputTokens / 1000) * p.inPrice + (extraOutputTokens / 1000) * p.outPrice;

  // 检索按次费用：平台侧真实支出，**只留痕**（决策 1）
  const meteredCalls = Math.max(0, Math.floor(params.metered?.calls || 0));
  const meteredUnitPrice =
    typeof params.metered?.unitPriceCny === "number" && Number.isFinite(params.metered.unitPriceCny)
      ? Math.max(0, params.metered.unitPriceCny)
      : 0;
  const meteredCostCny = meteredCalls * meteredUnitPrice;

  // ── 全球统一人民币口径（2026-10-28 运营决策）──
  // 不再做「注册国 → 币种 → 计价单位 + 汇率」的分支：三个量恒为 CNY / 1 / 1，
  // 使 points 对所有国家用户一致（1000 积分全球等值）。
  const currency = "CNY";
  const unit = 1;
  const rd = 1;
  const linkPath: "b-channel" | "direct" =
    isComSite() && process.env.ARK_PROXY_URL ? "b-channel" : "direct";

  // 公式：points = round( 豆包CNY成本 × R × 100 × AI_COST_MULTIPLIER )，R 恒为 1
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
    // 全球统一人民币口径 ⇒ 无本币折算；字段保留以便读旧账本时不报错
    fxRateUsed: undefined,
    // ── 检索明细：**仅在真的传了检索用量时才出现** ──
    // 不传新参数的 6 个既有调用方，其 breakdown JSON 与改前逐字节一致（additive 回归锁）。
    ...(extraInputTokens > 0 || extraOutputTokens > 0 || params.metered
      ? {
          searchInputTokens: extraInputTokens,
          searchOutputTokens: extraOutputTokens,
          searchCostCny: Math.round(searchCostCny * 1000) / 1000,
          searchCalls: meteredCalls,
          searchCallCostCny: Math.round(meteredCostCny * 1000) / 1000,
          // 决策 1 的显式留痕：账本上一眼看出「这笔钱发生了，但没收用户的」
          searchCallChargedToUser: false,
        }
      : {}),
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
