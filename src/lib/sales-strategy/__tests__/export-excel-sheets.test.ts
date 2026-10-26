/**
 * 单元测试：`export-excel.ts` 的 **layout 2（三 Sheet）** 版式（T11）
 *
 * 对照规格：PRD §4.0（表级格式）/ §4.1（Sheet1 14 列）/ §4.2（Sheet2 7 列 + 汇率基准行）
 *           / §4.3（Sheet3 5 列）；断言编排对应 PRD §7 的 C1 / C2 / C3 / C3'。
 *
 * 覆盖点：
 *   C1  Sheet 名与顺序逐字一致；
 *   C2  Sheet1 14 列表头逐字相等，且**不含「微信」**（PRD §4.4 已移出主表）；
 *   表级 首行冻结 + autoFilter + 序号/电话 `numFmt="@"` + 仅 S 行浅红底；
 *   C3  PII 门禁：未解锁行的「电话/邮箱/联系人」全部脱敏，且整行搜不到 11 位明文手机号；
 *   C3' Sheet2 7 列逐字 + 末行汇率基准（按币种裁剪）；Sheet3 5 列且 ≥3 行、含「老板」；
 *   降级 无 strategy 时三 Sheet 仍齐全，Sheet2 价格列全 `—` 且备注写「价格锚点未生成」；
 *   legacy `layout: 1`（含缺省）行为不变：单 Sheet 11 列。
 */
import { describe, it, expect } from "vitest";
import * as ExcelJS from "exceljs";
import { buildExcel } from "../export-excel";
import type { ExcelDealerInput } from "../export-types";
import type { StrategyLlmResult } from "../prompt";
import { maskEmail, maskPhone } from "@/lib/pii";

// ── 测试数据 ─────────────────────────────────────────────────
const UNLOCKED_ID = "d_cn_unlocked";
const LOCKED_EU_ID = "d_de_locked";
const LOCKED_CIS_ID = "d_uz_locked";

const PLAIN_PHONE = "13800138000";
const PLAIN_EMAIL = "alpha@corp.com";
const LOCKED_CN_PHONE = "13700137000";
const LOCKED_CN_EMAIL = "beta@corp.com";

function dealer(over: Partial<ExcelDealerInput> & { id: string }): ExcelDealerInput {
  return {
    partition: "intl",
    grade: null,
    brands: [],
    models: [],
    regions: [],
    nature: null,
    name: null,
    phone: null,
    wechat: null,
    email: null,
    sourceUrl: null,
    ...over,
  };
}

/** 境内、已解锁、grade=A（无 priority）→ 优先级应为 A */
const CN_UNLOCKED = dealer({
  id: UNLOCKED_ID,
  partition: "cn",
  grade: "A",
  name: "河北农机服务有限公司",
  brands: ["东方红", "雷沃"],
  nature: "授权经销",
  regions: ["河北"],
  country: "中国",
  city: "石家庄",
  contactPerson: "张三",
  phone: PLAIN_PHONE,
  wechat: "wx_plain_777",
  email: PLAIN_EMAIL,
  sourceUrl: "https://www.hebei-agri.cn/contact?from=excel#top",
  suggestedPrice: "¥45万 FOB",
  followStatus: "已联系",
  sourcePage: "w1_europe.md ①官网imprint",
});

/** 欧洲、未解锁、priority=S（人工/策略指定）→ 整行浅红底 */
const EU_LOCKED = dealer({
  id: LOCKED_EU_ID,
  partition: "intl",
  grade: "B",
  priority: "S",
  name: "E-FARM GmbH",
  brands: [],
  nature: null,
  regions: ["德国"],
  country: "德国",
  city: "Hamburg",
  contactPerson: "Sebastian Seniszyn",
  phone: "+49 40 5729 0308/+49 15888 279050",
  wechat: "wx_locked_eu",
  email: "info@e-farm.com / sales@e-farm.com",
  sourceUrl: "https://www.e-farm.com/dealer",
});

/** 中亚、未解锁、无 country（靠 regions 正则兜底）、无名称/联系人 */
const CIS_LOCKED = dealer({
  id: LOCKED_CIS_ID,
  partition: "intl",
  grade: null,
  name: null,
  brands: ["CLAAS"],
  nature: "二手商",
  regions: ["乌兹别克斯坦"],
  phone: LOCKED_CN_PHONE,
  wechat: "wx_locked_uz",
  email: LOCKED_CN_EMAIL,
  contactPerson: null,
});

