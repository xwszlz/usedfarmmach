/**
 * T03 `raw-detail-view.ts` 单测 —— **零 IO / 零真实连接串 / 零 Prisma 查询**。
 *
 * 本文件是 PII 安全边界的机器验证：
 *   ① 4 个不展示字段（id / goodsRegion / contentHash / createdAt）绝不出现在返回对象、
 *      键集合或 JSON 序列化结果里 —— 用「脏入参」做负向硬断言，证明是白名单而非黑名单；
 *   ② null → "—"；③ locale zh / en 列头与口径标注；
 *   ④ off / 匿名路径 `loadRawDetailRows()` 对 raw 查询的 mock 调用次数 = 0；
 *   ⑤ 全程 `@/lib/db` 探针零命中，绝不加载 PrismaClient。
 *
 * 本测试不 import 任何 .tsx 页面/组件，也不渲染 JSX，纯函数层可独立跑。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const probes = vi.hoisted(() => ({ calls: [] as string[] }));

/** 一旦有任何模块真的去连库 / 取连接串，就记名并抛错（负向探针）。 */
vi.mock("@/lib/db", () => ({
  prisma: {
    subsidyRecordRaw: {
      count: async () => {
        probes.calls.push("db.subsidyRecordRaw.count");
        throw new Error("单测禁止触发 Prisma 查询");
      },
      findMany: async () => {
        probes.calls.push("db.subsidyRecordRaw.findMany");
        throw new Error("单测禁止触发 Prisma 查询");
      },
    },
    subsidyCatalog: {
      findMany: async () => {
        probes.calls.push("db.subsidyCatalog.findMany");
        throw new Error("单测禁止触发 Prisma 查询");
      },
    },
  },
  getCurrentDatabaseUrl: () => {
    probes.calls.push("db.getCurrentDatabaseUrl");
    return "mock://no-real-database";
  },
}));

const DATABASE_URL_BEFORE = process.env.DATABASE_URL;
const DATABASE_URL_CN_BEFORE = process.env.DATABASE_URL_CN;

beforeEach(() => {
  // 明确写死假串：即便有代码误读 env，也不可能拿到真实连接串。
  process.env.DATABASE_URL = "mock://no-real-database";
  process.env.DATABASE_URL_CN = "mock://no-real-database-cn";
  probes.calls.length = 0;
});

