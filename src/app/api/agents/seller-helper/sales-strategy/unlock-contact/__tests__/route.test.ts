/**
 * 集成测试：POST /api/agents/seller-helper/sales-strategy/unlock-contact
 * 风险点：① 默认掩码（未确认责任时不返回明文）
 *         ② 解锁后返回明文 + 写 PiiAuditLog（**已免费**：不扣费，但审计必须留痕）
 *         ③ 责任确认逻辑（缺 candidateId / 未确认责任 / 线索不存在）
 *         ④ 免费口径回归锁：余额为 0 也能解锁，响应 cost 恒为 0、free 为 true
 *
 * 运行：npm test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    piiAuditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/lib/sales-strategy/retrieval", () => ({
  fetchLeadDealerContact: vi.fn(),
}));

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchLeadDealerContact } from "@/lib/sales-strategy/retrieval";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/unlock-contact/route";

const PLAIN = "13800002222";

function makeReq(body: unknown) {
  return new NextRequest("https://usedfarmmach.cn/zh/products/p1", {
    method: "POST",
    headers: { referer: "https://usedfarmmach.cn/zh/products/p1" },
    body: JSON.stringify(body),
  });
}

function mockContact() {
  (fetchLeadDealerContact as any).mockResolvedValue({
    candidateId: "lead_x",
    type: "lead",
    name: "买家",
    phone: PLAIN,
    wechat: "wx",
    email: "a@b.com",
    productId: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("① 默认掩码 / 责任确认前置", () => {
  it("未确认责任 → 400 RESPONSIBILITY_REQUIRED，且不查询明文联系（杜绝误发 PII）", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    const res = await POST(makeReq({ candidateId: "lead_x" })); // 无 responsibilityConfirmed
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.code).toBe("RESPONSIBILITY_REQUIRED");
    expect(fetchLeadDealerContact).not.toHaveBeenCalled();
    expect(prisma.piiAuditLog.create).not.toHaveBeenCalled();
  });

  it("缺少 candidateId → 400 NO_CANDIDATE", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    const res = await POST(makeReq({ responsibilityConfirmed: true }));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.code).toBe("NO_CANDIDATE");
  });

  it("未登录 → 401 LOGIN_REQUIRED（免费也要登录，防匿名爬联系方式）", async () => {
    (getUserFromRequest as any).mockResolvedValue(null);
    const res = await POST(makeReq({ candidateId: "lead_x", responsibilityConfirmed: true }));
    expect(res.status).toBe(401);
    expect(fetchLeadDealerContact).not.toHaveBeenCalled();
  });
});

describe("② 解锁后揭示明文 + PiiAuditLog（不扣费）", () => {
  it("确认责任 → 返回明文电话 + 写 PiiAuditLog；cost=0、free=true（不再扣积分）", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    mockContact();

    const res = await POST(makeReq({ candidateId: "lead_x", responsibilityConfirmed: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.data.phone).toBe(PLAIN); // 明文
    // 免费口径：cost 恒为 0，且显式标记 free
    expect(j.data.cost).toBe(0);
    expect(j.data.free).toBe(true);
    // 余额原样回报（未被扣减）
    expect(j.data.balance).toBe(99999);

    // PiiAuditLog 留痕
    expect(prisma.piiAuditLog.create).toHaveBeenCalled();
    const call = (prisma.piiAuditLog.create as any).mock.calls[0][0].data;
    expect(call.actorId).toBe("u1");
    expect(call.action).toBe("view_full");
    expect(call.purpose).toBe("ai_sales_strategy_unlock");
    expect(call.field).toBe("unlock:lead_x");
  });

  it("线索不存在 → 404 NOT_FOUND（PiiAuditLog 不写）", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    (fetchLeadDealerContact as any).mockResolvedValue(null);
    const res = await POST(makeReq({ candidateId: "lead_x", responsibilityConfirmed: true }));
    expect(res.status).toBe(404);
    expect(prisma.piiAuditLog.create).not.toHaveBeenCalled();
  });
});

describe("④ 免费口径回归锁：余额为 0 也必须能解锁（旧实现会 402）", () => {
  it("credits=0 → 仍 200 并返回明文，cost=0，balance=0", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 0 });
    mockContact();

    const res = await POST(makeReq({ candidateId: "lead_x", responsibilityConfirmed: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.phone).toBe(PLAIN);
    expect(j.data.cost).toBe(0);
    expect(j.data.balance).toBe(0);
    // 审计不能因为免费而丢
    expect(prisma.piiAuditLog.create).toHaveBeenCalled();
  });
});
