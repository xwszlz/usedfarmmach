/**
 * 单元测试：computeAiCost 的检索 token 并入（2026-11-01 计费口径统一 · T02）
 * ─────────────────────────────────────────────────────────
 * 守的是「漏收修复」的算术正确性：检索的真实 token 必须按 input/output 单价
 * 加进成本，且**不破坏** 6 个既有调用方的既有结果。
 *
 * 覆盖：
 *   ① additive：不传 extra* / metered ⇒ 结果与改前逐位一致（回归锁）
 *   ② extraInputTokens / extraOutputTokens 按真实单价加进 cnyCost 与 points
 *   ③ 检索 token 折算（searchCostCny）是 cnyCost 的子集，不是额外加项
 *   ④ 检索按次费用只留痕（searchCallCostCny / searchCallChargedToUser===false），不进 points
 *   ⑤ 决策 2：cached 没有任何计价分支（本测试用 input 全价验证「无 cached 折扣」）
 *
 * 红线：倍数 `AI_COST_MULTIPLIER` **不得明文出现** ⇒ 全部用源码导出的常量比对。
 *
 * 运行：npx vitest run src/lib/credits/__tests__/compute-ai-cost-extra.test.ts
 */
import { describe, it, expect, vi } from "vitest";
import {
  AI_COST_MULTIPLIER,
  ARK_WEB_SEARCH_UNIT_PRICE_CNY,
  CREDITS_PER_UNIT,
  computeAiCost,
  FALLBACK_PRICING,
  MODEL_PRICING,
} from "@/lib/credits/spend";

