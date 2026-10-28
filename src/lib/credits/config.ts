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

// ─── AI 销售策略按量计费（决策 B：[商业机密·内部]）──────────
// 计费系数 / 护栏上限一律只从 SystemConfig 读取，代码不持有明文倍数。
// 真实数值由老板后台配置；默认值均为占位，便于未配置时系统可运行。

/**
 * AI 销售策略计费系数（按量口径，**已废弃**）。
 * 单次成本公式：cost(积分) = 实际 token 消耗 × 本系数。
 * ⚠️ [商业机密·内部]：本系数是平台计费核心参数，仅存于 SystemConfig，
 *    代码中绝不出现明文倍数值；未知/非法值回落占位 1.0。
 *
 * @deprecated 销售策略已统一到「成本加成」口径（`computeAiCost`，见 spend.ts），
 *   不再读取本系数。保留函数与 `CONFIG_KEYS.aiCostCoeff` 仅为兼容仍在用
 *   `deductAiUsage` 的导出/解锁类动作（unlock-contact），避免破坏性变更；
 *   新代码请勿再引入。彻底下线需另行评估存量 SystemConfig 数据与调用方。
 */
export async function getAiCostCoeff(): Promise<number> {
  const v = await getConfig<number>(CONFIG_KEYS.aiCostCoeff, 1.0);
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 1.0;
}

/**
 * 单次成本护栏上限（积分）。
 * 单次请求实际成本超过此值 → 路由直接熔断返回（不扣费），防不可控高价检索/异常用量。
 * ⚠️ [商业机密·内部]：占位值 5000，真实值由老板后台配置（ai_cost_guardrail_credits）。
 */
export async function getAiCostGuardrail(): Promise<number> {
  const v = await getConfig<number>(CONFIG_KEYS.aiCostGuardrail, 5000);
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 5000;
}