const DEALERS: ExcelDealerInput[] = [CIS_LOCKED, EU_LOCKED, CN_UNLOCKED];
const UNLOCKED = new Set<string>([UNLOCKED_ID]);

const E1 = "Kuhn VBP3165 2022";

/** 含 4 个价格轴 + 1 条「无法归轴」的北美锚点（必须落备注） */
const STRATEGY = {
  summary: "先出清库存再谈高价",
  tldr: [
    { equipment: E1, bestChannel: "国内+中亚并行", expectedPriceCny: "50-70万", why: "国内残值最高" },
  ],
  keyInsight: { headline: "国内比欧洲高出约 20%", body: "欧洲二手净价被补贴压低" },
  marketAnchors: [
    { equipment: E1, axis: "国内", market: "国内", priceText: "50-70万", basisType: "国内二手估" },
    { equipment: E1, axis: "欧洲", market: "德国", priceText: "€32.8k", basisType: "欧洲二手净价" },
    { equipment: E1, axis: "中亚", market: "乌兹别克", priceText: "€45-55k", basisType: "FOB建议" },
    { equipment: E1, axis: "新机对标", market: "国内新机", priceText: "98-130万", basisType: "新机对标" },
    // ⚠️ 北美不在 5 轴内 → axisResidual = true → 只能进备注
    { equipment: E1, axis: "北美", market: "美国", priceText: "$48k", basisType: "推算" },
  ],
  bestDestinations: [{ equipment: E1, market: ["乌兹别克", "国内"], basis: "FOB 利润最高" }],
  marketRanking: [{ rank: 1, market: "乌兹别克", stars: 4 }],
  complianceTasks: [{ item: "确认实际采购成本（决定利润口径）", owner: "老板", deadline: "立刻" }],
} as unknown as StrategyLlmResult;

// ── 工具 ─────────────────────────────────────────────────────
async function load(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  return wb;
}

function cellText(cell: ExcelJS.Cell): string {
  return cell.value == null ? "" : String(cell.value);
}

/** 取整行文本（1..n 列） */
function rowTexts(ws: ExcelJS.Worksheet, rowNumber: number, n: number): string[] {
  const row = ws.getRow(rowNumber);
  const out: string[] = [];
  for (let c = 1; c <= n; c += 1) out.push(cellText(row.getCell(c)));
  return out;
}

function headerTexts(ws: ExcelJS.Worksheet, n: number): string[] {
  return rowTexts(ws, 1, n);
}

/** 按公司名找 Sheet1 的行号（找不到返回 -1） */
function findRowByCompany(ws: ExcelJS.Worksheet, company: string, n: number): number {
  for (let r = 2; r <= ws.rowCount; r += 1) {
    if (rowTexts(ws, r, n)[2] === company) return r;
  }
  return -1;
}

const SHEET1 = ["序号", "方向", "公司名", "国家地区", "城市", "联系人", "电话", "邮箱", "网址", "主营品牌/业务", "建议报价参考", "优先级", "跟进状态", "来源页"];
const SHEET2 = ["机型", "国内(二手估)", "欧洲(二手净价)", "中亚(FOB建议)", "非洲中东澳新", "最优去向", "备注"];
const SHEET3 = ["#", "事项", "负责", "时限", "状态"];

// ─────────────────────────────────────────────────────────────
// C1 · Sheet 名与顺序
// ─────────────────────────────────────────────────────────────
describe("C1 Sheet 名与顺序", () => {
  it("三 Sheet 名深等于 [渠道联系总表, 机型价格速查, 必办清单]", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["渠道联系总表", "机型价格速查", "必办清单"]);
  });

  it("英文站 Sheet 名为英文三件套", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "en", { layout: 2, strategy: STRATEGY }));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Dealer Contacts",
      "Price Quick Reference",
      "Action Checklist",
    ]);
  });
});

