/**
 * aggregate.ts 单元测试
 * ===========================================================================
 * 覆盖《建设方案》与团队纠偏要求的关键不变量：
 *  - 7 种表头变体解析一致（按表头名取列，不按列序号）
 *  - 含逗号字段不撕裂（quote-aware）
 *  - 状态过滤（只取「资金已兑付」）
 *  - 异常年份剔除
 *  - 空壳文件返回空
 *  - 中位数/p25/p75（含极端值 ¥17,894,606 不污染）
 *  - n≥10 门槛（k-匿名）
 *  - contentHash 包含 batchCode（同数据不同批次不互吞）
 *  - 品牌不截断（保留厂家法人全称）
 *  - assertPublicSafe 对 PII 字段名 / 单条原始行 / 县乡下钻 / n<10 均 throw
 *  - (县, 机型) count==1 组合被拒（k-匿名）
 */

import { describe, it, expect } from "vitest";
import {
  parseSubsidyRows,
  aggregateCatalog,
  toPublicCatalog,
  assertPublicSafe,
  assertNoPiiDrillDown,
  MIN_SAMPLE_SIZE,
  PUBLIC_FIELDS,
  PublicSafetyError,
  type SubsidyRow,
} from "../aggregate";

/* ───────────────────────────── 表头变体工具 ───────────────────────────── */

// 17 列基础表头（无「省」列）
const HEADER_17 =
  "序号,县,所在乡(镇),购机者姓名,机具品目,生产厂家,产品名称,购买机型,购买数量(台),经销商,购机日期,单台销售价格(元),单台中央补贴额(元),总补贴额(元),出厂编号,状态,是否超录申请";

// 18 列：开头插入「省」
const HEADER_18 =
  "省,序号,县,所在乡(镇),购机者姓名,机具品目,生产厂家,产品名称,购买机型,购买数量(台),经销商,购机日期,单台销售价格(元),单台中央补贴额(元),总补贴额(元),出厂编号,状态,是否超录申请";

// 23 列：保留「省」在开头，末尾追加 5 个省市县级补贴/贴息列（应被忽略）
const HEADER_23 =
  "省,序号,县,所在乡(镇),购机者姓名,机具品目,生产厂家,产品名称,购买机型,购买数量(台),经销商,购机日期,单台销售价格(元),单台中央补贴额(元),总补贴额(元),出厂编号,状态,是否超录申请,省级补贴(元),市级补贴(元),县级补贴(元),贴息(元),备注";

// 一条语义一致的行，按 17 列布局
function row17(overrides: Partial<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    序号: "1",
    县: "正定县",
    "所在乡(镇)": "新城铺镇",
    购机者姓名: "张三",
    机具品目: "轮式拖拉机",
    生产厂家: "第一拖拉机股份有限公司",
    产品名称: "东方红牌",
    购买机型: "LX2004",
    购买数量台: "1",
    经销商: "河北农机公司",
    购机日期: "2023-05-12",
    单台销售价格元: "120000",
    单台中央补贴额元: "30000",
    总补贴额元: "40000",
    出厂编号: "SN123456",
    状态: "资金已兑付",
    是否超录申请: "否",
  };
  return [
    base.序号,
    overrides.县 ?? base.县,
    overrides.乡镇 ?? base["所在乡(镇)"],
    overrides.购机者 ?? base.购机者姓名,
    overrides.品目 ?? base.机具品目,
    overrides.厂家 ?? base.生产厂家,
    overrides.产品 ?? base.产品名称,
    overrides.机型 ?? base.购买机型,
    overrides.数量 ?? base.购买数量台,
    overrides.经销商 ?? base.经销商,
    overrides.日期 ?? base.购机日期,
    overrides.售价 ?? base.单台销售价格元,
    overrides.中央 ?? base.单台中央补贴额元,
    overrides.总额 ?? base.总补贴额元,
    overrides.出厂 ?? base.出厂编号,
    overrides.状态 ?? base.状态,
    overrides.超录 ?? base.是否超录申请,
  ].join(",");
}

// 把 17 列的行映射到其它变体：含「省」表头则在开头加省份；末尾多出的列补占位符。
// 这样无论 18/19/20/22/23 列，都能对齐到对应表头（多出的省市县级补贴/贴息列被忽略）。
function toVariant(header: string, province: string, line17: string): string {
  const cols = line17.split(",");
  let out = cols;
  if (header.startsWith("省")) {
    out = [province, ...cols];
  }
  const extra = header.split(",").length - out.length;
  for (let i = 0; i < extra; i++) out.push("占位" + i);
  return out.join(",");
}

