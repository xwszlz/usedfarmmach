/**
 * 产品页报告的风险提示守卫
 * ─────────────────────────
 * 历史实现里 `product-valuation-report.tsx` 的 `warnings` 恒为 `[]`，
 * 产品页报告永远没有「风险提示」这一段 —— 与估值页报告质量不一致，
 * 是老板「报告还是比较简单」投诉的一部分。
 *
 * 现在改为从引擎已返回的因子（confidenceScore / depreciationPercent /
 * conditionFactor / brandFactor / marketFactor / details）反向推导，口径与估值页同源。
 *
 * 本文件锁死：
 *   ① 因子恶化时必须出提示（不能恒空）；
 *   ② 因子健康时不能凭空造提示（噪音比沉默更糟）；
 *   ③ 英文站不出中文（.com 报告语言一致性）。
 *
 * 运行：`npx vitest run src/components/product`
 */
import { describe, expect, it } from "vitest";
import { buildWarnings } from "@/components/product/product-valuation-report";
import type { ValuationResult } from "@/lib/valuation/formulas";

/** 造一个「各项都健康」的估值结果，测试再按需覆盖单因子 */
function healthy(overrides: Partial<ValuationResult> = {}): ValuationResult {
  return {
    estimatedValue: 268000,
    basePrice: 480000,
    brandFactor: 1.1,
    yearFactor: 0.72,
    hoursFactor: 0.8,
    conditionFactor: 0.95,
    marketFactor: 1.0,
    depreciationPercent: 42,
    confidenceScore: 0.85,
    priceRange: { low: 228000, mid: 268000, high: 308000 },
    details: [
      { label: "品牌溢价", value: "110%", impact: "positive", description: "认可度高" },
      { label: "工时残值", value: "80%", impact: "positive", description: "3200小时" },
    ],
    analysis: "",
    version: "v4",
    ...overrides,
  };
}

describe("buildWarnings · 因子恶化必须出声", () => {
  it("置信度 < 60% → 提示置信度偏低", () => {
    const w = buildWarnings(healthy({ confidenceScore: 0.42 }), true);
    expect(w.some((s) => s.includes("置信度偏低"))).toBe(true);
  });

  it("总折旧 ≥ 70% → 提示核对工时与成色", () => {
    const w = buildWarnings(healthy({ depreciationPercent: 78 }), true);
    expect(w.some((s) => s.includes("折旧"))).toBe(true);
  });

  it("成色因子 < 0.8 → 提示车况影响较大", () => {
    const w = buildWarnings(healthy({ conditionFactor: 0.62 }), true);
    expect(w.some((s) => s.includes("成色因子"))).toBe(true);
  });

  it("品牌保值系数 < 0.7 → 提示目标市场认可度有限", () => {
    const w = buildWarnings(healthy({ brandFactor: 0.5 }), true);
    expect(w.some((s) => s.includes("品牌保值系数"))).toBe(true);
  });

  it("市场因子偏离 ±10% → 提示区域价格偏差", () => {
    expect(buildWarnings(healthy({ marketFactor: 1.25 }), true).some((s) => s.includes("市场修正因子"))).toBe(true);
    expect(buildWarnings(healthy({ marketFactor: 0.8 }), true).some((s) => s.includes("市场修正因子"))).toBe(true);
  });

  it("工时残值为「无数据」→ 提示折旧只能按机龄估算", () => {
    const r = healthy({
      details: [
        { label: "工时残值", value: "无数据", impact: "neutral", description: "未提供工时数据" },
      ],
    });
    const w = buildWarnings(r, true);
    expect(w.some((s) => s.includes("未提供使用小时"))).toBe(true);
  });
});

describe("buildWarnings · 健康结果不造噪音", () => {
  it("各因子都正常 → 返回空数组（不能为了「看起来丰富」硬塞提示）", () => {
    expect(buildWarnings(healthy(), true)).toEqual([]);
  });

  it("多个因子同时恶化 → 多条提示同时出现（不互相覆盖）", () => {
    const w = buildWarnings(
      healthy({ confidenceScore: 0.5, depreciationPercent: 82, conditionFactor: 0.6 }),
      true
    );
    expect(w.length).toBeGreaterThanOrEqual(3);
  });
});

describe("buildWarnings · 语言跟随站点", () => {
  it("zh=false 时不出现中文（.com 报告语言一致性）", () => {
    const w = buildWarnings(
      healthy({ confidenceScore: 0.5, depreciationPercent: 82, conditionFactor: 0.6, brandFactor: 0.5 }),
      false
    );
    expect(w.length).toBeGreaterThan(0);
    for (const s of w) expect(s).not.toMatch(/[\u4e00-\u9fa5]/);
  });
});
