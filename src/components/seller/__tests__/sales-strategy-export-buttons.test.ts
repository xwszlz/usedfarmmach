/**
 * N03 回归守卫 · 前端导出透传「一个字段都不裁」
 * ─────────────────────────────────────────────────────────
 * 背景（真实事故）：`sales-strategy-export-buttons.tsx` 曾用**字段白名单**重建 PDF payload，
 * `ai-sales-strategy-card.tsx` 也曾在传参时白名单重建 `strategy`，两道裁剪叠加，
 * 使 N02 的 12 个决策字段在浏览器端就被丢光 ⇒ 后端 PDF 8 章全空、Excel Sheet2/Sheet3 无数据源。
 *
 * 本文件锁死三件事：
 *   ① PDF 请求体的 `strategy` 必须是 `{ ...strategy }` 全量展开（12 字段逐个断言）；
 *   ② Excel 请求体必须带 `layout: "v2"` + `strategy`；策略为空时与改造前逐字等价；
 *   ③ 源码层不得再出现白名单重建（卡片侧整对象透传 `strategy={result}`）。
 *
 * 运行：`npx vitest run src/components/seller`
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildExcelExportBody,
  buildPdfExportBody,
  type PdfExportBodyInput,
} from "@/components/seller/sales-strategy-export-buttons";
import type { StrategyLlmResult } from "@/lib/sales-strategy/prompt";
import type { StrategyDecisionFields } from "@/lib/sales-strategy/strategy-schema";

/** N02 冻结的 12 个决策字段键名（改名 / 删除都必须同步本数组） */
const TWELVE_DECISION_KEYS = [
  "tldr",
  "keyInsight",
  "equipmentProfiles",
  "marketAnchors",
  "readout",
  "bestDestinations",
  "marketRanking",
  "accessTrafficLight",
  "todayCalls",
  "complianceTasks",
  "openQuestions",
  "dataSources",
] as const satisfies readonly (keyof StrategyDecisionFields)[];

/**
 * 构造一份「12 字段 + 9 老字段全给」的策略样本。
 *
 * 值刻意做成可识别的小对象数组，便于断言「原样透传」而非「被重新构造」。
 */
function makeFullStrategy(): StrategyLlmResult & StrategyDecisionFields {
  return {
    summary: "整机出口中亚优先，欧洲走高价零售",
    targetMarkets: [{ market: "俄罗斯", priority: "高", rationale: "汇率与机况匹配" }],
    priceRange: { suggestedMinCny: 200000, suggestedMaxCny: 260000, currencyNote: "CNY" },
    compliance: { dataExport: "数据不出境", crossBorder: "由买方承担清关" },
    actionChecklist: [{ step: 1, action: "打 3 通电话" }],
    responsibility: { seller: "卖家负责机况", platform: "平台负责匹配" },
    scripts: [{ scenario: "首次触达", line: "这台机器工时低" }],
    listingChecklist: [{ step: 1, item: "上传工时照片" }],

    tldr: [
      { equipment: "克拉斯 Quadrant 3200", bestChannel: "乌兹别克进口商", expectedPriceCny: "52-58万", why: "本地无同类供给" },
      { equipment: "纽荷兰 BB1290", bestChannel: "南非二手商", expectedPriceCny: "38-42万", why: "粮价回升带动更新" },
    ],
    keyInsight: { headline: "越贵越好卖", body: "高价段反而先成交", contrastWithPrior: null },
    equipmentProfiles: [
      {
        name: "克拉斯 Quadrant 3200",
        brandCountry: "德国",
        type: "方捆机",
        spec: "120×70",
        power: "160hp",
        weightKg: 6200,
        condition: "二手",
        positioning: "中高端",
      },
    ],
    marketAnchors: [
      { equipment: "克拉斯 Quadrant 3200", axis: "欧洲", market: "德国", priceText: "€46,000", priceCny: 358800, basisType: "欧洲二手净价" },
      { equipment: "克拉斯 Quadrant 3200", axis: "中亚", market: "乌兹别克", priceText: "58万", priceCny: 580000, basisType: "FOB建议" },
    ],
    readout: "价格轴越靠欧洲越坚挺，中亚靠走量。",
    bestDestinations: [
      {
        equipment: "克拉斯 Quadrant 3200",
        market: ["乌兹别克", "哈萨克"],
        basis: "本地无同类在售",
        calcChain: "58万 - 运费 6万 - 关税 4万",
        channelIds: ["dealer_001"],
        rejected: [{ market: "北美", reason: "认证成本高", level: "L2", trigger: "R4" }],
      },
    ],
    marketRanking: [
      {
        equipment: "克拉斯 Quadrant 3200",
        rank: 1,
        market: "乌兹别克",
        stars: 5,
        factors: { unitPrice: "高", liquidity: "强", paymentSpeed: "快", complianceCost: "低" },
        note: "首选",
      },
    ],
    accessTrafficLight: { friendly: ["乌兹别克"], needPermit: ["哈萨克"], forbidden: ["欧盟"] },
    todayCalls: [
      { equipment: "克拉斯 Quadrant 3200", candidateIds: ["dealer_001"], role: "进口商", whyToday: "报价有效期 3 天" },
    ],
    complianceTasks: [
      { item: "确认 EAC 认证是否需要重做", owner: "外贸", deadline: "本周五", status: "未开始" },
      { item: "拍板底价", owner: "老板", deadline: "立刻" },
    ],
    openQuestions: [
      { question: "是否接受 10% 下浮", affects: "定价", urgency: "立刻" },
      { question: "谁负责目的港清关", affects: "责任划分", urgency: "本周" },
    ],
    dataSources: [
      { name: "站内行情", ref: "同品类在售 8 条" },
      { name: "Web检索", ref: "de.tec24.com", note: "挂牌价" },
    ],
  };
}

