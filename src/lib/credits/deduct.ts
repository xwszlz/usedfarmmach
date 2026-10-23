/**
 * 按量计费服务（AI 销售策略 / 解锁联系） —— 决策 B 落地
 *
 * 单次成本 = 实际 token 消耗 × 计费系数。
 *   - 计费系数【仅存 SystemConfig】（`ai_cost_coeff`），代码只读取、不写明文倍数，
 *     默认占位 1.0，具体值由老板后台配置（见 src/lib/credits/config.ts 读取处）。
 *   - 单次成本护栏：超过上限（SystemConfig `ai_cost_guardrail_credits`，占位值老板配）
 *     直接熔断返回 GUARDRAIL，绝不无限扣费。
 *   - 复用现有积分账户服务 `deductCredits`（FIFO 减 CreditLot + 写 CreditTransaction +
 *     User.credits 递减），不另造扣减逻辑（红线：绝不产生负余额）。
 */
import { deductCredits } from "@/lib/credits/spend";
import { getAiCostCoeff, getAiCostGuardrail } from "@/lib/credits/config";

/** 销售策略扣费动作（CreditTransaction.type 复用既有 ai_deduct / viewcontact_cost） */
export type SalesStrategyAction = "aiSalesStrategy" | "unlockContact";

/** 解锁联系固定预估 token（同档计费，无真实 LLM 调用，按固定量计费） */
export const UNLOCK_ESTIMATED_TOKENS = 800;

export interface AiDeductInput {
  userId: string;
  action: SalesStrategyAction;
  /** 生成类：LLM 实际 token 总数（prompt+completion） */
  actualTokens?: number;
  /** 预估（前端展示 / 成本护栏）用 token 数 */
  estimatedTokens?: number;
  reason: string;
  /** 流水补充信息（模型 / 检索来源 / contactId 等），仅作审计，不含明文倍数 */
  breakdown?: Record<string, unknown>;
}

export interface AiDeductResult {
  ok: boolean;
  /** 本次实际扣减积分 */
  cost: number;
  /** 扣后余额 */
  balance: number;
  code?: "OK" | "INSUFFICIENT" | "GUARDRAIL";
}

/**
 * 预估成本（扣前展示门槛用）：cost = ceil(tokens × 计费系数)。
 * 计费系数来自 SystemConfig（[商业机密·内部]），前端拿不到、本文件不持有明文倍数。
 */
export async function estimateAiCost(estimatedTokens: number): Promise<number> {
  const coeff = await getAiCostCoeff(); // [商业机密·内部] 仅读取，不写明文
  const tokens = Math.max(0, Math.floor(estimatedTokens || 0));
  return Math.ceil(tokens * coeff);
}

/**
 * 实际按量扣减。
 * 流程：
 *   1) 以实际 token × 系数算成本（系数为 SystemConfig 读取值，默认占位 1.0）；
 *   2) 单次护栏：cost > 护栏上限 → 熔断返回 GUARDRAIL（不扣费、防不可控高价检索）；
 *   3) 复用 deductCredits：余额不足整体拒绝（INSUFFICIENT，绝不负余额）；
 *      余额充足则 FIFO 减 CreditLot、写 CreditTransaction、递减 User.credits。
 * CreditTransaction.type：aiSalesStrategy → "ai_deduct"；unlockContact → "viewcontact_cost"。
 */
export async function deductAiUsage(input: AiDeductInput): Promise<AiDeductResult> {
  const coeff = await getAiCostCoeff(); // [商业机密·内部] 仅读取
  const guardrail = await getAiCostGuardrail(); // 单次成本上限（占位，老板后台配置）
  const tokens = Math.max(0, Math.floor(input.actualTokens ?? input.estimatedTokens ?? 0));
  const cost = Math.ceil(tokens * coeff);

  // 成本护栏熔断：单次成本超限直接拒绝，绝不无限扣费
  if (cost > guardrail) {
    return { ok: false, cost, balance: 0, code: "GUARDRAIL" };
  }

  const txnType = input.action === "unlockContact" ? "viewcontact_cost" : "ai_deduct";
  const res = await deductCredits(input.userId, cost, input.reason, input.breakdown, txnType);

  if (!res.ok) {
    return { ok: false, cost, balance: res.credits ?? 0, code: "INSUFFICIENT" };
  }
  return { ok: true, cost, balance: res.credits ?? 0, code: "OK" };
}