// computeAiCost 本身不碰数据库；mock 掉 db 以免顶层 import 触发 DATABASE_URL 校验
vi.mock("@/lib/db", () => ({
  prisma: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const MODEL = "doubao-seed-2-1-pro-260915";
const PRICE = MODEL_PRICING[MODEL];

/** 按真实公式复算期望（与源码同源，绝不出现倍率明文） */
function expectedPoints(
  inputTokens: number,
  outputTokens: number,
  extraInput = 0,
  extraOutput = 0
): number {
  const inP = PRICE?.inPrice ?? FALLBACK_PRICING.inPrice;
  const outP = PRICE?.outPrice ?? FALLBACK_PRICING.outPrice;
  const cny = ((inputTokens + extraInput) / 1000) * inP + ((outputTokens + extraOutput) / 1000) * outP;
  return Math.round(cny * CREDITS_PER_UNIT * AI_COST_MULTIPLIER);
}

describe("① additive：不带新参数时行为完全不变", () => {
  it("成本与点数与改前一致（回归锁）", () => {
    const before = computeAiCost({ model: MODEL, inputTokens: 4000, outputTokens: 4500 });
    const expected = expectedPoints(4000, 4500);
    expect(before.points).toBe(expected);
    // 不出现任何检索字段
    expect(before).not.toHaveProperty("searchInputTokens");
    expect(before).not.toHaveProperty("searchCallChargedToUser");
    expect(before.searchCostCny).toBeUndefined();
  });

  it("未知模型走兜底价，行为同样不变", () => {
    const r = computeAiCost({ model: "unknown-model", inputTokens: 1000, outputTokens: 100 });
    const inP = FALLBACK_PRICING.inPrice;
    const outP = FALLBACK_PRICING.outPrice;
    const cny = (1000 / 1000) * inP + (100 / 1000) * outP;
    expect(r.points).toBe(Math.round(cny * CREDITS_PER_UNIT * AI_COST_MULTIPLIER));
    expect(r).not.toHaveProperty("searchInputTokens");
  });
});

describe("② extra token 按真实单价加进成本", () => {
  it("extraInputTokens / extraOutputTokens 改变 cost 与 points", () => {
    const base = computeAiCost({ model: MODEL, inputTokens: 4000, outputTokens: 4500 });
    const withExtra = computeAiCost({
      model: MODEL,
      inputTokens: 4000,
      outputTokens: 4500,
      extraInputTokens: 32_157,
      extraOutputTokens: 1_508,
    });

    expect(withExtra.inputTokens).toBe(4_000); // 主 token 不混入
    expect(withExtra.outputTokens).toBe(4_500);
    expect(withExtra.searchInputTokens).toBe(32_157);
    expect(withExtra.searchOutputTokens).toBe(1_508);

    // 加算正确：加上的点数是「检索 token 单独算出来的点数」
    const addedPoints = expectedPoints(0, 0, 32_157, 1_508);
    expect(withExtra.points).toBe(base.points + addedPoints);
    expect(withExtra.points).toBe(expectedPoints(4000, 4500, 32_157, 1_508));
  });

  it("检索 token 折算（searchCostCny）是 cnyCost 的子集", () => {
    const r = computeAiCost({
      model: MODEL,
      inputTokens: 1000,
      outputTokens: 100,
      extraInputTokens: 50_000,
      extraOutputTokens: 2_000,
    });
    const inP = PRICE!.inPrice;
    const outP = PRICE!.outPrice;
    const searchCny = (50_000 / 1000) * inP + (2_000 / 1000) * outP;
    expect(r.searchCostCny).toBeCloseTo(Math.round(searchCny * 1000) / 1000, 3);
    // searchCostCny <= cnyCost（主 LLM 也有成本时严格小于；此处主 LLM 很小仍成立）
    expect(r.searchCostCny!).toBeLessThanOrEqual(r.actualCostCny);
    // 决策 2：cached 维持全价 ⇒ 没有任何 cached 折扣 —— 这里直接断言 cnyCost 用全价 inP
    const fullCny = (51_000 / 1000) * inP + (2_100 / 1000) * outP;
    expect(r.actualCostCny).toBeCloseTo(Math.round(fullCny * 1000) / 1000, 3);
  });
});

describe("③ 检索按次费用：只留痕，不进 points", () => {
  it("metered 只产出 searchCallCostCny / searchCallChargedToUser===false，不影响 points", () => {
    const calls = 13;
    const r = computeAiCost({
      model: MODEL,
      inputTokens: 4000,
      outputTokens: 4500,
      extraInputTokens: 0,
      extraOutputTokens: 0,
      metered: { kind: "ark_web_search", calls, unitPriceCny: ARK_WEB_SEARCH_UNIT_PRICE_CNY },
    });

    expect(r.points).toBe(expectedPoints(4000, 4500)); // 没因为 metered 多收一分
    expect(r.searchCalls).toBe(calls);
    expect(r.searchCallCostCny).toBeCloseTo(
      Math.round(calls * ARK_WEB_SEARCH_UNIT_PRICE_CNY * 1000) / 1000,
      3
    );
    // 🔴 决策 1：按次费用由平台吸收，恒 false
    expect(r.searchCallChargedToUser).toBe(false);
  });

  it("extra token 与 metered 同时传：points 只含 token，calls 只留痕", () => {
    const r = computeAiCost({
      model: MODEL,
      inputTokens: 1000,
      outputTokens: 100,
      extraInputTokens: 10_000,
      extraOutputTokens: 500,
      metered: { kind: "ark_web_search", calls: 57, unitPriceCny: ARK_WEB_SEARCH_UNIT_PRICE_CNY },
    });
    expect(r.points).toBe(expectedPoints(1000, 100, 10_000, 500));
    expect(r.searchCalls).toBe(57);
    expect(r.searchCallChargedToUser).toBe(false);
  });
});

describe("④ 边界：0 / 负数 / 非整数入参被归一成非负整数", () => {
  it("负数与小数被 max(0, floor) 夹紧", () => {
    const r = computeAiCost({
      model: MODEL,
      inputTokens: 4000,
      outputTokens: 4500,
      extraInputTokens: -9000,
      extraOutputTokens: 3.9,
    });
    expect(r.searchInputTokens).toBe(0);
    expect(r.searchOutputTokens).toBe(3);
    expect(r.points).toBe(expectedPoints(4000, 4500));
  });
});
