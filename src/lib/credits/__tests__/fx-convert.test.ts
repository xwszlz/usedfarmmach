/**
 * 单测：本币金额 → 人民币 → 积分的折算（1 元人民币 = 100 积分，全球等值）
 *
 * 方向断言是重中之重：`staticRates` 的方向是「1 CNY = rd 本币」（USD: 0.14943），
 * 所以本币→人民币必须**除以** rd。写成乘法会把 $10 折算成 ¥1.49（149 积分），
 * 少发 45 倍 —— 单子会红在这里。
 *
 * 第二批把折算函数改为异步（读库内实时汇率），本文件同步补充：
 *   1) 全部断言改成 await（库内无值时回落静态表，数值锚点不变）
 *   2) 新增 getRdWithSource 的 live / static / identity 三态断言
 *      —— 充值审计日志靠它区分「库内实时」与「静态兜底」，标错等于审计失效
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// fx.ts 顶层 import 了 @/lib/db（prisma 实例化会强依赖 DATABASE_URL），单测里桩掉
vi.mock("@/lib/db", () => ({ prisma: {} }));

// 汇率服务桩：默认「库内无任何新鲜汇率」，让所有断言走静态兜底（数值确定）
vi.mock("@/lib/services/exchange-rate-service", () => ({
  exchangeRateService: {
    getLiveRatesFromDb: vi.fn(async () => ({})),
    getAllRates: vi.fn(async () => ({
      base: "CNY",
      rates: { CNY: 1 },
      source: "static-fallback",
      fetchedAt: new Date(0).toISOString(),
    })),
  },
}));

import {
  cnyFromLocalAmount,
  cnyFromLocalAmountWithRate,
  creditsFromLocalAmount,
  getRd,
  getRdSync,
  getRdWithSource,
} from "@/lib/credits/fx";
import { exchangeRateService } from "@/lib/services/exchange-rate-service";

/** 静态表锚点：1 CNY = 0.14943 USD */
const USD_RD = 0.14943;

const liveRatesMock = vi.mocked(exchangeRateService.getLiveRatesFromDb);

beforeEach(() => {
  liveRatesMock.mockReset();
  liveRatesMock.mockResolvedValue({});
});

describe("cnyFromLocalAmountWithRate —— 纯函数版（本币 → 人民币，除以 rd）", () => {
  it("USD：方向必须取倒数", () => {
    // 10 / 0.14943 = 66.9209...
    expect(cnyFromLocalAmountWithRate(10, "USD", USD_RD)).toBeCloseTo(66.9209, 3);
    // 若误写成 10 × 0.14943 会得到 1.4943（资损方向）
    expect(cnyFromLocalAmountWithRate(10, "USD", USD_RD)).toBeGreaterThan(60);
  });

  it("非法 rd 按 1:1 兜底（宁可少发，绝不放大）", () => {
    expect(cnyFromLocalAmountWithRate(10, "USD", 0)).toBe(10);
    expect(cnyFromLocalAmountWithRate(10, "USD", -1)).toBe(10);
    expect(cnyFromLocalAmountWithRate(10, "USD", Number.NaN)).toBe(10);
  });

  it("CNY 恒等，且不依赖 rd", () => {
    expect(cnyFromLocalAmountWithRate(100, "CNY", 999)).toBe(100);
  });

  it("0 / 负数 / 非有限数一律 0", () => {
    expect(cnyFromLocalAmountWithRate(0, "USD", USD_RD)).toBe(0);
    expect(cnyFromLocalAmountWithRate(-5, "USD", USD_RD)).toBe(0);
  });
});

describe("cnyFromLocalAmount —— 本币 → 人民币（异步：库内实时 → 静态兜底）", () => {
  it("USD：库内无值时回落静态表，方向必须取倒数", async () => {
    expect(getRdSync("USD")).toBe(USD_RD);
    expect(await cnyFromLocalAmount(10, "USD")).toBeCloseTo(66.9209, 3);
    expect(await cnyFromLocalAmount(10, "USD")).toBeGreaterThan(60);
  });

  it("USD：库内有实时值时必须用库内值（0.2 → $10 = ¥50）", async () => {
    liveRatesMock.mockResolvedValue({ USD: 0.2 });
    expect(await cnyFromLocalAmount(10, "USD")).toBeCloseTo(50, 6);
    expect(await getRd("USD")).toBe(0.2);
  });

  it("CNY：恒等（R=1），且不查库", async () => {
    expect(await cnyFromLocalAmount(100, "CNY")).toBe(100);
    expect(await cnyFromLocalAmount(1, "CNY")).toBe(1);
    expect(liveRatesMock).not.toHaveBeenCalled();
  });

  it("0 / 负数 / 非有限数一律 0", async () => {
    expect(await cnyFromLocalAmount(0, "USD")).toBe(0);
    expect(await cnyFromLocalAmount(-5, "USD")).toBe(0);
    expect(await cnyFromLocalAmount(Number.NaN, "USD")).toBe(0);
    expect(await cnyFromLocalAmount(Number.POSITIVE_INFINITY, "USD")).toBe(0);
  });

  it("未知币种：getRdSync 回落 1，按 1:1 兜底（宁可少发，绝不放大）", async () => {
    expect(getRdSync("XYZ")).toBe(1);
    expect(await cnyFromLocalAmount(10, "XYZ")).toBe(10);
  });

  it("读库抛错时回落静态表，不向上抛", async () => {
    liveRatesMock.mockRejectedValue(new Error("db down"));
    expect(await cnyFromLocalAmount(10, "USD")).toBeCloseTo(66.9209, 3);
  });
});

