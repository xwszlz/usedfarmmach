/**
 * T13 补验（T11 Excel 三 Sheet）· 契约 / PII 门禁 / 多邮箱泄漏修复 / legacy 回归 / 残差锚点
 * ─────────────────────────────────────────────────────────
 * 快照：`629d201`（邮箱逐地址脱敏）+ `53e2806`（三 Sheet）。全部断言读**真实 xlsx 产物**（exceljs 回读单元格），
 * 不 mock 渲染层 —— 只有这样才能证明「单元格里到底写了什么」。
 *
 * 对应 team-lead 的 5 条验收：
 *   ① 三个 Sheet 的列数/表头**逐字**（Sheet1 14 / Sheet2 7 / Sheet3 5；半角括号不得变全角）
 *   ② v2 版式下 PII 门禁同样生效（未解锁明文零出现 / 已解锁出明文）
 *   ③ 🔴 多邮箱泄漏已修：`info@e-farm.com / sales@e-farm.com` ⇒ 两个地址都脱敏，`sales@` 零出现
 *   ④ `layout:1` 旧路径逐字回归（11 列 + 微信列仍在）
 *   ⑤ `axisResidual === true` 的锚点绝不进价格列，只能进「备注」且带 `未归类市场：` 前缀
 */
import { describe, it, expect } from "vitest";
import * as ExcelJS from "exceljs";
import { buildExcel } from "../export-excel";
import { maskEmail, maskPhone } from "@/lib/pii";
import type { ExcelDealerInput } from "../export-types";
import type { StrategyLlmResult } from "../prompt";

// ═══════════════════════════════════════════════════════════
// 工具：回读真实产物
// ═══════════════════════════════════════════════════════════
async function loadWb(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  return wb;
}

/** 第 1 行表头（含空列，按最长列宽取） */
function headersOf(ws: ExcelJS.Worksheet): string[] {
  const out: string[] = [];
  const row = ws.getRow(1);
  const width = Math.max(ws.columnCount, 0);
  for (let c = 1; c <= width; c += 1) {
    const v = row.getCell(c).value;
    out.push(v == null ? "" : String(v));
  }
  return out;
}

/** 整表所有单元格文本（用于「明文零出现」这类安全断言） */
function allCells(ws: ExcelJS.Worksheet): string[] {
  const out: string[] = [];
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      out.push(cell.value == null ? "" : String(cell.value));
    });
  });
  return out;
}

