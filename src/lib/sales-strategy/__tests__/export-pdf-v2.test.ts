/**
 * T10 单测：`buildPdf` 8 章重排（V2 版式）+ 双版式选路 + G16 补渲染
 * ─────────────────────────────────────────────────────────
 * 覆盖 arch §5「批次 3 · T10」验收 ①–⑧：
 *   ① 10 段标题顺序 1:1（0.5 段有/无两种 case）
 *   ② TL;DR 是表（4 列表头）+ 在第 1 页 + 末行 y > 页脚线
 *   ③ 12 个决策字段逐个 fuzz（undefined / null / "" / 999 项 / 嵌套 null）→ 12 次拿到字节
 *   ④ 空 strategy → legacy 5 模块（route.test.ts:202 仍绿）
 *   ⑤ G16：`compliance` / `actionChecklist` 等老字段已上纸
 *   ⑥ 非 ok → 顶部告警条；ok → 无告警条
 *   ⑦ `rejected` 三档措辞（不推荐 / 不建议 / 禁入）
 *   ⑧ `wrapText` 委派 `wrapCjk`（逐元素相等）
 *
 * **断言手法（沿用 T09 的教训，别弱化）**
 *   PDF 内容流被 Flate + 字体 subset 压缩，字节里读不到正文 ⇒ 一切「纸面上有没有某段话」的断言
 *   都用 `PDFPage.prototype.drawText` 原型级拦截，取 (text, size, y, page)。
 *   ⚠️ `drawTable` 的表头是 bold（同文本 +0.22pt 重绘一次），一次绘制会产生 2 次 drawText，
 *      因此**一律不去数调用次数**，只做「存在性 / 序列 / 坐标」断言。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "node:fs";
import * as path from "node:path";

import { buildPdf, wrapText } from "../export";
import { wrapCjk, A4_LAYOUT } from "../pdf-table";
import type { StrategyExportPayload } from "../export-types";

// ═══════════════════════════════════════════════════════════
// 夹具
// ═══════════════════════════════════════════════════════════

const FONT_FILE = "NotoSansSC-Regular.ttf";

function resolveFontPath(): string {
  const candidates = [
    path.join(process.cwd(), "src/lib/sales-strategy/fonts", FONT_FILE),
    path.join(process.cwd(), "fonts", FONT_FILE),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`NotoSansSC 字体未找到，已尝试: ${candidates.join(", ")}`);
}

let fontBytes: Buffer | null = null;
function getFontBytes(): Buffer {
  if (!fontBytes) fontBytes = fs.readFileSync(resolveFontPath());
  return fontBytes;
}

interface DrawCall {
  text: string;
  size: number;
  y: number;
  page: PDFPage;
}

/** 渲染一次并抓取全部 drawText 调用 */
async function render(payload: unknown): Promise<{ calls: DrawCall[]; bytes: Uint8Array }> {
  const calls: DrawCall[] = [];
  const original = PDFPage.prototype.drawText;
  const spy = vi
    .spyOn(PDFPage.prototype, "drawText")
    .mockImplementation(function (
      this: PDFPage,
      text: string,
      options?: Parameters<PDFPage["drawText"]>[1]
    ): void {
      calls.push({
        text,
        size: Number(options?.size ?? 0),
        y: Number(options?.y ?? 0),
        page: this,
      });
      original.call(this, text, options);
    });
  try {
    const bytes = await buildPdf(payload as StrategyExportPayload);
    return { calls, bytes };
  } finally {
    spy.mockRestore();
  }
}

/** 章节标题 = size 13 的文本（`drawSectionTitle` 专用字号），按绘制顺序返回 */
const SECTION_TITLE_SIZE = 13;
function sectionTitles(calls: DrawCall[]): string[] {
  return calls.filter((c) => Math.abs(c.size - SECTION_TITLE_SIZE) < 0.01).map((c) => c.text);
}

/** 纸面全文（用于「有没有出现某段话」的断言） */
function allText(calls: DrawCall[]): string {
  return calls.map((c) => c.text).join("\n");
}

const EXPECTED_TITLES_WITH_KI = [
  "0. 一页结论 TL;DR",
  "0.5 与上一单的关键反转",
  "1. 机型画像对比",
  "2. 全球价格锚点矩阵",
  "3. 每台最优去向",
  "4. 四因子市场排名",
  "4.5 准入红绿灯",
  "5. 今天该打的电话",
  "6. 合规前置清单",
  "7. 待老板确认",
  "附录 · 数据来源",
];

