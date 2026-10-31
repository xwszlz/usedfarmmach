/**
 * 回归测试：超管 / 管理员导出 PDF 同样必须拿到**明文**，普通用户仍**脱敏**。
 *
 * 与 `../../../export/excel/__tests__/route-admin-full-pii.test.ts` 同一命题、同一验收口径：
 * 两个导出路由必须**同时**修好，否则会出现「Excel 明文、PDF 掩码」这种同一用户同一数据
 * 两种结果的故障（也正是把前缀常量抽到 `@/lib/sales-strategy/pii-export` 的原因）。
 *
 * 覆盖点：
 *  ① `super_admin` ⇒ 经销商/线索的 `*Masked` 槽位被明文覆盖（`buildPdf` 只读这三个槽位）；
 *  ② `admin` ⇒ 明文 + 一条 `PiiAuditLog(action:"export")` 汇总留痕；
 *  ③ `seller` ⇒ `maskPhone` / `maskEmail` / 微信占位 / 「已隐藏」，且不写 export 留痕；
 *  ④ 留痕 `field` 不以 `unlock:` 开头；
 *  ⑤ 仅线索 / 混合两类候选时，field 的 scope 正确（`lead` / `dealer+lead`）。
 *
 * 说明：`@/lib/sales-strategy/export` 的 `buildPdf` 被替换为「记录 payload + 返回桩字节」，
 *       因此断言的是**渲染层真正收到的值**（比解 PDF 文本更稳、更快，且不依赖字体）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    piiAuditLog: { findMany: vi.fn(), create: vi.fn() },
    dealer: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
  },
}));
// 路由只从该模块取运行时符号 buildPdf（其余全是 type，编译期已擦除）
vi.mock("@/lib/sales-strategy/export", () => ({
  buildPdf: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])),
}));

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildPdf } from "@/lib/sales-strategy/export";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/export/pdf/route";

// ── 固定测试数据 ──

const DEALER_ID = "dx";
const LEAD_ID = "ly";
const D_PHONE = "13800138000"; // maskPhone ⇒ 138****8000
const D_EMAIL = "alpha@corp.com"; // maskEmail ⇒ al***@corp.com
const D_WECHAT = "wx_dx_777";
const D_CONTACT = "张伟";
const L_PHONE = "13900139000";
const L_EMAIL = "beta@buyer.com";

const DEALER_ROW = {
  id: DEALER_ID,
  name: "AGRAVIS Technik",
  brands: ["claas"],
  models: ["AXION 850"],
  regions: ["德国"],
  role: "授权经销",
  country: "德国",
  city: "Drenthe",
  contactPerson: D_CONTACT,
  phone: D_PHONE,
  wechat: D_WECHAT,
  email: D_EMAIL,
};

const LEAD_ROW = {
  id: LEAD_ID,
  name: "塔什干买家",
  brand: "东方红",
  model: "YTO-1204",
  region: "乌兹别克",
  location: "塔什干",
  phone: L_PHONE,
  wechat: "wx_lead_1",
  email: L_EMAIL,
};

const BODY = {
  strategy: { summary: "先出清库存" },
  product: { brandName: "东方红", modelName: "YTO-1204" },
  channels: [
    { candidateId: `dealer_${DEALER_ID}`, rationale: "机型匹配" },
    { candidateId: `lead_${LEAD_ID}`, rationale: "本地买家" },
  ],
};

function makeReq(body: unknown) {
  return new NextRequest("https://usedfarmmach.cn/api/agents/seller-helper/sales-strategy/export/pdf", {
    method: "POST",
    headers: { referer: "https://usedfarmmach.cn/zh/products/p1" },
    body: JSON.stringify(body),
  });
}

/** 取本次渲染真正收到的 payload 里的 channels（按 candidateId 索引） */
function capturedChannels(): any[] {
  const call = vi.mocked(buildPdf).mock.calls.at(-1);
  if (!call) throw new Error("buildPdf 未被调用");
  return (call[0] as any).channels ?? [];
}

function channelOf(candidateId: string): any {
  const hit = capturedChannels().find((c) => c.candidateId === candidateId);
  if (!hit) throw new Error(`payload 里没有 ${candidateId}`);
  return hit;
}

let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  // 默认：**没有任何解锁记录**（超管踩坑现场）
  vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([] as any);
  vi.mocked(prisma.piiAuditLog.create).mockResolvedValue({ id: "audit_pdf" } as any);
  vi.mocked(prisma.dealer.findMany).mockResolvedValue([DEALER_ROW] as any);
  vi.mocked(prisma.lead.findMany).mockResolvedValue([LEAD_ROW] as any);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
});