afterAll(() => {
  if (DATABASE_URL_BEFORE === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = DATABASE_URL_BEFORE;
  if (DATABASE_URL_CN_BEFORE === undefined) delete process.env.DATABASE_URL_CN;
  else process.env.DATABASE_URL_CN = DATABASE_URL_CN_BEFORE;
});

import type { RawDetailQuery, RawDetailResult, RawDetailRow } from "@/lib/subsidy/raw-detail";
import {
  loadRawDetailRows,
  RAW_DETAIL_CONDITIONAL_FIELDS,
  RAW_DETAIL_DISPLAY_FIELDS,
  RAW_DETAIL_HIDDEN_FIELDS,
  toRawDetailView,
} from "@/lib/subsidy/raw-detail-view";

function makeRow(overrides: Readonly<Record<string, unknown>> = {}): RawDetailRow {
  const row: Record<string, unknown> = {
    batchCode: "domestic-seed-2026-11",
    sourceFile: "hlj/2023/raw.csv",
    province: "黑龙江",
    county: "某某县",
    township: "某某乡",
    buyerName: "张三",
    manufacturer: "某某农机有限公司",
    category: "拖拉机",
    productName: "轮式拖拉机",
    modelName: "ABC-123",
    quantity: 1,
    dealer: "某某经销商",
    purchaseDate: "2023-05-06",
    salePriceCny: 123456.7,
    centralSubsidyCny: 10000,
    totalSubsidyCny: 12000,
    serialNo: "SN-0001",
    status: "资金已兑付",
  };
  for (const [key, value] of Object.entries(overrides)) row[key] = value;
  return row as unknown as RawDetailRow;
}

function allKeys(view: ReturnType<typeof toRawDetailView>): string[] {
  return [
    ...view.cells.map((cell) => cell.key),
    ...view.collapsedCells.map((cell) => cell.key),
  ];
}

function emptyResult(q: RawDetailQuery): RawDetailResult {
  return {
    rows: [],
    total: 0,
    page: q.page,
    pageSize: q.pageSize,
    consistent: false,
  };
}

const BASE_QUERY: RawDetailQuery = {
  key: {
    batchCode: "domestic-seed-2026-11",
    manufacturer: "某某农机有限公司",
    category: "拖拉机",
    modelName: "ABC-123",
    province: "黑龙江",
    policyYear: 2023,
  },
  expectedSampleSize: 16,
  page: 1,
  pageSize: 50,
};

describe("toRawDetailView — §3.1 白名单裁剪（PII 安全边界）", () => {
  it("白名单常量恰为 16 展示 + 2 条件 + 4 不展示，且三组互不相交", () => {
    expect(RAW_DETAIL_DISPLAY_FIELDS).toHaveLength(16);
    expect(RAW_DETAIL_CONDITIONAL_FIELDS).toEqual(["sourceFile", "serialNo"]);
    expect(RAW_DETAIL_HIDDEN_FIELDS).toEqual([
      "id",
      "goodsRegion",
      "contentHash",
      "createdAt",
    ]);
    const all = [...RAW_DETAIL_DISPLAY_FIELDS, ...RAW_DETAIL_CONDITIONAL_FIELDS];
    for (const hidden of RAW_DETAIL_HIDDEN_FIELDS) {
      expect(all).not.toContain(hidden);
    }
  });

  it("返回对象只有 cells / collapsedCells / locale，4 个不展示字段绝不出现", () => {
    const view = toRawDetailView(makeRow(), {
      showSerialNo: true,
      showSourceFile: true,
      locale: "zh",
    });
    expect(Object.keys(view).sort()).toEqual([
      "cells",
      "collapsedCells",
      "locale",
    ]);
    for (const hidden of RAW_DETAIL_HIDDEN_FIELDS) {
      expect(allKeys(view)).not.toContain(hidden);
      expect(Object.prototype.hasOwnProperty.call(view, hidden)).toBe(false);
    }
  });

  it("脏入参带 4 个不展示字段 + 未知字段时，键与值都绝不进序列化（白名单非黑名单）", () => {
    const dirty = makeRow({
      id: "__SECRET_ID__",
      goodsRegion: "__SECRET_REGION__",
      contentHash: "__SECRET_HASH__",
      createdAt: "__SECRET_CREATED__",
      idcard: "__SECRET_IDCARD__",
      phone: "__SECRET_PHONE__",
      address: "__SECRET_ADDRESS__",
    });
    const view = toRawDetailView(dirty, {
      showSerialNo: true,
      showSourceFile: true,
      locale: "zh",
    });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("__SECRET_");
    expect(allKeys(view)).toHaveLength(18); // 16 展示 + serialNo + sourceFile
    for (const hidden of RAW_DETAIL_HIDDEN_FIELDS) {
      expect(serialized).not.toContain(`"${hidden}"`);
    }
    // 正例：正常白名单值确实被挑出，证明不是把整行丢弃。
    expect(serialized).toContain("张三");
    expect(serialized).toContain("ABC-123");
  });

  it("默认 opts 下条件字段缺席：showSerialNo=false / showSourceFile=false", () => {
    const view = toRawDetailView(makeRow(), {
      showSerialNo: false,
      showSourceFile: false,
      locale: "zh",
    });
    expect(allKeys(view)).toEqual([...RAW_DETAIL_DISPLAY_FIELDS]);
    expect(view.collapsedCells).toHaveLength(0);
    expect(JSON.stringify(view)).not.toContain("SN-0001");
    expect(JSON.stringify(view)).not.toContain("raw.csv");
  });

  it("showSerialNo=true 时 serialNo 在主表可见；showSourceFile=true 时 sourceFile 进折叠区", () => {
    const view = toRawDetailView(makeRow(), {
      showSerialNo: true,
      showSourceFile: true,
      locale: "zh",
    });
    expect(view.cells.map((c) => c.key)).toContain("serialNo");
    expect(view.collapsedCells.map((c) => c.key)).toEqual(["sourceFile"]);
    expect(view.cells.find((c) => c.key === "serialNo")?.value).toBe("SN-0001");
  });

  it("null / undefined / 空串 → '—'（含 3 个可空金额字段）", () => {
    const view = toRawDetailView(
      makeRow({
        centralSubsidyCny: null,
        totalSubsidyCny: undefined,
        dealer: "",
        serialNo: null,
        sourceFile: null,
      }),
      { showSerialNo: true, showSourceFile: true, locale: "zh" }
    );
    const byKey = new Map(view.cells.map((c) => [c.key, c.value]));
    expect(byKey.get("centralSubsidyCny")).toBe("—");
    expect(byKey.get("totalSubsidyCny")).toBe("—");
    expect(byKey.get("dealer")).toBe("—");
    expect(byKey.get("serialNo")).toBe("—");
    expect(view.collapsedCells[0].value).toBe("—");
  });

  it("金额按 locale 格式化且列头标「单条成交价」，purchaseDate 列头标「购机日期（精确到日）」", () => {
    const zh = toRawDetailView(makeRow(), {
      showSerialNo: false,
      showSourceFile: false,
      locale: "zh",
    });
    const zhByKey = new Map(zh.cells.map((c) => [c.key, c]));
    expect(zhByKey.get("salePriceCny")?.label).toContain("单条成交价");
    expect(zhByKey.get("purchaseDate")?.label).toContain("购机日期（精确到日）");
    expect(zhByKey.get("salePriceCny")?.value).toContain("¥");
    expect(zhByKey.get("purchaseDate")?.value).toBe("2023-05-06");

    const en = toRawDetailView(makeRow(), {
      showSerialNo: false,
      showSourceFile: false,
      locale: "en",
    });
    const enByKey = new Map(en.cells.map((c) => [c.key, c]));
    expect(enByKey.get("salePriceCny")?.label).toContain("Single transaction price");
    expect(enByKey.get("purchaseDate")?.label).toContain("Purchase date (exact day)");
    expect(enByKey.get("salePriceCny")?.value).toContain("CNY");
  });

  it("locale zh / en 列头不同，且 en 不残留中文列头", () => {
    const zh = toRawDetailView(makeRow(), {
      showSerialNo: true,
      showSourceFile: true,
      locale: "zh",
    });
    const en = toRawDetailView(makeRow(), {
      showSerialNo: true,
      showSourceFile: true,
      locale: "en",
    });
    expect(zh.locale).toBe("zh");
    expect(en.locale).toBe("en");
    expect(zh.cells.map((c) => c.label)).not.toEqual(en.cells.map((c) => c.label));
    expect(en.cells.every((c) => !/[\u4e00-\u9fa5]/.test(c.label))).toBe(true);
    // 值本身与 locale 无关（同一条 raw 行）
    expect(zh.cells.map((c) => c.key)).toEqual(en.cells.map((c) => c.key));
  });
});

describe("loadRawDetailRows — off / 匿名路径 raw 查询 mock 计数 = 0", () => {
  it("off 态（mode_off）直接返回 null，query 探针 0 次调用", async () => {
    const query = vi.fn(async (q: RawDetailQuery) => emptyResult(q));
    const result = await loadRawDetailRows(
      { showRaw: false, reason: "mode_off" },
      BASE_QUERY,
      query
    );
    expect(result).toBeNull();
    expect(query).toHaveBeenCalledTimes(0);
  });

  it("login 但匿名 / 角色拒绝 / 非中文 / 非 .cn 等 denied 决策一律 0 次查询", async () => {
    const query = vi.fn(async (q: RawDetailQuery) => emptyResult(q));
    const denied = [
      { showRaw: false as const, reason: "login_required" as const },
      { showRaw: false as const, reason: "role_denied" as const },
      { showRaw: false as const, reason: "locale_denied" as const },
      { showRaw: false as const, reason: "site_not_cn" as const },
      { showRaw: false as const, reason: "mode_invalid" as const },
    ];
    for (const decision of denied) {
      const result = await loadRawDetailRows(decision, BASE_QUERY, query);
      expect(result).toBeNull();
    }
    expect(query).toHaveBeenCalledTimes(0);
  });

  it("showRaw=true 时恰好查询 1 次，且原样透传 query（严格计数断言不在此层放松）", async () => {
    const query = vi.fn(async (q: RawDetailQuery) => emptyResult(q));
    const decision = { showRaw: true as const, mode: "login" as const };
    const result = await loadRawDetailRows(decision, BASE_QUERY, query);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(BASE_QUERY);
    expect(result).toMatchObject({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 50,
      consistent: false,
    });
  });

  it("默认查询出口就是上游 queryRawDetail；denied 时也绝不触发它（探针零命中）", async () => {
    const result = await loadRawDetailRows(
      { showRaw: false, reason: "mode_off" },
      BASE_QUERY
    );
    expect(result).toBeNull();
    expect(probes.calls).toEqual([]);
  });
});

describe("零 IO / 零真实连接串硬断言", () => {
  it("整个测试文件运行期间 @/lib/db 探针没有任何命中", () => {
    expect(probes.calls).toEqual([]);
    expect(process.env.DATABASE_URL).toBe("mock://no-real-database");
    expect(process.env.DATABASE_URL_CN).toBe("mock://no-real-database-cn");
  });
});
