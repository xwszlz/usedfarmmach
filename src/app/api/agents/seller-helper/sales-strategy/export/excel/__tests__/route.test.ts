/**
 * 集成测试：POST /api/agents/seller-helper/sales-strategy/export/excel（T3，含 PII 门禁）
 *
 * 覆盖点：
 *  ① 未登录 → 401 LOGIN_REQUIRED；
 *  ② 余额不足 → 402 INSUFFICIENT_CREDITS；
 *  ③ partition 非法值（"xxx"）→ 回落 "all"（断言传给 retrieveDealers 的实参）；
 *  ④ 计费顺序：buildExcel 抛错 → 500 且 deductAiUsage 未被调用；
 *  ⑤ build 成功 → 200 + xlsx MIME + Content-Disposition: attachment；
 *  ⑥ unlockedSet 构建：只认 "unlock:dealer_<id>"，lead 前缀不得混入经销商解锁集；
 *  ⑦ 端到端 PII 门禁：解析真实产物，已解锁行明文、未解锁行搜不到原始 PII。
 *
 * 说明：@/lib/sales-strategy/export 以「spy 包裹真实实现」方式 mock，
 *       故 unlockedSet 可被断言，且产物是真实 xlsx（可用 exceljs 回读）；
 *       仅 prisma / auth / 计费 / retrieveDealers 被 mock。
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

// hoisted 句柄：保存真实 buildExcel，供 beforeEach 恢复默认实现
const H = vi.hoisted(() => ({
  realBuildExcel: null as unknown as (
    dealers: any[],
    unlocked: Set<string>,
    locale?: "zh" | "en"
  ) => Promise<Buffer>,
}));

vi.mock("@/lib/sales-strategy/export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sales-strategy/export")>();
  H.realBuildExcel = actual.buildExcel;
  return { ...actual, buildExcel: vi.fn(actual.buildExcel) };
});

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { estimateAiCost, deductAiUsage } from "@/lib/credits/deduct";
import { retrieveDealers } from "@/lib/sales-strategy/dealers";
import { buildExcel } from "@/lib/sales-strategy/export";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/export/excel/route";

// ── 测试数据 ──
const UNLOCKED_ID = "abc"; // PiiAuditLog 里被解锁的经销商
const LOCKED_ID = "def"; // 未解锁经销商

const UNLOCKED_PHONE = "13800138000";
const LOCKED_PHONE = "13900139000";
const LOCKED_EMAIL = "beta@corp.com";
const LOCKED_WECHAT = "wx_def_888";

function publicDealer(id: string, partition: "cn" | "intl", name: string) {
  return {
    id,
    name,
    brands: ["claas"],
    models: ["AXION 850"],
    regions: [partition === "cn" ? "北京" : "德国"],
    nature: "授权经销商",
    grade: "A",
    sourceUrl: null,
    partition,
    phoneMasked: "***",
    wechatMasked: "微信:********",
    emailMasked: "***",
  };
}

const DOMESTIC = [publicDealer(UNLOCKED_ID, "cn", "科乐收北京")];
const INTL = [publicDealer(LOCKED_ID, "intl", "AGRAVIS")];

function makeReq(body: unknown, referer = "https://usedfarmmach.cn/zh/sales-strategy/dealers") {
  return new NextRequest("https://usedfarmmach.cn/api/agents/seller-helper/sales-strategy/export/excel", {
    method: "POST",
    headers: { referer },
    body: JSON.stringify(body),
  });
}

let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();

  // 默认：真实 buildExcel + 两分区经销商 + 明文行 + audit 日志含 dealer 与 lead 两种前缀
  vi.mocked(buildExcel).mockReset().mockImplementation(H.realBuildExcel as any);
  vi.mocked(estimateAiCost).mockReset().mockResolvedValue(100);
  vi.mocked(deductAiUsage)
    .mockReset()
    .mockResolvedValue({ ok: true, cost: 100, balance: 9900, code: "OK" } as any);
  vi.mocked(getUserFromRequest).mockReset();
  vi.mocked(retrieveDealers)
    .mockReset()
    .mockResolvedValue({ site: "cn", domestic: DOMESTIC, international: INTL } as any);

  vi.mocked(prisma.dealer.findMany).mockReset();
  vi.mocked(prisma.dealer.findMany).mockResolvedValue([
    { id: UNLOCKED_ID, phone: UNLOCKED_PHONE, wechat: "wx_abc_777", email: "alpha@corp.com" },
    { id: LOCKED_ID, phone: LOCKED_PHONE, wechat: LOCKED_WECHAT, email: LOCKED_EMAIL },
  ] as any);

  vi.mocked(prisma.piiAuditLog.findMany).mockReset();
  vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([
    { field: "unlock:dealer_abc" },
    { field: "unlock:lead_xyz" },
  ] as any);

  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
});

/** 读取响应体 → 全部单元格文本 */
async function readCells(res: Response): Promise<string[]> {
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const cells: string[] = [];
  wb.worksheets[0].eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cell.value == null ? "" : String(cell.value));
    });
  });
  return cells;
}

describe("① 鉴权 / 余额门禁（取数前短路）", () => {
  it("未登录 → 401 LOGIN_REQUIRED，且不查经销商、不生成文件、不扣费", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null as any);

    const res = await POST(makeReq({ partition: "all" }));

    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.code).toBe("LOGIN_REQUIRED");
    expect(retrieveDealers).not.toHaveBeenCalled();
    expect(buildExcel).not.toHaveBeenCalled();
    expect(deductAiUsage).not.toHaveBeenCalled();
  });

  it("余额为 0 也允许导出（导出免费，不再有余额预检）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 0 } as any);

    const res = await POST(makeReq({ partition: "all" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(retrieveDealers).toHaveBeenCalled();
    expect(deductAiUsage).not.toHaveBeenCalled();
    expect(estimateAiCost).not.toHaveBeenCalled();
  });
});

