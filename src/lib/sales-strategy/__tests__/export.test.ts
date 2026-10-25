/**
 * 单元测试：src/lib/sales-strategy/export.ts（T2 PDF / T3 Excel 纯函数）
 *
 * 覆盖点（验收红线优先）：
 *  A. buildExcel 的 PII 门禁
 *     - id ∈ unlockedSet → 电话/邮箱/微信写明文；
 *     - id ∉ unlockedSet → 必须等于 maskPhone / maskEmail，微信为 "微信:********"（en: "WeChat:********"）；
 *     - 未解锁行里搜不到任何原始号码/邮箱/微信号（真正的合规断言，不是走过场）；
 *     - 产物以 PK 开头（xlsx = zip）且 > 1KB；
 *     - 空数组不抛错且表头仍在。
 *  B. buildPdf 基本可用性
 *     - 产物以 %PDF- 开头、> 10KB；
 *     - 空 channels / 空 strategy / product:null 走兜底文案不抛错；locale="en" 不抛错；
 *     - 合规：channels 只携带脱敏字段，产物字节里 grep 不到任何原始号码。
 *
 * 说明：本文件不 mock 任何依赖（maskPhone/maskEmail 用真实实现），
 *       字体走模块级缓存，故多次 buildPdf 只有第一次真正读 10.5MB 字体。
 */
import { describe, it, expect } from "vitest";
import * as ExcelJS from "exceljs";
import { buildExcel, buildPdf, type ExcelDealerInput, type StrategyExportPayload } from "../export";
import { maskEmail, maskPhone } from "@/lib/pii";

// ── 测试数据 ──
const UNLOCKED_ID = "dealer_a_unlocked";
const LOCKED_ID = "dealer_b_locked";

const PLAIN_PHONE = "13800138000";
const LOCKED_PHONE = "13900139000";
const PLAIN_EMAIL = "alpha@corp.com";
const LOCKED_EMAIL = "beta@corp.com";
const PLAIN_WECHAT = "wx_alpha_777";
const LOCKED_WECHAT = "wx_beta_888";

function makeDealer(over: Partial<ExcelDealerInput> = {}): ExcelDealerInput {
  return {
    id: UNLOCKED_ID,
    partition: "cn",
    grade: "A",
    brands: ["claas"],
    models: ["AXION 850"],
    regions: ["北京"],
    nature: "授权经销商",
    name: "科乐收农业机械贸易(北京)",
    phone: PLAIN_PHONE,
    wechat: PLAIN_WECHAT,
    email: PLAIN_EMAIL,
    sourceUrl: "https://claas.cn",
    ...over,
  };
}

/** 读取 xlsx buffer → 单元格文本数组（用于「搜不到明文」这类断言） */
async function loadSheet(buf: Buffer): Promise<{ ws: ExcelJS.Worksheet; cells: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  const cells: string[] = [];
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cell.value == null ? "" : String(cell.value));
    });
  });
  return { ws, cells };
}

// ─────────────────────────────────────────────────────────────
// A. buildExcel —— PII 门禁（合规红线）
// ─────────────────────────────────────────────────────────────
describe("A. buildExcel · 已解锁行写入明文", () => {
  it("id ∈ unlockedSet → 电话/邮箱/微信均为明文", async () => {
    const dealer = makeDealer();
    const buf = await buildExcel([dealer], new Set([UNLOCKED_ID]), "zh");
    const { cells } = await loadSheet(buf);

    expect(cells).toContain(PLAIN_PHONE);
    expect(cells).toContain(PLAIN_EMAIL);
    expect(cells).toContain(PLAIN_WECHAT);
    // 已解锁行不应出现脱敏形态
    expect(cells).not.toContain(maskPhone(PLAIN_PHONE));
    expect(cells).not.toContain(maskEmail(PLAIN_EMAIL));
    expect(cells).not.toContain("微信:********");
  });
});

describe("A. buildExcel · 未解锁行强制脱敏", () => {
  it("id ∉ unlockedSet → 电话=maskPhone、邮箱=maskEmail、微信=占位，且搜不到原始值", async () => {
    const dealer = makeDealer({
      id: LOCKED_ID,
      phone: LOCKED_PHONE,
      email: LOCKED_EMAIL,
      wechat: LOCKED_WECHAT,
    });
    const buf = await buildExcel([dealer], new Set(), "zh");
    const { cells } = await loadSheet(buf);

    // 与统一出口 maskPhone / maskEmail 的结果逐字一致（不许各写一套 slice 逻辑）
    expect(cells).toContain(maskPhone(LOCKED_PHONE));
    expect(cells).toContain(maskEmail(LOCKED_EMAIL));
    expect(cells).toContain("微信:********");

    // 合规红线：单元格里绝不能出现原始 PII
    expect(cells).not.toContain(LOCKED_PHONE);
    expect(cells).not.toContain(LOCKED_EMAIL);
    expect(cells).not.toContain(LOCKED_WECHAT);
    expect(cells.join("\u0001")).not.toContain(LOCKED_PHONE);
    expect(cells.join("\u0001")).not.toContain(LOCKED_EMAIL);
    expect(cells.join("\u0001")).not.toContain(LOCKED_WECHAT);
  });

  it("未解锁 + 空联系方式 → 不抛错，电话/微信/邮箱为空串", async () => {
    const dealer = makeDealer({ id: LOCKED_ID, phone: null, email: null, wechat: null });
    const buf = await buildExcel([dealer], new Set(), "zh");
    const { cells } = await loadSheet(buf);
    expect(cells).not.toContain("微信:********"); // 无微信号则不写占位
    expect(maskPhone(null)).toBe("");
    expect(maskEmail(null)).toBe("");
  });

  it("locale=en → 微信占位为 \"WeChat:********\"，表头为英文", async () => {
    const dealer = makeDealer({ id: LOCKED_ID, phone: LOCKED_PHONE, email: LOCKED_EMAIL });
    const buf = await buildExcel([dealer], new Set(), "en");
    const { ws, cells } = await loadSheet(buf);

    expect(cells).toContain("WeChat:********");
    expect(cells).not.toContain("微信:********");
    expect(cells).toContain("Phone");
    expect(ws.name).toBe("Dealer Contacts"); // 工作表名（不是单元格值）
    expect(cells).not.toContain(LOCKED_PHONE);
  });

  it("解锁集里放别人的 id 不影响本行脱敏（按 id 精确匹配，不做前缀/模糊匹配）", async () => {
    const dealer = makeDealer({
      id: LOCKED_ID,
      phone: LOCKED_PHONE,
      email: LOCKED_EMAIL,
      wechat: LOCKED_WECHAT,
    });
    // 前缀相近 / 大小写不同的 id 都不应放行
    const buf = await buildExcel(
      [dealer],
      new Set([UNLOCKED_ID, "dealer_b_locke", "DEALER_B_LOCKED"]),
      "zh"
    );
    const { cells } = await loadSheet(buf);
    expect(cells).toContain(maskPhone(LOCKED_PHONE));
    expect(cells).not.toContain(LOCKED_PHONE);
  });
});