/** 某一数据行的前 N 个单元格文本（rowIndex 从 1 起，1 = 表头） */
function rowCells(ws: ExcelJS.Worksheet, rowIndex: number, count: number): string[] {
  const out: string[] = [];
  for (let c = 1; c <= count; c += 1) {
    const v = ws.getRow(rowIndex).getCell(c).value;
    out.push(v == null ? "" : String(v));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// 夹具
// ═══════════════════════════════════════════════════════════
const UNLOCKED_ID = "dealer_unlocked";
const LOCKED_ID = "dealer_locked";

const UNLOCKED_PHONE = "13800138000";
const LOCKED_PHONE = "13900139000";
const MULTI_EMAIL = "info@e-farm.com / sales@e-farm.com";
const UNLOCKED_WECHAT = "wx_unlocked_777";
const LOCKED_WECHAT = "wx_locked_888";
const UNLOCKED_CONTACT = "张三丰";
const LOCKED_CONTACT = "李四海";

function makeDealer(over: Partial<ExcelDealerInput> = {}): ExcelDealerInput {
  return {
    id: UNLOCKED_ID,
    partition: "intl",
    grade: "A",
    brands: ["claas"],
    models: ["AXION 850"],
    regions: ["德国"],
    nature: "授权经销",
    name: "解锁过的公司",
    phone: UNLOCKED_PHONE,
    wechat: UNLOCKED_WECHAT,
    email: MULTI_EMAIL,
    sourceUrl: "https://en.tec24.com/zh/contact",
    country: "德国",
    city: "汉诺威",
    contactPerson: UNLOCKED_CONTACT,
    role: "授权经销",
    priority: "A",
    suggestedPrice: "€42k",
    followStatus: "已联系",
    sourcePage: "公开渠道·en.tec24.com·2026-10-13",
    ...over,
  };
}

const LOCKED_DEALER = makeDealer({
  id: LOCKED_ID,
  name: "没解锁的公司",
  phone: LOCKED_PHONE,
  wechat: LOCKED_WECHAT,
  email: MULTI_EMAIL,
  contactPerson: LOCKED_CONTACT,
  country: "荷兰",
  city: "Drenthe",
});

// ═══════════════════════════════════════════════════════════
// ① 三 Sheet 的列数 / 表头逐字
// ═══════════════════════════════════════════════════════════
describe("① 三 Sheet 列数 / 表头逐字（半角括号不得变全角）", () => {
  const EXPECT_SHEET1 = [
    "序号",
    "方向",
    "公司名",
    "国家地区",
    "城市",
    "联系人",
    "电话",
    "邮箱",
    "网址",
    "主营品牌/业务",
    "建议报价参考",
    "优先级",
    "跟进状态",
    "来源页",
  ];
  const EXPECT_SHEET2 = [
    "机型",
    "国内(二手估)",
    "欧洲(二手净价)",
    "中亚(FOB建议)",
    "非洲中东澳新",
    "最优去向",
    "备注",
  ];
  const EXPECT_SHEET3 = ["#", "事项", "负责", "时限", "状态"];

  it("Sheet 名与顺序 = 渠道联系总表 → 机型价格速查 → 必办清单", async () => {
    const wb = await loadWb(await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", { layout: 2 }));
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["渠道联系总表", "机型价格速查", "必办清单"]);
  });

  it("Sheet1 = 14 列且表头逐字相等", async () => {
    const wb = await loadWb(await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", { layout: 2 }));
    const headers = headersOf(wb.worksheets[0]);
    expect(headers).toHaveLength(14);
    expect(headers).toEqual(EXPECT_SHEET1);
  });

  it("Sheet2 = 7 列且表头逐字相等（4 个价格列用半角括号）", async () => {
    const wb = await loadWb(await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", { layout: 2 }));
    const headers = headersOf(wb.worksheets[1]);
    expect(headers).toHaveLength(7);
    expect(headers).toEqual(EXPECT_SHEET2);
    // 半角括号硬约束：不得出现全角 `（）`
    for (const h of headers) expect(h).not.toMatch(/[（）]/);
  });

  it("Sheet3 = 5 列且表头逐字相等", async () => {
    const wb = await loadWb(await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", { layout: 2 }));
    const headers = headersOf(wb.worksheets[2]);
    expect(headers).toHaveLength(5);
    expect(headers).toEqual(EXPECT_SHEET3);
  });

  it("Sheet1 序号列排序后为全局连续 1..N（不是按原数组顺序）", async () => {
    const dealers = [
      makeDealer({ id: "d3", name: "丙", priority: "C", country: "德国", regions: ["德国"] }),
      makeDealer({ id: "d1", name: "甲", priority: "A", country: "德国", regions: ["德国"] }),
      makeDealer({ id: "d2", name: "乙", priority: "B", country: "德国", regions: ["德国"] }),
    ];
    const wb = await loadWb(await buildExcel(dealers, new Set([UNLOCKED_ID]), "zh", { layout: 2 }));
    const ws = wb.worksheets[0];
    const seq = [];
    for (let r = 2; r <= ws.rowCount; r += 1) seq.push(String(ws.getRow(r).getCell(1).value));
    expect(seq).toEqual(["1", "2", "3"]);
    // 优先级 A 在 B 在 C 之前
    expect(String(ws.getRow(2).getCell(12).value)).toBe("A");
    expect(String(ws.getRow(4).getCell(12).value)).toBe("C");
  });
});

// ═══════════════════════════════════════════════════════════
// ② v2 版式的 PII 门禁（与 legacy 同口径，不放宽）
// ═══════════════════════════════════════════════════════════
describe("② v2 版式 PII 门禁：已解锁明文 / 未解锁零泄露", () => {
  it("已解锁行 → 电话/邮箱/联系人明文；未解锁行 → 星号 + 已隐藏", async () => {
    const buf = await buildExcel([makeDealer(), LOCKED_DEALER], new Set([UNLOCKED_ID]), "zh", {
      layout: 2,
    });
    const wb = await loadWb(buf);
    const ws1 = wb.worksheets[0];
    const cells = allCells(ws1);
    const flat = cells.join("\u0001");

    // 已解锁：四位一体明文
    expect(cells).toContain(UNLOCKED_PHONE);
    expect(cells).toContain("info@e-farm.com / sales@e-farm.com");
    expect(cells).toContain(UNLOCKED_CONTACT);

    // 未解锁：脱敏 + 联系人已隐藏
    expect(cells).toContain(maskPhone(LOCKED_PHONE)); // 139****9000
    expect(cells).toContain("已隐藏");

    // 安全边界：未解锁的原始 PII 在**全部 3 个 Sheet 的所有单元格**里零出现
    const everySheet = wb.worksheets.flatMap((ws) => allCells(ws)).join("\u0001");
    expect(everySheet).not.toContain(LOCKED_PHONE);
    expect(everySheet).not.toContain(LOCKED_CONTACT);
    expect(everySheet).not.toContain(LOCKED_WECHAT);
    // 邮箱在 ③ 单独逐地址验；这里先保证「整串未解锁邮箱」不出现
    expect(flat).not.toContain(`info@e-farm.com / sales@e-farm.com"`);
  });

  it("微信列按 PRD §4.4 已移出主表 ⇒ 任何微信值（含已解锁）都不出现在 v2 产物里", async () => {
    const wb = await loadWb(
      await buildExcel([makeDealer(), LOCKED_DEALER], new Set([UNLOCKED_ID]), "zh", { layout: 2 })
    );
    const everyCell = wb.worksheets.flatMap((ws) => allCells(ws)).join("\u0001");
    const allHeaders = wb.worksheets.flatMap((ws) => headersOf(ws)).join("|");

    expect(allHeaders).not.toContain("微信");
    expect(everyCell).not.toContain(UNLOCKED_WECHAT);
    expect(everyCell).not.toContain(LOCKED_WECHAT);
    expect(everyCell).not.toContain("微信:********");
  });

  it("解锁集为空 ⇒ 全部脱敏，两个明文号码都不出现", async () => {
    const wb = await loadWb(await buildExcel([makeDealer(), LOCKED_DEALER], new Set(), "zh", { layout: 2 }));
    const everyCell = wb.worksheets.flatMap((ws) => allCells(ws)).join("\u0001");
    expect(everyCell).not.toContain(UNLOCKED_PHONE);
    expect(everyCell).not.toContain(LOCKED_PHONE);
    expect(everyCell).not.toContain(UNLOCKED_CONTACT);
    expect(everyCell).not.toContain(LOCKED_CONTACT);
  });
});

// ═══════════════════════════════════════════════════════════
// ③ 🔴 多邮箱逐地址脱敏（线上事故修复，独立复验）
// ═══════════════════════════════════════════════════════════
describe("③ 🔴 多邮箱泄漏修复：每个地址都脱敏，第二个地址不得裸奔", () => {
  it("非空转证明：旧实现（整体 `maskEmail`）确实会漏掉第二个地址", () => {
    // 这条不是为了测 maskEmail，而是钉住「为什么必须在 export-excel 层逐地址拆」：
    // maskEmail 只处理第一个 `@`，整体传多邮箱时**第二个地址的本地部分+域名全裸**。
    const legacyMasked = maskEmail(MULTI_EMAIL);
    expect(legacyMasked).toContain("sales@e-farm.com"); // ← 泄漏证据
    expect(legacyMasked).not.toContain("info@"); // 第一个地址确实脱了
  });

  it("v2（layout 2）：`info@ / sales@` ⇒ 两段 `in***@` + `sa***@`，`sales@` 零出现", async () => {
    const wb = await loadWb(await buildExcel([LOCKED_DEALER], new Set(), "zh", { layout: 2 }));
    const ws1 = wb.worksheets[0];
    const cells = allCells(ws1);
    const flat = cells.join("\u0001");

    // 两个地址都必须变成脱敏形态（域名保留，便于人工核对来源）
    expect(flat).toContain("in***@e-farm.com");
    expect(flat).toContain("sa***@e-farm.com");

    // 事故断言：第二个及以后地址的本地部分**绝不允许**明文出现
    expect(flat, "第二个邮箱 sales@ 明文泄漏").not.toContain("sales@");
    expect(flat).not.toContain("info@");
    expect(flat).not.toContain("sales@e-farm.com");
    expect(flat).not.toContain("info@e-farm.com");
  });

  it("legacy（layout 1）同样已修：多邮箱逐地址脱敏", async () => {
    const wb = await loadWb(await buildExcel([LOCKED_DEALER], new Set(), "zh"));
    const flat = allCells(wb.worksheets[0]).join("\u0001");
    expect(flat).toContain("in***@e-farm.com");
    expect(flat).toContain("sa***@e-farm.com");
    expect(flat).not.toContain("sales@");
    expect(flat).not.toContain("info@e-farm.com");
  });

  it("三种分隔符（/ 、 ; 、逗号）都要拆开逐地址脱敏", async () => {
    const variants = [
      "aa@x.com; bb@y.com",
      "aa@x.com, bb@y.com",
      "aa@x.com / bb@y.com",
      "aa@x.com，bb@y.com",
    ];
    for (const email of variants) {
      const wb = await loadWb(
        await buildExcel([makeDealer({ id: LOCKED_ID, email })], new Set(), "zh", { layout: 2 })
      );
      const flat = allCells(wb.worksheets[0]).join("\u0001");
      expect(flat, `分隔符场景失败：${email}`).toContain("aa***@x.com");
      expect(flat, `分隔符场景失败：${email}`).toContain("bb***@y.com");
      expect(flat, `分隔符场景失败：${email}`).not.toContain("bb@y.com");
    }
  });

  it("单邮箱输出与 `maskEmail` 逐字相同（改动不含单地址回归）", async () => {
    for (const layout of [1, 2] as const) {
      const wb = await loadWb(
        await buildExcel([makeDealer({ id: LOCKED_ID, email: "info@e-farm.com" })], new Set(), "zh", layout === 2 ? { layout: 2 } : undefined)
      );
      const flat = allCells(wb.worksheets[0]).join("\u0001");
      expect(flat).toContain("in***@e-farm.com");
      expect(flat).not.toContain("info@e-farm.com");
    }
  });

  it("已解锁行多邮箱保持原样（明文，两地址都在且顺序不变）", async () => {
    const wb = await loadWb(await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", { layout: 2 }));
    const cells = allCells(wb.worksheets[0]);
    expect(cells).toContain("info@e-farm.com / sales@e-farm.com");
  });

  it("无邮箱 ⇒ `—`（v2）/ 空串（legacy），不产出 `***@` 噪声", async () => {
    const wb2 = await loadWb(
      await buildExcel([makeDealer({ id: LOCKED_ID, email: null })], new Set(), "zh", { layout: 2 })
    );
    expect(allCells(wb2.worksheets[0])).not.toContain("***@");
    const wb1 = await loadWb(
      await buildExcel([makeDealer({ id: LOCKED_ID, email: null })], new Set(), "zh")
    );
    expect(allCells(wb1.worksheets[0])).not.toContain("***@");
  });
});

// ═══════════════════════════════════════════════════════════
// ④ layout:1 legacy 逐字回归
// ═══════════════════════════════════════════════════════════
describe("④ layout:1 旧路径逐字回归（11 列 + 微信列仍在）", () => {
  it("缺省（不传 opts）与显式 layout:1 都产出 11 列且表头一致", async () => {
    const expectLegacy = [
      "分区",
      "分级",
      "品牌",
      "机型组",
      "地区",
      "性质",
      "名称",
      "电话",
      "微信",
      "邮箱",
      "来源链接",
    ];
    const a = await loadWb(await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh"));
    const b = await loadWb(await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", { layout: 1 }));

    expect(a.worksheets).toHaveLength(1);
    expect(headersOf(a.worksheets[0])).toEqual(expectLegacy);
    expect(headersOf(b.worksheets[0])).toEqual(expectLegacy);
    expect(a.worksheets[0].name).toBe("经销商联系表");
  });

  it("微信列仍在：已解锁明文 / 未解锁 `微信:********`", async () => {
    const wb = await loadWb(
      await buildExcel([makeDealer(), LOCKED_DEALER], new Set([UNLOCKED_ID]), "zh", { layout: 1 })
    );
    const cells = allCells(wb.worksheets[0]);
    expect(cells).toContain(UNLOCKED_WECHAT);
    expect(cells).toContain("微信:********");
    expect(cells).not.toContain(LOCKED_WECHAT);
  });

  it("layout 传非法值（3 / undefined）⇒ 一律回落 legacy，不静默变成三 Sheet", async () => {
    for (const layout of [3, 0, undefined] as any[]) {
      const wb = await loadWb(await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", { layout }));
      expect(wb.worksheets).toHaveLength(1);
      expect(headersOf(wb.worksheets[0])).toHaveLength(11);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// ⑤ axisResidual 锚点绝不进价格列
// ═══════════════════════════════════════════════════════════
describe("⑤ axisResidual 锚点只能进「备注」，绝不进四个价格列", () => {
  const EQUIP = "东方红 YTO-1204";

  const strategyWithResidual: StrategyLlmResult = {
    tldr: [{ equipment: EQUIP, bestChannel: "塔什干二手商", expectedPriceCny: "¥98万", why: "溢价高" }],
    marketAnchors: [
      {
        equipment: EQUIP,
        // `北美` 不是五轴枚举 ⇒ 归桶失败 ⇒ axisResidual = true，但 axis 会被兜底成「非洲中东澳新」
        axis: "北美" as any,
        market: "美国",
        priceText: "$48k",
        priceCny: 48000,
        basisType: "挂牌" as any,
      },
      {
        equipment: EQUIP,
        axis: "欧洲" as any,
        market: "德国",
        priceText: "€42k",
        priceCny: 42000,
        basisType: "挂牌" as any,
      },
    ],
  };

  it("`$48k`（北美/美国，未归轴）不出现在任何价格列，只出现在备注且带 `未归类市场：` 前缀", async () => {
    const wb = await loadWb(
      await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", {
        layout: 2,
        strategy: strategyWithResidual,
      })
    );
    const ws2 = wb.worksheets[1];

    // 找到机型行（跳过表头与可能的其他行）
    let rowIndex = -1;
    for (let r = 2; r <= ws2.rowCount; r += 1) {
      if (String(ws2.getRow(r).getCell(1).value ?? "").trim() === EQUIP) {
        rowIndex = r;
        break;
      }
    }
    expect(rowIndex, `Sheet2 找不到机型行「${EQUIP}」`).toBeGreaterThan(0);

    const cells = rowCells(ws2, rowIndex, 7);
    const [eq, cn, eu, ca, africaMe, best, note] = cells;

    expect(eq).toBe(EQUIP);
    // 真归桶的「欧洲」锚点正常进列
    expect(eu).toContain("€42k");
    // 🔴 残差锚点绝不允许出现在任何价格列
    for (const [label, val] of [
      ["国内(二手估)", cn],
      ["欧洲(二手净价)", eu],
      ["中亚(FOB建议)", ca],
      ["非洲中东澳新", africaMe],
    ] as const) {
      expect(val, `残差锚点 $48k 混进了「${label}」列`).not.toContain("$48k");
      expect(val, `残差锚点 $48k 混进了「${label}」列`).not.toContain("48");
    }
    // 只允许进备注，且必须带前缀（否则读者会以为它属于某个真轴）
    expect(note).toContain("未归类市场：");
    expect(note).toContain("$48k");
    expect(note).toContain("美国");
    expect(note.indexOf("未归类市场：")).toBeLessThan(note.indexOf("$48k"));
    // 备注不是价格列（防止有人把备注当第 5 个价格列读）
    expect(best === "$48k").toBe(false);
  });

  it("Sheet2 末行固定是「汇率基准」行（不是数据行）", async () => {
    const wb = await loadWb(
      await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", {
        layout: 2,
        strategy: strategyWithResidual,
      })
    );
    const ws2 = wb.worksheets[1];
    const lastRow = ws2.getRow(ws2.rowCount);
    expect(String(lastRow.getCell(1).value)).toBe("汇率基准");
    // B 列是服务端汇率常量文案，且含本次实际出现的币种（EUR/USD）
    const fx = String(lastRow.getCell(2).value ?? "");
    expect(fx).toMatch(/1 EUR≈/);
    expect(fx).toMatch(/1 USD≈/);
  });

  it("webStatus 非 ok ⇒ Sheet2 备注带「外部检索未接入」；ok/缺省不带", async () => {
    const withDegraded = await loadWb(
      await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", {
        layout: 2,
        strategy: strategyWithResidual,
        webStatus: "partial",
      })
    );
    expect(allCells(withDegraded.worksheets[1]).join("\u0001")).toContain("外部检索未接入");

    const normal = await loadWb(
      await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh", {
        layout: 2,
        strategy: strategyWithResidual,
      })
    );
    expect(allCells(normal.worksheets[1]).join("\u0001")).not.toContain("外部检索未接入");
  });
});
