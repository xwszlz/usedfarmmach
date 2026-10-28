/**
 * `narrative.ts` 单元测试 —— 结论叙述层。
 *
 * 锁住 6 件事（都是「错了会让老板再怼一次」的点）：
 *   ① LLM 返回非 JSON / 半截 JSON ⇒ `{ narrative: null }` 且**绝不抛异常**
 *   ② 合法 JSON ⇒ 字段解析正确，`axis` / `basis` 保持英文枚举（前端按字面量渲染）
 *   ③ 必填锚点（new_equivalent / domestic_used，.com 还要 export_fob）缺失时用确定性数据补齐
 *   ④ `.com` 上**一个补贴字样都不能有**（文本层确定性过滤，不靠模型听话）
 *   ⑤ `.cn` 上补贴话题只在 isChineseBrand 时开放，且不出 export_fob / target_market_retail
 *   ⑥ dataSources 走白名单：模型编造的来源被丢弃，并用真实来源兜底到 3 条
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("@/lib/ai/ark-client", () => ({
  chatCompletionDoubao: vi.fn(),
  getArkModelId: () => "doubao-seed-2-1-pro-260915",
  getArkVisionModelId: () => "doubao-seed-2-1-pro-260915",
  getArkVideoModelId: () => "doubao-seed-2-1-pro-260915",
  getArkLinkPath: () => "direct",
}));

vi.mock("@/lib/credits/usage-collector", () => ({
  recordUsage: vi.fn(),
  drainUsage: vi.fn(() => []),
  hasUsage: vi.fn(() => false),
  ESTIMATED_TOKENS: { input: 1500, output: 500 },
}));

// ai-locale 会 import credits/fx 的 getLocaleOfCountry（其内部会拉起 prisma）——这里切断
vi.mock("@/lib/credits/fx", () => ({
  getLocaleOfCountry: vi.fn(() => null),
  getBillingCountry: vi.fn(async () => "CN"),
}));

// brand-data 是巨型常量表，narrative 只用 MIN_RESIDUAL_RATIO
vi.mock("@/lib/valuation/brand-data", () => ({ MIN_RESIDUAL_RATIO: 0.1 }));

import { chatCompletionDoubao } from "@/lib/ai/ark-client";
import { recordUsage } from "@/lib/credits/usage-collector";
import type { ValuationResult } from "@/lib/valuation/formulas";
import {
  buildNarrativePrompt,
  generateValuationNarrative,
  NARRATIVE_SYSTEM_PROMPT,
  parseNarrativeJson,
} from "../narrative";

/** 一份典型的 V4 估值结果（只填 narrative 用得到的字段） */
function makeResult(overrides: Partial<ValuationResult> = {}): ValuationResult {
  return {
    estimatedValue: 185000,
    basePrice: 420000,
    brandFactor: 1.06,
    yearFactor: 0.72,
    hoursFactor: 0.95,
    conditionFactor: 0.98,
    marketFactor: 1.0,
    depreciationPercent: 56,
    confidenceScore: 0.78,
    priceRange: { low: 157000, mid: 185000, high: 213000 },
    details: [],
    analysis: "模板一句话",
    version: "v4-20260704",
    visualConditionScore: 7.2,
    visualConditionAnalysis: "外观良好，无明显锈蚀",
    usedV4Condition: true,
    specFactor: 1.02,
    videoFactor: 1.03,
    channelPrices: { retail: 185000, dealer: 162800, consignment: 177600, auction: 148000 },
    ...overrides,
  } as ValuationResult;
}