// ─────────────────────────────────────────────────────────────
// C2 · Sheet1 14 列表头逐字
// ─────────────────────────────────────────────────────────────
describe("C2 Sheet1 表头", () => {
  it("14 列表头逐字相等（半角括号，无空格）", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    expect(headerTexts(ws, 14)).toEqual(SHEET1);
    expect(headerTexts(ws, 15)[14]).toBe(""); // 只到第 14 列，没有第 15 列
  });

  it("主表不含「微信」列（PRD §4.4：微信移出 Excel 主表）", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    const headers = headerTexts(ws, 14);
    expect(headers).not.toContain("微信");
    expect(headers.join("|")).not.toContain("微信");
    // 全表任何单元格都不该出现微信占位（主表已无此列，避免残留）
    const flat: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => flat.push(cellText(c))));
    expect(flat.join("\u0001")).not.toContain("微信:********");
  });
});

// ─────────────────────────────────────────────────────────────
// 表级格式（PRD §4.0）
// ─────────────────────────────────────────────────────────────
describe("表级格式", () => {
  it("三个 Sheet 均首行冻结 + autoFilter + 表头加粗浅灰底", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    for (const [name, cols] of [
      ["渠道联系总表", 14],
      ["机型价格速查", 7],
      ["必办清单", 5],
    ] as const) {
      const ws = wb.getWorksheet(name)!;
      const views: any = ws.views;
      expect(Array.isArray(views) && views.length > 0).toBe(true);
      expect(views[0].state).toBe("frozen");
      expect(views[0].ySplit).toBe(1);
      expect(ws.autoFilter).toBeTruthy();

      const head = ws.getRow(1);
      expect(head.getCell(1).font?.bold).toBe(true);
      const fill: any = head.getCell(1).fill;
      expect(fill?.fgColor?.argb).toBe("FFEEEEEE");
      expect(headerTexts(ws, cols).filter(Boolean)).toHaveLength(cols);
    }
  });

  it("序号 / 电话列 numFmt === \"@\"（防号码变科学计数法）", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    expect(ws.getColumn(1).numFmt).toBe("@");
    expect(ws.getColumn(7).numFmt).toBe("@");
    // 数据格也必须带文本格式（列样式在部分读取器里不回落，逐格写才稳）
    expect(ws.getRow(2).getCell(1).numFmt).toBe("@");
    expect(ws.getRow(2).getCell(7).numFmt).toBe("@");
  });

  it("仅优先级 = S 的整行浅红底，其他档不着色", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    const sFill = "FFFFE5E5";
    let sRows = 0;
    for (let r = 2; r <= ws.rowCount; r += 1) {
      const cells = rowTexts(ws, r, 14);
      const isS = cells[11] === "S";
      if (isS) sRows += 1;
      for (let c = 1; c <= 14; c += 1) {
        const fill: any = ws.getRow(r).getCell(c).fill;
        const argb = fill?.fgColor?.argb;
        if (isS) expect(argb).toBe(sFill);
        else expect(argb).not.toBe(sFill);
      }
    }
    expect(sRows).toBe(1); // 样本里只有 E-FARM 是 S
  });

  it("空值统一 —（全角破折号），不用空串", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    const uzRow = findRowByCompany(ws, "未命名渠道 d_uz_l", 14);
    expect(uzRow).toBeGreaterThan(1);
    const cells = rowTexts(ws, uzRow, 14);
    expect(cells[3]).toBe("—"); // 国家地区（无 country 且 date 未解析）
    expect(cells[4]).toBe("—"); // 城市
    expect(cells[5]).toBe("—"); // 联系人（本来就没有 → 不谎报「已隐藏」）
    expect(cells[8]).toBe("—"); // 网址（无 sourceUrl）
    expect(cells[10]).toBe("—"); // 建议报价参考
    expect(cells[13]).toBe("—"); // 来源页
    expect(cells).not.toContain(""); // 没有空串
  });
});

