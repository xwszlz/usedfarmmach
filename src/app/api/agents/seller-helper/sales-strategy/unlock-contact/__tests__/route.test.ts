/**
 * 集成测试：POST /api/agents/seller-helper/sales-strategy/unlock-contact
 * 风险点：① 默认掩码（无 confirmedResponsibility 时不返回明文）② 付费后返回明文 + 写 PiiAuditLog
 *         ③ 责任确认逻辑（缺 candidateId / 未确认责任 / 线索不存在 / 余额不足）
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
vi.mock("@/lib/credits/deduct", () => ({
  deductAiUsage: vi.fn(),
  estimateAiCost: vi.fn(),
  UNLOCK_ESTIMATED_TOKENS: 800,
}));
vi.mock("@/lib/sales-strategy/retrieval", () => ({
  fetchLeadDealerContact: vi.fn(),
}));

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deductAiUsage, estimateAiCost } from "@/lib/credits/deduct";
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
  });

  it("缺少 candidateId → 400 NO_CANDIDATE", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    const res = await POST(makeReq({ responsibilityConfirmed: true }));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.code).toBe("NO_CANDIDATE");
  });
});

describe("② 付费后揭示明文 + PiiAuditLog", () => {
  it("确认责任 + 余额足 + 扣费成功 → 返回明文电话 + 写 PiiAuditLog（谁/何时/哪个线索/用途）", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    (estimateAiCost as any).mockResolvedValue(100);
    (fetchLeadDealerContact as any).mockResolvedValue({
      candidateId: "lead_x",
      type: "lead",
      name: "买家",
      phone: PLAIN,
      wechat: "wx",
      email: "a@b.com",
      productId: null,
    });
    (deductAiUsage as any).mockResolvedValue({ ok: true, cost: 100, balance: 9900 });

    const res = await POST(makeReq({ candidateId: "lead_x", responsibilityConfirmed: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.data.phone).toBe(PLAIN); // 明文

    // PiiAuditLog 留痕
    expect(prisma.piiAuditLog.create).toHaveBeenCalled();
    const call = (prisma.piiAuditLog.create as any).mock.calls[0][0].data;
    expect(call.actorId).toBe("u1");
    expect(call.action).toBe("view_full");
    expect(call.purpose).toBe("ai_sales_strategy_unlock");
    expect(call.field).toBe("unlock:lead_x");
  });

  it("线索不存在 → 404 NOT_FOUND（扣费/PiiAuditLog 均不发生）", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 99999 });
    (estimateAiCost as any).mockResolvedValue(100);
    (fetchLeadDealerContact as any).mockResolvedValue(null);
    const res = await POST(makeReq({ candidateId: "lead_x", responsibilityConfirmed: true }));
    expect(res.status).toBe(404);
    expect(deductAiUsage).not.toHaveBeenCalled();
    expect(prisma.piiAuditLog.create).not.toHaveBeenCalled();
  });

  it("余额不足（预检）→ 402，且 PiiAuditLog 不写（付费未成不泄露）", async () => {
    (getUserFromRequest as any).mockResolvedValue({ id: "u1", credits: 0 });
    (estimateAiCost as any).mockResolvedValue(100); // 需 100 > 余额 0
    const res = await POST(makeReq({ candidateId: "lead_x", responsibilityConfirmed: true }));
    expect(res.status).toBe(402);
    expect(fetchLeadDealerContact).not.toHaveBeenCalled();
    expect(deductAiUsage).not.toHaveBeenCalled();
    expect(prisma.piiAuditLog.create).not.toHaveBeenCalled();
  });
});