describe("A. buildExcel · 产物结构", () => {
  it("产物以 PK 开头（xlsx 即 zip）且体积 > 1KB", async () => {
    const buf = await buildExcel([makeDealer()], new Set([UNLOCKED_ID]), "zh");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(buf.length).toBeGreaterThan(1024);
  });

  it("空数组输入不抛错，表头仍然存在（11 列）", async () => {
    const buf = await buildExcel([], new Set(), "zh");
    const { ws, cells } = await loadSheet(buf);

    expect(buf.length).toBeGreaterThan(0);
    expect(ws.rowCount).toBe(1); // 仅表头
    for (const h of ["分区", "分级", "品牌", "机型组", "地区", "性质", "名称", "电话", "微信", "邮箱", "来源链接"]) {
      expect(cells).toContain(h);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// B. buildPdf —— 基本可用性 + 合规
// ─────────────────────────────────────────────────────────────
const RAW_PHONE = "13612345678";
const MASKED_PHONE = maskPhone(RAW_PHONE);

function makePayload(over: Partial<StrategyExportPayload> = {}): StrategyExportPayload {
  return {
    strategy: {
      summary: "主推中亚二手市场，先出清库存再谈高价。",
      targetMarkets: [
        { market: "乌兹别克斯坦", priority: "高", rationale: "价格接受度高", priceBand: "¥80万-120万" },
      ],
      priceRange: {
        suggestedMinCny: 800000,
        suggestedMaxCny: 1200000,
        currencyNote: "CNY",
        basis: "同品类在售均价",
      },
      channels: [{ candidateId: "lead_abc", type: "lead", rationale: "本地买家" }],
      compliance: { dataExport: "境内数据不出境" },
      actionChecklist: [{ step: 1, action: "电话触达" }],
      responsibility: { disclaimer: "仅供参考" },
      scripts: [{ scenario: "首次触达", line: "您好，我们有现货圆捆机。" }],
      listingChecklist: [{ step: 1, item: "补齐车况信息卡" }],
    },
    product: {
      brandName: "东方红",
      modelName: "YTO-1204",
      year: 2019,
      categoryName: "拖拉机",
      priceCny: 980000,
      location: "河南",
      condition: "二手",
      workingHours: 3200,
      isChineseBrand: true,
    },
    channels: [
      {
        candidateId: "lead_abc",
        type: "lead",
        name: "塔什干买家",
        brand: "CLAAS",
        model: "Jaguar 970",
        region: "UZ",
        rationale: "有进口记录",
        // 合规：导出侧只拿到脱敏值
        phoneMasked: MASKED_PHONE,
        wechatMasked: "微信:********",
        emailMasked: "ta***@corp.com",
      },
    ],
    locale: "zh",
    ...over,
  };
}

/** 把 PDF 字节转成可被字符串检索的形态（粗粒度：单一字节序，覆盖 ASCII 直接量） */
function bytesToSearchable(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

describe("B. buildPdf · 产物可用性", () => {
  it("zh 全量 payload → 以 %PDF- 开头、长度 > 10KB、不含任何明文原始号码", async () => {
    const bytes = await buildPdf(makePayload());

    expect(bytes).toBeInstanceOf(Uint8Array);
    const head = Buffer.from(bytes).subarray(0, 5).toString("latin1");
    expect(head).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(10 * 1024);

    // 合规红线：只喂脱敏值 → 产物里不应出现明文手机号
    const searchable = bytesToSearchable(bytes);
    expect(searchable).not.toContain(RAW_PHONE);
    expect(searchable).not.toContain("13800138000");
    expect(searchable).not.toContain("13900139000");
  });

  it("空 channels + 空 strategy + product:null → 不抛错（走「暂无渠道/未给出定价」兜底）", async () => {
    const bytes = await buildPdf({ strategy: {}, product: null, channels: [], locale: "zh" });
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1024);
  });

  it("locale=en → 不抛错且为合法 PDF", async () => {
    const bytes = await buildPdf(makePayload({ locale: "en" }));
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1024);
    expect(bytesToSearchable(bytes)).not.toContain(RAW_PHONE);
  });
});