describe("creditsFromLocalAmount —— 本币 → 积分（1 元 = 100 积分）", () => {
  it("$10 → 6692 积分（10 ÷ 0.14943 × 100）", async () => {
    expect(await creditsFromLocalAmount(10, "USD")).toBe(6692);
    // 反向锁：乘法方向只会得到 149，绝不能通过
    expect(await creditsFromLocalAmount(10, "USD")).not.toBe(149);
  });

  it("¥100 → 10000 积分", async () => {
    expect(await creditsFromLocalAmount(100, "CNY")).toBe(10000);
  });

  it("¥1 → 100 积分", async () => {
    expect(await creditsFromLocalAmount(1, "CNY")).toBe(100);
  });

  it("$0.01 → 6 积分（0.01 ÷ 0.14943 × 100 = 6.69…，向下取整）", async () => {
    expect(await creditsFromLocalAmount(0.01, "USD")).toBe(6);
  });

  it("$1 → 669 积分（1 ÷ 0.14943 × 100 = 669.2…）", async () => {
    expect(await creditsFromLocalAmount(1, "USD")).toBe(669);
  });

  it("浮点误差不吞分：整数金额不因 1e-6 偏移而进位或掉分", async () => {
    // 0.29 × 100 = 28.999999999999996 ⇒ 必须有 1e-6 兜底才不漏 1 分
    expect(await creditsFromLocalAmount(0.29, "CNY")).toBe(29);
    expect(await creditsFromLocalAmount(1.15, "CNY")).toBe(115);
    expect(await creditsFromLocalAmount(19.99, "CNY")).toBe(1999);
  });

  it("未知币种兜底不放大：$10 → 1000 积分 ≤ 正常 6692", async () => {
    const fallback = await creditsFromLocalAmount(10, "XYZ");
    expect(fallback).toBe(1000);
    expect(fallback).toBeLessThanOrEqual(await creditsFromLocalAmount(10, "USD"));
  });

  it("库内实时汇率参与积分计算：$10 @ rd=0.2 → 5000 积分", async () => {
    liveRatesMock.mockResolvedValue({ USD: 0.2 });
    expect(await creditsFromLocalAmount(10, "USD")).toBe(5000);
  });
});

describe("getRdWithSource —— 汇率来源审计（资金路径必须能区分 live / static）", () => {
  it("CNY → identity，rd=1，且不查库", async () => {
    expect(await getRdWithSource("CNY")).toEqual({ rd: 1, source: "identity" });
    expect(liveRatesMock).not.toHaveBeenCalled();
  });

  it("库内无新鲜值 → static，且 rd 等于静态快照", async () => {
    const got = await getRdWithSource("USD");
    expect(got.source).toBe("static");
    expect(got.rd).toBe(USD_RD);
  });

  it("库内有新鲜值 → live，rd 取库内值", async () => {
    liveRatesMock.mockResolvedValue({ USD: 0.15 });
    const got = await getRdWithSource("USD");
    expect(got.source).toBe("live");
    expect(got.rd).toBe(0.15);
  });

  it("来源判定逐币种精确：库内只有 EUR 时，USD 必须仍报 static", async () => {
    liveRatesMock.mockResolvedValue({ EUR: 0.13 });
    expect(await getRdWithSource("USD")).toEqual({ rd: USD_RD, source: "static" });
    expect(await getRdWithSource("EUR")).toEqual({ rd: 0.13, source: "live" });
  });

  it("读库抛错 → static 兜底，不向上抛", async () => {
    liveRatesMock.mockRejectedValue(new Error("db down"));
    await expect(getRdWithSource("USD")).resolves.toEqual({
      rd: USD_RD,
      source: "static",
    });
  });

  it("getRd 委托 getRdWithSource：返回值与来源判定同源", async () => {
    liveRatesMock.mockResolvedValue({ USD: 0.15 });
    expect(await getRd("USD")).toBe(0.15);
    expect(await getRd("CNY")).toBe(1);
    expect(await getRd("XYZ")).toBe(1);
  });
});