describe("① super_admin 导出 PDF ⇒ 明文写进 *Masked 槽位", () => {
  beforeEach(() => {
    vi.mocked(getUserFromRequest).mockResolvedValue({
      id: "u_super",
      role: "super_admin",
    } as any);
  });

  it("经销商：电话 / 邮箱 / 微信 / 联系人全部明文，unlocked=true", async () => {
    const res = await POST(makeReq(BODY));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");

    const ch = channelOf(`dealer_${DEALER_ID}`);
    expect(ch.phoneMasked).toBe(D_PHONE);
    expect(ch.emailMasked).toBe(D_EMAIL);
    expect(ch.wechatMasked).toBe(D_WECHAT);
    expect(ch.contactPersonMasked).toBe(D_CONTACT);
    expect(ch.phone).toBe(D_PHONE);
    expect(ch.unlocked).toBe(true);
  });

  it("线索：电话 / 邮箱同样明文", async () => {
    await POST(makeReq(BODY));

    const ch = channelOf(`lead_${LEAD_ID}`);
    expect(ch.phoneMasked).toBe(L_PHONE);
    expect(ch.emailMasked).toBe(L_EMAIL);
    expect(ch.phone).toBe(L_PHONE);
    expect(ch.unlocked).toBe(true);
  });

  it("管理员不再查询「逐条解锁」审计表", async () => {
    await POST(makeReq(BODY));
    expect(prisma.piiAuditLog.findMany).not.toHaveBeenCalled();
  });
});

describe("② admin 导出 PDF ⇒ 明文 + 一条汇总留痕", () => {
  beforeEach(() => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u_admin", role: "admin" } as any);
  });

  it("admin 与 super_admin 同权", async () => {
    await POST(makeReq(BODY));
    expect(channelOf(`dealer_${DEALER_ID}`).phoneMasked).toBe(D_PHONE);
    expect(channelOf(`lead_${LEAD_ID}`).phoneMasked).toBe(L_PHONE);
  });

  it("留痕：一次导出一条，action=export，purpose 记录渠道/角色/行数", async () => {
    await POST(makeReq(BODY));

    expect(prisma.piiAuditLog.create).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.piiAuditLog.create).mock.calls[0][0].data as any;
    expect(data.action).toBe("export");
    expect(data.actorId).toBe("u_admin");
    expect(data.targetUserId).toBeNull();
    expect(data.targetListingId).toBeNull();
    expect(String(data.purpose)).toContain("channel=pdf");
    expect(String(data.purpose)).toContain("rows=2");
    expect(String(data.purpose)).toContain("dealer=1;lead=1");
  });
});

describe("④ 留痕 field 不得以 unlock: 开头（最关键防回归）", () => {
  beforeEach(() => {
    vi.mocked(getUserFromRequest).mockResolvedValue({
      id: "u_super",
      role: "super_admin",
    } as any);
  });

  it("经销商 + 线索混合导出 ⇒ field=export:dealer+lead_batch，且不是 unlock: 前缀", async () => {
    await POST(makeReq(BODY));

    const data = vi.mocked(prisma.piiAuditLog.create).mock.calls[0][0].data as any;
    const field = String(data.field);
    expect(field).toBe("export:dealer+lead_batch");
    expect(field.startsWith("unlock:")).toBe(false);
    expect(field.startsWith("unlock:dealer_")).toBe(false);
    expect(field.startsWith("unlock:lead_")).toBe(false);
  });

  it("只有线索 ⇒ field=export:lead_batch（不会被 buildUnlockedContactSets 认成 unlock:lead_*）", async () => {
    await POST(makeReq({ ...BODY, channels: [{ candidateId: `lead_${LEAD_ID}` }] }));

    const field = String(
      (vi.mocked(prisma.piiAuditLog.create).mock.calls[0][0].data as any).field
    );
    expect(field).toBe("export:lead_batch");
    expect(field.startsWith("unlock:")).toBe(false);
  });
});

describe("③ 普通用户（seller）⇒ 仍然脱敏，行为不变", () => {
  beforeEach(() => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u_seller", role: "seller" } as any);
  });

  it("经销商 / 线索一律走统一脱敏出口，且不写 export 留痕", async () => {
    const res = await POST(makeReq(BODY));
    expect(res.status).toBe(200);

    const d = channelOf(`dealer_${DEALER_ID}`);
    expect(d.phoneMasked).toBe("138****8000");
    expect(d.emailMasked).toBe("al***@corp.com");
    expect(d.wechatMasked).toBe("微信:********");
    expect(d.contactPersonMasked).toBe("已隐藏");
    expect(d.phone).toBeNull();
    expect(d.unlocked).toBe(false);

    const l = channelOf(`lead_${LEAD_ID}`);
    expect(l.phoneMasked).toBe("139****9000");
    expect(l.emailMasked).toBe("be***@buyer.com");
    expect(l.unlocked).toBe(false);

    expect(prisma.piiAuditLog.create).not.toHaveBeenCalled();
  });

  it("seller 仍按「逐条解锁」放行：解锁过的线索明文", async () => {
    vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([
      { field: `unlock:lead_${LEAD_ID}` },
    ] as any);

    await POST(makeReq(BODY));

    expect(channelOf(`lead_${LEAD_ID}`).phoneMasked).toBe(L_PHONE);
    // 未解锁的经销商仍然掩码（证明逐条口径没被放宽）
    expect(channelOf(`dealer_${DEALER_ID}`).phoneMasked).toBe("138****8000");
  });
});
