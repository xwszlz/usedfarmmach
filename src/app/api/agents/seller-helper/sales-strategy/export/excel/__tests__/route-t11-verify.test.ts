/**
 * T13 补验（T11）· 路由级端到端：`layout:"v2"` 真的会产出三 Sheet，且 PII 门禁在**真实请求路径**下成立
 * ─────────────────────────────────────────────────────────
 * 为什么在 buildExcel 单测之外再走一遍路由：
 *   ① 三 Sheet 的**开关**在路由（`layout: "v2" | 2 | "2"` → 2），单测证明不了前端线上发的字符串 `"v2"` 没被静默降级；
 *   ② 多邮箱泄漏是**线上存量数据**事故 ⇒ 必须验「PiiAuditLog→unlockedSet→prisma 明文→渲染」整条链，
 *      而不是只验最后的渲染函数；
 *   ③ `unlockedSet` 的来源（`unlock:dealer_` 前缀）与 Row 的 `id` 口径若漂移，单测无法发现。
 *
 * 断言全部读**真实 xlsx 产物**（exceljs 回读），不 mock 渲染层。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import * as ExcelJS from "exceljs";

vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    dealer: { findMany: vi.fn() },
    piiAuditLog: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/credits/deduct", () => ({
  estimateAiCost: vi.fn(),
  deductAiUsage: vi.fn(),
  EXPORT_ESTIMATED_TOKENS: 800,
}));
vi.mock("@/lib/sales-strategy/dealers", () => ({ retrieveDealers: vi.fn() }));

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { estimateAiCost, deductAiUsage } from "@/lib/credits/deduct";
import { retrieveDealers } from "@/lib/sales-strategy/dealers";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/export/excel/route";

const UNLOCKED_ID = "abc";
const LOCKED_ID = "def";
const UNLOCKED_PHONE = "13800138000";
const LOCKED_PHONE = "13900139000";
const MULTI_EMAIL = "info@e-farm.com / sales@e-farm.com";
/** 已解锁行必须用**另一串**邮箱：否则 `sales@` 会合法地出现在明文行，导致「未解锁零泄漏」断言失去区分度 */
const UNLOCKED_EMAIL = "alpha@corp.com";
const LOCKED_CONTACT = "李四海";

function publicDealer(id: string, partition: "cn" | "intl", name: string) {
  return {
    id,
    name,
    brands: ["claas"],
    models: ["AXION 850"],
    regions: [partition === "cn" ? "北京" : "荷兰"],
    nature: "授权经销",
    grade: "A",
    sourceUrl: "https://en.tec24.com/zh/contact",
    partition,
    phoneMasked: "***",
    wechatMasked: "微信:********",
    emailMasked: "***",
  };
}

function makeReq(body: unknown, referer = "https://usedfarmmach.cn/zh/sales-strategy/dealers") {
  return new NextRequest("https://usedfarmmach.cn/api/agents/seller-helper/sales-strategy/export/excel", {
    method: "POST",
    headers: { referer },
    body: JSON.stringify(body),
  });
}

async function loadWb(res: Response): Promise<ExcelJS.Workbook> {
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  return wb;
}

function allCells(wb: ExcelJS.Workbook): string[] {
  const out: string[] = [];
  for (const ws of wb.worksheets) {
    ws.eachRow((row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        out.push(cell.value == null ? "" : String(cell.value));
      });
    });
  }
  return out;
}

function headersOf(ws: ExcelJS.Worksheet): string[] {
  const out: string[] = [];
  for (let c = 1; c <= ws.columnCount; c += 1) {
    const v = ws.getRow(1).getCell(c).value;
    out.push(v == null ? "" : String(v));
  }
  return out;
}

let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
  vi.mocked(estimateAiCost).mockResolvedValue(100);
  vi.mocked(deductAiUsage).mockResolvedValue({ ok: true, cost: 100, balance: 9900 } as any);
  vi.mocked(retrieveDealers).mockResolvedValue({
    site: "cn",
    domestic: [publicDealer(UNLOCKED_ID, "cn", "解锁过的公司")],
    international: [publicDealer(LOCKED_ID, "intl", "没解锁的公司")],
  } as any);
  vi.mocked(prisma.dealer.findMany).mockResolvedValue([
    {
      id: UNLOCKED_ID,
      phone: UNLOCKED_PHONE,
      wechat: "wx_abc_777",
      email: UNLOCKED_EMAIL,
      location: null,
      country: "中国",
      city: "北京",
      contactPerson: "张三丰",
      role: "授权经销",
      priority: "A",
      suggestedPrice: null,
      followStatus: "已联系",
      sourcePage: "公开渠道·en.tec24.com·2026-10-13",
    },
    {
      id: LOCKED_ID,
      phone: LOCKED_PHONE,
      wechat: "wx_def_888",
      email: MULTI_EMAIL,
      location: null,
      country: "荷兰",
      city: "Drenthe",
      contactPerson: LOCKED_CONTACT,
      role: "进口商",
      priority: "B",
      suggestedPrice: null,
      followStatus: null,
      sourcePage: null,
    },
  ] as any);
  vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([
    { field: "unlock:dealer_abc" },
    { field: "unlock:lead_xyz" }, // lead 前缀不得混入经销商解锁集
  ] as any);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
});