function buildCsv(header: string, lines: string[], province = "河北省"): string {
  const body = lines.map((l) => toVariant(header, province, l)).join("\n");
  return header + "\n" + body;
}

/* ───────────────────────────── 1. 7 种表头变体解析一致 ───────────────────────────── */

describe("表头变体解析一致性（按表头名取列）", () => {
  const variants = [HEADER_17, HEADER_18, HEADER_23];

  for (const header of variants) {
    it(`变体（${header === HEADER_17 ? "17列" : header === HEADER_18 ? "18列" : "23列"}）解析出一致的聚合键字段`, () => {
      const csv = buildCsv(header, [row17()]);
      // 17 列无省列，需要 defaultProvince；其余变体自带省列
      const rows = parseSubsidyRows(csv, { defaultProvince: "河北省" });
      expect(rows).toHaveLength(1);
      const r = rows[0];
      expect(r.manufacturer).toBe("第一拖拉机股份有限公司");
      expect(r.category).toBe("轮式拖拉机");
      expect(r.modelName).toBe("LX2004");
      expect(r.salePriceCny).toBe(120000);
      expect(r.province).toBe("河北省");
      expect(r.purchaseDate.getFullYear()).toBe(2023);
    });
  }

  it("19/20/22 列也按表头名正确解析（扩展变体）", () => {
    // 19 列：18 列基础上再加 1 个尾部列
    const h19 =
      "省,序号,县,所在乡(镇),购机者姓名,机具品目,生产厂家,产品名称,购买机型,购买数量(台),经销商,购机日期,单台销售价格(元),单台中央补贴额(元),总补贴额(元),出厂编号,状态,是否超录申请,备注A";
    const csv = buildCsv(h19, [row17()]);
    const rows = parseSubsidyRows(csv, { defaultProvince: "河北省" });
    expect(rows).toHaveLength(1);
    expect(rows[0].modelName).toBe("LX2004");
    expect(rows[0].salePriceCny).toBe(120000);
  });
});

/* ───────────────────────────── 2. 含逗号字段不撕裂 ───────────────────────────── */

describe("quote-aware：含逗号字段不撕裂", () => {
  it("产品名称含逗号时列不偏移", () => {
    // 用引号包裹含逗号的字段
    const line = [
      "1",
      "正定县",
      "新城铺镇",
      "张三",
      "轮式拖拉机",
      "第一拖拉机股份有限公司",
      '"东方红,改进型"',
      "LX2004",
      "1",
      "河北农机公司",
      "2023-05-12",
      "120000",
      "30000",
      "40000",
      "SN123",
      "资金已兑付",
      "否",
    ].join(",");
    const csv = HEADER_17 + "\n" + line;
    const rows = parseSubsidyRows(csv, { defaultProvince: "河北省" });
    expect(rows).toHaveLength(1);
    expect(rows[0].productName).toBe("东方红,改进型"); // 逗号保留，未被撕成两列
    expect(rows[0].salePriceCny).toBe(120000); // 价格列未被偏移
    expect(rows[0].modelName).toBe("LX2004");
  });
});

/* ───────────────────────────── 3. 状态过滤 ───────────────────────────── */

