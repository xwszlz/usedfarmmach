/**
 * 系统配置服务（C6 配置化运营）：SystemConfig 键值表（JSON value）+ 进程内 60s 缓存。
 * 改配置不发版；后台配置页读写均走此模块。
 */
import { prisma } from "@/lib/db";
import {
  CONFIG_KEYS,
  DEFAULT_COMPLIANCE_TEXT,
  DEFAULT_CREDIT_PACKS,
  DEFAULT_PAYMENT_QR,
  DEFAULT_PLANS,
  DEFAULT_REWARD_VALUES,
  type CreditPackSku,
  type PlanSku,
  type RewardValues,
} from "./constants";

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** 读取配置（JSON 解析失败/不存在时回退 fallback） */
export async function getConfig<T>(key: string, fallback: T): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  try {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    if (!row) {
      cache.set(key, { value: fallback, expiresAt: now + CACHE_TTL_MS });
      return fallback;
    }
    const parsed = JSON.parse(row.value) as T;
    cache.set(key, { value: parsed, expiresAt: now + CACHE_TTL_MS });
    return parsed;
  } catch (error) {
    console.error(`[SystemConfig] 读取 ${key} 失败，使用默认值:`, error);
    return fallback;
  }
}

/** 写入配置（写后使缓存失效） */
export async function setConfig(
  key: string,
  value: unknown,
  operatorId?: string
): Promise<void> {
  const serialized = JSON.stringify(value);
  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value: serialized, updatedBy: operatorId ?? null },
    update: { value: serialized, updatedBy: operatorId ?? null },
  });
  cache.delete(key);
}

/** 手动失效缓存（测试/管理场景） */
export function invalidateConfigCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

// ─── 具名配置读取 ────────────────────────────────────────────

/** 按年收费开关（默认开启；US-8） */
export async function getAnnualBillingEnabled(): Promise<boolean> {
  return getConfig<boolean>(CONFIG_KEYS.annualBillingEnabled, true);
}

/** 积分充值包（4 档） */
export async function getCreditPacks(): Promise<CreditPackSku[]> {
  return getConfig<CreditPackSku[]>(CONFIG_KEYS.creditPacks, DEFAULT_CREDIT_PACKS);
}

/** 套餐（3 档） */
export async function getPlans(): Promise<PlanSku[]> {
  return getConfig<PlanSku[]>(CONFIG_KEYS.plans, DEFAULT_PLANS);
}

/** 合规文案（增值信息服务费） */
export async function getComplianceText(): Promise<{ zh: string; en: string }> {
  return getConfig<{ zh: string; en: string }>(CONFIG_KEYS.complianceText, DEFAULT_COMPLIANCE_TEXT);
}

/** 收款码图片 */
export async function getPaymentQr(): Promise<{ wechat: string; alipay: string }> {
  return getConfig<{ wechat: string; alipay: string }>(CONFIG_KEYS.paymentQr, DEFAULT_PAYMENT_QR);
}

/** 奖励数值（运营可调，默认 PRD 口径） */
export async function getRewardValues(): Promise<RewardValues> {
  const stored = await getConfig<Partial<RewardValues>>(CONFIG_KEYS.rewardValues, {});
  return { ...DEFAULT_REWARD_VALUES, ...stored };
}

/** 按 SKU 查充值包定义 */
export async function getPackBySku(sku: string): Promise<CreditPackSku | null> {
  const packs = await getCreditPacks();
  return packs.find((p) => p.sku === sku) ?? null;
}

/** 按 SKU 查套餐定义 */
export async function getPlanBySku(sku: string): Promise<PlanSku | null> {
  const plans = await getPlans();
  return plans.find((p) => p.sku === sku) ?? null;
}

// ─── AI 计费：单次成本护栏（决策 B：[商业机密·内部]）──────────
// 护栏上限只从 SystemConfig 读取，代码不持有明文倍数。
// 真实数值由老板后台配置；默认值为占位，便于未配置时系统可运行。

// ⚠️ `ai_cost_coeff`（计费系数）已于 **2026-10-31 退役**，代码侧全部删除，**不要再加回来**。
//   · 原用途：`cost(积分) = 实际 token 消耗 × ai_cost_coeff`，是「按量」口径。
//   · 退役原因：全站 AI 消耗已统一到「成本加成」口径 —— 真实计价见
//     `src/lib/credits/spend.ts` 的 `computeAiCost()`：
//         points = round(豆包人民币成本 × 100) × 运营倍率
//     即 1 积分 = ¥0.01。消费者只读 `usage` 的 input/output tokens，**与任何倍数开关无关**。
//   · 为什么必须删而不是留着：留一个「改了不生效」的后台开关，比没有开关危险得多 ——
//     运营调了它、以为单价变了、实际一分不变，问题会拖到对账时才暴露。
//   · SystemConfig 表里的 `ai_cost_coeff` 行已同步删除（2026-10-31，`.com` 库）。
//   · 若将来真要恢复「按量」计费，请**新建**一套口径并显式迁移，不要把本开关复活。

/**
 * 单次成本护栏上限（积分）。
 * 单次请求实际成本超过此值 → 路由直接熔断返回（不扣费），防不可控高价检索/异常用量。
 * ⚠️ [商业机密·内部]：占位值 5000，真实值由老板后台配置（ai_cost_guardrail_credits）。
 *
 * ⚠️ 本函数与 `ai_cost_guardrail_credits` 是**活的**（`sales-strategy/route.ts` 每次生成都读），
 *    与已退役的 `ai_cost_coeff` 无关，不要一起删。
 */
export async function getAiCostGuardrail(): Promise<number> {
  const v = await getConfig<number>(CONFIG_KEYS.aiCostGuardrail, 5000);
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 5000;
}
