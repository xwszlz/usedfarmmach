/**
 * 集成测试：销售策略路由的「输出质量」修复（T14）
 * ─────────────────────────────────────────────────────────
 * 覆盖四件事（旧行为全都在这里被钉死，改回去必然红）：
 *   ① 时间预算常量与深度分析对齐（90s/8192/85s/88s → 300s/16384/240s/280s）
 *   ② `finishReason === "length"` 时**续写**，且续写的 token 计入成本
 *   ③ 解析为空 ⇒ **502 + 一分不扣**（旧行为：200 + 空字段 + 照扣 250 积分）
 *   ④ 脏字段类型被清洗（旧行为：`...strategy` 原样透传 ⇒ 前端 `.map()` 白屏）
 *
 * 说明：本文件**不 mock 提示词层**（`sanitizeStrategy` / `isStrategyEmpty` /
 * `parseStrategyResultDetailed` 都走真实实现），因为这三者正是被测对象；
 * 只 mock 鉴权 / DB / LLM / 扣款 / 护栏 / 检索。
 *
 * 运行：npx vitest run src/app/api/agents/seller-helper/sales-strategy/__tests__/route.llm-quality.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
// 保留真实 computeAiCost（价格表真算），只把落库扣款换成 spy
vi.mock("@/lib/credits/spend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/credits/spend")>();
  return { ...actual, deductCredits: vi.fn() };
});
vi.mock("@/lib/credits/config", () => ({ getAiCostGuardrail: vi.fn(async () => 3000) }));
vi.mock("@/lib/sales-strategy/retrieval", () => ({
  retrieveStrategyContext: vi.fn(),
  fetchLeadDealerContact: vi.fn(),
}));

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chatCompletionDoubao } from "@/lib/ai/ark-client";
import { deductCredits } from "@/lib/credits/spend";
import { retrieveStrategyContext, fetchLeadDealerContact } from "@/lib/sales-strategy/retrieval";
import { POST, maxDuration } from "@/app/api/agents/seller-helper/sales-strategy/route";

/** 首轮被 max_tokens 砍断的 JSON（真实形态：bestDestinations 的 rejected 没闭合） */
const TRUNCATED_JSON =
  '{"summary":"中亚优先","readout":"国内与中亚两极分化",' +
  '"bestDestinations":[{"equipment":"克拉斯 Quadrant 3200","market":["乌兹别克"],' +
  '"basis":"本地无同类在售","rejected":[{"market":"欧盟","reason":"合规成本过高","level":"L3"}]';

/** 续写片段：只补剩余的括号与后续字段（模拟真实的续写行为） */
const CONTINUE_FRAGMENT = '}],"dataSources":[{"name":"站内基准价","ref":"未找到"}]}';

function makeReq(body: unknown): NextRequest {
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
  vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
  vi.mocked(retrieveStrategyContext).mockResolvedValue(mockCtx() as any);
  vi.mocked(fetchLeadDealerContact).mockResolvedValue({
    candidateId: "lead_abc",
    type: "lead",
    name: "潜在买家",
    phone: "13800001111",
    wechat: "wx",
    email: "a@b.com",
    productId: null,
  } as any);
  vi.mocked(deductCredits).mockResolvedValue({ ok: true, credits: 9900, required: 250 });
});

describe("① 时间预算常量（与 deep-analysis 对齐）", () => {
  it("maxDuration = 300（旧值 90 ⇒ 输出要 75-150s 的请求必然被平台杀成 HTML 504）", () => {
    expect(maxDuration).toBe(300);
  });

  it("三个私有常量取值正确（模块私有，用源码守卫钉住：8192/85s/88s 一律不许回来）", () => {
    const routeSrc = readFileSync(
      resolve(process.cwd(), "src/app/api/agents/seller-helper/sales-strategy/route.ts"),
      "utf8"
    );
    expect(routeSrc).toMatch(/const SALES_STRATEGY_MAX_TOKENS = 16384;/);
    expect(routeSrc).toMatch(/const LLM_CALL_TIMEOUT_MS = 240_000;/);
    expect(routeSrc).toMatch(/const LLM_TOTAL_BUDGET_MS = 280_000;/);
    // 单次超时必须小于 maxDuration，否则路由先被平台杀掉
    expect(240_000).toBeLessThan(300_000);

    const retrievalSrc = readFileSync(
      resolve(process.cwd(), "src/lib/sales-strategy/retrieval.ts"),
      "utf8"
    );
    // Neon 冷启动唤醒常 >1-3s，3s 硬闸会让 6 个查询集体返回 null ⇒ 模型只能编
    expect(retrievalSrc).toMatch(/const DB_TIMEOUT_MS = 8_000;/);
  });
});

