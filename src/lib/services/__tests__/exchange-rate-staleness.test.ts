/**
 * 单测：汇率「新鲜度」阈值（UPDATE_STRATEGY.conditions.maxAgeHours = 36）
 *
 * ⚠️ 这条例外于「本分支最后一个改动」的字面范围，但必须补：
 * 本次把 24h 放宽到 36h 之前，全仓**没有任何测试覆盖 isRateStale**
 * （该方法是 private，汇率服务此前根本没有测试文件），也就是说没有任何东西
 * 能拦住有人把 36 改回 24、甚至改成 1。而这条阈值直接决定 .com 充值用的是
 * 库内实时汇率还是静态快照（USD: 0.14998 vs 0.14943，差 0.37%）。
 *
 * 断言方式：走 public 的 `getAllRates()` 间接验证，用 35h / 37h 两个样本把阈值
 * 夹在 (35, 37] —— 取值从 24 改成 36 会改变这两个样本的结论，改回去测试就会红。
 *   - 35 小时前的库内值 → 仍算新鲜 → source = "db-live"，rates.USD = 库内值
 *   - 37 小时前的库内值 → 判定过期 → 回落静态快照，source = "static-fallback"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { exchangeRate: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { ExchangeRateService } from "@/lib/services/exchange-rate-service";
import { UPDATE_STRATEGY } from "@/config/exchange-rates";

/** 静态快照锚点：1 CNY = 0.14943 USD（回落时必须是这个值） */
const STATIC_USD = UPDATE_STRATEGY.fallbackStrategy.staticRates.USD;
/** 库内实时值锚点：0.15（与静态值必须不同，才能区分数据来源） */
const LIVE_USD = 0.15;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/** 构造一行库内汇率（只填 getAllRates 会用到的字段） */
function row(rate: number, lastUpdated: string) {
  return {
    id: `r-${rate}`,
    baseCurrency: "CNY",
    targetCurrency: "USD",
    rate,
    inverseRate: 1 / rate,
    source: "Frankfurter.app",
    lastUpdated,
    effectiveDate: lastUpdated,
    confidence: 0.95,
    isLive: true,
    isHistorical: false,
    isInterpolated: false,
  };
}

function mockRows(rows: unknown[]) {
  vi.mocked(prisma.exchangeRate.findMany).mockResolvedValue(rows as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("maxAgeHours = 36：库内值的「新鲜」窗口", () => {
  it("35 小时前的库内值仍算新鲜（24h 阈值下会被判过期，故本用例钉住 36）", async () => {
    mockRows([row(LIVE_USD, hoursAgo(35))]);
    const all = await new ExchangeRateService().getAllRates();
    expect(all.rates.USD).toBe(LIVE_USD);
    expect(all.rates.USD).not.toBe(STATIC_USD);
    expect(all.source).toBe("db-live");
  });

  it("37 小时前的库内值已过期 → 回落静态快照", async () => {
    mockRows([row(LIVE_USD, hoursAgo(37))]);
    const all = await new ExchangeRateService().getAllRates();
    expect(all.rates.USD).toBe(STATIC_USD);
    expect(all.source).toBe("static-fallback");
  });

  it("未过期的库内值原样返回（1 小时前），且 CNY 基准恒为 1", async () => {
    mockRows([row(LIVE_USD, hoursAgo(1))]);
    const all = await new ExchangeRateService().getAllRates();
    expect(all.rates.USD).toBe(LIVE_USD);
    expect(all.rates.CNY).toBe(1);
    expect(all.base).toBe("CNY");
    expect(all.source).toBe("db-live");
  });

  it("库内无数据时全部走静态快照（cron 从未成功的降级路径）", async () => {
    mockRows([]);
    const all = await new ExchangeRateService().getAllRates();
    expect(all.rates.USD).toBe(STATIC_USD);
    expect(all.source).toBe("static-fallback");
  });
});