// ─────────────────────────────────────────────────────────────
// C3 · PII 门禁（新列不越权）
// ─────────────────────────────────────────────────────────────
describe("C3 PII 门禁", () => {
  it("已解锁行：电话/邮箱/联系人均为明文", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    const r = findRowByCompany(ws, "河北农机服务有限公司", 14);
    const cells = rowTexts(ws, r, 14);
    expect(cells[5]).toBe("张三");
    expect(cells[6]).toBe(PLAIN_PHONE);
    expect(cells[7]).toBe(PLAIN_EMAIL);
  });

  it("未解锁行：电话=maskPhone、邮箱=maskEmail、联系人=已隐藏", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;

    // 欧洲行：多号 → 「；」拼接；邮箱多值 → 逐个脱敏后以「 / 」拼接（防第二个地址明文泄漏）
    const eu = rowTexts(ws, findRowByCompany(ws, "E-FARM GmbH", 14), 14);
    expect(eu[5]).toBe("已隐藏"); // 联系人纳入同一门禁
    expect(eu[6]).toBe(maskPhone("+49 40 5729 0308/+49 15888 279050"));
    expect(eu[7]).toBe(`${maskEmail("info@e-farm.com")} / ${maskEmail("sales@e-farm.com")}`);
    // 关键：第二个地址的本地部分不得明文出现
    expect(eu[7]).not.toContain("sales@");

    // 中亚行
    const uz = rowTexts(ws, findRowByCompany(ws, "未命名渠道 d_uz_l", 14), 14);
    expect(uz[6]).toBe(maskPhone(LOCKED_CN_PHONE));
    expect(uz[7]).toBe(maskEmail(LOCKED_CN_EMAIL));
  });

  it("未解锁行逐格 + 全文双断言：搜不到 11 位明文手机号 / 原始邮箱", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;

    for (const company of ["E-FARM GmbH", "未命名渠道 d_uz_l"]) {
      const r = findRowByCompany(ws, company, 14);
      for (const text of rowTexts(ws, r, 14)) {
        expect(text).not.toMatch(/\d{11}/);
      }
    }

    const flat: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => flat.push(cellText(c))));
    const joined = flat.join("\u0001");
    expect(joined).not.toContain(LOCKED_CN_PHONE);
    expect(joined).not.toContain(LOCKED_CN_EMAIL);
    expect(joined).not.toContain("info@e-farm.com");
    expect(joined).not.toContain("sales@e-farm.com");
    expect(joined).not.toContain("Sebastian Seniszyn"); // 联系人同门禁
  });

  it("微信不出现在任何 Sheet（主表已移除，避免占位泄漏解锁状态）", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const flat: string[] = [];
    for (const ws of wb.worksheets) {
      ws.eachRow((row) => row.eachCell((c) => flat.push(cellText(c))));
    }
    expect(flat.join("\u0001")).not.toContain("wx_plain_777");
  });
});

// ─────────────────────────────────────────────────────────────
// 优先级语义（S 不得被自动外推）
// ─────────────────────────────────────────────────────────────
describe("优先级 S 只在 priority 显式指定时出现", () => {
  it("优先级取值 ⊆ {S,A,B,C}；grade=A 且无 priority 的行必须是 A", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    const values: string[] = [];
    for (let r = 2; r <= ws.rowCount; r += 1) values.push(rowTexts(ws, r, 14)[11]);
    expect(values.every((v) => ["S", "A", "B", "C"].includes(v))).toBe(true);
    // grade=A 的行没有 priority ⇒ A（绝不外推成 S）
    expect(values).toContain("A");
    // S 仅来自 EU 行的 priority="S"
    expect(values.filter((v) => v === "S")).toHaveLength(1);
    const eu = rowTexts(ws, findRowByCompany(ws, "E-FARM GmbH", 14), 14);
    expect(eu[11]).toBe("S");
  });
});