describe("③ partition 取值校验", () => {
  it("partition=\"xxx\"（非法）→ 回落 \"all\"", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);

    const res = await POST(makeReq({ partition: "xxx" }));

    expect(res.status).toBe(200);
    expect(retrieveDealers).toHaveBeenCalledWith("all");
  });

  it("partition 缺省 → \"all\"；partition=\"cn\" 原样透传", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);

    await POST(makeReq({}));
    expect(retrieveDealers).toHaveBeenLastCalledWith("all");

    await POST(makeReq({ partition: "cn" }));
    expect(retrieveDealers).toHaveBeenLastCalledWith("cn");
  });

  it("partition=\"intl\" 原样透传（导出不扣费，无 breakdown 可留痕）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);

    const res = await POST(makeReq({ partition: "intl" }));

    expect(res.status).toBe(200);
    expect(retrieveDealers).toHaveBeenCalledWith("intl");
    expect(deductAiUsage).not.toHaveBeenCalled();
  });
});

describe("④ 计费顺序：先 build 成功再扣费", () => {
  it("buildExcel 抛错 → 500 SERVER_ERROR 且 deductAiUsage 未被调用", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    vi.mocked(buildExcel).mockRejectedValueOnce(new Error("xlsx write failed"));

    const res = await POST(makeReq({ partition: "all" }));

    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.success).toBe(false);
    expect(j.code).toBe("SERVER_ERROR");
    // 红线：渲染失败绝不扣费
    expect(deductAiUsage).not.toHaveBeenCalled();
    expect(res.headers.get("content-disposition")).toBeNull();
  });
});

describe("⑤ 成功路径 + ⑥ unlockedSet 构建", () => {
  it("200：xlsx MIME + attachment；unlockedSet 只含 dealer_abc（lead 前缀不混入）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);

    const res = await POST(makeReq({ partition: "all" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const cd = res.headers.get("content-disposition") || "";
    expect(cd).toContain("attachment");
    expect(cd).toContain(".xlsx");

    // 导出免费：零 LLM 成本 ⇒ 不进计费模块
    expect(deductAiUsage).not.toHaveBeenCalled();
    expect(estimateAiCost).not.toHaveBeenCalled();

    // unlockedSet 构建：PiiAuditLog 的 "unlock:dealer_abc" → "abc"；"unlock:lead_xyz" 被排除
    const call = vi.mocked(buildExcel).mock.calls[0];
    const unlockedSet = call[1] as Set<string>;
    expect(unlockedSet.has(UNLOCKED_ID)).toBe(true);
    expect(unlockedSet.has("xyz")).toBe(false); // lead 前缀不得混入
    expect(unlockedSet.has("dealer_abc")).toBe(false); // 前缀必须剥掉
    expect(unlockedSet.size).toBe(1);

    // 审计查询条件：按当前用户 + dealer 前缀
    const auditArg = vi.mocked(prisma.piiAuditLog.findMany).mock.calls[0][0] as any;
    expect(auditArg.where.actorId).toBe("u1");
    expect(auditArg.where.field.startsWith).toBe("unlock:dealer_");
  });
});

describe("⑦ 端到端 PII 门禁（解析真实产物）", () => {
  it("已解锁行写明文；未解锁行仅脱敏，产物里搜不到原始电话/邮箱/微信", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);

    const res = await POST(makeReq({ partition: "all" }));
    expect(res.status).toBe(200);

    const cells = await readCells(res);
    const flat = cells.join("\u0001");

    // 已解锁经销商（abc）：明文
    expect(cells).toContain(UNLOCKED_PHONE);
    expect(cells).toContain("wx_abc_777");
    expect(cells).toContain("alpha@corp.com");

    // 未解锁经销商（def）：只剩脱敏值
    expect(cells).toContain("139****9000");
    expect(cells).toContain("be***@corp.com");
    expect(cells).toContain("微信:********");

    // 红线：原始 PII 不得出现
    expect(flat).not.toContain(LOCKED_PHONE);
    expect(flat).not.toContain(LOCKED_EMAIL);
    expect(flat).not.toContain(LOCKED_WECHAT);
  });

  it("没有任何解锁记录（audit 为空）→ 全部脱敏，明文一个都不出现", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([] as any);

    const res = await POST(makeReq({ partition: "all" }));
    const flat = (await readCells(res)).join("\u0001");

    expect(flat).not.toContain(UNLOCKED_PHONE);
    expect(flat).not.toContain(LOCKED_PHONE);
    expect(flat).not.toContain("alpha@corp.com");
    expect(flat).not.toContain(LOCKED_EMAIL);
    expect(flat).not.toContain("wx_abc_777");
    expect(flat).not.toContain(LOCKED_WECHAT);
  });

  it("经销商为空（两分区都空）→ 200 + 仅表头的 xlsx，不抛错", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    vi.mocked(retrieveDealers).mockResolvedValue({ site: "cn", domestic: [], international: [] } as any);

    const res = await POST(makeReq({ partition: "all" }));

    expect(res.status).toBe(200);
    const cells = await readCells(res);
    expect(cells).toContain("电话");
    // 无经销时不查明文表（ids.length === 0 短路）
    expect(prisma.dealer.findMany).not.toHaveBeenCalled();
  });
});