describe("路由级：layout 开关", () => {
  it("body.layout=\"v2\"（前端线上发的字符串）→ 三 Sheet，14/7/5 列表头齐全", async () => {
    const res = await POST(makeReq({ layout: "v2", strategy: { summary: "x" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    const wb = await loadWb(res);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["渠道联系总表", "机型价格速查", "必办清单"]);
    expect(headersOf(wb.worksheets[0])).toHaveLength(14);
    expect(headersOf(wb.worksheets[1])).toHaveLength(7);
    expect(headersOf(wb.worksheets[2])).toHaveLength(5);
  });

  it("layout 数字 2 与字符串 \"2\" 同样走 v2（三种写法都容忍）", async () => {
    for (const layout of [2, "2"]) {
      const wb = await loadWb(await POST(makeReq({ layout })));
      expect(wb.worksheets, `layout=${JSON.stringify(layout)}`).toHaveLength(3);
    }
  });

  it("layout 缺省 → legacy 单 Sheet 11 列（老客户端零回归）", async () => {
    const wb = await loadWb(await POST(makeReq({ partition: "all" })));
    expect(wb.worksheets).toHaveLength(1);
    expect(headersOf(wb.worksheets[0])).toEqual([
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
  });

  it("layout 传垃圾值 \"xxx\" → 回落 legacy（不静默变三 Sheet）", async () => {
    const wb = await loadWb(await POST(makeReq({ layout: "xxx" })));
    expect(wb.worksheets).toHaveLength(1);
    expect(headersOf(wb.worksheets[0])).toHaveLength(11);
  });
});

describe("路由级：PII 门禁 + 多邮箱泄漏（真实请求路径）", () => {
  it("v2：已解锁明文、未解锁脱敏；`sales@` 与未解锁明文在全部 Sheet 零出现", async () => {
    const res = await POST(makeReq({ layout: "v2" }));
    expect(res.status).toBe(200);

    const wb = await loadWb(res);
    const cells = allCells(wb);
    const flat = cells.join("\u0001");

    // 已解锁（abc）：电话明文 + 多邮箱原样
    expect(cells).toContain(UNLOCKED_PHONE);
    expect(cells).toContain(UNLOCKED_EMAIL); // 已解锁邮箱明文（单地址）
    // 未解锁（def）：电话脱敏 + 联系人已隐藏
    expect(cells).toContain("139****9000");
    expect(cells).toContain("已隐藏");

    // 🔴 事故断言：多邮箱第二个地址不得裸奔（两个地址都必须脱敏）
    expect(flat).toContain("in***@e-farm.com");
    expect(flat).toContain("sa***@e-farm.com");
    expect(flat, "未解锁行第二个邮箱泄漏").not.toContain("sales@e-farm.com");
    expect(flat).not.toContain("info@e-farm.com");
    // 未解锁的其它明文
    expect(flat).not.toContain(LOCKED_PHONE);
    expect(flat).not.toContain(LOCKED_CONTACT);
    expect(flat).not.toContain("wx_def_888");
  });

  it("legacy：同一批数据同样不漏第二个邮箱", async () => {
    const wb = await loadWb(await POST(makeReq({})));
    const flat = allCells(wb).join("\u0001");
    expect(flat).toContain("sa***@e-farm.com");
    expect(flat).not.toContain("sales@e-farm.com");
  });

  it("审计查询仍然只认 `unlock:dealer_` 前缀（lead 记录不得放行经销商明文）", async () => {
    vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([
      { field: "unlock:lead_abc" }, // 同 id 但 lead 前缀
    ] as any);

    const wb = await loadWb(await POST(makeReq({ layout: "v2" })));
    const flat = allCells(wb).join("\u0001");
    expect(flat, "lead 前缀误放行了经销商明文").not.toContain(UNLOCKED_PHONE);

    const auditArg = vi.mocked(prisma.piiAuditLog.findMany).mock.calls[0][0] as any;
    expect(auditArg.where.field.startsWith).toBe("unlock:dealer_");
  });
});

describe("路由级：webStatus 透传到 Sheet2 备注", () => {
  it("body.webStatus=\"timeout\" → Sheet2 备注标「外部检索未接入」", async () => {
    const wb = await loadWb(await POST(makeReq({ layout: "v2", webStatus: "timeout" })));
    expect(allCells(wb).join("\u0001")).toContain("外部检索未接入");
  });

  it("缺省 webStatus → 不标降级", async () => {
    const wb = await loadWb(await POST(makeReq({ layout: "v2" })));
    expect(allCells(wb).join("\u0001")).not.toContain("外部检索未接入");
  });
});