// ─────────────────────────────────────────────────────────────
// Sheet1 派生列（方向 / 序号 / 网址 / 主营）
// ─────────────────────────────────────────────────────────────
describe("Sheet1 派生列", () => {
  it("方向按 5 桶分组，序号全局连续 1..N", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    const rows = [];
    for (let r = 2; r <= ws.rowCount; r += 1) rows.push(rowTexts(ws, r, 14));

    expect(rows.map((c) => c[0])).toEqual(["1", "2", "3"]);
    // 方向分组序：中国国内 → 欧洲 → 中亚独联体（CIS 靠 regions 正则兜底命中）
    expect(rows.map((c) => c[1])).toEqual(["中国国内", "欧洲", "中亚独联体"]);
  });

  it("网址去协议取域名；主营 = brands + ' · ' + nature", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    const cn = rowTexts(ws, findRowByCompany(ws, "河北农机服务有限公司", 14), 14);
    expect(cn[8]).toBe("hebei-agri.cn");
    expect(cn[9]).toBe("东方红 / 雷沃 · 授权经销");
    expect(cn[12]).toBe("已联系");

    const eu = rowTexts(ws, findRowByCompany(ws, "E-FARM GmbH", 14), 14);
    expect(eu[8]).toBe("e-farm.com");
    expect(eu[9]).toBe("—"); // brands 与 nature 皆空
  });

  it("公司名兜底为 `未命名渠道 <id 前 6 位>`", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("渠道联系总表")!;
    expect(findRowByCompany(ws, "未命名渠道 d_uz_l", 14)).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────
// C3' · Sheet2 机型价格速查
// ─────────────────────────────────────────────────────────────
describe("C3' Sheet2 机型价格速查", () => {
  it("7 列表头逐字相等（半角括号）", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("机型价格速查")!;
    expect(headerTexts(ws, 7)).toEqual(SHEET2);
  });

  it("价格四列按 axis 归桶，新机对标下沉备注", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("机型价格速查")!;
    const row = rowTexts(ws, 2, 7);
    expect(row[0]).toBe(E1);
    expect(row[1]).toBe("50-70万"); // 国内(二手估)
    expect(row[2]).toBe("€32.8k"); // 欧洲(二手净价)
    expect(row[3]).toBe("€45-55k"); // 中亚(FOB建议)
    expect(row[4]).toBe("—"); // 非洲中东澳新：唯一的该轴锚点是残差，不得进价格列
    expect(row[5]).toBe("乌兹别克"); // 最优去向 = bestDestinations.market[0]
    expect(row[6]).toContain("新机对标 98-130万"); // 新机对标 → 备注
    expect(row[6]).toContain("国内比欧洲高出约 20%"); // keyInsight.headline
  });

  it("🔴 axisResidual 的锚点绝不进任何价格列，只进备注（前缀「未归类市场：」）", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("机型价格速查")!;
    const row = rowTexts(ws, 2, 7);
    // 价格四列都不含美国价
    for (let c = 1; c <= 4; c += 1) expect(row[c]).not.toContain("$48k");
    // 备注里有，且带前缀
    expect(row[6]).toContain("未归类市场：");
    expect(row[6]).toContain("美国 $48k");
  });

  it("末行 = 汇率基准，B 列按实际币种裁剪（无 JPY 则不带 JPY）", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("机型价格速查")!;
    const last = rowTexts(ws, ws.rowCount, 7);
    expect(last[0]).toBe("汇率基准");
    expect(last[1]).toMatch(/1 EUR≈7\.8元/);
    expect(last[1]).toContain("USD");
    expect(last[1]).not.toContain("JPY"); // 策略里没有日元价 → 裁剪掉
    // 其余列留空
    expect(last.slice(2)).toEqual(["", "", "", "", ""]);
  });

  it("webStatus 非 ok → 备注追加「外部检索未接入」", async () => {
    const wb = await load(
      await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY, webStatus: "timeout" })
    );
    const ws = wb.getWorksheet("机型价格速查")!;
    expect(rowTexts(ws, 2, 7)[6]).toContain("外部检索未接入");
  });

  it("降级：无 strategy → 价格四列全 —，备注写「价格锚点未生成」，Sheet 不隐藏", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2 }));
    const ws = wb.getWorksheet("机型价格速查")!;
    expect(ws).toBeTruthy();
    const row = rowTexts(ws, 2, 7);
    expect(row[0]).toBe("本批机型");
    expect(row.slice(1, 5)).toEqual(["—", "—", "—", "—"]);
    expect(row[5]).toBe("—");
    expect(row[6]).toContain("价格锚点未生成");
  });
});

