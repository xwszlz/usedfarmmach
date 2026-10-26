/**
 * T13 验收（A1 / A2 / G16）— **真实产物字节 + 独立文本抽取**，不依赖 drawText mock
 * ─────────────────────────────────────────────────────────
 * 与工程师既有 `export-pdf-v2.test.ts`（原型级拦截 drawText）的关键区别：
 *   本文件先用 `buildPdf` 出**真实 PDF 字节**，再用 `./pdf-text` 从字节里解出
 *   ToUnicode CMap + 内容流，还原「纸上到底写了什么、在第几页、什么坐标」。
 *   ⇒ 若渲染层根本没调用 drawText（或调用后没写进内容流），这里会 FAIL，拦截式断言不会。
 *
 * 覆盖：
 *   A1 双版式选路：空 strategy → legacy 5 模块（且不含 v2 章节）；有 tldr → v2 10 段标题按序。
 *   A2 TL;DR 位于**第 1 页**（页级文本 + 真实坐标 y，配合 `getSize().height` 核对）。
 *   G16 `compliance` / `responsibility` / `actionChecklist`（+ scripts / listingChecklist）真上纸。
 *
 * 口径澄清（避免误判为 bug，见 team-lead 预警）：
 *   ① `webStatus !== "ok"` 时 deleted/L3 档由 prompt 层强制降级 ⇒ 本文件**不断言**「必须有 L3」；
 *   ② R2 价格倒挂只断言「trigger→level 一致性」，不断言「R2 命中必进 rejected」；
 *   ③ 空数组同样触发 v2（`!= null` 判定），属设计取舍，本文件仅记录不判错。
 */
import { describe, it, expect } from "vitest";
import { buildPdf } from "../export";
import { extractPdfText, inspectPdf } from "./pdf-text";
import type { StrategyExportPayload } from "../export-types";

// ── 夹具 ────────────────────────────────────────────────────
const PRODUCT = { brandName: "东方红", modelName: "YTO-1204", year: 2019 };

/** legacy 判定用的 5 模块特征串 */
const LEGACY_MARKERS = [
  "① 经销商清单（联系方式已脱敏）",
  "② 价格基准",
  "③ 全渠道打法",
  "④ 话术",
  "⑤ 上架清单",
];

/** v2 的固定章节标题（顺序即验收口径）。0.5 章按 `keyInsight` 存在性整段省略，单独断言 */
const V2_SECTIONS_MANDATORY = [
  "0. 一页结论 TL;DR",
  "1. 机型画像对比",
  "2. 全球价格锚点矩阵",
  "3. 每台最优去向",
  "4. 四因子市场排名",
  "4.5 准入红绿灯",
  "5. 今天该打的电话",
  "6. 合规前置清单",
  "7. 待老板确认",
];
const V2_SECTION_05 = "0.5 与上一单的关键反转";
const V2_APPENDIX = "附录 · 数据来源";

const V2_PAYLOAD: StrategyExportPayload = {
  strategy: {
    tldr: [
      {
        equipment: "东方红 YTO-1204",
        bestChannel: "塔什干二手商",
        expectedPriceCny: "¥98万",
        why: "当地二手机溢价高",
      },
    ],
    keyInsight: { headline: "反转标题SENTINEL-KI-H", body: "反转正文SENTINEL-KI-B" },
    compliance: {
      dataExport: "境内数据不出境SENTINEL-DE",
      crossBorder: "跨境买家自担SENTINEL-CB",
      notes: "保留报关单SENTINEL-NT",
    },
    actionChecklist: [{ step: 1, action: "打电话给老王SENTINEL-ACT", owner: "老板", eta: "今天" }],
    responsibility: {
      seller: "卖家责任SENTINEL-SELLER",
      platform: "平台边界SENTINEL-PLATFORM",
      disclaimer: "免责声明SENTINEL-DISC",
    },
    scripts: [{ scenario: "首次触达SENTINEL-SC", line: "您好有话术SENTINEL-LINE" }],
    listingChecklist: [{ step: 1, item: "补车况卡SENTINEL-LC" }],
  },
  product: PRODUCT,
  channels: [],
  locale: "zh",
};

