/**
 * 集成测试：POST /api/agents/seller-helper/sales-strategy
 * 风险点：① 未登录→401 ② 余额不足→402 ③ 正常→200 + 6 业务字段 + UsageLog(aiSalesStrategy) + 默认掩码
 *         ④ 计费参数不出现在任何返回体明文
 *         ⑤ 成本加成口径：扣减金额由 computeAiCost 的真实价格表算出，且不低于策略最低消费
 *         ⑥ 重试（第 2 次 LLM 调用）的 token 必须计入成本
 *         （护栏熔断→429、实际扣费不足→402 也一并覆盖）
 *
 * 说明：除 @/lib/pii（真实脱敏函数）与 computeAiCost（真实价格表 + 真实公式）外，
 *       所有外部依赖（auth/db/LLM/扣款/护栏/检索/提示词）均 mock，仅验证路由编排与契约。
 *       计费断言因此是「真算出来的数」，而不是把 mock 的返回值再断言一遍。
 * 运行：npx vitest run src/app/api/agents/seller-helper/sales-strategy
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
/**
 * 计费层：**保留真实的 computeAiCost**（价格表 doubao 6 元/百万输入、30 元/百万输出），
 * 只把 `deductCredits` 换成 spy（不写库、不碰事务）。
 * 这样 `deductCredits` 收到的积分是路由真算出来的，能真正锁住计费公式与最低消费。
 */
vi.mock("@/lib/credits/spend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/credits/spend")>();
  return { ...actual, deductCredits: vi.fn() };
});
/** 单次护栏：默认给足；个别用例下调以验证熔断分支 */
vi.mock("@/lib/credits/config", () => ({ getAiCostGuardrail: vi.fn() }));
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
import { AI_COST_MULTIPLIER, deductCredits } from "@/lib/credits/spend";
import { getAiCostGuardrail } from "@/lib/credits/config";
import { retrieveStrategyContext, fetchLeadDealerContact } from "@/lib/sales-strategy/retrieval";
import { parseStrategyResult } from "@/lib/sales-strategy/prompt";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/route";

const PLAIN_PHONE = "13800001111";

/** 豆包价目表（与 spend.ts 的 MODEL_PRICING 同源）：输入 6 元/百万、输出 30 元/百万 */
const IN_PRICE_PER_1K = 0.006;
const OUT_PRICE_PER_1K = 0.03;
/** 与 spend.ts 的 CREDITS_PER_UNIT 一致：1 元 = 100 积分 */
const CREDITS_PER_UNIT = 100;

/** 策略专属最低消费（与路由常量同值；测试侧独立写死，防止常量被悄悄改小） */
const MIN_POINTS = 250;

/**
 * 按真实公式复算期望积分（消耗侧全球统一人民币口径）：
 *   cnyCost = in/1000×0.006 + out/1000×0.03
 *   points  = round(cnyCost × 100 × 运营定价倍率)
 * 运营定价倍率直接取源码导出常量，避免测试里出现倍率明文。
 */
function expectedPoints(inputTokens: number, outputTokens: number): number {
  const cny = (inputTokens / 1000) * IN_PRICE_PER_1K + (outputTokens / 1000) * OUT_PRICE_PER_1K;
  return Math.round(cny * CREDITS_PER_UNIT * AI_COST_MULTIPLIER);
}

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAiCostGuardrail).mockResolvedValue(3000);
  vi.mocked(deductCredits).mockResolvedValue({ ok: true, credits: 9900, required: MIN_POINTS });
  vi.mocked(retrieveStrategyContext).mockResolvedValue(mockCtx() as any);
  vi.mocked(parseStrategyResult).mockImplementation((t: string) => JSON.parse(t));
  vi.mocked(fetchLeadDealerContact).mockResolvedValue({
    candidateId: "lead_abc",
    type: "lead",
    name: "潜在买家",
    phone: PLAIN_PHONE,
    wechat: "wx",
    email: "a@b.com",
    productId: null,
  } as any);
});