describe("② 截断续写：finishReason=length 触发续写且 token 累加", () => {
  it("两轮拼接出完整 JSON，扣费包含续写消耗，响应标记 truncated", async () => {
    vi.mocked(chatCompletionDoubao)
      .mockResolvedValueOnce({
        text: TRUNCATED_JSON,
        usage: { prompt_tokens: 1000, completion_tokens: 2000 },
        finishReason: "length",
      } as any)
      .mockResolvedValueOnce({
        text: CONTINUE_FRAGMENT,
        usage: { prompt_tokens: 500, completion_tokens: 100 },
        finishReason: "stop",
      } as any);

    const res = await POST(makeReq({ text: "克拉斯 Quadrant 3200" }));
    expect(res.status).toBe(200);

    // ① 触发了一次续写（= 共 2 次 LLM 调用，不是 1 次）
    expect(chatCompletionDoubao).toHaveBeenCalledTimes(2);

    // ② 续写请求的消息序列 = 原 messages + assistant(已写内容) + user(续写指令)
    const secondCall = vi.mocked(chatCompletionDoubao).mock.calls[1][0] as any;
    expect(secondCall.messages).toHaveLength(4);
    expect(secondCall.messages[2]).toMatchObject({ role: "assistant", content: TRUNCATED_JSON });
    expect(secondCall.messages[3].role).toBe("user");
    expect(String(secondCall.messages[3].content)).toContain("截断");

    // ③ 拼接后的内容被完整解析出来（旧行为：截断 ⇒ 整份 JSON 报废 ⇒ 空策略）
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.data.summary).toBe("中亚优先");
    expect(j.data.bestDestinations[0].rejected[0].level).toBe("L3");
    // 续写补齐后内容已完整 ⇒ truncated=false（这个字段的语义是「最终仍不完整」），
    // 但 llmCalls=2 证明续写确实发生过（验证时看这个字段判断有没有被截断拖慢）
    expect(j.data.truncated).toBe(false);
    expect(j.data.llmCalls).toBe(2);

    // ④ 两次调用的 token 都必须计入成本（续写不是白送的）
    const call = vi.mocked(deductCredits).mock.calls[0] as any[];
    expect(call[3]).toMatchObject({
      inputTokens: 1500, // 1000 + 500
      outputTokens: 2100, // 2000 + 100
      llmCalls: 2,
    });
  });

  it("续写轮次用尽仍截断 ⇒ 标记 truncated，但已解析出的字段照常返回（不丢内容）", async () => {
    // 连续 3 次都返回 length（首轮 + 2 轮续写），内容始终是「可补全的前缀」
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: TRUNCATED_JSON,
      usage: { prompt_tokens: 10, completion_tokens: 20 },
      finishReason: "length",
    } as any);

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(200);
    // 首轮 + 2 次续写 + rejected 重试（首轮结果达标与否都可能，这里只锁 ≥3）
    expect(vi.mocked(chatCompletionDoubao).mock.calls.length).toBeGreaterThanOrEqual(3);
    const j = await res.json();
    expect(j.data.truncated).toBe(true);
    expect(j.data.summary).toBe("中亚优先");
  });
});

describe("③ 解析为空 ⇒ 502 且**未调用 deductCredits**（本次最重要的一条）", () => {
  it("模型返回一段废话 ⇒ 502 LLM_UNPARSEABLE + 不扣费 + 不写 UsageLog + 不重试", async () => {
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: "抱歉，我无法根据这些信息生成销售策略。",
      usage: { prompt_tokens: 100, completion_tokens: 20 },
      finishReason: "stop",
    } as any);

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(502);
    const j = await res.json();
    expect(j.success).toBe(false);
    expect(j.code).toBe("LLM_UNPARSEABLE");
    expect(j.retryable).toBe(true);
    expect(String(j.error)).toContain("未扣除积分");
    expect(j.debug.textLength).toBeGreaterThan(0);

    // 核心断言：一分不扣、不写 UsageLog、不因为"解析失败"触发 rejected 重试
    expect(deductCredits).not.toHaveBeenCalled();
    expect(prisma.usageLog.create).not.toHaveBeenCalled();
    expect(chatCompletionDoubao).toHaveBeenCalledTimes(1);
  });

  it("模型返回 {} ⇒ 同样 502 不扣费（空对象不得被当成成功）", async () => {
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: "{}",
      usage: { prompt_tokens: 100, completion_tokens: 5 },
      finishReason: "stop",
    } as any);

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("LLM_UNPARSEABLE");
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("所有字段都是空壳（空数组 / 空串）⇒ 仍判空并 502", async () => {
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: JSON.stringify({
        summary: "",
        targetMarkets: [],
        channels: [],
        tldr: [],
        marketAnchors: [],
        dataSources: [],
      }),
      usage: { prompt_tokens: 100, completion_tokens: 30 },
      finishReason: "stop",
    } as any);

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(502);
    expect(deductCredits).not.toHaveBeenCalled();
  });
});

describe("④ 脏字段类型被清洗（防前端白屏）", () => {
  it("targetMarkets 是字符串 / bestDestinations[].market 是标量 ⇒ 响应里都是数组", async () => {
    vi.mocked(chatCompletionDoubao).mockResolvedValue({
      text: JSON.stringify({
        summary: "中亚优先",
        // 模型偶尔这样返回：字符串冒充数组
        targetMarkets: "俄罗斯",
        channels: { bogus: true },
        priceRange: [1, 2, 3],
        bestDestinations: [{ equipment: "X", market: "乌兹别克", basis: "b", rejected: [] }],
        actionChecklist: "第一步",
      }),
      usage: { prompt_tokens: 100, completion_tokens: 100 },
      finishReason: "stop",
    } as any);

    const res = await POST(makeReq({ text: "x" }));
    expect(res.status).toBe(200);
    const d = (await res.json()).data;

    // 前端直接 .map() 的字段必须是数组
    expect(Array.isArray(d.targetMarkets)).toBe(true);
    expect(Array.isArray(d.actionChecklist)).toBe(true);
    expect(Array.isArray(d.bestDestinations)).toBe(true);
    expect(Array.isArray(d.bestDestinations[0].market)).toBe(true);
    // 对象字段收到数组 ⇒ null（渲染层按空处理）
    expect(d.priceRange).toBeNull();
    // channels 永远是脱敏后的数组（绝不回传 LLM 原始对象）
    expect(Array.isArray(d.channels)).toBe(true);
  });
});