// ─────────────────────────────────────────────────────────────
// C3' · Sheet3 必办清单
// ─────────────────────────────────────────────────────────────
describe("C3' Sheet3 必办清单", () => {
  it("5 列表头逐字相等，行数 ≥3 且含「负责 = 老板」", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2, strategy: STRATEGY }));
    const ws = wb.getWorksheet("必办清单")!;
    expect(headerTexts(ws, 5)).toEqual(SHEET3);

    const body: string[][] = [];
    for (let r = 2; r <= ws.rowCount; r += 1) body.push(rowTexts(ws, r, 5));
    expect(body.length).toBeGreaterThanOrEqual(3);
    expect(body.some((row) => row[2] === "老板")).toBe(true);
    // # 从 1 连续派生；状态缺省「未开始」
    expect(body[0][0]).toBe("1");
    expect(body.map((r) => r[4]).every((s) => ["未开始", "进行中", "已完成"].includes(s))).toBe(true);
    // 有原字段 → 不出现「（自动转换）」标记行
    expect(body.some((row) => row[0] === "（自动转换）")).toBe(false);
  });

  it("降级：无 strategy → 3 行兜底 + 表尾「（自动转换）」标记行", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh", { layout: 2 }));
    const ws = wb.getWorksheet("必办清单")!;
    const body: string[][] = [];
    for (let r = 2; r <= ws.rowCount; r += 1) body.push(rowTexts(ws, r, 5));
    expect(body.length).toBeGreaterThanOrEqual(4); // 3 条兜底 + 1 条标记
    expect(body[body.length - 1][0]).toBe("（自动转换）");
    expect(body.some((row) => row[2] === "老板")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// legacy 版式不变
// ─────────────────────────────────────────────────────────────
describe("layout 1（legacy）行为不变", () => {
  it("缺省 layout → 单 Sheet 11 列，表头与微信占位与 HEAD 一致", async () => {
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh"));
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0].name).toBe("经销商联系表");
    const ws = wb.worksheets[0];
    expect(headerTexts(ws, 11)).toEqual([
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
    ]);
    // legacy 语义：已解锁行写明文微信，未解锁行仍写「微信:********」占位
    const flat: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => flat.push(cellText(c))));
    expect(flat).toContain("wx_plain_777"); // 已解锁 → 明文
    expect(flat.filter((v) => v === "微信:********")).toHaveLength(2); // 两条未解锁行 → 占位
    expect(flat).not.toContain("wx_locked_eu"); // 未解锁的原始微信号绝不出现
    expect(flat).not.toContain("wx_locked_uz");
  });

  it("显式 layout:1 与缺省等价；空数组只有表头", async () => {
    const a = await load(await buildExcel([], new Set(), "zh", { layout: 1 }));
    expect(a.worksheets).toHaveLength(1);
    expect(a.worksheets[0].rowCount).toBe(1);
    const b = await load(await buildExcel([], new Set(), "en"));
    expect(b.worksheets[0].name).toBe("Dealer Contacts");
  });

  it("🔴 回归（T11 安全修复）：legacy 多邮箱未解锁行也必须逐地址脱敏", async () => {
    // 修复前 `maskEmail("info@e-farm.com / sales@e-farm.com")` 只脱第一个 `@`，
    // 产出 "in***@e-farm.com / sales@e-farm.com" —— 第二个地址完全明文。
    const wb = await load(await buildExcel(DEALERS, UNLOCKED, "zh"));
    const ws = wb.worksheets[0];
    const cellTexts: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => cellTexts.push(cellText(c))));
    const joined = cellTexts.join("\u0001");

    // 必须等于「逐地址脱敏后以 ` / ` 连接」
    expect(cellTexts).toContain(`${maskEmail("info@e-farm.com")} / ${maskEmail("sales@e-farm.com")}`);
    // 第二个地址的本地部分 + 域名都不得明文出现
    expect(joined).not.toContain("sales@e-farm.com");
    expect(joined).not.toContain("sales@");
    // 单邮箱行的输出与修复前逐字相同（不许顺手改了强约束路径）
    expect(cellTexts).toContain(maskEmail(LOCKED_CN_EMAIL));
  });

  it("legacy 空邮箱仍为空串（不改单元格口径）", async () => {
    const wb = await load(
      await buildExcel([dealer({ id: "d_empty", phone: null, email: null, wechat: null })], new Set(), "zh")
    );
    const ws = wb.worksheets[0];
    expect(cellText(ws.getRow(2).getCell(10))).toBe(""); // 邮箱列 = 空串，不是 `—`
  });
});
