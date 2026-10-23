/**
 * 集成测试：POST /api/agents/seller-helper/sales-strategy
 * 风险点：① 未登录→401 ② 余额不足→402 ③ 正常→200 + 6 业务字段 + UsageLog(aiSalesStrategy) + 默认掩码
 *         ④ 计费系数不出现在任何返回体明文
 *         （护栏熔断→429、实际扣费不足→402 也一并覆盖）
 *
 * 说明：除 @/lib/pii（真实脱敏函数）外，所有外部依赖（auth/db/LLM/计费/检索/提示词）均 mock，
 *       仅验证路由本身的编排与契约。运行：npm test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    usageLog: { create: vi.fn().mockResolvedValue({}) },
    piiAuditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/lib/ai/ark-client", () => ({
  chatCompletionDoubao: vi.fn(),
  getArkModelId: vi.fn(() => "doubao-seed-2-1-pro-260915"),
}));
vi.mock("@/lib/credits/deduct", () => ({
  deductAiUsage: vi.fn(),
  estimateAiCost: vi.fn(),
  UNLOCK_ESTIMATED_TOKENS: 800,
}));
vi.mock("@/lib/sales-strategy/retrieval", () => ({
  retrieveStrategyContext: vi.fn(),
  fetchLeadDealerContact: vi.fn(),
}));
vi.mock("@/lib/sales-strategy/prompt", () => ({
  buildStrategyMessages: vi.fn(() => []),
  parseStrategyResult: vi.fn(),
}));
// @/lib/pii 保持真实，验证默认脱敏确实生效

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chatCompletionDoubao } from "@/lib/ai/ark-client";
import { deductAiUsage, estimateAiCost } from "@/lib/credits/deduct";
import { retrieveStrategyContext, fetchLeadDealerContact } from "@/lib/sales-strategy/retrieval";
import { parseStrategyResult } from "@/lib/sales-strategy/prompt";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/route";

const PLAIN_PHONE = "13800001111";

function makeReq(body: unknown) {
  return new NextRequest("https://usedfarmmach.cn/zh/products/p1", {
    method: "POST",
    headers: { referer: "https://usedfarmmach.cn/zh/products/p1" },
    body: JSON.stringify(body),
  });
}

function mockCtx() {
  return {
    product: null,
    candidates: [
      {
        id: "lead_abc",
        type: "lead",
        name: "潜在买家",
        brand: "CLAAS",
        model: "Jaguar 970",
        region: "EU",
        source: "lead_pool",
      },
    ],
    similarProducts: [],
    benchmarks: [],
    dailyReport: null,
    portSuggestion: "",
    marketIntel: [],
    realtimeExternal: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("① 鉴权 / 余额门禁", () => {
  it("未登录 → 401 LOGIN_REQUIRED", async () => {
    (getUserFromRequest as any).mockResolvedValue(null);
    const res = await POST(makeReq({ text: "2014 FRANQUET TE6" }));
    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.success).toBe(false);
    expect(j.code).toBe("LOGIN_REQUIRED");
    expect(chatCompletionDoubao).not.toHaveBeenCalled();
  });

  it("余额不足（按名义预估）→ 402 INSUFFICIENT_CREDITS + rechargeUrl，不发起 LLM", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 0 });
    (estimateAiCost as any).mockResolvedValue(9999);
    const res = await POST(makeReq({ text: "test" }));
    expect(res.status).toBe(402);
    const j = await res.json();
    expect(j.code).toBe("INSUFFICIENT_CREDITS");
    expect(j.rechargeUrl).toContain("/credits");
    expect(chatCompletionDoubao).not.toHaveBeenCalled();
  });
});

describe("③ 正常流程", () => {
  it("200：返回 6 业务字段 + UsageLog(aiSalesStrategy) + 渠道电话默认掩码 + 不含计费系数明文", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    (estimateAiCost as any).mockResolvedValue(100);
    (retrieveStrategyContext as any).mockResolvedValue(mockCtx());
    const llmJson = JSON.stringify({
      summary: "一句话策略",
      targetMarkets: [{ market: "RU", priority: "高", rationale: "x" }],
      priceRange: { suggestedMinCny: 100, suggestedMaxCny: 200 },
      channels: [{ candidateId: "lead_abc", type: "lead", rationale: "r" }],
      compliance: { dataExport: "x" },
      actionChecklist: [{ step: 1, action: "a" }],
      responsibility: { seller: "s" },
    });
    (chatCompletionDoubao as any).mockResolvedValue({
      text: llmJson,
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });
    (parseStrategyResult as any).mockImplementation((t: string) => JSON.parse(t));
    (fetchLeadDealerContact as any).mockResolvedValue({
      candidateId: "lead_abc",
      type: "lead",
      name: "潜在买家",
      phone: PLAIN_PHONE,
      wechat: "wx",
      email: "a@b.com",
      productId: null,
    });
    (deductAiUsage as any).mockResolvedValue({ ok: true, cost: 100, balance: 9900 });

    const res = await POST(makeReq({ text: "2014 FRANQUET TE6" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);

    const d = j.data;
    // 6 业务字段齐备（prompt 定义：targetMarkets/priceRange/channels/compliance/actionChecklist/responsibility）
    for (const f of [
      "targetMarkets",
      "priceRange",
      "channels",
      "compliance",
      "actionChecklist",
      "responsibility",
    ]) {
      expect(d[f]).toBeDefined();
    }
    // 渠道电话默认脱敏（非明文）
    expect(d.channels[0].phoneMasked).not.toBe(PLAIN_PHONE);
    expect(d.channels[0].phoneMasked).toBe("138****1111");

    // UsageLog 写入 aiSalesStrategy
    expect(prisma.usageLog.create).toHaveBeenCalled();
    expect((prisma.usageLog.create as any).mock.calls[0][0].data.action).toBe("aiSalesStrategy");

    // 计费系数不出现在任何返回体明文
    const body = JSON.stringify(j);
    expect(body).not.toMatch(/coeff|coefficient|multiplier|倍数|ai_cost_coeff|ai_cost_guardrail/i);
  });

  it("② 扣费护栏熔断 → 429 GUARDRAIL（未扣费，UsageLog 不写）", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    (estimateAiCost as any).mockResolvedValue(100);
    (retrieveStrategyContext as any).mockResolvedValue(mockCtx());
    (chatCompletionDoubao as any).mockResolvedValue({
      text: "{}",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    (parseStrategyResult as any).mockImplementation((t: string) => JSON.parse(t));
    (deductAiUsage as any).mockResolvedValue({ ok: false, code: "GUARDRAIL", cost: 9999, balance: 0 });

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(429);
    const j = await res.json();
    expect(j.code).toBe("GUARDRAIL");
    expect(prisma.usageLog.create).not.toHaveBeenCalled();
  });

  it("实际扣费不足 → 402 INSUFFICIENT_CREDITS（返回余额）", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    (estimateAiCost as any).mockResolvedValue(100);
    (retrieveStrategyContext as any).mockResolvedValue(mockCtx());
    (chatCompletionDoubao as any).mockResolvedValue({
      text: "{}",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    (parseStrategyResult as any).mockImplementation((t: string) => JSON.parse(t));
    (deductAiUsage as any).mockResolvedValue({ ok: false, code: "INSUFFICIENT", cost: 100, balance: 50 });

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(402);
    const j = await res.json();
    expect(j.code).toBe("INSUFFICIENT_CREDITS");
    expect(j.balance).toBe(50);
  });
});