describe("① 鉴权 / 余额门禁", () => {
  it("未登录 → 401 LOGIN_REQUIRED", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null);
    const res = await POST(makeReq({ text: "2014 FRANQUET TE6" }));
    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.success).toBe(false);
    expect(j.code).toBe("LOGIN_REQUIRED");
    expect(chatCompletionDoubao).not.toHaveBeenCalled();
  });

  it("余额不足（成本加成预估门槛）→ 402 INSUFFICIENT_CREDITS + rechargeUrl，不发起 LLM", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 0 } as any);
    const res = await POST(makeReq({ text: "test" }));
    expect(res.status).toBe(402);
    const j = await res.json();
    expect(j.code).toBe("INSUFFICIENT_CREDITS");
    expect(j.rechargeUrl).toContain("/credits");
    // 门槛 = max(成本加成预估值, 策略最低消费)；余额 0 必然被拦
    expect(j.required).toBeGreaterThan(0);
    expect(j.balance).toBe(0);
    expect(chatCompletionDoubao).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("余额 = 门槛 - 1 → 402；余额 = 门槛 → 放行（门槛口径与实际扣费一致，不会白等 80 秒）", async () => {
    // 预检门槛：input 4000 / output 4500 的成本加成结果与最低消费取大
    const est = expectedPoints(4000, 4500);
    const gate = Math.max(est, MIN_POINTS);

    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: gate - 1 } as any);
    const blocked = await POST(makeReq({ text: "x" }));
    expect(blocked.status).toBe(402);
    expect((await blocked.json()).required).toBe(gate);
    expect(chatCompletionDoubao).not.toHaveBeenCalled();

    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: gate } as any);
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: LLM_JSON,
      usage: { prompt_tokens: 100, completion_tokens: 100 },
    } as any);
    const passed = await POST(makeReq({ text: "x" }));
    expect(passed.status).toBe(200);
  });
});

describe("③ 正常流程", () => {
  it("200：返回 6 业务字段 + UsageLog(aiSalesStrategy) + 渠道电话默认掩码 + 不含计费参数明文", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: LLM_JSON,
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    } as any);

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

    // 计费参数不出现在任何返回体明文（泄露铁律）
    const body = JSON.stringify(j);
    expect(body).not.toMatch(/coeff|coefficient|multiplier|倍数|ai_cost_coeff|ai_cost_guardrail/i);
  });
});

describe("⑤ 成本加成计费（真价格表参与断言）", () => {
  it("正常生成：按实际 token 的成本加成结果扣款（低于最低消费时按最低消费兜底）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: LLM_JSON,
      usage: { prompt_tokens: 100, completion_tokens: 100 },
    } as any);

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(200);

    // 首轮不达标触发重试 ⇒ 共 2 次调用，token 累加为 input 200 / output 200
    const pure = expectedPoints(200, 200);
    expect(pure).toBeLessThan(MIN_POINTS); // 前提校验：本题确实落在最低消费之下

    expect(deductCredits).toHaveBeenCalledTimes(1);
    const call = vi.mocked(deductCredits).mock.calls[0] as any[];
    expect(call[0]).toBe("u1");
    expect(call[1]).toBe(MIN_POINTS); // 最低消费生效
    expect(call[2]).toBe("AI销售策略");
    expect(call[3]).toMatchObject({
      inputTokens: 200,
      outputTokens: 200,
      points: pure, // 账面留痕的仍是纯成本加成结果
      chargedPoints: MIN_POINTS,
    });

    const j = await res.json();
    expect(j.data.cost).toBe(MIN_POINTS);
    expect(j.data.balance).toBe(9900);
  });

  it("⑥ 重试的第 2 次 LLM 调用 token 也计入成本（不是白送）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    // 单次 input 20000 / output 8192 ⇒ 单次成本已远超最低消费，能真实反映累加差异
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: LLM_JSON,
      usage: { prompt_tokens: 20000, completion_tokens: 8192 },
    } as any);

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(200);

    // LLM_JSON 无 bestDestinations ⇒ 判不达标 ⇒ 必然重试 1 次 ⇒ 2 次调用
    expect(chatCompletionDoubao).toHaveBeenCalledTimes(2);

    const oneCall = expectedPoints(20000, 8192);
    const twoCalls = expectedPoints(40000, 16384);
    expect(twoCalls).toBeGreaterThan(oneCall);

    const call = vi.mocked(deductCredits).mock.calls[0] as any[];
    expect(call[1]).toBe(twoCalls); // 若漏掉重试 token，这里会退化成 oneCall
    expect(call[3]).toMatchObject({
      inputTokens: 40000,
      completionTokens: 16384,
      rejectedRetried: true,
    });
  });

  it("护栏熔断 → 429 GUARDRAIL（未扣费、不写 UsageLog）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    vi.mocked(getAiCostGuardrail).mockResolvedValue(1); // 极低下限，必然熔断
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: "{}",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    } as any);

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(429);
    const j = await res.json();
    expect(j.code).toBe("GUARDRAIL");
    expect(deductCredits).not.toHaveBeenCalled();
    expect(prisma.usageLog.create).not.toHaveBeenCalled();
  });

  it("实际扣费不足 → 402 INSUFFICIENT_CREDITS（返回余额与所需积分）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: "{}",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    } as any);
    vi.mocked(deductCredits).mockResolvedValue({
      ok: false,
      insufficient: true,
      credits: 50,
      required: MIN_POINTS,
    });

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(402);
    const j = await res.json();
    expect(j.code).toBe("INSUFFICIENT_CREDITS");
    expect(j.balance).toBe(50);
    expect(j.required).toBe(MIN_POINTS);
  });
});
