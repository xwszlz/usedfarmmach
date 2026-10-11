/**
 * 服务端动态汇率入口（仅服务端上下文调用）。
 * 动态 import ExchangeRateService，避免把 prisma/axios 等服务端依赖打进客户端包。
 *
 * getUsdPerCny()：优先库内实时值（cron 每日刷新落库），缺失/异常回退静态兜底。
 */
import {
  USD_PER_CNY_STATIC,
  cnyToUsd,
  usdToCny,
  CNY_PER_USD_STATIC,
} from "@/lib/exchange-rate-constants";

export {
  USD_PER_CNY_STATIC,
  CNY_PER_USD_STATIC,
  cnyToUsd,
  usdToCny,
};

/**
 * 获取动态 USD per CNY 汇率。
 * 优先读取库内最新实时值；失败或缺值回退静态兜底（绝不抛错、绝不返回 0）。
 */
export async function getUsdPerCny(): Promise<number> {
  try {
    const { ExchangeRateService } = await import(
      "@/lib/services/exchange-rate-service"
    );
    const svc = new ExchangeRateService();
    const result = await svc.getAllRates();
    const r = result?.rates?.USD;
    if (typeof r === "number" && r > 0) return r;
  } catch {
    // 忽略，回退静态
  }
  return USD_PER_CNY_STATIC;
}
