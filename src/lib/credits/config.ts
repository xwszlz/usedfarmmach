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
 * AI 销售策略计费系数。
 * 单次成本公式：cost(积分) = 实际 token 消耗 × 本系数。
 * ⚠️ [商业机密·内部]：本系数是平台计费核心参数，仅存于 SystemConfig，
 *    代码中绝不出现明文倍数值；未知/非法值回落占位 1.0。
 */
export async function getAiCostCoeff(): Promise<number> {
  const v = await getConfig<number>(CONFIG_KEYS.aiCostCoeff, 1.0);
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 1.0;
}

/**
 * 单次成本护栏上限（积分）。
 * 单次请求实际成本超过此值 → 路由直接熔断返回（不扣费），防不可控高价检索/异常用量。
 * ⚠️ [商业机密·内部]：占位值 3000，真实值由老板后台配置（ai_cost_guardrail_credits）。
 *
 * 3000 是怎么算出来的（计费账本口径）：
 * 单次成本公式：cost(积分) = ceil(实际 token × ai_cost_coeff)。
 * 已知最大的单次 AI 调用是销售策略生成，其 maxTokens 上限为
 * SALES_STRATEGY_MAX_TOKENS = 8192（见 sales-strategy/route.ts）。
 * 配套定价把 ai_cost_coeff 下调到 0.2，故一次合法请求的最大成本为
 * 8192 × 0.2 = 1638.4 → ceil ≈ 1639 积分。
 * 3000 ≈ 该合法上限的 1.8 倍：正常请求（含重试累加的 token）畅通，
 * 失控计费（异常超长上下文、循环重试、系数被误调高）能及时熔断。
 *
 * ⚠️ 本护栏与 ai_cost_coeff 必须联动标定，改任一个都要重算另一个：
 * - 旧的 5000 是在 coeff = 1.0 的旧定价下标定的，系数下调后沿用会失去防护意义
 *   （合法上限降到 ~1639，护栏却仍在 5000，异常时单次可扣近 5000 分才熔断）；
 * - 反过来说，若 ai_cost_coeff 调回 1.0，合法上限回到 8192 > 3000，
 *   正常请求会被本护栏误熔断 —— 届时护栏必须同步上调。
 * 本文件只改护栏，coeff 的 fallback（1.0）与真实值由老板另行拍板，不在本轮改动范围。
 */
export async function getAiCostGuardrail(): Promise<number> {
  const v = await getConfig<number>(CONFIG_KEYS.aiCostGuardrail, 3000);
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 3000;
}
