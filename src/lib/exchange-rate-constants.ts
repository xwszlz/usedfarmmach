/**
 * 汇率折算常量与纯函数（无服务端依赖，可安全用于客户端组件）。
 * 静态兜底值同步自 src/config/exchange-rates.ts 的 UPDATE_STRATEGY.fallbackStrategy.staticRates。
 *
 * 约定（与旧代码 7.25 的反比关系）：
 *   - 旧：priceUsd = priceCny / 7.25   （7.25 = CNY per USD）
 *   - 新：priceUsd = priceCny * usdPerCny （usdPerCny = USD per CNY，如 0.14943）
 *   - 反向（USD→CNY）：cny = usd / usdPerCny = usd * CNY_PER_USD_STATIC
 */
import { UPDATE_STRATEGY } from "@/config/exchange-rates";

/** 1 CNY = X USD（静态兜底） */
export const USD_PER_CNY_STATIC =
  UPDATE_STRATEGY.fallbackStrategy.staticRates.USD; // 0.14943

/** 1 USD = X CNY（反向，替代旧 `exchangeRate = 7.25` 默认值） */
export const CNY_PER_USD_STATIC = 1 / USD_PER_CNY_STATIC;

/** CNY → USD（写库点统一入口，已 Math.round） */
export function cnyToUsd(
  cny: number,
  usdPerCny: number = USD_PER_CNY_STATIC
): number {
  return Math.round(cny * usdPerCny);
}

/** USD → CNY（展示/套利统一入口） */
export function usdToCny(
  usd: number,
  usdPerCny: number = USD_PER_CNY_STATIC
): number {
  return usd / usdPerCny; // = usd * CNY_PER_USD_STATIC
}