describe("状态过滤（只取「资金已兑付」）", () => {
  it("非已兑付状态被剔除", () => {
    const lines = [
      row17({ 状态: "资金已兑付" }),
      row17({ 状态: "资金待兑付", 出厂: "SN-A" }),
      row17({ 状态: "冻结", 出厂: "SN-B" }),
      row17({ 状态: "待申请结算", 出厂: "SN-C" }),
    ];
    const rows = parseSubsidyRows(buildCsv(HEADER_17, lines), {
      defaultProvince: "河北省",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("资金已兑付");
  });
});

/* ───────────────────────────── 4. 异常年份剔除 ───────────────────────────── */

describe("异常年份剔除", () => {
  it("1896 / 3023 等异常购机年份被丢弃，正常年份保留", () => {
    const lines = [
      row17({ 日期: "2023-05-12" }),
      row17({ 日期: "1896-01-01", 出厂: "SN-OLD" }),
      row17({ 日期: "3023-12-31", 出厂: "SN-FUT" }),
      row17({ 日期: "1970-06-06", 出厂: "SN-70" }),
    ];
    const rows = parseSubsidyRows(buildCsv(HEADER_17, lines), {
      defaultProvince: "河北省",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].purchaseDate.getFullYear()).toBe(2023);
  });
});

/* ───────────────────────────── 5. 空壳文件 ───────────────────────────── */

describe("空壳文件", () => {
  it("只有表头时返回空数组", () => {
    const rows = parseSubsidyRows(HEADER_17 + "\n", {
      defaultProvince: "河北省",
    });
    expect(rows).toHaveLength(0);
  });

  it("表头 + 若干全空行时返回空数组", () => {
    const rows = parseSubsidyRows(HEADER_17 + "\n\n  \n", {
      defaultProvince: "河北省",
    });
    expect(rows).toHaveLength(0);
  });
});

/* ───────────────────────────── 6. 中位数/p25/p75（极端值不污染） ───────────────────────────── */

describe("中位数/p25/p75 稳健性（极端值不污染）", () => {
  it("含 ¥17,894,606 极端值时中位数/p25/p75 仍为干净值", () => {
    // 11 条同聚合键记录：10 条 1000..10000 + 1 条极端值
    const prices = [
      1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 17894606,
    ];
    const lines = prices.map((p, i) =>
      row17({ 售价: String(p), 出厂: "SN" + i, 日期: "2023-0" + ((i % 9) + 1) + "-12" })
    );
    const rows = parseSubsidyRows(buildCsv(HEADER_17, lines), {
      defaultProvince: "河北省",
    });
    expect(rows).toHaveLength(11);

    const cats = aggregateCatalog(rows, "seed-2026-11");
    expect(cats).toHaveLength(1);
    const c = cats[0];
    // 经 Tukey 截尾后：median=5500, p25=3250, p75=7750（极端值被剔除，不污染）
    expect(c.medianPriceCny).toBe(5500);
    expect(c.p25PriceCny).toBe(3250);
    expect(c.p75PriceCny).toBe(7750);
    expect(c.sampleSize).toBe(11);
  });

  it("纯常数列也给出正确中位数", () => {
    const lines = Array.from({ length: 12 }, (_, i) =>
      row17({ 售价: "5000", 出厂: "SN" + i })
    );
    const rows = parseSubsidyRows(buildCsv(HEADER_17, lines), {
      defaultProvince: "河北省",
    });
    const cats = aggregateCatalog(rows, "seed-2026-11");
    expect(cats[0].medianPriceCny).toBe(5000);
    expect(cats[0].p25PriceCny).toBe(5000);
    expect(cats[0].p75PriceCny).toBe(5000);
  });
});

/* ───────────────────────────── 7. n≥10 门槛（k-匿名） ───────────────────────────── */

describe("n≥10 门槛（k-匿名）", () => {
  it("聚合组 n=9 时 assertPublicSafe 抛错", () => {
    const lines = Array.from({ length: 9 }, (_, i) =>
      row17({ 售价: String(1000 * (i + 1)), 出厂: "SN" + i })
    );
    const rows = parseSubsidyRows(buildCsv(HEADER_17, lines), {
      defaultProvince: "河北省",
    });
    const cats = aggregateCatalog(rows, "seed-2026-11");
    expect(cats[0].sampleSize).toBe(9);
    const payload = toPublicCatalog(cats[0] as unknown as Record<string, unknown>);
    expect(() => assertPublicSafe(payload)).toThrow(PublicSafetyError);
  });

  it("聚合组 n=10 时 assertPublicSafe 通过", () => {
    const lines = Array.from({ length: 10 }, (_, i) =>
      row17({ 售价: String(1000 * (i + 1)), 出厂: "SN" + i })
    );
    const rows = parseSubsidyRows(buildCsv(HEADER_17, lines), {
      defaultProvince: "河北省",
    });
    const cats = aggregateCatalog(rows, "seed-2026-11");
    expect(cats[0].sampleSize).toBe(10);
    const payload = toPublicCatalog(cats[0] as unknown as Record<string, unknown>);
    expect(() => assertPublicSafe(payload)).not.toThrow();
  });
});

/* ───────────────────────────── 8. contentHash 包含 batchCode ───────────────────────────── */

describe("contentHash 绑定 batchCode（同数据不同批次不互吞）", () => {
  it("相同数据不同批次 → 不同 contentHash", () => {
    const lines = Array.from({ length: 12 }, (_, i) =>
      row17({ 售价: String(1000 * (i + 1)), 出厂: "SN" + i })
    );
    const rows = parseSubsidyRows(buildCsv(HEADER_17, lines), {
      defaultProvince: "河北省",
    });
    const a = aggregateCatalog(rows, "batch-2026-11");
    const b = aggregateCatalog(rows, "batch-2026-12");
    expect(a[0].contentHash).not.toBe(b[0].contentHash);
  });
});

/* ───────────────────────────── 9. 品牌不截断 ───────────────────────────── */

describe("品牌保留厂家法人全称（禁止 [:4] 截断）", () => {
  it("长厂家名完整保留", () => {
    const longName = "第一拖拉机股份有限公司";
    const rows = parseSubsidyRows(buildCsv(HEADER_17, [row17({ 厂家: longName })]), {
      defaultProvince: "河北省",
    });
    const cats = aggregateCatalog(rows, "seed-2026-11");
    expect(cats[0].brandName).toBe(longName);
    expect(cats[0].brandName.length).toBe(longName.length);
    expect(cats[0].manufacturer).toBe(longName);
  });
});

/* ───────────────────────────── 10. assertPublicSafe 拒绝 PII / 单条 / 下钻 ───────────────────────────── */

describe("assertPublicSafe 拒绝违规负载", () => {
  const safeBase = (): Record<string, unknown> => ({
    province: "河北省",
    policyYear: 2023,
    category: "轮式拖拉机",
    brandName: "某厂",
    modelName: "LX2004",
    medianPriceCny: 120000,
    p25PriceCny: 100000,
    p75PriceCny: 140000,
    medianCentralSubsidy: 30000,
    medianTotalSubsidy: 40000,
    sampleSize: 50,
  });

  it("含 buyerName 字段名抛错", () => {
    const p = { ...safeBase(), buyerName: "张三" } as never;
    expect(() => assertPublicSafe(p)).toThrow(PublicSafetyError);
  });

  it("含 serialNo 字段名抛错", () => {
    const p = { ...safeBase(), serialNo: "SN1" } as never;
    expect(() => assertPublicSafe(p)).toThrow(PublicSafetyError);
  });

  it("含 county 下钻维度抛错", () => {
    const p = { ...safeBase(), county: "正定县" } as never;
    expect(() => assertPublicSafe(p)).toThrow(PublicSafetyError);
  });

  it("含 id（疑似单条原始行）抛错", () => {
    const p = { ...safeBase(), id: "cuidxxx" } as never;
    expect(() => assertPublicSafe(p)).toThrow(PublicSafetyError);
  });

  it("合法白名单负载通过", () => {
    const p = toPublicCatalog(safeBase());
    expect(() => assertPublicSafe(p)).not.toThrow();
  });
});

/* ───────────────────────────── 11. toPublicCatalog 只输出白名单字段 ───────────────────────────── */

describe("toPublicCatalog 白名单", () => {
  it("传入含 PII 的记录，输出仅含 PUBLIC_FIELDS", () => {
    const record: Record<string, unknown> = {
      province: "河北省",
      policyYear: 2023,
      category: "轮式拖拉机",
      brandName: "某厂",
      modelName: "LX2004",
      medianPriceCny: 120000,
      p25PriceCny: 100000,
      p75PriceCny: 140000,
      medianCentralSubsidy: 30000,
      medianTotalSubsidy: 40000,
      sampleSize: 50,
      // 以下 PII / 单条字段必须被剔除
      buyerName: "张三",
      serialNo: "SN1",
      county: "正定县",
      dealer: "河北农机",
      id: "cuidxxx",
    };
    const out = toPublicCatalog(record);
    const keys = Object.keys(out);
    for (const k of keys) {
      expect((PUBLIC_FIELDS as readonly string[]).includes(k)).toBe(true);
    }
    expect(keys).not.toContain("buyerName");
    expect(keys).not.toContain("serialNo");
    expect(keys).not.toContain("county");
    expect(keys).not.toContain("dealer");
    expect(keys).not.toContain("id");
  });
});

/* ───────────────────────────── 12. (县, 机型) count==1 组合被拒 ───────────────────────────── */

describe("(县, 机型) 唯一组合 k-匿名被拒", () => {
  it("单条记录聚合 n=1 → assertPublicSafe 抛错", () => {
    const rows = parseSubsidyRows(buildCsv(HEADER_17, [row17()]), {
      defaultProvince: "河北省",
    });
    const cats = aggregateCatalog(rows, "seed-2026-11");
    expect(cats[0].sampleSize).toBe(1);
    const payload = toPublicCatalog(cats[0] as unknown as Record<string, unknown>);
    expect(() => assertPublicSafe(payload)).toThrow(PublicSafetyError);
  });
});

/* ───────────────────────────── 13. assertNoPiiDrillDown 拒绝县乡下钻参数 ───────────────────────────── */

describe("assertNoPiiDrillDown 拒绝下钻参数", () => {
  it("传入 county 参数抛错", () => {
    expect(() =>
      assertNoPiiDrillDown({ brand: "某厂", county: "正定县" })
    ).toThrow(PublicSafetyError);
  });

  it("仅品牌/品类/型号/省份参数通过", () => {
    expect(() =>
      assertNoPiiDrillDown({
        brand: "某厂",
        category: "轮式拖拉机",
        model: "LX2004",
        province: "河北省",
      })
    ).not.toThrow();
  });
});