/** 构造 PDF 请求体入参（默认值集中在此，避免每个用例重复） */
function makePdfInput(overrides: Partial<PdfExportBodyInput> = {}): PdfExportBodyInput {
  return {
    strategy: makeFullStrategy(),
    product: { brandName: "CLAAS", modelName: "Quadrant 3200", year: 2016, priceCny: 240000 },
    channels: [
      {
        candidateId: "dealer_001",
        type: "dealer",
        name: "Tashkent Agro",
        phoneMasked: "138****1234",
        wechatMasked: "微信:********",
        emailMasked: "a***@b.com",
      },
    ],
    locale: "zh",
    ...overrides,
  };
}

describe("N03 · PDF 请求体：12 个决策字段全量透传（验收 ①）", () => {
  it("12 个字段逐个存在且原样保留（非白名单重建）", () => {
    const full = makeFullStrategy();
    const body = buildPdfExportBody(makePdfInput({ strategy: full }));
    const strategy = body.strategy as Record<string, unknown>;

    for (const key of TWELVE_DECISION_KEYS) {
      expect(strategy, `缺失决策字段 ${key}`).toHaveProperty(key);
      // 值必须与传入完全一致（同一引用即证明是展开而非重建）
      expect(strategy[key]).toEqual((full as Record<string, unknown>)[key]);
    }
    // 12 个键一个不少、也不多出被改名后的残影
    for (const key of TWELVE_DECISION_KEYS) expect(Object.keys(strategy)).toContain(key);
  });

  it("既有 9 个老字段同样保留（回归：改造前行为不得退化）", () => {
    const body = buildPdfExportBody(makePdfInput());
    const strategy = body.strategy as Record<string, unknown>;
    for (const key of [
      "summary",
      "targetMarkets",
      "priceRange",
      "compliance",
      "actionChecklist",
      "responsibility",
      "scripts",
      "listingChecklist",
    ]) {
      expect(strategy, `缺失老字段 ${key}`).toHaveProperty(key);
    }
  });

  it("channels 原样透传脱敏值，组件不做二次脱敏/解密", () => {
    const input = makePdfInput();
    const body = buildPdfExportBody(input);
    expect(body.channels).toEqual(input.channels);
    expect(JSON.stringify(body.channels)).not.toContain("13800001234");
  });

  it("webStatus / webNote 缺省时 JSON 序列化自动省略（后端视同 ok）", () => {
    const wire = JSON.parse(JSON.stringify(buildPdfExportBody(makePdfInput())));
    expect(Object.keys(wire).sort()).toEqual(["channels", "locale", "product", "strategy"]);
    expect(wire).not.toHaveProperty("webStatus");
    expect(wire).not.toHaveProperty("webNote");
  });

  it("webStatus=partial 时随请求体下发（T10 顶部告警条数据源）", () => {
    const wire = JSON.parse(
      JSON.stringify(
        buildPdfExportBody(makePdfInput({ webStatus: "partial", webNote: "部分检索超时（3/5 成功）" }))
      )
    );
    expect(wire.webStatus).toBe("partial");
    expect(wire.webNote).toBe("部分检索超时（3/5 成功）");
  });

  it("webNote 为空串 / 纯空白时省略（生成接口 ok 时下发空串，不得渲染空行）", () => {
    for (const blank of ["", "   "]) {
      const wire = JSON.parse(JSON.stringify(buildPdfExportBody(makePdfInput({ webNote: blank }))));
      expect(Object.keys(wire)).not.toContain("webNote");
    }
  });
});