const EXPECTED_TITLES_NO_KI = EXPECTED_TITLES_WITH_KI.filter(
  (x) => x !== "0.5 与上一单的关键反转"
);

/** 一份「12 字段齐全且自洽」的基座策略（各用例在此基础上改一个点） */
function baseStrategy(): Record<string, unknown> {
  return {
    tldr: [
      {
        equipment: "圆捆机A",
        bestChannel: "荷兰二手商",
        expectedPriceCny: "¥128,000",
        why: "当地缺口大",
      },
    ],
    keyInsight: {
      headline: "结论反转",
      body: "欧洲净价高于中亚，但中亚回款更快。",
      contrastWithPrior: "上一单主推中亚",
    },
    equipmentProfiles: [
      {
        name: "圆捆机A",
        brandCountry: "中国",
        type: "打捆机",
        spec: "1.2m",
        power: "90hp",
        weightKg: 3200,
        condition: "二手",
        positioning: "中端",
      },
    ],
    marketAnchors: [
      {
        equipment: "圆捆机A",
        axis: "欧洲",
        market: "荷兰",
        priceText: "€18,000",
        priceCny: 140000,
        basisType: "欧洲二手净价",
        note: "",
      },
    ],
    readout: "欧洲净价最高，中亚成交最快",
    bestDestinations: [
      {
        equipment: "圆捆机A",
        market: ["荷兰"],
        basis: "净价最高",
        calcChain: "€18k×7.8",
        channelIds: ["dealer_1"],
        rejected: [
          { market: "伊朗", reason: "制裁禁运", level: "L3", trigger: "R6" },
          { market: "埃及", reason: "回款慢", level: "L2", trigger: "R2" },
          { market: "蒙古", reason: "需求量小", level: "L1" },
        ],
      },
    ],
    marketRanking: [
      {
        equipment: "圆捆机A",
        rank: 1,
        market: "荷兰",
        stars: 5,
        factors: { unitPrice: "高", liquidity: "高", paymentSpeed: "快", complianceCost: "低" },
        note: "",
      },
    ],
    accessTrafficLight: { friendly: ["荷兰"], needPermit: ["埃及"], forbidden: ["伊朗"] },
    todayCalls: [
      {
        equipment: "圆捆机A",
        candidateIds: ["dealer_1"],
        role: "二手商",
        whyToday: "本周有采购计划",
      },
    ],
    complianceTasks: [
      { item: "确认报关行", owner: "外贸", deadline: "出口前", status: "未开始" },
      { item: "确认实际采购成本", owner: "老板", deadline: "立刻", status: "未开始" },
      { item: "确认目的港运费", owner: "物流", deadline: "出口前", status: "未开始" },
    ],
    openQuestions: [
      { question: "实际到手成本是多少？", affects: "定价", urgency: "立刻" },
      { question: "是否接受拼柜？", affects: "物流", urgency: "本周" },
    ],
    dataSources: [
      { name: "站内行情", ref: "Product 聚合", note: null },
      { name: "站内基准价", ref: "BrandBenchmark", note: null },
      { name: "Web检索", ref: "—", note: "未启用" },
    ],
    // ── G16：9 个老字段中的 5 个（此前从未上纸）────────────
    compliance: {
      dataExport: "数据不出境",
      crossBorder: "测试A",
      notes: "备注X",
    },
    actionChecklist: [{ step: 1, action: "测试B", owner: "业务", eta: "今天" }],
    scripts: [{ scenario: "首次触达", line: "您好，这台还在。" }],
    listingChecklist: [{ step: 1, item: "补车况卡" }],
    responsibility: { seller: "卖方自担合规", platform: "平台不承担交易风险", disclaimer: "仅供参考" },
  };
}

const CHANNEL = {
  candidateId: "dealer_1",
  type: "dealer" as const,
  name: "荷兰农机行",
  phoneMasked: "136****5678",
  wechatMasked: "微信:********",
  emailMasked: "a***@b.com",
};

/** 组装 payload；`override` 覆盖 strategy 顶层字段 */
function makePayload(
  override: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    strategy: { ...baseStrategy(), ...override },
    product: { brandName: "东方红", modelName: "YTO-1204", year: 2019 },
    channels: [CHANNEL],
    locale: "zh",
    ...extra,
  };
}

afterEach(() => vi.restoreAllMocks());

