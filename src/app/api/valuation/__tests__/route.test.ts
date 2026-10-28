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

/**
 * 站点变体开关：默认 .com，用例可切到 .cn 验证「两站一致」的约束。
 * 用 vi.hoisted 是为了在 vi.mock 工厂执行（早于 import）之前就存在。
 */
const siteState = vi.hoisted(() => ({ value: "com" as "com" | "cn" }));

vi.mock("@/config/site", () => ({
  SITE: "com",
  siteConfig: {
    site: "com",
    siteName: "UsedFarmMach",
    locales: ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"],
    defaultLocale: "en",
  },
  siteConfigMap: {},
  cnFeatures: {},
  getSiteVariant: () => siteState.value,
  isCnSite: () => siteState.value === "cn",
  isComSite: () => siteState.value === "com",
  isOverseasAiAllowed: () => siteState.value !== "cn",
}));

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: vi.fn(() => "tok"),
  verifyToken: vi.fn(() => ({ userId: "u1" })),
}));
vi.mock("@/lib/credits/fx", () => ({
  getBillingCountry: vi.fn(async () => "CN"),
  // ai-locale 的 IP→语种分支会用到；返回 null 表示「IP 头没有可用信息」
  getLocaleOfCountry: vi.fn(() => null),
}));
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
vi.mock("@/lib/valuation/image-analyzer", async (importOriginal) => {
  // 部分 mock：保留 scoreToConditionCode / conditionCodeLabelText 等纯函数真身，
  // 只替换会真发网络请求的 analyzeProductImages。
  // ⚠️ 不要改回「手工列出全部导出」的写法——每次新增导出都会在这里挂一次。
  const actual = await importOriginal<typeof import("@/lib/valuation/image-analyzer")>();
  return { ...actual, analyzeProductImages: vi.fn() };
});
vi.mock("@/lib/valuation/video-analyzer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/valuation/video-analyzer")>();
  return { ...actual, analyzeVideo: vi.fn() };
});
vi.mock("@/lib/valuation/resolve-codes", () => ({
  resolveValuationCodes: vi.fn(),
}));
// brand-data 是巨型常量表，route 只用到 isDomesticBrandSupported（决定要不要讲补贴）
vi.mock("@/lib/valuation/brand-data", () => ({
  isDomesticBrandSupported: vi.fn(() => true),
  MIN_RESIDUAL_RATIO: 0.1,
}));
// 结论叙述层要真发 LLM 调用：测试里整体替换掉，只验证接线与降级
vi.mock("@/lib/valuation/narrative", () => ({
  generateValuationNarrative: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { computeAiCost, deductCredits } from "@/lib/credits/spend";
import { drainUsage } from "@/lib/credits/usage-collector";
import { calculateValuationV4 } from "@/lib/valuation/formulas";
import { analyzeProductImages } from "@/lib/valuation/image-analyzer";
import { generateValuationNarrative } from "@/lib/valuation/narrative";
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

/** 视觉分析夹具：带逐图明细（与 image-analyzer 真实聚合结构一致） */
function mockVisualResult() {
  vi.mocked(analyzeProductImages).mockResolvedValue({
    visualConditionScore: 7,
    visualConditionAnalysis: "成色良好",
    imageConfidence: 0.8,
    usedV4Condition: true,
    conditionCode: "good",
    perImage: [
      { score: 8, label: "good", analysis: "外观良好", confidence: 0.8 },
      { score: 6, label: "fair", analysis: "有轻度锈迹", confidence: 0.7 },
      { score: 7, label: "good", analysis: "液压无渗漏", confidence: 0.9 },
    ],
  } as never);
}

/** 结论叙述夹具 */
function mockNarrative() {
  vi.mocked(generateValuationNarrative).mockResolvedValue({
    narrative: {
      tldr: ["AI 估值 ¥100,000，区间 ¥85,000–¥115,000，成色评分 7/10。"],
      keyInsight: { headline: "品牌残值率高于同品类中位", detail: "同品类排名 3/24。" },
      marketAnchors: [
        { axis: "new_equivalent", priceText: "¥180,000", priceCny: 180000, basis: "benchmark", note: "站内基准价" },
        { axis: "domestic_used", priceText: "¥100,000", priceCny: 100000, basis: "derived", note: "折旧公式推导" },
      ],
      openQuestions: [{ question: "真实工时未知", affects: "工时因子", impact: "补齐可收窄" }],
      dataSources: [{ name: "站内新机基准价", ref: "result.basePrice", note: "基准" }],
    },
    usage: { inputTokens: 2500, outputTokens: 1500 },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  siteState.value = "com";
  // ⚠️ clearAllMocks 只清调用记录，不清实现；每个用例都要把实现显式装回去，
  //    否则「游客用例」把 verifyToken 设成 null 后会污染后续用例。
  vi.mocked(getTokenFromHeaders).mockReturnValue("tok" as never);
  vi.mocked(verifyToken).mockReturnValue({ userId: "u1" } as never);
  mockBalance(10000);
  mockValuationResult();
  vi.mocked(drainUsage).mockReturnValue([] as never);
  vi.mocked(computeAiCost).mockReturnValue({ points: 0 } as never);
  vi.mocked(deductCredits).mockResolvedValue({ ok: true, credits: 10000 } as never);
  mockVisualResult();
  mockNarrative();
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
  it("credits=0 → 402 INSUFFICIENT_CREDITS + rechargeUrl（语种取 body.locale）", async () => {
    mockBalance(0);
    const res = await POST(makeReq({ ...BASE_BODY, locale: "zh", imageDataUris: [DATA_URI] }));
    expect(res.status).toBe(402);
    const j = await res.json();
    expect(j.code).toBe("INSUFFICIENT_CREDITS");
    expect(j.required).toBe(1);
    expect(j.balance).toBe(0);
    expect(j.rechargeUrl).toBe("/zh/credits");
    expect(analyzeProductImages).not.toHaveBeenCalled();
    expect(generateValuationNarrative).not.toHaveBeenCalled();
  });

  it("rechargeUrl 与 AI 文案语种同源：body.locale=ru → /ru/credits", async () => {
    mockBalance(0);
    const res = await POST(makeReq({ ...BASE_BODY, locale: "ru", imageDataUris: [DATA_URI] }));
    const j = await res.json();
    expect(j.rechargeUrl).toBe("/ru/credits");
  });
});

describe("④ 扣费失败 → 结果照常返回 + WATCHDOG 日志", () => {
  it("deductCredits 返回 ok=false 时仍 200，并打 [Valuation][WATCHDOG]", async () => {    vi.mocked(drainUsage).mockReturnValue([
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

describe("⑤ AI 结论叙述层接线（只按登录态判定，两站一致）", () => {
  it("登录用户 → 生成 narrative，且语种/超时预算正确传入", async () => {
    const res = await POST(makeReq({ ...BASE_BODY, locale: "ru", imageDataUris: [DATA_URI] }));
    expect(res.status).toBe(200);
    expect(generateValuationNarrative).toHaveBeenCalledTimes(1);

    const args = vi.mocked(generateValuationNarrative).mock.calls[0][0];
    expect(args.locale).toBe("ru");
    // 动态预算：必须是有限正数且不超过 90s 上限（被视觉分析耗时挤掉多少就减多少）
    expect(typeof args.timeoutMs).toBe("number");
    expect(args.timeoutMs as number).toBeGreaterThan(0);
    expect(args.timeoutMs as number).toBeLessThanOrEqual(90_000);
    // 只读入参：不得反向修改估值结果
    expect(args.result).toBeTruthy();
    expect(args.productMeta.brand).toBe("约翰迪尔");
  });

  it("`.cn` 站同样生成 narrative（无任何 .com 专属逻辑）", async () => {
    siteState.value = "cn";
    const res = await POST(makeReq({ ...BASE_BODY, locale: "zh", imageDataUris: [DATA_URI] }));
    expect(res.status).toBe(200);
    expect(generateValuationNarrative).toHaveBeenCalledTimes(1);
  });

  it("narrative 生成失败（null）不影响价格结果", async () => {
    vi.mocked(generateValuationNarrative).mockResolvedValue({
      narrative: null,
      usage: { inputTokens: 0, outputTokens: 0 },
    } as never);
    const res = await POST(makeReq({ ...BASE_BODY, imageDataUris: [DATA_URI] }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.data.narrative).toBeNull();
    expect(j.data.estimatedValue).toBe(100000);
  });

  it("游客 → 不生成 narrative（付费差异点），仍返回模糊区间 + 基础视觉分", async () => {
    vi.mocked(verifyToken).mockReturnValue(null as never);
    const res = await POST(makeReq({ ...BASE_BODY, imageDataUris: [DATA_URI] }));
    const j = await res.json();
    expect(generateValuationNarrative).not.toHaveBeenCalled();
    expect(j.data.narrative).toBeNull();
    expect(j.data.visual.perImage).toEqual([]);
    expect(j.data.visual.score).toBe(7);
    expect(j.meta.aiLocale).toBeTruthy();
  });
});

describe("⑥ 响应新增字段 shape（只增不改）", () => {
  it("data.narrative 结构完整，axis/basis 保持英文枚举", async () => {
    const res = await POST(makeReq({ ...BASE_BODY, imageDataUris: [DATA_URI] }));
    const j = await res.json();
    const narrative = j.data.narrative;
    expect(Array.isArray(narrative.tldr)).toBe(true);
    expect(narrative.keyInsight.headline).toBeTruthy();
    expect(narrative.marketAnchors.map((a: { axis: string }) => a.axis)).toContain("new_equivalent");
    for (const anchor of narrative.marketAnchors) {
      expect(["domestic_used", "export_fob", "target_market_retail", "new_equivalent", "salvage"]).toContain(
        anchor.axis
      );
      expect(["measured", "benchmark", "derived", "not_found"]).toContain(anchor.basis);
    }
    // 原有字段一个不能少
    expect(j.data.estimatedValue).toBe(100000);
    expect(j.data.details).toEqual([]);
    expect(j.data.version).toBeDefined();
  });

  it("data.visual 含逐图明细与本地化 labelText，label 是英文枚举", async () => {
    const res = await POST(makeReq({ ...BASE_BODY, locale: "en", imageDataUris: [DATA_URI] }));
    const j = await res.json();
    const visual = j.data.visual;
    expect(visual.score).toBe(7);
    expect(visual.label).toBe("good");
    expect(visual.labelText).toBe("Good");
    expect(visual.imageCount).toBe(3);
    expect(visual.perImage).toHaveLength(3);
    for (const item of visual.perImage) {
      expect(typeof item.score).toBe("number");
      expect(["excellent", "good", "fair", "poor"]).toContain(item.label);
      expect(typeof item.analysis).toBe("string");
      expect(typeof item.confidence).toBe("number");
    }
  });

  it("视觉分析被跳过 → score/label 为 null，imageCount 为 0", async () => {
    const res = await POST(makeReq({ ...BASE_BODY, skipImageAnalysis: true }));
    const j = await res.json();
    expect(j.data.visual).toEqual({ score: null, label: null, labelText: null, imageCount: 0, perImage: [] });
  });
});

describe("⑦ 计费：视觉 token 与 narrative token 合并成一次扣费", () => {
  it("两条用量记录 → 一次 deductCredits，金额为两者之和", async () => {
    vi.mocked(drainUsage).mockReturnValue([
      // 视觉分析（image-analyzer 归集）
      { model: "doubao-seed-2-1-pro-260915", inputTokens: 4500, outputTokens: 600, estimated: false },
      // 结论叙述（narrative 内部 recordUsage 归集）
      { model: "doubao-seed-2-1-pro-260915", inputTokens: 2500, outputTokens: 1500, estimated: false },
    ] as never);
    vi.mocked(computeAiCost).mockReturnValueOnce({ points: 42 } as never).mockReturnValueOnce({ points: 60 } as never);
    vi.mocked(deductCredits).mockResolvedValue({ ok: true, credits: 9898 } as never);

    const res = await POST(makeReq({ ...BASE_BODY, imageDataUris: [DATA_URI] }));
    const j = await res.json();
    expect(deductCredits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deductCredits).mock.calls[0][1]).toBe(102);
    expect(j.billing).toEqual({ points: 102, balance: 9898 });
  });
});
