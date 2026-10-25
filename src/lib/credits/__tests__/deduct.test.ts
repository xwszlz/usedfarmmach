/**
 * 单元测试：按量计费服务 deduct.ts
 * 风险点：① 正常 cost=ceil(tokens×coeff) ② 护栏熔断 ③ 余额不足→INSUFFICIENT ④ 绝不产生负余额（委托 spend，见 spend.test.ts）
 *
 * 运行：npm test  （vitest）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { estimateAiCost, deductAiUsage } from "@/lib/credits/deduct";

// 依赖全部 mock：spend（真实扣减/FIFO 在 spend.test.ts 验证）与 config（系数/护栏）
vi.mock("@/lib/credits/spend", () => ({ deductCredits: vi.fn() }));
vi.mock("@/lib/credits/config", () => ({
  getAiCostCoeff: vi.fn(),
  getAiCostGuardrail: vi.fn(),
}));

import { deductCredits } from "@/lib/credits/spend";
import { getAiCostCoeff, getAiCostGuardrail } from "@/lib/credits/config";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("estimateAiCost —— 成本公示算法", () => {
  it("cost = ceil(tokens × coeff)", async () => {
    (getAiCostCoeff as any).mockResolvedValue(2);
    expect(await estimateAiCost(1000)).toBe(2000);

    (getAiCostCoeff as any).mockResolvedValue(1.5);
    // ceil(1001 × 1.5 = 1501.5) = 1502
    expect(await estimateAiCost(1001)).toBe(1502);
  });

  it("负数 / 非法 tokens 归零（cost = 0）", async () => {
    (getAiCostCoeff as any).mockResolvedValue(2);
    expect(await estimateAiCost(-5)).toBe(0);
    expect(await estimateAiCost(0)).toBe(0);
  });
});

describe("deductAiUsage —— 实际扣减编排", () => {
  it("① 正常：cost=ceil(tokens×coeff)，返回 OK 与扣后余额，type=ai_deduct", async () => {
    (getAiCostCoeff as any).mockResolvedValue(2);
    (getAiCostGuardrail as any).mockResolvedValue(5000);
    (deductCredits as any).mockResolvedValue({ ok: true, credits: 800 });

    const r = await deductAiUsage({
      userId: "u1",
      action: "aiSalesStrategy",
      actualTokens: 1000,
      reason: "AI销售策略",
    });

    expect(r.ok).toBe(true);
    expect(r.cost).toBe(2000);
    expect(r.balance).toBe(800);
    expect(r.code).toBe("OK");
    expect(deductCredits).toHaveBeenCalledWith(
      "u1",
      2000,
      "AI销售策略",
      expect.anything(),
      "ai_deduct"
    );
  });

  it("② 护栏熔断：cost > guardrail → GUARDRAIL，且不调用任何扣减（不扣费）", async () => {
    (getAiCostCoeff as any).mockResolvedValue(2);
    (getAiCostGuardrail as any).mockResolvedValue(1000); // 护栏上限 1000
    (deductCredits as any).mockResolvedValue({ ok: true, credits: 0 });

    // cost = ceil(1000 × 2) = 2000 > 1000 → 熔断
    const r = await deductAiUsage({
      userId: "u1",
      action: "aiSalesStrategy",
      actualTokens: 1000,
      reason: "x",
    });

    expect(r.ok).toBe(false);
    expect(r.code).toBe("GUARDRAIL");
    expect(r.cost).toBe(2000);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("③ 余额不足：deductCredits 返回 insufficient → INSUFFICIENT，返回当前余额", async () => {
    (getAiCostCoeff as any).mockResolvedValue(1);
    (getAiCostGuardrail as any).mockResolvedValue(5000);
    (deductCredits as any).mockResolvedValue({ ok: false, insufficient: true, credits: 50 });

    const r = await deductAiUsage({
      userId: "u1",
      action: "aiSalesStrategy",
      actualTokens: 100,
      reason: "x",
    });

    expect(r.ok).toBe(false);
    expect(r.code).toBe("INSUFFICIENT");
    expect(r.balance).toBe(50);
  });

  it("unlockContact 使用 viewcontact_cost 类型，按固定预估 tokens 计费", async () => {
    (getAiCostCoeff as any).mockResolvedValue(1);
    (getAiCostGuardrail as any).mockResolvedValue(5000);
    (deductCredits as any).mockResolvedValue({ ok: true, credits: 900 });

    const r = await deductAiUsage({
      userId: "u1",
      action: "unlockContact",
      estimatedTokens: 800,
      reason: "解锁销售线索联系方式",
    });

    expect(r.ok).toBe(true);
    expect(r.cost).toBe(800); // ceil(800 × 1)
    expect(deductCredits).toHaveBeenCalledWith(
      "u1",
      800,
      "解锁销售线索联系方式",
      expect.anything(),
      "viewcontact_cost"
    );
  });

  it("④ 防御：负数 actualTokens 归零 → cost=0，仍以 need=0 委托扣减（spend 保证零写/不负债）", async () => {
    (getAiCostCoeff as any).mockResolvedValue(2);
    (getAiCostGuardrail as any).mockResolvedValue(5000);
    (deductCredits as any).mockResolvedValue({ ok: true, credits: 100 });

    const r = await deductAiUsage({
      userId: "u1",
      action: "aiSalesStrategy",
      actualTokens: -10,
      reason: "x",
    });

    expect(r.cost).toBe(0);
    expect(deductCredits).toHaveBeenCalledWith("u1", 0, "x", expect.anything(), "ai_deduct");
  });
});