const INTELLIGENCE = {
  available: true,
  brand: "约翰迪尔",
  category: "拖拉机",
  model: { key: "约翰迪尔||拖拉机||6J", level: "model", n: 320, median: 420000, p25: 360000, p75: 480000 },
  brandCat: { key: "约翰迪尔||拖拉机", level: "brand_category", n: 4200, median: 400000, p25: 310000, p75: 500000 },
  regional: { current: { province: "黑龙江省", n: 900, median: 190000, index: 1.04 }, currentIndex: 1.04 },
  depreciation: {
    category: "拖拉机",
    refNewMedian: 400000,
    curve: [
      { age: 1, residual: 0.82 },
      { age: 3, residual: 0.66 },
      { age: 5, residual: 0.52 },
    ],
  },
  brandRanking: { category: "拖拉机", currentRank: 3, total: 24, top: [{ brand: "约翰迪尔", netMedian: 400000, n: 4200 }] },
  confidence: { n: 4200, cv: 0.31, level: "medium" },
  global: { totalRecords: 8660000, nBrands: 337, nCategories: 42, nProvinces: 31, topBrands: [] },
};

const PRODUCT_META = {
  brand: "约翰迪尔",
  modelName: "6J-2104",
  category: "拖拉机",
  year: 2021,
  workingHours: 3200,
  condition: "good",
  region: "黑龙江省",
  sellerAskingCny: 198000,
  foreignPriceCny: null,
  imageCount: 3,
  videoCount: 1,
  perImage: [
    { score: 8, label: "good", analysis: "外观良好", confidence: 0.8 },
    { score: 7, label: "good", analysis: "液压无渗漏", confidence: 0.75 },
    { score: 6, label: "fair", analysis: "轮胎磨损", confidence: 0.7 },
  ],
};

/** 一份合法的模型输出（未过滤前） */
function validOutput(): Record<string, unknown> {
  return {
    tldr: [
      "估值 ¥185,000，区间 ¥157,000–¥213,000，成色 7.2/10。",
      "卖家报价 ¥198,000，比估值高 7%，议价空间约 ¥13,000。",
      "同品类品牌残值排名 3/24，样本 4,200 台。",
    ],
    keyInsight: {
      headline: "工时折旧比机龄更狠",
      detail: "本机 3,200 小时落在 3 年档，残值 66%；同机龄低工时样机可达 72%。",
    },
    marketAnchors: [
      { axis: "new_equivalent", priceText: "¥420,000", priceCny: 420000, basis: "benchmark", note: "站内新机基准价" },
      { axis: "domestic_used", priceText: "¥185,000", priceCny: 185000, basis: "derived", note: "420000×0.72×0.95×0.98" },
      { axis: "export_fob", priceText: "未找到", priceCny: null, basis: "not_found", note: "无出口成交记录" },
    ],
    openQuestions: [
      { question: "真实工时是否有保养记录支撑？", affects: "result.factors.hours", impact: "补齐可收窄区间" },
    ],
    dataSources: [
      { name: "站内新机基准价", ref: "result.basePrice", note: "新机锚点" },
      { name: "国内新机成交行情", ref: "intelligence.model", note: "P25/P75" },
      { name: "品类折旧曲线", ref: "intelligence.depreciation", note: "残值曲线" },
    ],
  };
}

function mockLlm(text: string, opts: { finishReason?: string; usage?: boolean } = {}) {
  vi.mocked(chatCompletionDoubao).mockResolvedValue({
    text,
    finishReason: opts.finishReason ?? "stop",
    ...(opts.usage === false
      ? {}
      : { usage: { prompt_tokens: 2500, completion_tokens: 1500 } }),
  } as never);
}

