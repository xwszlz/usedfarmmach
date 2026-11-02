/**
 * 集成测试：检索用量并入计费（2026-11-01 计费口径统一 · T03 接线）
 * ─────────────────────────────────────────────────────────
 * 验证「检索的真实 token 终于进账」这条最关键的链路：
 *   ① 首次预检**在检索之前**触发（A-修复：余额 0 的用户不再先烧检索钱）→ retrieveStrategyContext 不被调用；
 *   ② 二次预检：检索拿到真实用量后、LLM 之前，再判一次余额（补足差额）→ LLM 不被调用；
 *   ③ 正常路径：drain 出来的检索用量并进 `computeAiCost`，扣费明细里带 search* 字段，
 *      且 `searchCallChargedToUser === false`（决策 1：按次费用平台吸收）。
 *
 * 关键技巧：`retrieveStrategyContext` 被 mock，但它在**路由的 ALS 作用域内**运行，
 * 于是测试可在 mock 实现里直接 `recordWebSearchUsage(...)`，这些记录会落到同一条请求的桶里，
 * 路由随后 `drainWebSearchUsage()` 取走并计费 —— 与真实「检索层记录、路由消费」的形态一致。
 *
 * 运行：npx vitest run src/app/api/agents/seller-helper/sales-strategy/__tests__/route.search-billing.test.ts
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
vi.mock("@/lib/credits/spend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/credits/spend")>();
  return { ...actual, deductCredits: vi.fn() };
});
vi.mock("@/lib/credits/config", () => ({ getAiCostGuardrail: vi.fn(async () => 3000) }));
vi.mock("@/lib/sales-strategy/retrieval", () => ({
  retrieveStrategyContext: vi.fn(),
  fetchLeadDealerContact: vi.fn(),
}));
vi.mock("@/lib/sales-strategy/prompt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sales-strategy/prompt")>();
  return {
    ...actual,
    buildStrategyMessages: vi.fn(async () => []),
    parseStrategyResultDetailed: vi.fn(),
  };
});

import { getUserFromRequest } from "@/lib/auth";
import { chatCompletionDoubao } from "@/lib/ai/ark-client";
import { AI_COST_MULTIPLIER, CREDITS_PER_UNIT, deductCredits } from "@/lib/credits/spend";
import { getAiCostGuardrail } from "@/lib/credits/config";
import { retrieveStrategyContext, fetchLeadDealerContact } from "@/lib/sales-strategy/retrieval";
import {
  parseStrategyResultDetailed,
  sanitizeStrategy,
} from "@/lib/sales-strategy/prompt";
import { recordWebSearchUsage } from "@/lib/credits/search-usage-collector";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/route";
import type { WebEvidence } from "@/lib/search/web-evidence";

const IN_PRICE = 0.006;
const OUT_PRICE = 0.03;

/** 一份「rejected 不达标」的 LLM 输出（无 bestDestinations ⇒ 必然触发重试） */
const LLM_JSON = JSON.stringify({
  summary: "一句话策略",
  targetMarkets: [{ market: "RU", priority: "高", rationale: "x" }],
  priceRange: { suggestedMinCny: 100, suggestedMaxCny: 200 },
  channels: [{ candidateId: "lead_abc", type: "lead", rationale: "r" }],
  compliance: { dataExport: "x" },
  actionChecklist: [{ step: 1, action: "a" }],
  responsibility: { seller: "s" },
});

function makeReq(body: unknown): NextRequest {
  return new NextRequest("https://usedfarmmach.cn/zh/products/p1", {
    method: "POST",
    headers: { referer: "https://usedfarmmach.cn/zh/products/p1" },
    body: JSON.stringify(body),
  });
}

/** 与 `WebEvidence` 类型完全一致的 mock（仅供类型收敛，不改变任何运行期行为） */
const MOCK_WEB_EVIDENCE: WebEvidence = {
  status: "ok",
  provider: null,
  items: [],
  urls: [],
  successQueries: 5,
  totalQueries: 5,
  note: "",
  elapsedMs: 100,
  cached: false,
  dataSources: [{ name: "Web检索", ref: "mock" }],
  reason: "",
};

function mockCtx(overrides: Record<string, unknown> = {}) {
  return {
    product: null,
    candidates: [
      {
        id: "lead_abc",
        type: "lead" as const,
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
    webEvidence: MOCK_WEB_EVIDENCE,
    ...overrides,
  };
}

/** 在 mock 的检索里「造」一份真实检索用量（落在当前请求作用域的桶里） */
function recordSearchStub(searchCalls = 13, inputTokens = 32_157, outputTokens = 1_508, cached = false) {
  return mockCtx({ webEvidence: { status: "ok", cached, elapsedMs: 100, totalQueries: 5, note: "" } });
}

function searchPoints(inputTokens: number, outputTokens: number): number {
  const cny = (inputTokens / 1000) * IN_PRICE + (outputTokens / 1000) * OUT_PRICE;
  return Math.round(cny * CREDITS_PER_UNIT * AI_COST_MULTIPLIER);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAiCostGuardrail).mockResolvedValue(3000);
  vi.mocked(deductCredits).mockResolvedValue({ ok: true, credits: 9900, required: 250 });
  vi.mocked(fetchLeadDealerContact).mockResolvedValue({
    candidateId: "lead_abc",
    type: "lead",
    name: "潜在买家",
    phone: "13800001111",
    wechat: "wx",
    email: "a@b.com",
    productId: null,
  } as any);
  vi.mocked(parseStrategyResultDetailed).mockImplementation((t: string) => {
    try {
      return { strategy: sanitizeStrategy(JSON.parse(t)), truncated: false, repaired: false };
    } catch {
      return { strategy: {}, truncated: false, repaired: false };
    }
  });
});