// ═══════════════════════════════════════════════════════════
// ① 10 段标题顺序 1:1
// ═══════════════════════════════════════════════════════════

describe("T10 ① · 10 段标题顺序 1:1（A1）", () => {
  it("有 keyInsight：11 段标题（含 0.5）严格按序", async () => {
    const { calls, bytes } = await render(makePayload());
    expect(bytes.length).toBeGreaterThan(0);
    expect(calls.length).toBeGreaterThan(0); // 防拦截器失效导致假绿
    expect(sectionTitles(calls)).toEqual(EXPECTED_TITLES_WITH_KI);
  }, 120_000);

  it("keyInsight 缺失：0.5 段连标题一起不渲染，其余 10 段顺序不变", async () => {
    const { calls } = await render(makePayload({ keyInsight: undefined }));
    expect(sectionTitles(calls)).toEqual(EXPECTED_TITLES_NO_KI);
    expect(allText(calls)).not.toContain("0.5 与上一单的关键反转");
  }, 120_000);

  it("en locale 顺序与 zh 完全一致（仅文案不同）", async () => {
    const { calls } = await render(makePayload({}, { locale: "en" }));
    const titles = sectionTitles(calls);
    expect(titles).toHaveLength(EXPECTED_TITLES_WITH_KI.length);
    expect(titles[0]).toBe("0. TL;DR — One Page Conclusion");
    expect(titles[titles.length - 1]).toBe("Appendix · Data Sources");
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════
// ② TL;DR 必须是表、在第 1 页、末行 y > 页脚线
// ═══════════════════════════════════════════════════════════

describe("T10 ② · TL;DR 是表且一页看完（A2）", () => {
  it("4 列表头齐全，且本行内容落在第 1 页、y 高于页脚线", async () => {
    const { calls } = await render(makePayload());

    const text = allText(calls);
    for (const header of ["机型", "最优去向", "预期价", "一句话理由"]) {
      expect(text).toContain(header);
    }

    // 文档标题所在页 = 第 1 页
    const firstPage = calls.find((c) => c.text.includes("作战手册"))?.page;
    expect(firstPage).toBeDefined();

    // TL;DR 行的设备名必须画在第 1 页且 y > MARGIN（页脚线）
    const tldrCalls = calls.filter((c) => c.text.includes("圆捆机A"));
    expect(tldrCalls.length).toBeGreaterThan(0);
    const firstTldr = tldrCalls[0];
    expect(firstTldr.page).toBe(firstPage);
    expect(firstTldr.y).toBeGreaterThan(A4_LAYOUT.MARGIN);
  }, 120_000);

  it("tldr 与 equipmentProfiles 行数不等 → 仍渲染 + 灰字告警，不抛错", async () => {
    const { calls, bytes } = await render(
      makePayload({
        tldr: [
          { equipment: "圆捆机A", bestChannel: "荷兰", expectedPriceCny: "¥1", why: "a" },
          { equipment: "打捆机B", bestChannel: "埃及", expectedPriceCny: "¥2", why: "b" },
        ],
        equipmentProfiles: [
          {
            name: "圆捆机A",
            brandCountry: "中国",
            type: "打捆机",
            spec: "1.2m",
            power: "90hp",
            condition: "二手",
            positioning: "中端",
          },
        ],
      })
    );
    expect(bytes.length).toBeGreaterThan(0);
    expect(allText(calls)).toContain("≠ 机型画像");
  }, 120_000);

  it("tldr 为空 → 合成 1 行 + 「（自动汇总：AI 未给出一页结论）」", async () => {
    const { calls } = await render(makePayload({ tldr: [] }));
    expect(allText(calls)).toContain("自动汇总：AI 未给出一页结论");
    expect(sectionTitles(calls)).toEqual(EXPECTED_TITLES_WITH_KI);
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════
// ③ 12 字段逐个 fuzz
// ═══════════════════════════════════════════════════════════

const FUZZ_CASES: Array<[string, unknown]> = [
  ["tldr", undefined],
  ["keyInsight", null],
  ["equipmentProfiles", ""],
  ["marketAnchors", Array.from({ length: 999 }, () => ({}))],
  [
    "bestDestinations",
    [
      {
        equipment: null,
        market: null,
        basis: null,
        calcChain: null,
        channelIds: null,
        rejected: [{ market: null, reason: null, level: null, trigger: null }],
      },
    ],
  ],
  ["marketRanking", [{ equipment: null, rank: null, market: null, stars: null, factors: null }]],
  ["accessTrafficLight", { friendly: null, needPermit: null, forbidden: null }],
  ["todayCalls", [{ equipment: null, candidateIds: null, role: null, whyToday: null }]],
  [
    "complianceTasks",
    Array.from({ length: 999 }, () => ({ item: null, owner: null, deadline: null, status: null })),
  ],
  ["openQuestions", [{}, {}]],
  ["dataSources", [{ name: "不存在的来源名", ref: null, note: undefined }]],
  ["readout", ""],
];

describe("T10 ③ · 12 字段逐个 fuzz（A4：无空章节、无脏串）", () => {
  it.each(FUZZ_CASES)("字段 %s 注入脏值仍能出 PDF", async (field, badValue) => {
    const { calls, bytes } = await render(makePayload({ [field]: badValue }));

    expect(bytes.length).toBeGreaterThan(1024);
    expect(calls.length).toBeGreaterThan(5);

    const text = allText(calls);
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
    expect(text).not.toContain("[object Object]");

    // 12 章标题必须仍齐全（不允许「字段脏 ⇒ 整章消失」）
    // 唯一例外：keyInsight 脏/空 ⇒ 0.5 段按设计整段不渲染（PRD §2 ②），故期望少一段
    const expected = field === "keyInsight" ? EXPECTED_TITLES_NO_KI : EXPECTED_TITLES_WITH_KI;
    expect(sectionTitles(calls)).toEqual(expected);
  }, 180_000);
});

// ═══════════════════════════════════════════════════════════
// ④ 空 strategy → legacy
// ═══════════════════════════════════════════════════════════

describe("T10 ④ · 双版式选路（空 strategy → legacy 5 模块）", () => {
  it("strategy 为空对象 → 走 legacy，含「① 经销商清单」且不含「0. 一页结论」", async () => {
    const { calls, bytes } = await render({
      strategy: {},
      product: null,
      channels: [{ ...CHANNEL, name: "塔什干买家", type: "lead" }],
      locale: "zh",
    });

    expect(bytes.length).toBeGreaterThan(0);
    const titles = sectionTitles(calls);
    expect(titles).toContain("① 经销商清单（联系方式已脱敏）");
    expect(titles).toEqual(["① 经销商清单（联系方式已脱敏）", "② 价格基准", "③ 全渠道打法", "④ 话术", "⑤ 上架清单"]);
    expect(allText(calls)).not.toContain("0. 一页结论");
  }, 120_000);

  it("老 9 字段齐全但无 12 新字段 → 仍走 legacy（老策略 JSON 不重跑）", async () => {
    const { calls } = await render(makePayload({}, { strategy: { summary: "先出清库存" } }));
    expect(sectionTitles(calls)).toContain("① 经销商清单（联系方式已脱敏）");
    expect(allText(calls)).toContain("摘要：先出清库存");
  }, 120_000);

  it("只要有一个新字段 → 立刻切 V2", async () => {
    // 注意：`readout` **不在** V2_TRIGGER_KEYS（arch §1.4.4 的 11 个键）里，
    // 它只能作为第 2 章的附属读图，不能单独触发 V2；故用 `tldr: []`（存在但为空）触发。
    const { calls } = await render(makePayload({ tldr: [] }));
    expect(sectionTitles(calls)[0]).toBe("0. 一页结论 TL;DR");
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════
// ⑤ G16 补渲染
// ═══════════════════════════════════════════════════════════

describe("T10 ⑤ · G16：LLM 生成了就要上纸", () => {
  it("compliance.crossBorder 与 actionChecklist[0].action 出现在纸面", async () => {
    const { calls } = await render(makePayload());
    const text = allText(calls);
    expect(text).toContain("测试A");
    expect(text).toContain("测试B");
  }, 120_000);

  it("compliance.dataExport / notes / scripts / listingChecklist / responsibility 全部上纸", async () => {
    const { calls } = await render(makePayload());
    const text = allText(calls);
    expect(text).toContain("数据不出境");
    expect(text).toContain("备注X");
    expect(text).toContain("首次触达");
    expect(text).toContain("补车况卡");
    expect(text).toContain("卖方自担合规");
    expect(text).toContain("平台不承担交易风险");
    expect(text).toContain("仅供参考");
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════
// ⑥ 顶部告警条
// ═══════════════════════════════════════════════════════════

describe("T10 ⑥ · 检索状态告警条（任务 D）", () => {
  it("webStatus=timeout → 纸面含「[告警]」且位于第 1 页顶部", async () => {
    const { calls } = await render(makePayload({}, { webStatus: "timeout" }));
    const warnCall = calls.find((c) => c.text.includes("[告警]"));
    expect(warnCall).toBeDefined();
    expect(warnCall?.y).toBeGreaterThan(A4_LAYOUT.PAGE_H / 2);
    // 必须在第 0 章标题之前
    const warnIndex = calls.findIndex((c) => c.text.includes("[告警]"));
    const tldrIndex = calls.findIndex((c) => c.text === "0. 一页结论 TL;DR");
    expect(warnIndex).toBeGreaterThanOrEqual(0);
    expect(warnIndex).toBeLessThan(tldrIndex);
  }, 120_000);

  it("webStatus=ok → 纸面不含「[告警]」", async () => {
    const { calls } = await render(makePayload({}, { webStatus: "ok" }));
    expect(allText(calls)).not.toContain("[告警]");
  }, 120_000);

  it("webStatus 缺省（undefined）视同 ok，不画告警条", async () => {
    const { calls } = await render(makePayload());
    expect(allText(calls)).not.toContain("[告警]");
  }, 120_000);

  it("webNote 透传进告警条第二行", async () => {
    const { calls } = await render(
      makePayload({}, { webStatus: "partial", webNote: "部分检索超时（3/5 成功）" })
    );
    expect(allText(calls)).toContain("部分检索超时（3/5 成功）");
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════
// ⑦ rejected 三档措辞
// ═══════════════════════════════════════════════════════════

describe("T10 ⑦ · rejected 三档措辞（PRD §3.3）", () => {
  it("L1/L2/L3 → 不推荐 / 不建议 / 禁入（按「档位」独立单元格精确断言）", async () => {
    const { calls } = await render(makePayload());
    const cellTexts = calls.map((c) => c.text);
    // 精确匹配：`[红]禁入` 是红绿灯**表头**，不是否决档位 ⇒ 用全等而非包含，
    // 否则「禁入」会被表头蒙对，断言形同虚设。
    expect(cellTexts).toContain("不推荐");
    expect(cellTexts).toContain("不建议");
    expect(cellTexts).toContain("禁入");
  }, 120_000);

  it("无任一 L3 时追加「未给出禁入判定」告警", async () => {
    const { calls } = await render(
      makePayload({
        bestDestinations: [
          {
            equipment: "圆捆机A",
            market: ["荷兰"],
            basis: "净价最高",
            rejected: [{ market: "蒙古", reason: "量小", level: "L1" }],
          },
        ],
      })
    );
    expect(allText(calls)).toContain("未给出禁入判定");
  }, 120_000);

  it("rejected 全空时追加「未生成否决建议」告警", async () => {
    const { calls } = await render(
      makePayload({
        bestDestinations: [
          { equipment: "圆捆机A", market: ["荷兰"], basis: "净价最高", rejected: [] },
        ],
      })
    );
    expect(allText(calls)).toContain("未生成否决建议");
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════
// ⑧ wrapText 委派 wrapCjk
// ═══════════════════════════════════════════════════════════

describe("T10 ⑧ · wrapText 委派 wrapCjk（任务 E）", () => {
  it("同一输入（中文长句 + \\n + 空行）输出数组逐元素相等", async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(getFontBytes(), { subset: true });

    const samples = [
      "这是一段很长的中文说明，用来验证按字符换行语义完全一致，不许多一个字符也不许少一个字符。",
      "第一行\n第二行\n\n第四行（中间有空行）",
      "混排 English 与中文 mixed content 9YG-1.2 型号，最长的一行需要折行处理。",
      "",
      "\n\n",
    ];
    const widths = [40, 120, 260, A4_LAYOUT.CONTENT_W];

    for (const sample of samples) {
      for (const width of widths) {
        expect(wrapText(sample, font, 8.5, width)).toEqual(wrapCjk(sample, font, 8.5, width));
      }
    }
  }, 120_000);

  it("api 与 legacy 仍共用同一实现：legacy 输出含 5 模块标题", async () => {
    const { calls } = await render({ strategy: {}, product: null, channels: [], locale: "zh" });
    expect(sectionTitles(calls)).toHaveLength(5);
  }, 120_000);
});