function callNarrative(overrides: Partial<Parameters<typeof generateValuationNarrative>[0]> = {}) {
  return generateValuationNarrative({
    locale: "zh",
    result: makeResult(),
    intelligence: INTELLIGENCE,
    productMeta: PRODUCT_META,
    isChineseBrand: true,
    timeoutMs: 90_000,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  siteState.value = "com";
  mockLlm(JSON.stringify(validOutput()));
});

describe("① 失败必须降级为 narrative: null，绝不抛异常", () => {
  it("LLM 返回非 JSON（散文）→ null，不抛，usage 仍回报", async () => {
    mockLlm("抱歉，我需要更多信息才能评估这台设备。");
    const out = await callNarrative();
    expect(out.narrative).toBeNull();
    expect(out.usage).toEqual({ inputTokens: 2500, outputTokens: 1500 });
    expect(out.raw).toContain("抱歉");
  });

  it("LLM 抛错（网络/超时）→ null，usage 全 0，不记录用量", async () => {
    vi.mocked(chatCompletionDoubao).mockRejectedValue(new Error("timeout"));
    const out = await callNarrative();
    expect(out.narrative).toBeNull();
    expect(out.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("finishReason=length（JSON 被截断）→ 直接判失败，不做半截解析", async () => {
    mockLlm('{"tldr":["估值 ¥185,000"', { finishReason: "length" });
    const out = await callNarrative();
    expect(out.narrative).toBeNull();
    expect(out.raw).toBeTruthy();
  });

  it("JSON 合法但缺 tldr / keyInsight → 判失败（不是一份报告）", async () => {
    mockLlm(JSON.stringify({ tldr: [], keyInsight: {}, marketAnchors: [] }));
    const out = await callNarrative();
    expect(out.narrative).toBeNull();
  });

  it("provider 没给 usage 时用 ESTIMATED_TOKENS 兜底并标 estimated", async () => {
    mockLlm(JSON.stringify(validOutput()), { usage: false });
    const out = await callNarrative();
    expect(out.narrative).not.toBeNull();
    expect(out.usage).toEqual({ inputTokens: 1500, outputTokens: 500 });
    expect(recordUsage).toHaveBeenCalledWith("doubao-seed-2-1-pro-260915", 1500, 500, { estimated: true });
  });
});

describe("② 合法 JSON → 字段解析正确，枚举保持英文", () => {
  it("tldr / keyInsight / anchors / sources 全部解析", async () => {
    const out = await callNarrative();
    const narrative = out.narrative;
    expect(narrative).not.toBeNull();
    expect(narrative!.tldr).toHaveLength(3);
    expect(narrative!.keyInsight.headline).toBe("工时折旧比机龄更狠");
    // 模型给了 3 个轴位；salvage 由「新机基准价 × 残值底线」确定性补出，故共 4 个
    expect(narrative!.marketAnchors.map((a) => a.axis)).toEqual([
      "new_equivalent",
      "domestic_used",
      "export_fob",
      "salvage",
    ]);
    expect(narrative!.openQuestions).toHaveLength(1);
    expect(narrative!.dataSources.length).toBeGreaterThanOrEqual(3);
  });

  it("axis / basis 永远是英文枚举（即使模型写了中文也会被纠正或丢弃）", async () => {
    mockLlm(
      JSON.stringify({
        ...validOutput(),
        marketAnchors: [
          { axis: "新机对标", priceText: "¥420,000", priceCny: 420000, basis: "benchmark", note: "x" },
          { axis: "domestic_used", priceText: "¥185,000", priceCny: 185000, basis: "测算", note: "x" },
        ],
      })
    );
    const out = await callNarrative();
    const axes = out.narrative!.marketAnchors.map((a) => a.axis);
    const bases = out.narrative!.marketAnchors.map((a) => a.basis);
    // 中文轴位被丢弃（不认识），但必填轴位由确定性兜底补回来
    expect(axes).toContain("new_equivalent");
    expect(axes).toContain("domestic_used");
    for (const axis of axes) {
      expect(["domestic_used", "export_fob", "target_market_retail", "new_equivalent", "salvage"]).toContain(axis);
    }
    for (const basis of bases) {
      expect(["measured", "benchmark", "derived", "not_found"]).toContain(basis);
    }
  });

  it("basis=not_found 时强制 priceCny=null（不许「没依据却带价格」）", async () => {
    mockLlm(
      JSON.stringify({
        ...validOutput(),
        marketAnchors: [
          // 模型自相矛盾：说 not_found 却给了价格
          { axis: "target_market_retail", priceText: "约 $32,000", priceCny: 230000, basis: "not_found", note: "猜的" },
        ],
      })
    );
    const out = await callNarrative();
    const anchor = out.narrative!.marketAnchors.find((a) => a.axis === "target_market_retail");
    expect(anchor).toBeDefined();
    expect(anchor!.priceCny).toBeNull();
    expect(anchor!.basis).toBe("not_found");
  });

  it("代码围栏 / 前后废话都能解析", async () => {
    const fenced = "这是结果：\n```json\n" + JSON.stringify(validOutput()) + "\n```\n以上。";
    mockLlm(fenced);
    const out = await callNarrative();
    expect(out.narrative).not.toBeNull();
    expect(parseNarrativeJson(fenced)).not.toBeNull();
  });
});

describe("③ 必填锚点缺失 → 用确定性数据补齐", () => {
  it("模型只给了 export_fob：new_equivalent / domestic_used 由 basePrice 与估值补齐", async () => {
    mockLlm(
      JSON.stringify({
        ...validOutput(),
        marketAnchors: [{ axis: "export_fob", priceText: "未找到", priceCny: null, basis: "not_found", note: "" }],
      })
    );
    const out = await callNarrative();
    const byAxis = new Map(out.narrative!.marketAnchors.map((a) => [a.axis, a]));
    expect(byAxis.get("new_equivalent")).toMatchObject({ priceCny: 420000, basis: "benchmark" });
    expect(byAxis.get("domestic_used")).toMatchObject({ priceCny: 185000, basis: "derived" });
    // salvage 由新机基准价 × 10% 残值底线补出
    expect(byAxis.get("salvage")).toMatchObject({ priceCny: 42000, basis: "derived" });
  });

  it(".com 必出 export_fob（模型漏了也要有该轴位，价格可为 not_found）", async () => {
    mockLlm(
      JSON.stringify({
        ...validOutput(),
        marketAnchors: [{ axis: "new_equivalent", priceText: "¥420,000", priceCny: 420000, basis: "benchmark", note: "" }],
      })
    );
    const out = await callNarrative();
    const fob = out.narrative!.marketAnchors.find((a) => a.axis === "export_fob");
    expect(fob).toBeDefined();
    expect(fob!.basis).toBe("not_found");
    expect(fob!.priceCny).toBeNull();
  });
});

describe("④ .com 上一个补贴字样都不能有", () => {
  it("含补贴的句子被确定性删除，其余保留", async () => {
    mockLlm(
      JSON.stringify({
        ...validOutput(),
        tldr: [
          "估值 ¥185,000，区间 ¥157,000–¥213,000。",
          "该机型在国内享受农机购置补贴，各省补贴额度约 ¥3 万。",
          "卖家报价 ¥198,000，高于估值 7%。",
        ],
        keyInsight: {
          headline: "补贴退坡会让二手更值钱",
          detail: "样本 4,200 台，残值 66%。",
        },
        dataSources: [
          { name: "Subsidy transaction data", ref: "intelligence.model", note: "补贴成交价" },
          { name: "站内新机基准价", ref: "result.basePrice", note: "基准" },
        ],
      })
    );
    const out = await callNarrative({ locale: "en" });
    const narrative = out.narrative;
    // headline 全是补贴内容 ⇒ 整份报告判失败（宁可没有结论，也不给残句）
    expect(narrative).toBeNull();
  });

  it("补贴只出现在部分句子里时：删句保留内容，且输出里不再出现 subsidy/补贴", async () => {
    mockLlm(
      JSON.stringify({
        ...validOutput(),
        tldr: [
          "Valuation ¥185,000 with a range of ¥157,000–¥213,000.",
          "Chinese purchase subsidy adds roughly ¥30,000 to the domestic resale value.",
          "Asking price ¥198,000 sits 7% above the valuation.",
        ],
        dataSources: [
          { name: "Subsidy transaction data", ref: "intelligence.model", note: "subsidy records" },
          { name: "Platform new-machine benchmark", ref: "result.basePrice", note: "anchor" },
        ],
      })
    );
    const out = await callNarrative({ locale: "en" });
    const narrative = out.narrative;
    expect(narrative).not.toBeNull();
    const flat = JSON.stringify(narrative).toLowerCase();
    expect(flat).not.toContain("subsid");
    expect(flat).not.toContain("补贴");
    expect(narrative!.tldr).toHaveLength(2);
  });

  it(".com 的兜底来源名称本身不含补贴字样（8 语种）", async () => {
    mockLlm(JSON.stringify({ ...validOutput(), dataSources: [] }));
    for (const locale of ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"] as const) {
      const out = await callNarrative({ locale });
      expect(out.narrative).not.toBeNull();
      const flat = JSON.stringify(out.narrative).toLowerCase();
      expect(flat).not.toContain("subsid");
      expect(flat).not.toContain("补贴");
    }
  });
});

describe("⑤ .cn：补贴按品牌开放，且不出出口/目标市场轴位", () => {
  it(".cn + 国产品牌 → payload 允许讲补贴；export_fob / target_market_retail 被剔除", async () => {
    siteState.value = "cn";
    mockLlm(
      JSON.stringify({
        ...validOutput(),
        marketAnchors: [
          { axis: "new_equivalent", priceText: "¥420,000", priceCny: 420000, basis: "benchmark", note: "" },
          { axis: "domestic_used", priceText: "¥185,000", priceCny: 185000, basis: "derived", note: "" },
          { axis: "export_fob", priceText: "$30,000", priceCny: 216000, basis: "measured", note: "" },
          { axis: "target_market_retail", priceText: "$38,000", priceCny: 273000, basis: "measured", note: "" },
        ],
      })
    );
    const out = await callNarrative({ locale: "zh", isChineseBrand: true });
    const axes = out.narrative!.marketAnchors.map((a) => a.axis);
    expect(axes).toContain("domestic_used");
    expect(axes).not.toContain("export_fob");
    expect(axes).not.toContain("target_market_retail");

    // payload 里的开关必须是 true
    const prompt = vi.mocked(chatCompletionDoubao).mock.calls[0][0] as { messages: Array<{ content: unknown }> };
    const userContent = String(prompt.messages[1].content);
    expect(userContent).toContain('"subsidyTalkAllowed": true');
  });

  it(".cn + 进口品牌 → subsidyTalkAllowed 为 false", async () => {
    siteState.value = "cn";
    await callNarrative({ locale: "zh", isChineseBrand: false });
    const prompt = vi.mocked(chatCompletionDoubao).mock.calls[0][0] as { messages: Array<{ content: unknown }> };
    const userContent = String(prompt.messages[1].content);
    expect(userContent).toContain('"subsidyTalkAllowed": false');
  });

  it(".com + 国产品牌 → subsidyTalkAllowed 恒为 false（国际买家不讲中国补贴）", async () => {
    await callNarrative({ locale: "en", isChineseBrand: true });
    const prompt = vi.mocked(chatCompletionDoubao).mock.calls[0][0] as { messages: Array<{ content: unknown }> };
    const userContent = String(prompt.messages[1].content);
    expect(userContent).toContain('"subsidyTalkAllowed": false');
  });
});

describe("⑥ dataSources 白名单：编造的来源被丢弃，真实来源兜底", () => {
  it("模型编造的外部来源全部被丢弃，用 payload 里真实存在的来源补到 3 条", async () => {
    mockLlm(
      JSON.stringify({
        ...validOutput(),
        dataSources: [
          { name: "中国农机工业协会年报", ref: "industry.report.2025", note: "编的" },
          { name: "海外经销商报价", ref: "overseas.dealer.quote", note: "编的" },
        ],
      })
    );
    const out = await callNarrative();
    const refs = out.narrative!.dataSources.map((s) => s.ref);
    expect(refs).not.toContain("industry.report.2025");
    expect(refs).not.toContain("overseas.dealer.quote");
    expect(out.narrative!.dataSources.length).toBeGreaterThanOrEqual(3);
    for (const ref of refs) {
      expect([
        "result.estimatedValue",
        "result.basePrice",
        "result.priceRange",
        "result.channelPrices",
        "result.factors",
        "result.confidenceScore",
        "intelligence.model",
        "intelligence.brandCategory",
        "intelligence.depreciation",
        "intelligence.regional",
        "intelligence.brandRanking",
        "intelligence.confidence",
        "visual.perImage",
        "productMeta.sellerAskingCny",
        "productMeta.foreignPriceCny",
        "productMeta.workingHours",
        "derived.salvageFloorCny",
        "policy.subsidyTalkAllowed",
      ]).toContain(ref);
    }
  });

  it("数量上限 8 条（超出的被裁掉）", async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      name: `源 ${i}`,
      ref: "result.basePrice",
      note: "x",
    }));
    mockLlm(JSON.stringify({ ...validOutput(), dataSources: many }));
    const out = await callNarrative();
    expect(out.narrative!.dataSources.length).toBeLessThanOrEqual(8);
  });
});