describe("① 首次预检在检索之前（A-修复，最严重的一条）", () => {
  it("余额 0 ⇒ 402 且 retrieveStrategyContext / chatCompletionDoubao / deductCredits 全不调用", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 0 } as any);
    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(402);
    expect(retrieveStrategyContext).not.toHaveBeenCalled();
    expect(chatCompletionDoubao).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });
});

describe("② 二次预检：真实检索用量 → 补足差额", () => {
  it("预检过 250 但检索后总账 > 余额 ⇒ 402（LLM 不被调用，只损失检索的钱）", async () => {
    // 预检门槛 ≈250 通过；检索用量 = 32_157/1_508 ⇒ 总成本约 397 积分
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 300 } as any);
    vi.mocked(retrieveStrategyContext).mockImplementation(async () => {
      // 在路由 ALS 作用域内造一份检索用量（与真实「检索层记录」形态一致）
      recordWebSearchUsage({
        kind: "ark_web_search",
        searchCalls: 13,
        inputTokens: 32_157,
        outputTokens: 1_508,
        estimated: false,
      });
      return recordSearchStub();
    });

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(402);
    // 关键：第一次检索已经真打了，但 LLM 不该再被触发（差额补齐在 LLM 之前）
    expect(chatCompletionDoubao).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
    expect((await res.json()).required).toBeGreaterThan(250);
  });
});

describe("③ 正常路径：检索用量并进计费明细", () => {
  it("deductCredits 的 breakdown 带 search* 字段，且 searchCallChargedToUser===false（决策 1）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99_999 } as any);
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: LLM_JSON,
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    } as any);
    vi.mocked(retrieveStrategyContext).mockImplementation(async () => {
      recordWebSearchUsage({
        kind: "ark_web_search",
        searchCalls: 13,
        inputTokens: 32_157,
        outputTokens: 1_508,
        estimated: false,
      });
      return recordSearchStub();
    });

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(200);

    expect(deductCredits).toHaveBeenCalledTimes(1);
    const breakdown = vi.mocked(deductCredits).mock.calls[0][3] as Record<string, unknown>;
    expect(breakdown.searchInputTokens).toBe(32_157);
    expect(breakdown.searchOutputTokens).toBe(1_508);
    expect(breakdown.searchCalls).toBe(13);
    // 🔴 决策 1：按次费用由平台吸收，账本上「看得见没收」
    expect(breakdown.searchCallChargedToUser).toBe(false);
    // 检索 token 折算成本与点数都正确加进来了
    const searchPt = searchPoints(32_157, 1_508);
    expect(searchPt).toBeGreaterThan(0);
    expect(breakdown.searchCostCny).toBeCloseTo(
      Math.round(((32_157 / 1000) * IN_PRICE + (1_508 / 1000) * OUT_PRICE) * 1000) / 1000,
      3
    );
    // 扣减点数 = max(主LLM + 检索, 250)
    const mainPt = searchPoints(100, 200); // 首轮不达标→重试2次 → token 累加 200/400
    expect(mainPt).toBeLessThan(250); // 主 LLM 落在最低消费之下
    // 检索 token 单独约 238 点 + 主 LLM 约 13 点 = 251 点 > 250 ⇒ 最低消费不兜底，按真实成本收
    expect(vi.mocked(deductCredits).mock.calls[0][1]).toBe(251);
    // 但主 LLM 真实 token 仍记录在 breakdown
    expect(breakdown.inputTokens).toBe(200);
    expect(breakdown.outputTokens).toBe(400);
  });

  it("检索整体命中缓存 ⇒ searchCached=true，且本次无检索 token 成本（对账可解释）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99_999 } as any);
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: LLM_JSON,
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    } as any);
    vi.mocked(retrieveStrategyContext).mockImplementation(async () => {
      // 缓存命中：检索层**不会** record（没有真实用量发生）
      return recordSearchStub(0, 0, 0, true);
    });

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(200);
    const breakdown = vi.mocked(deductCredits).mock.calls[0][3] as Record<string, unknown>;
    expect(breakdown.searchCached).toBe(true);
    // 未记录 ⇒ 检索明细不出现（additive：缓存命中时仍只收主 LLM 的钱）
    expect(breakdown.searchInputTokens ?? 0).toBe(0);
    expect(breakdown.searchCallChargedToUser).toBe(false);
  });
});
