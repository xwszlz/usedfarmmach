/**
 * 导出免计费守卫（EXPORT_FREE_GUARD）回归锁
 * ─────────────────────────────────────────────────────────
 * 钉死「导出（PDF / Excel）不扣费」这条业务红线。
 *
 * 机制：把 `@/lib/credits/spend` 整体 mock，令 `deductCredits` 成为一个**可观测的 spy**；
 *   然后驱动 PDF / Excel 两条导出路由跑完【全部】分支（普通用户、余额 0、渲染失败 500、
 *   管理员超管明文留痕、未登录 401），断言 `deductCredits` 全程【从未被调用】。
 *
 * 为什么这是硬锁：CreditTransaction（含 0 金额流水）的唯一写入入口就是 `deductCredits`
 *   （FIFO CreditLot 扣减）；导出链路里 `recordAdminFullPiiExport` 只写 PiiAuditLog（审计），
 *   不写 CreditTransaction。因此「deductCredits 未调用」⇔「导出无任何扣费流水（含 0 金额）」。
 *
 * 任何「导出链路偷偷引入计费」的改动（import 了 deductCredits 并调用，或在渲染前/后补一段
 *   扣费）都会让本测试变红 —— 这是防回归的唯一硬锁，【禁止】靠删测试来通过。
 *
 * 运行：
 *   npx vitest run src/app/api/agents/seller-helper/sales-strategy/export/__tests__/export-charge-guard.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── mock：鉴权 ──
vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));

// ── mock：DB（prisma 全部返回空，导出不依赖具体数据；避免单测真连 Neon 超时）──
vi.mock("@/lib/db", () => ({
  prisma: {
    piiAuditLog: { findMany: vi.fn(async () => []) },
    dealer: { findMany: vi.fn(async () => []) },
    lead: { findMany: vi.fn(async () => []) },
  },
}));

// ── 🔒 核心 mock：计费模块 ── deductCredits 必须是可观测 spy ──
// 用 importOriginal 保留其它导出，仅把 deductCredits 替换成 spy，
// 这样未来若有人 import 了 spend 的其它函数也不会因未定义而误报。
vi.mock("@/lib/credits/spend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/credits/spend")>();
  return { ...actual, deductCredits: vi.fn(async () => ({ ok: true, credits: 0, required: 0 })) };
});

// ── mock：PII 门禁 / 审计（recordAdminFullPiiExport 是留痕、非计费）──
vi.mock("@/lib/sales-strategy/pii-export", () => ({
  UNLOCK_FIELD_PREFIX: "unlock:",
  DEALER_UNLOCK_FIELD_PREFIX: "unlock:dealer_",
  buildUnlockedContactSets: vi.fn(() => ({ dealers: new Set<string>(), leads: new Set<string>() })),
  buildUnlockedDealerSet: vi.fn(() => new Set<string>()),
  recordAdminFullPiiExport: vi.fn(async () => ({})),
}));
vi.mock("@/lib/pii", () => ({
  canViewFullPii: vi.fn(() => false),
  maskPhone: vi.fn((p: string | null) => (p ? "***" : p)),
  maskEmail: vi.fn((e: string | null) => (e ? "***" : e)),
}));

// ── mock：渲染（本测试只关心计费锁，不跑真实 pdf-lib / exceljs）──
vi.mock("@/lib/sales-strategy/export", () => ({
  buildPdf: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
  buildExcel: vi.fn(async () => Buffer.from([1, 2, 3, 4])),
}));

// ── mock：Excel 路由依赖的经销商取数 / 国家城市解析 ──
vi.mock("@/lib/sales-strategy/dealers", () => ({
  retrieveDealers: vi.fn(async () => ({ site: "cn", domestic: [], international: [] })),
}));
vi.mock("@/lib/sales-strategy/derive", () => ({
  splitCountryCity: vi.fn(() => ({ country: null, city: null })),
}));

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewFullPii } from "@/lib/pii";
import { deductCredits } from "@/lib/credits/spend";
import { recordAdminFullPiiExport } from "@/lib/sales-strategy/pii-export";
import { retrieveDealers } from "@/lib/sales-strategy/dealers";
import { buildPdf, buildExcel } from "@/lib/sales-strategy/export";
import { POST as POST_PDF } from "@/app/api/agents/seller-helper/sales-strategy/export/pdf/route";
import { POST as POST_EXCEL } from "@/app/api/agents/seller-helper/sales-strategy/export/excel/route";

function pdfReq(body: unknown) {
  return new NextRequest("https://usedfarmmach.cn/api/agents/seller-helper/sales-strategy/export/pdf", {
    method: "POST",
    headers: { referer: "https://usedfarmmach.cn/zh/products/p1" },
    body: JSON.stringify(body),
  });
}
function excelReq(body: unknown) {
  return new NextRequest("https://usedfarmmach.cn/api/agents/seller-helper/sales-strategy/export/excel", {
    method: "POST",
    headers: { referer: "https://usedfarmmach.cn/zh/sales-strategy/dealers" },
    body: JSON.stringify(body),
  });
}

const OK_USER = { id: "u1", role: "seller", credits: 99999 } as any;
const ZERO_USER = { id: "u1", role: "seller", credits: 0 } as any;
const ADMIN_USER = { id: "admin1", role: "super_admin", credits: 99999 } as any;

beforeEach(() => {
  vi.clearAllMocks();
  // 默认：计费 spy 成功；渲染桩成功（每轮重置，避免上一轮 mockRejectedValueOnce 泄漏）
  vi.mocked(deductCredits).mockResolvedValue({ ok: true, credits: 0, required: 0 } as any);
  vi.mocked(buildPdf).mockImplementation(async () => new Uint8Array([1, 2, 3, 4]));
  vi.mocked(buildExcel).mockImplementation(async () => Buffer.from([1, 2, 3, 4]));
  vi.mocked(retrieveDealers).mockResolvedValue({ site: "cn", domestic: [], international: [] } as any);
  vi.mocked(canViewFullPii).mockReturnValue(false);
  vi.mocked(prisma.dealer.findMany).mockResolvedValue([] as any);
});

describe("PDF 导出免计费守卫", () => {
  it("普通用户（余额充足）正常导出 → 200 且 deductCredits 从未调用", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(OK_USER);
    const res = await POST_PDF(pdfReq({ strategy: {}, channels: [] }));
    expect(res.status).toBe(200);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("余额为 0 也照常导出（无余额预检/熔断分支）→ deductCredits 未调用", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(ZERO_USER);
    const res = await POST_PDF(pdfReq({ strategy: {}, channels: [] }));
    expect(res.status).toBe(200);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("渲染失败 → 500 且不扣费（无「先扣费再渲染」回退）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(OK_USER);
    vi.mocked(buildPdf).mockRejectedValueOnce(new Error("render boom"));
    const res = await POST_PDF(pdfReq({ strategy: {}, channels: [] }));
    expect(res.status).toBe(500);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("管理员(fullPii)导出 → 走审计留痕 recordAdminFullPiiExport，但【不】计费", async () => {
    // 让服务端重取能命中一条经销商，使 channels 非空 ⇒ 触发审计留痕分支
    vi.mocked(getUserFromRequest).mockResolvedValue(ADMIN_USER);
    vi.mocked(canViewFullPii).mockReturnValue(true);
    vi.mocked(prisma.dealer.findMany).mockResolvedValue([
      {
        id: "x1",
        name: "X",
        brands: [],
        models: [],
        regions: [],
        role: null,
        country: null,
        city: null,
        contactPerson: null,
        phone: "13900000000",
        wechat: "wx_x",
        email: "a@b.com",
      },
    ] as any);
    const res = await POST_PDF(
      pdfReq({ strategy: {}, channels: [{ candidateId: "dealer_x1", type: "dealer", rationale: "r" }] })
    );
    expect(res.status).toBe(200);
    // 审计留痕允许（只写 piiAuditLog，不写 CreditTransaction）
    expect(recordAdminFullPiiExport).toHaveBeenCalled();
    // 红线：即便管理员明文导出，也绝不扣费
    expect(deductCredits).not.toHaveBeenCalled();
  });
});

describe("Excel 导出免计费守卫", () => {
  it("普通用户正常导出 → 200 且 deductCredits 从未调用", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(OK_USER);
    const res = await POST_EXCEL(excelReq({ partition: "all" }));
    expect(res.status).toBe(200);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("余额为 0 也照常导出 → deductCredits 未调用", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(ZERO_USER);
    const res = await POST_EXCEL(excelReq({ partition: "all" }));
    expect(res.status).toBe(200);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("渲染失败 → 500 且不扣费", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(OK_USER);
    vi.mocked(buildExcel).mockRejectedValueOnce(new Error("xlsx boom"));
    const res = await POST_EXCEL(excelReq({ partition: "all" }));
    expect(res.status).toBe(500);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("管理员(fullPii)导出 → 走审计留痕，但【不】计费", async () => {
    // 让取数返回一条经销商，使 inputs 非空 ⇒ 触发审计留痕分支
    vi.mocked(getUserFromRequest).mockResolvedValue(ADMIN_USER);
    vi.mocked(canViewFullPii).mockReturnValue(true);
    vi.mocked(retrieveDealers).mockResolvedValue({
      site: "cn",
      domestic: [{ id: "x1", name: "X", brands: ["b"], models: ["m"], regions: ["r"], nature: "授权经销商", grade: "A", sourceUrl: null, partition: "cn", phoneMasked: "***", wechatMasked: "微信:********", emailMasked: "***" }],
      international: [],
    } as any);
    const res = await POST_EXCEL(excelReq({ partition: "all", layout: "v2", strategy: {} }));
    expect(res.status).toBe(200);
    expect(recordAdminFullPiiExport).toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });
});

describe("跨路由一致性", () => {
  it("未登录 → 401 且两条路由均不扣费", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null as any);
    const r1 = await POST_PDF(pdfReq({}));
    const r2 = await POST_EXCEL(excelReq({}));
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(deductCredits).not.toHaveBeenCalled();
  });
});