describe("⑦ prompt 契约（语言指令 + 英文枚举 + 反编造红线）", () => {
  it("system prompt 里写明反编造红线与枚举语义", () => {
    expect(NARRATIVE_SYSTEM_PROMPT).toContain('"measured"');
    expect(NARRATIVE_SYSTEM_PROMPT).toContain('"benchmark"');
    expect(NARRATIVE_SYSTEM_PROMPT).toContain('"derived"');
    expect(NARRATIVE_SYSTEM_PROMPT).toContain('"not_found"');
    expect(NARRATIVE_SYSTEM_PROMPT).toContain("ANTI-FABRICATION");
    expect(NARRATIVE_SYSTEM_PROMPT).toContain("subsidyTalkAllowed");
  });

  it("user prompt 注入了目标语言指令，且枚举字段要求原文英文", () => {
    const prompt = buildNarrativePrompt({ site: "com", result: {} }, "ru");
    expect(prompt).toContain("Русский");
    expect(prompt).toContain("OUTPUT LANGUAGE");
    expect(prompt).toContain('"measured" | "benchmark" | "derived" | "not_found"');
    expect(prompt).toContain("allowed ref tokens");
  });

  it(".cn 的 prompt 明确禁用 export_fob / target_market_retail；.com 则要求必须给 export_fob", () => {
    const cnPrompt = buildNarrativePrompt({ site: "cn" }, "zh");
    expect(cnPrompt).toContain("NOT applicable");
    const comPrompt = buildNarrativePrompt({ site: "com" }, "en");
    expect(comPrompt).toContain('"export_fob" is MANDATORY');
  });

  it("调用时 system 与 user 两条消息都带语言指令（8 语种不靠硬编码中文）", async () => {
    await callNarrative({ locale: "ar" });
    const call = vi.mocked(chatCompletionDoubao).mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>;
      maxTokens: number;
      timeoutMs: number;
      model: string;
    };
    expect(call.messages[0].role).toBe("system");
    expect(String(call.messages[0].content)).toContain("العربية");
    expect(String(call.messages[1].content)).toContain("العربية");
    expect(call.maxTokens).toBe(4096);
    expect(call.timeoutMs).toBe(90_000);
  });

  it("默认超时为 120s（route 不传时）", async () => {
    await generateValuationNarrative({
      locale: "zh",
      result: makeResult(),
      intelligence: INTELLIGENCE,
      productMeta: PRODUCT_META,
      isChineseBrand: true,
    });
    const call = vi.mocked(chatCompletionDoubao).mock.calls[0][0] as { timeoutMs: number };
    expect(call.timeoutMs).toBe(120_000);
  });
});