describe("N03 · Excel 请求体：layout v2 + strategy（验收 ②）", () => {
  it("有策略 → {partition, locale, layout:'v2', strategy}，且 marketAnchors/complianceTasks 可读", () => {
    const body = buildExcelExportBody("all", "zh", makeFullStrategy());
    expect(Object.keys(body).sort()).toEqual(["layout", "locale", "partition", "strategy"]);
    expect(body.partition).toBe("all");
    expect(body.locale).toBe("zh");
    expect(body.layout).toBe("v2");

    const strategy = body.strategy as Record<string, unknown>;
    expect(Array.isArray(strategy.marketAnchors)).toBe(true);
    expect((strategy.marketAnchors as unknown[]).length).toBe(2);
    expect(Array.isArray(strategy.complianceTasks)).toBe(true);
    expect((strategy.complianceTasks as unknown[]).length).toBe(2);
  });

  it("分区口径原样透传（cn / intl 不得被吞）", () => {
    expect(buildExcelExportBody("cn", "en", makeFullStrategy()).partition).toBe("cn");
    expect(buildExcelExportBody("intl", "en", makeFullStrategy()).locale).toBe("en");
  });

  it("webStatus 有值时下发（T11 route 用它给 Sheet2「备注」标注降级），缺省则省略键", () => {
    const withStatus = buildExcelExportBody("all", "zh", makeFullStrategy(), "timeout");
    expect(withStatus.webStatus).toBe("timeout");

    const withoutStatus = buildExcelExportBody("all", "zh", makeFullStrategy());
    expect(Object.keys(withoutStatus)).not.toContain("webStatus");

    // 线上真实形态：undefined 键在 JSON 序列化时被丢弃
    const wire = JSON.parse(JSON.stringify(withStatus));
    expect(wire.webStatus).toBe("timeout");
  });
});

describe("N03 · 向后兼容：策略为空不得抛错（验收 ③）", () => {
  it("strategy=null → PDF strategy 为空对象，其余字段照常", () => {
    const body = buildPdfExportBody(makePdfInput({ strategy: null }));
    expect(body.strategy).toEqual({});
    expect(body.product).not.toBeNull();
    expect(Array.isArray(body.channels)).toBe(true);
  });

  it("strategy=undefined → Excel 请求体与改造前逐字等价（不发 layout）", () => {
    const body = buildExcelExportBody("all", "zh", undefined);
    expect(body).toEqual({ partition: "all", locale: "zh" });
    expect(Object.keys(body)).not.toContain("layout");
  });

  it("strategy=null / 非对象 / 数组 → 一律退化为 {}，不抛错", () => {
    const cases: unknown[] = [null, undefined, [], "not-an-object", 42];
    for (const bad of cases) {
      const pdfBody = buildPdfExportBody(makePdfInput({ strategy: bad as StrategyLlmResult }));
      expect(pdfBody.strategy).toEqual({});
      const excelBody = buildExcelExportBody("all", "zh", bad as StrategyLlmResult);
      expect(excelBody).toEqual({ partition: "all", locale: "zh" });
    }
  });

  it("JSON.stringify 不因 undefined 字段抛错（真实发送路径）", () => {
    expect(() =>
      JSON.stringify(buildPdfExportBody(makePdfInput({ strategy: undefined })))
    ).not.toThrow();
  });
});

describe("N03 · 源码层回归守卫：不得再出现白名单重建", () => {
  const CARD_PATH = join(process.cwd(), "src/components/product/ai-sales-strategy-card.tsx");
  const BUTTONS_PATH = join(process.cwd(), "src/components/seller/sales-strategy-export-buttons.tsx");

  it("卡片侧整对象透传 `strategy={result}`，且不再有 strategy={{ ... }} 白名单字面量", () => {
    const source = readFileSync(CARD_PATH, "utf8");
    expect(source).toContain("strategy={result}");
    // 白名单特征：`strategy={{` 紧跟 `summary: result.summary`
    expect(source).not.toMatch(/strategy=\{\{\s*\n\s*summary:\s*result\.summary/);
  });

  it("导出按钮侧 payload 用 `{ ...strategy }` 展开，且无 `summary: strategy.` 之类重建", () => {
    const source = readFileSync(BUTTONS_PATH, "utf8");
    expect(source).toMatch(/\{\s*\.\.\.strategy\s*\}/);
    expect(source).not.toMatch(/summary:\s*strategy\./);
    expect(source).not.toMatch(/targetMarkets:\s*strategy\./);
  });

  it("卡片侧下传检索状态（PDF 黄条 / Excel 降级标注的唯一数据源）", () => {
    const source = readFileSync(CARD_PATH, "utf8");
    expect(source).toContain("webStatus={result.searchStatus}");
    expect(source).toContain("webNote={result.searchNote}");
  });
});