// ═══════════════════════════════════════════════════════════
// A1 双版式选路（真实字节 ⇒ 抽文本判版式）
// ═══════════════════════════════════════════════════════════
describe("A1 双版式选路（真实 PDF 字节抽文本）", () => {
  it("空 strategy + 空 channels ⇒ legacy 5 模块全在，且不含 v2「0. 一页结论」/附录", async () => {
    const bytes = await buildPdf({ strategy: {}, product: PRODUCT, channels: [], locale: "zh" });
    const { all } = await extractPdfText(bytes);

    for (const marker of LEGACY_MARKERS) {
      expect(all, `legacy 缺特征串「${marker}」`).toContain(marker);
    }
    expect(all).not.toContain("0. 一页结论");
    expect(all).not.toContain(V2_APPENDIX);
    expect(all).not.toContain("1. 机型画像对比");
  });

  it("仅 tldr 一个字段 ⇒ v2：9 段必现标题按序，且不含 legacy「① 经销商清单」", async () => {
    const bytes = await buildPdf({
      strategy: { tldr: V2_PAYLOAD.strategy.tldr },
      product: PRODUCT,
      channels: [],
      locale: "zh",
    });
    const { all } = await extractPdfText(bytes);

    let cursor = -1;
    for (const title of V2_SECTIONS_MANDATORY) {
      const at = all.indexOf(title);
      expect(at, `v2 缺章节标题「${title}」（解出全文见下）\n${all.slice(0, 1200)}`).toBeGreaterThan(-1);
      expect(at, `章节「${title}」顺序错位（应在上一个标题之后）`).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(all).toContain(V2_APPENDIX);
    expect(all).not.toContain("① 经销商清单");
    // 0.5 章在无 keyInsight 时应整段省略（连标题一起不画）
    expect(all).not.toContain(V2_SECTION_05);
  });

  it("有 keyInsight ⇒ 0.5 章上纸，且位置在 0 与 1 之间", async () => {
    const { all } = await extractPdfText(await buildPdf(V2_PAYLOAD));
    const at0 = all.indexOf("0. 一页结论 TL;DR");
    const at05 = all.indexOf(V2_SECTION_05);
    const at1 = all.indexOf("1. 机型画像对比");
    expect(at05, "有 keyInsight 却未渲染 0.5 章").toBeGreaterThan(-1);
    expect(at05).toBeGreaterThan(at0);
    expect(at05).toBeLessThan(at1);
    expect(all).toContain("反转标题SENTINEL-KI-H");
  });

  it("11 个 V2 触发键逐个单独存在 ⇒ 都走 v2（不是只看 tldr）", async () => {
    const triggers: Array<[string, unknown]> = [
      ["tldr", []],
      ["keyInsight", {}],
      ["equipmentProfiles", []],
      ["marketAnchors", []],
      ["bestDestinations", []],
      ["marketRanking", []],
      ["accessTrafficLight", {}],
      ["todayCalls", []],
      ["complianceTasks", []],
      ["openQuestions", []],
      ["dataSources", []],
    ];

    for (const [key, value] of triggers) {
      const bytes = await buildPdf({
        strategy: { [key]: value } as any,
        product: PRODUCT,
        channels: [],
        locale: "zh",
      });
      const { all } = await extractPdfText(bytes);
      expect(all, `触发键 ${key} 未走 v2`).toContain("0. 一页结论");
      expect(all, `触发键 ${key} 误走 legacy`).not.toContain("① 经销商清单");
    }
  });

  it("12 个新字段全为显式 null ⇒ 仍走 legacy（`!= null` 判定，null 不算「有字段」）", async () => {
    const allNull = {
      tldr: null,
      keyInsight: null,
      equipmentProfiles: null,
      marketAnchors: null,
      bestDestinations: null,
      marketRanking: null,
      accessTrafficLight: null,
      todayCalls: null,
      complianceTasks: null,
      openQuestions: null,
      dataSources: null,
    };
    const { all } = await extractPdfText(
      await buildPdf({ strategy: allNull as any, product: PRODUCT, channels: [], locale: "zh" })
    );
    expect(all).toContain("① 经销商清单");
    expect(all).not.toContain("0. 一页结论");
  });

  it("locale=en ⇒ 走 legacy 英文 5 模块（不串中文标题）", async () => {
    const bytes = await buildPdf({ strategy: {}, product: PRODUCT, channels: [], locale: "en" });
    const { all } = await extractPdfText(bytes);
    expect(all).toContain("① Dealer List (masked)");
    expect(all).not.toContain("① 经销商清单");
  });
});

// ═══════════════════════════════════════════════════════════
// A2 TL;DR 必须在第 1 页（页级文本 + 真实坐标）
// ═══════════════════════════════════════════════════════════
describe("A2 TL;DR 落在第 1 页（页级文本 + 坐标核对）", () => {
  it("TL;DR 标题与首行数据都在第 1 页，且在页面纵向可打印区内", async () => {
    const bytes = await buildPdf(V2_PAYLOAD);
    const { pages, runs } = await extractPdfText(bytes);
    const meta = await inspectPdf(bytes);

    // 事实基础：A4 尺寸从产物读出（595 x 842）
    expect(meta.sizes[0].width).toBeCloseTo(595, 0);
    const pageHeight = meta.sizes[0].height;
    expect(pageHeight).toBeCloseTo(842, 0);

    // ① 页级断言：标题只出现在第 1 页
    expect(pages[0]).toContain("0. 一页结论 TL;DR");
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i], `TL;DR 标题出现在第 ${i + 1} 页（应在第 1 页）`).not.toContain(
        "0. 一页结论 TL;DR"
      );
    }

    // ② 坐标断言：标题 y 在页面上半部，表格首行 y 在标题之下且仍在可打印区内
    const titleRun = runs[0].find((r) => r.text === "0. 一页结论 TL;DR");
    expect(titleRun, "第 1 页找不到 TL;DR 标题的绘制记录").toBeDefined();
    const titleY = titleRun!.y;
    expect(titleY).toBeGreaterThan(pageHeight / 2); // 上半部
    expect(titleY).toBeLessThanOrEqual(pageHeight); // 不越界

    const rowRun = runs[0].find((r) => r.text === "塔什干二手商");
    expect(rowRun, "第 1 页找不到 TL;DR 首行数据的绘制记录").toBeDefined();
    expect(rowRun!.y).toBeLessThan(titleY); // 表格在标题下方
    expect(rowRun!.y).toBeGreaterThan(40); // 不低于页脚边距 MARGIN=40
    expect(rowRun!.x).toBeGreaterThanOrEqual(40);
  });

  it("8 行 TL;DR（长表）仍完整落在第 1 页可打印区内（不静默截断）", async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      equipment: `机型${i + 1}号`,
      bestChannel: `去向${i + 1}`,
      expectedPriceCny: `¥${90 + i}万`,
      why: `理由${i + 1}`,
    }));
    const bytes = await buildPdf({
      ...V2_PAYLOAD,
      strategy: { ...V2_PAYLOAD.strategy, tldr: rows },
    });
    const { pages, runs } = await extractPdfText(bytes);
    const meta = await inspectPdf(bytes);

    // 8 行全部可检出（不丢行）
    for (let i = 1; i <= 8; i++) {
      expect(pages[0], `第 ${i} 行「机型${i}号」未落在第 1 页`).toContain(`机型${i}号`);
    }

    // ⚠️ 同一机型名还会在「1. 机型画像对比」章出现（derive 由 tldr 自动派生 profiles，
    //    属「数据不白丢」的正向行为）⇒ 必须按 y 轴切出**TL;DR 表**那一段再断言，不能数总次数。
    const profileTitle = runs[0].find((r) => r.text === "1. 机型画像对比");
    expect(profileTitle, "第 1 页找不到「1. 机型画像对比」标题").toBeDefined();
    const tldrYs = runs[0]
      .filter((r) => /^机型\d号$/.test(r.text) && r.y > profileTitle!.y)
      .map((r) => r.y);

    expect(tldrYs).toHaveLength(8);
    for (const y of tldrYs) {
      expect(y).toBeGreaterThan(40); // 高于页脚边距
      expect(y).toBeLessThan(meta.sizes[0].height); // 不越出页面
    }
    // 行间严格递减（自上而下，不重叠、不跳行）
    for (let i = 1; i < tldrYs.length; i++) {
      expect(tldrYs[i]).toBeLessThan(tldrYs[i - 1]);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 章 5「今天该打的电话」兜底（修复 `42444bf`：付费解锁号码必须上纸）
// ═══════════════════════════════════════════════════════════
describe("章 5 todayCalls 缺失 ⇒ 从 channels 兜底（付费号码必须上纸）", () => {
  const UNLOCKED_PHONE = "13800138000";
  const UNLOCKED_MASKED = "138****8000";
  const AUTO_NOTE = "本节由渠道清单自动生成";

  /** 已解锁渠道：路由会把明文同时写进 `phoneMasked` 与 `phone`（T12 契约） */
  const unlockedChannel = {
    candidateId: "dealer_a",
    type: "dealer" as const,
    name: "已解锁B公司",
    model: "东方红 YTO-1204",
    unlocked: true,
    phone: UNLOCKED_PHONE,
    phoneMasked: UNLOCKED_PHONE,
    wechatMasked: "微信:********",
    emailMasked: "al***@corp.com",
  };

  it("① 兜底生效：无 todayCalls 时，已解锁明文上纸 + 出现自动生成说明 + 不再显示脱敏号", async () => {
    const { all } = await extractPdfText(
      await buildPdf({ ...V2_PAYLOAD, channels: [unlockedChannel] })
    );

    // 核心：用户花积分解锁的号码必须真的印在纸上
    expect(all, "付费解锁的明文号码未上纸（兜底没生效）").toContain(UNLOCKED_PHONE);
    expect(all).toContain(AUTO_NOTE);
    // 已解锁行不应再出现脱敏形态
    expect(all, "已解锁行仍显示脱敏号（覆盖逻辑漏了）").not.toContain(UNLOCKED_MASKED);
    // 也不该退化成「今日无可用电话」
    expect(all).not.toContain("今日无可用电话");
  });

  it("② 有 todayCalls 时不走兜底（分支没写反）", async () => {
    const { all } = await extractPdfText(
      await buildPdf({
        ...V2_PAYLOAD,
        strategy: {
          ...V2_PAYLOAD.strategy,
          todayCalls: [
            {
              equipment: "东方红 YTO-1204",
              // ⚠️ 必须是 `DEALER_ROLES` 里的枚举值（"采购" 不在枚举内，会被 derive 归一成「终端」）
              role: "进口商",
              candidateIds: ["dealer_a"],
              whyToday: "近 30 天有成交",
            },
          ],
        },
        channels: [unlockedChannel],
      })
    );

    expect(all, "有 todayCalls 却仍标注「自动生成」").not.toContain(AUTO_NOTE);
    // 命中渠道 ⇒ 显示渠道公司名（而不是「见附件 Excel」）
    expect(all).toContain("已解锁B公司");
    expect(all).toContain(UNLOCKED_PHONE);
  });

  it("③ 兜底排序：已解锁行必须排在未解锁行之前（不可按原数组顺序）", async () => {
    const lockedA = {
      candidateId: "dealer_l1",
      type: "dealer" as const,
      name: "未解锁A公司",
      phone: "13900139000",
      phoneMasked: "139****9000",
      wechatMasked: "微信:********",
      emailMasked: "a***@a.com",
    };
    const lockedC = {
      candidateId: "dealer_l2",
      type: "dealer" as const,
      name: "未解锁C公司",
      phone: "13700137000",
      phoneMasked: "137****7000",
      wechatMasked: "微信:********",
      emailMasked: "c***@c.com",
    };

    // 原数组顺序：未解锁 A → 已解锁 B → 未解锁 C
    const { all } = await extractPdfText(
      await buildPdf({ ...V2_PAYLOAD, channels: [lockedA, unlockedChannel, lockedC] })
    );

    const atB = all.indexOf(UNLOCKED_PHONE);
    const atA = all.indexOf("139****9000");
    const atC = all.indexOf("137****7000");

    expect(atB, "已解锁明文未上纸").toBeGreaterThan(-1);
    expect(atA, "未解锁 A 的脱敏号未上纸").toBeGreaterThan(-1);
    expect(atC, "未解锁 C 的脱敏号未上纸").toBeGreaterThan(-1);
    // 已解锁优先：B 必须在 A 与 C 之前
    expect(atB, "兜底未把已解锁行排到最前（排序缺失）").toBeLessThan(atA);
    expect(atB, "兜底未把已解锁行排到最前（排序缺失）").toBeLessThan(atC);
    // 三行都得在（不能只渲染 1 行）
    expect(all).toContain("未解锁A公司");
    expect(all).toContain("未解锁C公司");
    expect(all).toContain("已解锁B公司");
  });

  // `75fbab6` 把列头从「电话（已脱敏）」改成中性「电话」（en: Phone）。
  // 这是纯文案修复 ⇒ 没有断言守就会被人改回去，故锁死：**行内是明文号时，标签不许再声称已脱敏**。
  it("④ 列头中性化回归锁：行内是明文号时不得再挂「已脱敏」标签", async () => {
    const { all, runs } = await extractPdfText(
      await buildPdf({ ...V2_PAYLOAD, channels: [unlockedChannel] })
    );

    // 前提校验：确认走的确实是兜底表格（否则下面的「无标签」会退化成空断言）
    expect(all).toContain(UNLOCKED_PHONE);
    expect(all).toContain(AUTO_NOTE);

    const flat = runs.flat();
    expect(flat.some((r) => r.text.trim() === "电话"), "兜底表格缺少中性「电话」列头").toBe(true);
    expect(
      flat.some((r) => r.text.includes("已脱敏")),
      "章 5 仍出现「已脱敏」字样 —— 明文行与列头自相矛盾"
    ).toBe(false);
    expect(all).not.toContain("电话（已脱敏）");
  });

  it("⑤ en 版式同一口径：Phone 而不是 Phone (masked)", async () => {
    const { all } = await extractPdfText(
      await buildPdf({ ...V2_PAYLOAD, locale: "en", channels: [unlockedChannel] })
    );

    expect(all, "en 下章 5 兜底未生效").toContain(UNLOCKED_PHONE);
    expect(all, "en 列头仍声称 masked").not.toContain("Phone (masked)");
  });
});

describe("webStatus 降级语义（按 team-lead 口径两套期望，不断言「必须有 L3」）", () => {
  const BANNER_FRAGMENT = "本次策略未接入外部检索";
  const NO_REJECT_BANNER = "本次未生成否决建议";

  it("缺省 webStatus（视同 ok）⇒ 无顶部检索告警条", async () => {
    const { all } = await extractPdfText(await buildPdf(V2_PAYLOAD));
    expect(all).not.toContain(BANNER_FRAGMENT);
  });

  it("webStatus=partial ⇒ 顶部告警条 + webNote 第二行上纸；此时期望 L1/L2 即可，不断言 L3", async () => {
    // 章 3 的告警条只在「有最优去向但没给否决建议」时触发（无去向时会渲染「（未生成）」，不叠加错位告警）
    const payloadWithDest = {
      ...V2_PAYLOAD,
      strategy: {
        ...V2_PAYLOAD.strategy,
        bestDestinations: [
          {
            equipment: "东方红 YTO-1204",
            market: ["乌兹别克斯坦"],
            basis: "当地二手溢价高",
            rejected: [],
          },
        ],
      },
      webStatus: "partial" as const,
      webNote: "部分检索超时（3/5 成功）",
    };
    const { all } = await extractPdfText(await buildPdf(payloadWithDest));

    // 告警条（读者必须知道「数字仅基于站内数据」）
    expect(all).toContain(BANNER_FRAGMENT);
    expect(all).toContain("检索备注：部分检索超时（3/5 成功）");
    // 章 3 必须有显式降级告警，严禁静默通过（PRD §3.3）
    expect(all).toContain(NO_REJECT_BANNER);
    // ⚠️ 合规：非 ok 时**不得**要求出现 L3「禁入」档（prompt 层强制降级，无检索不给禁入结论）
    //    因此这里只断言告警条，不断言任何禁入/否决内容 ⇒ 顺序见注释
  });

  it("ok 但有最优去向却没给否决建议 ⇒ 同样显式告警（与检索状态解耦）", async () => {
    const { all } = await extractPdfText(
      await buildPdf({
        ...V2_PAYLOAD,
        strategy: {
          ...V2_PAYLOAD.strategy,
          bestDestinations: [
            { equipment: "东方红 YTO-1204", market: ["乌兹别克斯坦"], basis: "溢价高", rejected: [] },
          ],
        },
      })
    );
    expect(all).toContain(NO_REJECT_BANNER);
  });

  it("webStatus=error ⇒ 折叠为 disabled 文案上纸（error 不得静默消失）", async () => {
    const { all } = await extractPdfText(
      await buildPdf({ ...V2_PAYLOAD, webStatus: "error" })
    );
    expect(all).toContain(BANNER_FRAGMENT);
    expect(all).toContain("外部证据未接入（未启用）");
  });

  it("webStatus=timeout ⇒ 顶部告警条含该档 note（四档文案可区分）", async () => {
    const { all } = await extractPdfText(
      await buildPdf({ ...V2_PAYLOAD, webStatus: "timeout" })
    );
    expect(all).toContain(BANNER_FRAGMENT);
    expect(all).toContain("外部证据未接入（检索超时）");
  });
});

// ═══════════════════════════════════════════════════════════
// G16 老字段必须真上纸（改前「生成了却从不渲染」= 数据白丢）
// ═══════════════════════════════════════════════════════════
describe("G16 compliance / responsibility / actionChecklist 真上纸", () => {
  it("compliance 三字段逐条上纸（带标签前缀，可定位）", async () => {
    const { all } = await extractPdfText(await buildPdf(V2_PAYLOAD));
    expect(all).toContain("数据出境：境内数据不出境SENTINEL-DE");
    expect(all).toContain("跨境合规：跨境买家自担SENTINEL-CB");
    expect(all).toContain("补充提示：保留报关单SENTINEL-NT");
  });

  it("responsibility 三字段上纸（含免责声明）", async () => {
    const { all } = await extractPdfText(await buildPdf(V2_PAYLOAD));
    expect(all).toContain("卖家责任SENTINEL-SELLER");
    expect(all).toContain("平台边界SENTINEL-PLATFORM");
    expect(all).toContain("免责声明SENTINEL-DISC");
    // 免责声明在「[P1] 责任划分与免责」小节内
    expect(all.indexOf("[P1] 责任划分与免责")).toBeGreaterThan(-1);
    expect(all.indexOf("[P1] 责任划分与免责")).toBeLessThan(
      all.indexOf("免责声明SENTINEL-DISC")
    );
  });

  it("actionChecklist 上纸（步骤/动作/负责人/时限 四要素齐全）", async () => {
    const { all } = await extractPdfText(await buildPdf(V2_PAYLOAD));
    expect(all).toContain("打电话给老王SENTINEL-ACT");
    expect(all).toContain("老板");
    expect(all).toContain("今天");
    expect(all).toContain("[P1] 执行分工与时限");
  });

  it("scripts / listingChecklist 上纸（P1 区，改造前同样从未渲染）", async () => {
    const { all } = await extractPdfText(await buildPdf(V2_PAYLOAD));
    expect(all).toContain("[P1] 销售话术");
    expect(all).toContain("首次触达SENTINEL-SC");
    expect(all).toContain("您好有话术SENTINEL-LINE");
    expect(all).toContain("[P1] 上架清单");
    expect(all).toContain("补车况卡SENTINEL-LC");
  });

  it("三个老字段都为 null/缺省时不上纸、也不抛错（不留 `` null / undefined 字面量）", async () => {
    const bytes = await buildPdf({
      strategy: { tldr: V2_PAYLOAD.strategy.tldr },
      product: PRODUCT,
      channels: [],
      locale: "zh",
    });
    const { all } = await extractPdfText(bytes);
    expect(all).not.toContain("数据出境：");
    expect(all).not.toContain("[P1] 责任划分与免责");
    expect(all).not.toContain("[P1] 执行分工与时限");
    // 绝不把 null / undefined 画到纸上
    expect(all).not.toMatch(/\bnull\b/);
    expect(all).not.toMatch(/\bundefined\b/);
  });
});
