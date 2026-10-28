/**
 * 汇率 / 币种 / 国家解析（R-03 复用 + §3.10 / R-24 注册国感知计费）
 *
 * 方向约定：本模块所有汇率均为 **CNY → 本币**（与 config/exchange-rates.ts 的
 * staticRates 方向一致，也契合 ExchangeRateService.getAllRates() 的 CNY 基准返回）。
 *   R_d(c) = 1 CNY 可兑多少 c 本币。
 *
 * 计费公式（§3.10）：
 *   points = round( 豆包 CNY 成本 × R_d(c) ÷ U(c) × 100 × 运营定价倍率 )
 * 其中 U(c) = 计价单位（VND/IDR=1000，其余 1）。
 * ⚠️ 运营定价倍率只在 `spend.ts` 的 `AI_COST_MULTIPLIER` 一处维护，本文件不持有取值。
 *
 * 另一条与本文件强相关的换算（充值与消耗的公共纽带，2026-10-28 口径）：
 *   1 元人民币 = 100 积分，全球等值 ⇒ 本币金额换算积分必须先经汇率折回人民币，
 *   见下方 `cnyFromLocalAmount` / `creditsFromLocalAmount`。
 *   方向极易搞反：`staticRates` 是「1 CNY = rd 本币」，故**本币 → 人民币是除以 rd**。
 *
 * 本模块为服务端库，不进客户端包；所有函数为异步（读取库内实时汇率，失败回落代码兜底）。
 */
import { prisma } from "@/lib/db";
import { exchangeRateService } from "@/lib/services/exchange-rate-service";
import { UPDATE_STRATEGY } from "@/config/exchange-rates";

/** 国家（ISO-3166 alpha-2，大写）→ 币种（R-03 代码兜底；运营可经 SystemConfig.currency_map 覆盖） */
const COUNTRY_CURRENCY: Record<string, string> = {
  CN: "CNY",
  US: "USD",
  GB: "GBP",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  PT: "EUR",
  RU: "RUB",
  IN: "INR",
  BR: "BRL",
  KZ: "KZT",
  VN: "VND",
  ID: "IDR",
  // 兜底（未知/缺失 → USD，与 R-05 失败默认值一致）
  DEFAULT: "USD",
};

/** 币种 → 计价单位 U(c)（VND/IDR=1000，其余 1） */
const CURRENCY_UNIT: Record<string, number> = {
  VND: 1000,
  IDR: 1000,
};

/** 静态兜底汇率表（CNY→本币，与 config/exchange-rates.ts staticRates 同源） */
const STATIC_RATES: Record<string, number> =
  (UPDATE_STRATEGY as unknown as {
    fallbackStrategy: { staticRates: Record<string, number> };
  }).fallbackStrategy.staticRates || {};

/** 国家 → 币种 */
export function getCurrencyOfCountry(country?: string | null): string {
  if (!country) return COUNTRY_CURRENCY.DEFAULT;
  const c = country.toUpperCase();
  return COUNTRY_CURRENCY[c] ?? COUNTRY_CURRENCY.DEFAULT;
}

/** 币种 → 计价单位 U(c) */
export function getUnit(currency: string): number {
  return CURRENCY_UNIT[currency] ?? 1;
}

/** 同步兜底 R_d(c)（代码静态表），保证计费永不崩 */
export function getRdSync(currency: string): number {
  if (currency === "CNY") return 1;
  if (currency in STATIC_RATES && STATIC_RATES[currency] > 0) return STATIC_RATES[currency];
  return 1;
}

/**
 * 本币金额 → 人民币金额。
 *
 * 方向（务必看清）：静态汇率表方向是「1 CNY = rd 本币」（如 `USD: 0.14943`），
 * 故本币→CNY 是**除以** rd：`$10 → 10 / 0.14943 ≈ ¥66.92`。
 * 写成乘法会得到 `$10 → ¥1.49`，属直接资损事故。
 *
 * 汇率缺失/非法时原样返回（按 1:1 兜底）——宁可少发积分，绝不放大。
 * 非有限数或 ≤0 一律返回 0（调用方无需再做前置校验）。
 */
export function cnyFromLocalAmount(amount: number, currency: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === "CNY") return amount;
  const rd = getRdSync(currency);
  if (!Number.isFinite(rd) || rd <= 0) return amount;
  return amount / rd;
}

/**
 * 本币金额 → 积分（口径：1 元人民币 = 100 积分，全球等值）。
 *
 * 换算链路：本币金额 --(÷ rd)--> 人民币金额 --(×100)--> 积分。
 * `+ 1e-6` 只用于抵消二进制浮点误差（如 `0.29 * 100 = 28.999999999999996`），
 * 不是四舍五入；整体仍是 floor（向下取整，对平台侧永不超发）。
 *
 * 自测锚点（与本文件单测一致）：
 *   creditsFromLocalAmount(10, "USD")    === 6692   // 10 / 0.14943 × 100
 *   creditsFromLocalAmount(100, "CNY")   === 10000
 *   creditsFromLocalAmount(1, "CNY")     === 100
 *   creditsFromLocalAmount(0.01, "USD")  === 6
 */
export function creditsFromLocalAmount(amount: number, currency: string): number {
  return Math.floor(cnyFromLocalAmount(amount, currency) * 100 + 1e-6);
}

/**
 * R_d(c)：CNY → 本币 实时汇率。
 * 优先级：ExchangeRateService（库内实时，base=CNY）→ 同步静态兜底。
 * .cn（CNY）恒返回 1。
 */
export async function getRd(currency: string): Promise<number> {
  if (currency === "CNY") return 1;
  try {
    const all = await exchangeRateService.getAllRates();
    const r = all.rates[currency];
    if (typeof r === "number" && r > 0) return r;
  } catch {
    // 回落静态
  }
  return getRdSync(currency);
}

/**
 * 解析用户注册锁定的计费国家（R-04/R-05）。
 * 取 User.country（注册时锁定，登录 IP 不变更）；缺失/异常回落 DEFAULT（USD）。
 */
export async function getBillingCountry(userId?: string | null): Promise<string> {
  if (!userId) return COUNTRY_CURRENCY.DEFAULT;
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });
    return u?.country || COUNTRY_CURRENCY.DEFAULT;
  } catch {
    return COUNTRY_CURRENCY.DEFAULT;
  }
}

/**
 * 一次性解析计费所需的全部参数（国家/币种/单位/汇率）。
 * 接收 userId 或已解析的 billingCountry；每请求调用一次即可。
 */
export async function getBillingParams(
  userId?: string | null,
  billingCountry?: string | null
): Promise<{ country: string; currency: string; unit: number; rd: number }> {
  const country = billingCountry || (await getBillingCountry(userId));
  const currency = getCurrencyOfCountry(country);
  return {
    country,
    currency,
    unit: getUnit(currency),
    rd: await getRd(currency),
  };
}
