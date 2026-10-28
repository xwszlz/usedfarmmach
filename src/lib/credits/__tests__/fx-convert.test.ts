/**
 * 单测：本币金额 → 人民币 → 积分的折算（1 元人民币 = 100 积分，全球等值）
 *
 * 方向断言是重中之重：`staticRates` 的方向是「1 CNY = rd 本币」（USD: 0.14943），
 * 所以本币→人民币必须**除以** rd。写成乘法会把 $10 折算成 ¥1.49（149 积分），
 * 少发 45 倍 —— 单子会红在这里。
 */
import { describe, it, expect, vi } from "vitest";

// fx.ts 顶层 import 了 @/lib/db（prisma 实例化会强依赖 DATABASE_URL），单测里桩掉
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { cnyFromLocalAmount, creditsFromLocalAmount, getRdSync } from "@/lib/credits/fx";

/** 静态表锚点：1 CNY = 0.14943 USD */
const USD_RD = 0.14943;

describe("cnyFromLocalAmount —— 本币 → 人民币（除以 rd）", () => {
  it("USD：方向必须取倒数", () => {
    expect(getRdSync("USD")).toBe(USD_RD);
    // 10 / 0.14943 = 66.9209...
    expect(cnyFromLocalAmount(10, "USD")).toBeCloseTo(66.9209, 3);
    // 若误写成 10 × 0.14943 会得到 1.4943（资损方向）
    expect(cnyFromLocalAmount(10, "USD")).toBeGreaterThan(60);
  });

  it("CNY：恒等（R=1）", () => {
    expect(cnyFromLocalAmount(100, "CNY")).toBe(100);
    expect(cnyFromLocalAmount(1, "CNY")).toBe(1);
  });

  it("0 / 负数 / 非有限数一律 0", () => {
    expect(cnyFromLocalAmount(0, "USD")).toBe(0);
    expect(cnyFromLocalAmount(-5, "USD")).toBe(0);
    expect(cnyFromLocalAmount(Number.NaN, "USD")).toBe(0);
    expect(cnyFromLocalAmount(Number.POSITIVE_INFINITY, "USD")).toBe(0);
  });

  it("未知币种：getRdSync 回落 1，按 1:1 兜底（宁可少发，绝不放大）", () => {
    expect(getRdSync("XYZ")).toBe(1);
    expect(cnyFromLocalAmount(10, "XYZ")).toBe(10);
  });
});

describe("creditsFromLocalAmount —— 本币 → 积分（1 元 = 100 积分）", () => {
  it("$10 → 6692 积分（10 ÷ 0.14943 × 100）", () => {
    expect(creditsFromLocalAmount(10, "USD")).toBe(6692);
    // 反向锁：乘法方向只会得到 149，绝不能通过
    expect(creditsFromLocalAmount(10, "USD")).not.toBe(149);
  });

  it("¥100 → 10000 积分", () => {
    expect(creditsFromLocalAmount(100, "CNY")).toBe(10000);
  });

  it("¥1 → 100 积分", () => {
    expect(creditsFromLocalAmount(1, "CNY")).toBe(100);
  });

  it("$0.01 → 6 积分（0.01 ÷ 0.14943 × 100 = 6.69…，向下取整）", () => {
    expect(creditsFromLocalAmount(0.01, "USD")).toBe(6);
  });

  it("$1 → 669 积分（1 ÷ 0.14943 × 100 = 669.2…）", () => {
    expect(creditsFromLocalAmount(1, "USD")).toBe(669);
  });

  it("浮点误差不吞分：整数金额不因 1e-6 偏移而进位或掉分", () => {
    // 0.29 × 100 = 28.999999999999996 ⇒ 必须有 1e-6 兜底才不漏 1 分
    expect(creditsFromLocalAmount(0.29, "CNY")).toBe(29);
    expect(creditsFromLocalAmount(1.15, "CNY")).toBe(115);
    expect(creditsFromLocalAmount(19.99, "CNY")).toBe(1999);
  });

  it("未知币种兜底不放大：$10 → 1000 积分 ≤ 正常 6692", () => {
    const fallback = creditsFromLocalAmount(10, "XYZ");
    expect(fallback).toBe(1000);
    expect(fallback).toBeLessThanOrEqual(creditsFromLocalAmount(10, "USD"));
  });
});
