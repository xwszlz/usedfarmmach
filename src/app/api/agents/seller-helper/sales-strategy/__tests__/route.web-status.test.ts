/**
 * 语义测试：POST /api/agents/seller-helper/sales-strategy —— 检索状态（PRD §6.5）
 * ─────────────────────────────────────────────────────────
 * 与 `seller/__tests__/sales-strategy-export-buttons.test.ts` 里的「跨层键名契约」源码守卫互补：
 *   - 源码守卫挡「键名被改」（route 发 webStatus / 卡片读 searchStatus 之类）；
 *   - 本文件挡「键名对、值没赋上」——例如 `pickWebStatus` 的兜底被改成 `"ok"`（永不告警）、
 *     或 `searchNote` 取错对象 ⇒ 非 ok 却给不出说明、ok 却给出提示。
 *
 * 断言的三条硬语义：
 *   ① 非 ok（partial / timeout / disabled）⇒ `searchNote` **必须非空**（前端黄条副标题）；
 *   ② ok ⇒ `searchNote` **必须是空串**（前端据此不渲染任何提示）；
 *   ③ `webEvidence` 缺失 / 状态非法 ⇒ **必须** 落 `disabled`，绝不可当 `ok`。
 *
 * 说明：与既有 `route.test.ts` 同一套 mock 骨架，互不改动；本文件只新增用例。
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

import { getUserFromRequest } from "@/lib/auth";
import { chatCompletionDoubao } from "@/lib/ai/ark-client";
import { deductAiUsage, estimateAiCost } from "@/lib/credits/deduct";
import { retrieveStrategyContext } from "@/lib/sales-strategy/retrieval";
import { parseStrategyResult } from "@/lib/sales-strategy/prompt";
import { WEB_STATUS_NOTE } from "@/lib/sales-strategy/strategy-schema";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/route";

/** 满足 `isRejectedAdequate` 的策略（含 L3 否决）⇒ 不触发重试，调用次数确定 */
const ADEQUATE_STRATEGY = {
  summary: "中亚优先",
  targetMarkets: [],
  bestDestinations: [
    {
      equipment: "克拉斯 Quadrant 3200",
      market: ["乌兹别克"],
      basis: "本地无同类在售",
      rejected: [{ market: "欧盟", reason: "合规成本过高", level: "L3" }],
    },
  ],
};

function makeReq(): NextRequest {
  return new NextRequest("https://usedfarmmach.cn/zh/products/p1", {
    method: "POST",
    headers: { referer: "https://usedfarmmach.cn/zh/products/p1" },
    body: JSON.stringify({ text: "2016 CLAAS Quadrant 3200" }),
  });
}

/** 检索上下文：只关心 webEvidence 的两种形态（有 / 无） */
function makeCtx(webEvidence?: unknown) {
  return {
    product: null,
    candidates: [],
    similarProducts: [],
    benchmarks: [],
    dailyReport: null,
    portSuggestion: "",
    marketIntel: [],
    realtimeExternal: false,
    ...(webEvidence === undefined ? {} : { webEvidence }),
  };
}

/** 把成功路径的 mock 一次性铺好，返回路由响应体 */
async function runSuccess(webEvidence?: unknown) {
  (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
  (estimateAiCost as any).mockResolvedValue(100);
  (retrieveStrategyContext as any).mockResolvedValue(makeCtx(webEvidence));
  (chatCompletionDoubao as any).mockResolvedValue({
    text: "{}",
    usage: { prompt_tokens: 100, completion_tokens: 200 },
  });
  (parseStrategyResult as any).mockReturnValue(ADEQUATE_STRATEGY);
  (deductAiUsage as any).mockResolvedValue({ ok: true, cost: 10, balance: 99989 });

  const res = await POST(makeReq());
  expect(res.status).toBe(200);
  const json: any = await res.json();
  expect(json.success).toBe(true);
  // 显式契约：`ADEQUATE_STRATEGY` 达标 ⇒ 不得触发 rejected 重试。
  // 否则一旦 adequacy 判定口径变严，fixture 会从"达标"滑成"不达标"，
  // 测试静默变成 2 次 LLM 调用却仍然全绿（两次 mockResolvedValue 返回同值）。
  expect(chatCompletionDoubao).toHaveBeenCalledTimes(1);
  return json.data as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PRD §6.5 · 检索状态语义（response.searchStatus / searchNote）", () => {
  it("status=ok ⇒ searchStatus='ok' 且 searchNote 为空串（前端不渲染任何提示）", async () => {
    const data = await runSuccess({ status: "ok", note: "这段文案必须被丢弃" });
    expect(data.searchStatus).toBe("ok");
    expect(data.searchNote).toBe("");
  });

  it("status=partial ⇒ searchNote 用 webEvidence.note 原文（非空）", async () => {
    const data = await runSuccess({ status: "partial", note: "部分检索超时（3/5 成功）" });
    expect(data.searchStatus).toBe("partial");
    expect(data.searchNote).toBe("部分检索超时（3/5 成功）");
  });

  it("status=timeout 且无 note ⇒ 回落 WEB_STATUS_NOTE 固定文案（不得为空）", async () => {
    const data = await runSuccess({ status: "timeout" });
    expect(data.searchStatus).toBe("timeout");
    expect(data.searchNote).toBe(WEB_STATUS_NOTE.timeout);
    expect(String(data.searchNote).length).toBeGreaterThan(0);
  });

  it("status=disabled ⇒ searchNote 非空（前端黄条能解释「为什么没接上」）", async () => {
    const data = await runSuccess({ status: "disabled" });
    expect(data.searchStatus).toBe("disabled");
    expect(data.searchNote).toBe(WEB_STATUS_NOTE.disabled);
  });

  it("webEvidence 缺失 ⇒ 必须落 disabled，绝不可当 ok（否则黄条永不出现）", async () => {
    const data = await runSuccess(undefined);
    expect(data.searchStatus).toBe("disabled");
    expect(String(data.searchNote).length).toBeGreaterThan(0);
  });

  it("状态为非法值 ⇒ 同样落 disabled（不静默放过）", async () => {
    const data = await runSuccess({ status: "whatever", note: "x" });
    expect(data.searchStatus).toBe("disabled");
    expect(data.searchNote).toBe("x");
  });

  it("响应体不得出现导出层键名（webStatus / webNote）：跨层改名会让两端双 undefined", async () => {
    const data = await runSuccess({ status: "partial", note: "n" });
    expect(Object.keys(data)).not.toContain("webStatus");
    expect(Object.keys(data)).not.toContain("webNote");
    expect(Object.keys(data)).toContain("searchStatus");
    expect(Object.keys(data)).toContain("searchNote");
  });
});
