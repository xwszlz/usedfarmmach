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
