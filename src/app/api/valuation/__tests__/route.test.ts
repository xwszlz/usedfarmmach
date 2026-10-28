/**
 * 集成测试：POST /api/valuation 的计费接线（2026-10-28 第三批 Commit B）
 *
 * 锁住四件事：
 *   ① imageDataUris 必须并入视觉输入 —— 国产渠道只传 data URI，不合并就永远零 token ⇒ 零收费
 *   ② 响应必须带 `billing: { points, balance }`（前端 page.tsx 直接读这两个键）
 *   ③ 余额 0 → 402 INSUFFICIENT_CREDITS，且不调用视觉模型（不烧钱）
 *   ④ 扣费失败 → 仍然返回结果，但打 [WATCHDOG] 日志（可 grep）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: vi.fn(() => "tok"),
  verifyToken: vi.fn(() => ({ userId: "u1" })),
}));
vi.mock("@/lib/credits/fx", () => ({ getBillingCountry: vi.fn(async () => "CN") }));
vi.mock("@/lib/credits/usage-collector", () => ({ drainUsage: vi.fn(() => []) }));
vi.mock("@/lib/credits/spend", () => ({
  computeAiCost: vi.fn(),
  deductCredits: vi.fn(),
}));
vi.mock("@/lib/valuation/intelligence", () => ({
  getValuationIntelligence: vi.fn(() => null),
}));
vi.mock("@/lib/valuation/formulas", () => ({
  calculateValuation: vi.fn(),
  calculateValuationV4: vi.fn(),
}));
vi.mock("@/lib/valuation/image-analyzer", () => ({
  analyzeProductImages: vi.fn(),
}));
vi.mock("@/lib/valuation/video-analyzer", () => ({
  analyzeVideo: vi.fn(),
}));
vi.mock("@/lib/valuation/resolve-codes", () => ({
  resolveValuationCodes: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { computeAiCost, deductCredits } from "@/lib/credits/spend";
import { drainUsage } from "@/lib/credits/usage-collector";
import { calculateValuationV4 } from "@/lib/valuation/formulas";
import { analyzeProductImages } from "@/lib/valuation/image-analyzer";
import { POST } from "@/app/api/valuation/route";

const DATA_URI = "data:image/jpeg;base64,AAAA";

function makeReq(body: unknown) {
  return new NextRequest("https://usedfarmmach.cn/zh/services/valuation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  brand: "约翰迪尔",
  category: "拖拉机",
  year: 2020,
  useV4: true,
};

function mockBalance(credits: number) {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ credits } as never);
}

function mockValuationResult() {
  vi.mocked(calculateValuationV4).mockResolvedValue({
    estimatedValue: 100000,
    confidenceScore: 0.8,
    confidence: 0.8,
    details: [],
    version: "v4",
    usedV4Condition: true,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ clearAllMocks 只清调用记录，不清实现；每个用例都要把实现显式装回去，
  //    否则「游客用例」把 verifyToken 设成 null 后会污染后续用例。
  vi.mocked(getTokenFromHeaders).mockReturnValue("tok" as never);
  vi.mocked(verifyToken).mockReturnValue({ userId: "u1" } as never);
  mockBalance(10000);
  mockValuationResult();
  vi.mocked(drainUsage).mockReturnValue([] as never);
  vi.mocked(computeAiCost).mockReturnValue({ points: 0 } as never);
  vi.mocked(deductCredits).mockResolvedValue({ ok: true, credits: 10000 } as never);
  vi.mocked(analyzeProductImages).mockResolvedValue({
    visualConditionScore: 7,
    visualConditionAnalysis: "成色良好",
    imageConfidence: 0.8,
    usedV4Condition: true,
  } as never);
});

describe("① imageDataUris 必须并入视觉输入（否则国产渠道永远零收费）", () => {
  it("只传 data URI（国产渠道）时，视觉分析必须收到这批图", async () => {
    const res = await POST(makeReq({ ...BASE_BODY, imageDataUris: [DATA_URI] }));
    expect(res.status).toBe(200);
    expect(analyzeProductImages).toHaveBeenCalledTimes(1);
    const urls = vi.mocked(analyzeProductImages).mock.calls[0][0];
    expect(urls).toContain(DATA_URI);
  });

  it("data URI 与远程 URL 并存时两者都要送到（data URI 在前）", async () => {
    await POST(
      makeReq({
        ...BASE_BODY,
        imageDataUris: [DATA_URI],
        imageUrls: ["https://cdn.example.com/a.jpg"],
      })
    );
    const urls = vi.mocked(analyzeProductImages).mock.calls[0][0];
    expect(urls[0]).toBe(DATA_URI);
    expect(urls).toContain("https://cdn.example.com/a.jpg");
  });

  it("非 image/* 的 data URI 被丢弃（不把任意字符串当图片喂给视觉模型）", async () => {
    await POST(
      makeReq({
        ...BASE_BODY,
        imageDataUris: ["data:text/html;base64,PHNjcmlwdD4=", DATA_URI],
      })
    );
    const urls = vi.mocked(analyzeProductImages).mock.calls[0][0];
    expect(urls).toEqual([DATA_URI]);
  });

  it("skipImageAnalysis=true 时不调用视觉模型", async () => {
    await POST(makeReq({ ...BASE_BODY, imageDataUris: [DATA_URI], skipImageAnalysis: true }));
    expect(analyzeProductImages).not.toHaveBeenCalled();
  });
});

describe("② 响应 billing 字段（前端 page.tsx 读 billing.points / billing.balance）", () => {
  it("有 LLM 用量 → billing = { points, balance }", async () => {
    vi.mocked(drainUsage).mockReturnValue([
      { model: "doubao-1.5-pro", inputTokens: 1000, outputTokens: 500, estimated: false },
    ] as never);
    vi.mocked(computeAiCost).mockReturnValue({ points: 240 } as never);
    vi.mocked(deductCredits).mockResolvedValue({ ok: true, credits: 9760 } as never);

    const res = await POST(makeReq({ ...BASE_BODY, imageDataUris: [DATA_URI] }));
    const j = await res.json();
    expect(j.billing).toEqual({ points: 240, balance: 9760 });
    // 扣费只发生一次，且用真实成本
    expect(deductCredits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deductCredits).mock.calls[0][1]).toBe(240);
  });

  it("无 LLM 用量（跳过图片分析）→ billing 为 null，不返回「扣 0 分」噪音", async () => {
    const res = await POST(makeReq({ ...BASE_BODY, skipImageAnalysis: true }));
    const j = await res.json();
    expect(j.billing).toBeNull();
    // 无用量时仍会走一次「扣 0 分」（deductCredits need=0 零写），不能真扣到东西
    const calls = vi.mocked(deductCredits).mock.calls;
    expect(calls.length === 0 || calls[0][1] === 0).toBe(true);
  });

  it("游客（无 token）→ 不扣费、无 billing，仍返回模糊结果", async () => {
    vi.mocked(verifyToken).mockReturnValue(null as never);
    const res = await POST(makeReq({ ...BASE_BODY, skipImageAnalysis: true }));
    const j = await res.json();
    expect(j.blurred).toBe(true);
    expect(j.billing).toBeUndefined();
    expect(deductCredits).not.toHaveBeenCalled();
  });
});

describe("③ 余额 0 → 402，且不调用视觉模型（不烧钱）", () => {
  it("credits=0 → 402 INSUFFICIENT_CREDITS + rechargeUrl", async () => {
    mockBalance(0);
    const res = await POST(makeReq({ ...BASE_BODY, imageDataUris: [DATA_URI] }));
    expect(res.status).toBe(402);
    const j = await res.json();
    expect(j.code).toBe("INSUFFICIENT_CREDITS");
    expect(j.required).toBe(1);
    expect(j.balance).toBe(0);
    expect(j.rechargeUrl).toBe("/zh/credits");
    expect(analyzeProductImages).not.toHaveBeenCalled();
  });
});

describe("④ 扣费失败 → 结果照常返回 + WATCHDOG 日志", () => {
  it("deductCredits 返回 ok=false 时仍 200，并打 [Valuation][WATCHDOG]", async () => {
    vi.mocked(drainUsage).mockReturnValue([
      { model: "doubao-1.5-pro", inputTokens: 1000, outputTokens: 500, estimated: false },
    ] as never);
    vi.mocked(computeAiCost).mockReturnValue({ points: 240 } as never);
    vi.mocked(deductCredits).mockResolvedValue({
      ok: false,
      insufficient: true,
      credits: 10,
      required: 240,
    } as never);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const res = await POST(makeReq({ ...BASE_BODY, imageDataUris: [DATA_URI] }));
      expect(res.status).toBe(200);
      const j = await res.json();
      // 结果不阻断，billing 仍回报（balance 为扣后真实余额）
      expect(j.billing).toEqual({ points: 240, balance: 10 });
      const hit = warnSpy.mock.calls.map((c) => String(c[0])).find((s) => s.includes("[Valuation][WATCHDOG]"));
      expect(hit).toBeDefined();
      expect(hit).toContain("required=240");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
