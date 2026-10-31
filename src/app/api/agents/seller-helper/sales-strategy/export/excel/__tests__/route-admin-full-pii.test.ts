/**
 * 回归测试：超管 / 管理员导出 Excel 必须拿到**明文**，普通用户仍**脱敏**。
 *
 * 背景（老板原话）：「导出 Excel 这里边还有掩码呢，这不行。」
 *   改造前判据只有「是否点过解锁按钮」（PiiAuditLog 里的 `unlock:dealer_*`），
 *   一行角色判断都没有 ⇒ 超管没逐个点过解锁 ⇒ 解锁集为空 ⇒ 整表打码。
 *
 * 覆盖点（对应验收标准）：
 *  ① `super_admin` 导出 ⇒ 电话 / 邮箱 / 微信 / 联系人全为明文（layout 1 与 layout 2 都测）；
 *  ② `admin` 导出 ⇒ 明文，且写一条 `PiiAuditLog(action:"export")`；
 *  ③ `seller` 导出 ⇒ 仍然脱敏（逐条解锁口径不变），且**不写** export 留痕；
 *  ④ 留痕 `field` **不以 `unlock:` 开头**（最关键防回归：带 unlock: 前缀 = 永久解锁 = 权限泄漏）；
 *  ⑤ 留痕记录回灌到解锁集后**不能**解锁任何经销商（端到端验④）。
 *
 * 说明：本文件用**真实** buildExcel 渲染（只有 prisma / auth / retrieveDealers 被 mock），
 *       断言直接回读 xlsx 产物，因此「明文还是掩码」是端到端结论，不依赖内部实现细节。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import * as ExcelJS from "exceljs";

vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    dealer: { findMany: vi.fn() },
    piiAuditLog: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/sales-strategy/dealers", () => ({ retrieveDealers: vi.fn() }));

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { retrieveDealers } from "@/lib/sales-strategy/dealers";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/export/excel/route";

// ── 固定测试数据（明文与掩码互不包含，便于「搜不到明文」类断言）──

const PHONE = "13800138000"; // maskPhone ⇒ 138****8000
const EMAIL = "alpha@corp.com"; // maskEmail ⇒ al***@corp.com
const WECHAT = "wx_d1_777";
const CONTACT = "张伟";
const DEALER_ID = "d1";

/** retrieveDealers 返回的「公开（已脱敏）」经销商 */
const PUBLIC_DEALER = {
  id: DEALER_ID,
  name: "科乐收北京",
  brands: ["claas"],
  models: ["AXION 850"],
  regions: ["北京"],
  nature: "授权经销商",
  grade: "A",
  sourceUrl: "https://example.com/dealers/1",
  partition: "cn" as const,
  phoneMasked: "138****8000",
  wechatMasked: "微信:********",
  emailMasked: "al***@corp.com",
};

/** prisma.dealer.findMany 返回的「明文」行（路由内部二次查库拿到的真实值） */
const PLAIN_DEALER = {
  id: DEALER_ID,
  phone: PHONE,
  wechat: WECHAT,
  email: EMAIL,
  location: "中国 · 北京",
  country: "中国",
  city: "北京",
  contactPerson: CONTACT,
  role: "授权经销",
  priority: "A",
  suggestedPrice: null,
  followStatus: "未联系",
  sourcePage: "公开渠道·example.com·2026-10-13",
};

function makeReq(body: unknown) {
  return new NextRequest(
    "https://usedfarmmach.cn/api/agents/seller-helper/sales-strategy/export/excel",
    {
      method: "POST",
      headers: { referer: "https://usedfarmmach.cn/zh/sales-strategy/dealers" },
      body: JSON.stringify(body),
    }
  );
}

/** 把整张 Sheet（缺省第 1 张）的所有单元格拼成一串，便于 contains 断言 */
async function readSheetText(res: Response, sheetName?: string): Promise<string> {
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
  if (!ws) throw new Error(`Sheet 不存在: ${sheetName}`);
  const cells: string[] = [];
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cell.value == null ? "" : String(cell.value));
    });
  });
  return cells.join("\u0001");
}

let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  // 默认：库里**没有任何解锁记录**（正是超管踩坑的现场），只有一条线索解锁干扰项
  vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([] as any);
  vi.mocked(prisma.piiAuditLog.create).mockResolvedValue({ id: "audit_1" } as any);
  vi.mocked(prisma.dealer.findMany).mockResolvedValue([PLAIN_DEALER] as any);
  vi.mocked(retrieveDealers).mockResolvedValue({
    site: "cn",
    domestic: [PUBLIC_DEALER],
    international: [],
  } as any);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
});

describe("① super_admin 导出 ⇒ 明文（layout 2 三 Sheet 版式）", () => {
  beforeEach(() => {
    vi.mocked(getUserFromRequest).mockResolvedValue({
      id: "u_admin",
      role: "super_admin",
      credits: 0,
    } as any);
  });

  it("未点过任何「解锁」也能拿到明文电话 / 邮箱 / 联系人", async () => {
    const res = await POST(makeReq({ partition: "all", layout: "v2" }));

    expect(res.status).toBe(200);
    const text = await readSheetText(res, "渠道联系总表");

    // 明文必须出现
    expect(text).toContain(PHONE);
    expect(text).toContain(EMAIL);
    expect(text).toContain(CONTACT);
    // 掩码不得出现（掩码来自真实 maskPhone / maskEmail，端到端证明门禁被绕过）
    expect(text).not.toContain("138****8000");
    expect(text).not.toContain("al***@corp.com");
    expect(text).not.toContain("已隐藏");
  });

  it("管理员走全量放行 ⇒ 不再查询「逐条解锁」审计表（省一次 DB 往返）", async () => {
    await POST(makeReq({ partition: "all", layout: "v2" }));
    expect(prisma.piiAuditLog.findMany).not.toHaveBeenCalled();
  });
});

describe("① super_admin 导出 ⇒ 明文（layout 1 legacy 11 列版式）", () => {
  it("legacy 路径同样给明文（含微信列），不再受解锁集影响", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({
      id: "u_admin",
      role: "super_admin",
    } as any);

    const res = await POST(makeReq({ partition: "all" })); // 不传 layout ⇒ legacy

    expect(res.status).toBe(200);
    const text = await readSheetText(res);

    expect(text).toContain(PHONE);
    expect(text).toContain(EMAIL);
    expect(text).toContain(WECHAT);
    expect(text).not.toContain("138****8000");
    expect(text).not.toContain("al***@corp.com");
    expect(text).not.toContain("微信:********");
  });
});

describe("② admin 导出 ⇒ 明文 + 写审计留痕", () => {
  beforeEach(() => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u_admin2", role: "admin" } as any);
  });

  it("admin 与 super_admin 同权：明文照出", async () => {
    const res = await POST(makeReq({ partition: "cn", layout: "v2" }));

    expect(res.status).toBe(200);
    const text = await readSheetText(res, "渠道联系总表");
    expect(text).toContain(PHONE);
    expect(text).toContain(EMAIL);
    expect(text).not.toContain("138****8000");
  });

  it("一次导出只写一条汇总留痕：action=export、actorId=当前用户、rows=行数", async () => {
    await POST(makeReq({ partition: "cn", layout: "v2" }));

    expect(prisma.piiAuditLog.create).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.piiAuditLog.create).mock.calls[0][0].data as any;
    expect(data.action).toBe("export");
    expect(data.actorId).toBe("u_admin2");
    // 批量导出无单一对象 ⇒ 不编造
    expect(data.targetUserId).toBeNull();
    expect(data.targetListingId).toBeNull();
    expect(String(data.purpose)).toContain("admin_export_full_pii");
    expect(String(data.purpose)).toContain("channel=excel");
    expect(String(data.purpose)).toContain("rows=1");
  });
});

describe("④ 留痕 field 不得以 unlock: 开头（最关键防回归）", () => {
  it("超管导出后写入的 field 前缀是 export:，绝不可能是 unlock:", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({
      id: "u_admin",
      role: "super_admin",
    } as any);

    await POST(makeReq({ partition: "all", layout: "v2" }));

    const data = vi.mocked(prisma.piiAuditLog.create).mock.calls[0][0].data as any;
    const field = String(data.field);
    expect(field).toBe("export:dealer_batch");
    // 双重锁：任何 unlock: 前缀都会让 buildUnlockedDealerSet 把该 id 当「已解锁」
    expect(field.startsWith("unlock:")).toBe(false);
    expect(field.startsWith("unlock:dealer_")).toBe(false);
  });
});

describe("③ 普通用户（seller）⇒ 仍然脱敏，行为不变", () => {
  beforeEach(() => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u_seller", role: "seller" } as any);
  });

  it("没有任何解锁记录 ⇒ 整表掩码，产物里搜不到明文", async () => {
    const res = await POST(makeReq({ partition: "all", layout: "v2" }));

    expect(res.status).toBe(200);
    const text = await readSheetText(res, "渠道联系总表");

    expect(text).toContain("138****8000");
    expect(text).toContain("al***@corp.com");
    expect(text).toContain("已隐藏"); // 联系人
    expect(text).not.toContain(PHONE);
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(CONTACT);
  });

  it("seller 导出不写 export 留痕（只有管理员全量明文才留痕）", async () => {
    await POST(makeReq({ partition: "all", layout: "v2" }));
    expect(prisma.piiAuditLog.create).not.toHaveBeenCalled();
  });

  it("seller 仍按「逐条解锁」放行：解锁过的经销商明文，未解锁的掩码", async () => {
    vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([
      { field: `unlock:dealer_${DEALER_ID}` },
    ] as any);

    const res = await POST(makeReq({ partition: "all", layout: "v2" }));
    const text = await readSheetText(res, "渠道联系总表");

    expect(text).toContain(PHONE);
    expect(text).not.toContain("138****8000");
  });
});

describe("⑤ 端到端：留痕记录回灌后不得解锁任何经销商", () => {
  it("把超管导出写的 field 当成「历史解锁记录」喂给 seller ⇒ 仍然掩码", async () => {
    // 1) 超管导出（同时产生留痕）
    vi.mocked(getUserFromRequest).mockResolvedValue({
      id: "u_admin",
      role: "super_admin",
    } as any);
    await POST(makeReq({ partition: "all", layout: "v2" }));
    const written = vi.mocked(prisma.piiAuditLog.create).mock.calls[0][0].data as any;

    // 2) 同一条留痕被当作该用户的历史审计记录
    vi.clearAllMocks();
    vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([{ field: written.field }] as any);
    vi.mocked(prisma.piiAuditLog.create).mockResolvedValue({ id: "audit_2" } as any);
    vi.mocked(prisma.dealer.findMany).mockResolvedValue([PLAIN_DEALER] as any);
    vi.mocked(retrieveDealers).mockResolvedValue({
      site: "cn",
      domestic: [PUBLIC_DEALER],
      international: [],
    } as any);

    // 3) 换成 seller 再导一次 ⇒ 若 field 用了 unlock: 前缀，这里会变成明文（权限泄漏）
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u_admin", role: "seller" } as any);
    const res = await POST(makeReq({ partition: "all", layout: "v2" }));
    const text = await readSheetText(res, "渠道联系总表");

    expect(text).toContain("138****8000");
    expect(text).not.toContain(PHONE);
  });
});
