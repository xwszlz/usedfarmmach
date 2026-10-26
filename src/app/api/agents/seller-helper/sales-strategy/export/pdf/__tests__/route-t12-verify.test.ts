/**
 * T13 验收（第 3 条）· T12 付费解锁**端到端**（真实 PDF 字节 → 解出文本逐字断言）
 * ─────────────────────────────────────────────────────────
 * 与工程师 `unlock.test.ts` 的区别：他们断言的是**传给 buildPdf 的 channel 对象**
 * （spy 口径）。本文件走完整路由 → 真实 PDF → 从字节里抽文本，
 * 证明「明文真的上了纸」「未解锁的明文一个字节都搜不到」——安全性只认产物，不认中间对象。
 *
 * 覆盖：
 *   ① 已解锁 dealer ⇒ 电话/邮箱/微信明文出现在 PDF 文本里；
 *   ② 未解锁 dealer ⇒ 只剩星号；**其明文号码在全文档任何位置都不出现**（安全边界）；
 *   ③ 客户端伪造 name / phoneMasked 一律不生效（服务端按 candidateId 重取）；
 *   ④ lead_ 前缀解锁同样给明文；
 *   ⑤ 库里取不到的 candidateId ⇒ 丢弃（不编造占位联系方式）；
 *   ⑥ DB 全挂 ⇒ 仍 200 可打开 PDF、不重复扣费、不泄露任何明文。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    piiAuditLog: { findMany: vi.fn() },
    dealer: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/credits/deduct", () => ({
  estimateAiCost: vi.fn(),
  deductAiUsage: vi.fn(),
  EXPORT_ESTIMATED_TOKENS: 800,
}));

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { estimateAiCost, deductAiUsage } from "@/lib/credits/deduct";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/export/pdf/route";
import { extractPdfText, inspectPdf } from "@/lib/sales-strategy/__tests__/pdf-text";

// ── PII 夹具（每条都是真实形态的手机号，便于「搜不到」断言） ──
const UNLOCKED_PHONE = "13800138000";
const LOCKED_PHONE = "13900139000";
const LEAD_PHONE = "13700137000";
const UNLOCKED_EMAIL = "alpha@corp.com";
const LOCKED_EMAIL = "beta@corp.com";
const UNLOCKED_WECHAT = "wx_abc_777";
const LOCKED_WECHAT = "wx_def_888";

const DEALER_ROWS = [
  {
    id: "abc",
    name: "解锁过的经销商ABC",
    brands: ["claas"],
    models: ["AXION 850"],
    regions: ["北京"],
    role: "授权经销",
    country: "中国",
    city: "北京",
    contactPerson: "张三",
    phone: UNLOCKED_PHONE,
    wechat: UNLOCKED_WECHAT,
    email: UNLOCKED_EMAIL,
  },
  {
    id: "def",
    name: "没解锁的经销商DEF",
    brands: ["john deere"],
    models: ["8R 370"],
    regions: ["德国"],
    role: "进口商",
    country: "德国",
    city: "汉诺威",
    contactPerson: "Hans",
    phone: LOCKED_PHONE,
    wechat: LOCKED_WECHAT,
    email: LOCKED_EMAIL,
  },
];

const LEAD_ROWS = [
  {
    id: "xyz",
    name: "解锁过的线索XYZ",
    brand: "claas",
    model: "Jaguar 970",
    region: "乌兹别克斯坦",
    location: null,
    phone: LEAD_PHONE,
    wechat: "wx_xyz_999",
    email: "lead@corp.com",
  },
];

/** 走 legacy 版式（无 v2 触发键）：正文里电话以「电话: xxx」直出，便于逐字断言 */
const LEGACY_STRATEGY = {
  summary: "先出清库存再谈高价",
  priceRange: { suggestedMinCny: 800000, suggestedMaxCny: 1200000 },
};

/** 走 v2 版式：验证「5. 今天该打的电话」章同样给明文（该章是付费价值的落点） */
const V2_STRATEGY = {
  tldr: [
    { equipment: "东方红 YTO-1204", bestChannel: "塔什干二手商", expectedPriceCny: "¥98万", why: "溢价高" },
  ],
  // 章 5 的数据来自 LLM 的 todayCalls（必须带 candidateIds，derive 按 id 回填渠道名与电话）
  todayCalls: [
    {
      equipment: "东方红 YTO-1204",
      candidateIds: ["dealer_abc", "dealer_def"],
      role: "授权经销",
      whyToday: "近 30 天有成交",
    },
  ],
};

function makeReq(body: unknown, referer = "https://usedfarmmach.cn/zh/products/p1") {
  return new NextRequest("https://usedfarmmach.cn/api/agents/seller-helper/sales-strategy/export/pdf", {
    method: "POST",
    headers: { referer },
    body: JSON.stringify(body),
  });
}

async function pdfTextOf(res: Response): Promise<{ text: string; pages: string[]; pageCount: number }> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { all, pages } = await extractPdfText(bytes);
  const meta = await inspectPdf(bytes);
  return { text: all, pages, pageCount: meta.pageCount };
}

let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
  vi.mocked(estimateAiCost).mockResolvedValue(100);
  vi.mocked(deductAiUsage).mockResolvedValue({ ok: true, cost: 100, balance: 9900, code: "OK" } as any);
  vi.mocked(prisma.dealer.findMany).mockResolvedValue(DEALER_ROWS as any);
  vi.mocked(prisma.lead.findMany).mockResolvedValue(LEAD_ROWS as any);
  vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([
    { field: "unlock:dealer_abc" },
    { field: "unlock:lead_xyz" },
  ] as any);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
});

describe("①② T12 二段式解锁（真实 PDF 文本级验证）", () => {
  it("legacy 版式：已解锁号明文上纸；未解锁号只剩星号且明文全文零出现", async () => {
    const res = await POST(
      makeReq({
        strategy: LEGACY_STRATEGY,
        product: { brandName: "东方红", modelName: "YTO-1204" },
        channels: [{ candidateId: "dealer_abc" }, { candidateId: "dealer_def" }],
      })
    );
    expect(res.status).toBe(200);

    const { text } = await pdfTextOf(res);

    // 已解锁：四位一体明文（电话/微信/邮箱/公司名）
    expect(text).toContain("解锁过的经销商ABC");
    expect(text, "已解锁电话未上纸（星号仍是星号 ⇒ T12 失效）").toContain(UNLOCKED_PHONE);
    expect(text).toContain(UNLOCKED_WECHAT);
    expect(text).toContain(UNLOCKED_EMAIL);

    // 未解锁：只剩脱敏形态
    expect(text).toContain("没解锁的经销商DEF");
    expect(text, "未解锁电话未脱敏").toContain("139****9000");
    expect(text).toContain("be***@corp.com");
    expect(text).toContain("微信:********");

    // 安全边界：未解锁的原始 PII 在**全文任何位置**都不得出现
    expect(text, `未解锁明文号码泄露：${LOCKED_PHONE}`).not.toContain(LOCKED_PHONE);
    expect(text).not.toContain(LOCKED_EMAIL);
    expect(text).not.toContain(LOCKED_WECHAT);
  });

  it("v2 版式：「5. 今天该打的电话」章同样给已解锁明文、未解锁星号", async () => {
    const res = await POST(
      makeReq({
        strategy: V2_STRATEGY,
        product: { brandName: "东方红", modelName: "YTO-1204" },
        channels: [{ candidateId: "dealer_abc" }, { candidateId: "dealer_def" }],
      })
    );
    expect(res.status).toBe(200);

    const { text, pages } = await pdfTextOf(res);
    expect(pages[0]).toContain("5. 今天该打的电话");

    expect(text).toContain(UNLOCKED_PHONE);
    expect(text).not.toContain(LOCKED_PHONE);
    // 未解锁行在「今天该打的电话」里不应出现任何可拨号数字
    expect(text).toContain("139****9000");
  });

  it("③ 客户端伪造 name / phoneMasked 一律不生效（服务端按 candidateId 重取）", async () => {
    const res = await POST(
      makeReq({
        strategy: LEGACY_STRATEGY,
        channels: [
          {
            candidateId: "dealer_def", // 未解锁
            name: "伪造公司名FAKE",
            phoneMasked: UNLOCKED_PHONE, // 试图把别人的明文塞进来
            emailMasked: "fake@corp.com",
            region: "伪造地区",
            rationale: "真实推荐理由OK",
          },
        ],
      })
    );
    expect(res.status).toBe(200);

    const { text } = await pdfTextOf(res);
    expect(text).not.toContain("伪造公司名FAKE");
    expect(text).not.toContain("fake@corp.com");
    expect(text, "客户端伪造的 phoneMasked 被直接信任（越权泄露）").not.toContain(UNLOCKED_PHONE);
    // 服务端重取的事实 + 客户端唯一可信字段 rationale
    expect(text).toContain("没解锁的经销商DEF");
    expect(text).toContain("真实推荐理由OK");
  });

  it("④ lead_ 前缀解锁 ⇒ 明文（unlock:lead_ 与 dealer 同口径）", async () => {
    const res = await POST(
      makeReq({
        strategy: LEGACY_STRATEGY,
        channels: [{ candidateId: "lead_xyz" }],
      })
    );
    expect(res.status).toBe(200);

    const { text } = await pdfTextOf(res);
    expect(text).toContain("解锁过的线索XYZ");
    expect(text, "线索解锁后仍未给明文").toContain(LEAD_PHONE);
  });

  it("⑤ 库里取不到的 candidateId ⇒ 丢弃，不编造占位联系方式", async () => {
    const res = await POST(
      makeReq({
        strategy: LEGACY_STRATEGY,
        channels: [{ candidateId: "dealer_nonexistent" }, { candidateId: "lead_ghost" }],
      })
    );
    expect(res.status).toBe(200);

    const { text } = await pdfTextOf(res);
    expect(text).not.toContain("dealer_nonexistent");
    expect(text).not.toContain("lead_ghost");
    expect(text).not.toContain("未命名渠道");
    // 无渠道 ⇒ legacy 走「暂无可对接渠道」
    expect(text).toContain("暂无可对接渠道");
  });

  it("⑥ DB 全挂 ⇒ 200 可打开 PDF、扣费恰好一次、零明文泄露", async () => {
    vi.mocked(prisma.piiAuditLog.findMany).mockRejectedValue(new Error("db down"));
    vi.mocked(prisma.dealer.findMany).mockRejectedValue(new Error("db down"));
    vi.mocked(prisma.lead.findMany).mockRejectedValue(new Error("db down"));

    const res = await POST(
      makeReq({ strategy: LEGACY_STRATEGY, channels: [{ candidateId: "dealer_abc" }] })
    );

    expect(res.status).toBe(200);
    const { pageCount, text } = await pdfTextOf(res);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(deductAiUsage).toHaveBeenCalledTimes(1);
    // 库挂了 ⇒ 查不到 = 不解锁（fail-closed），绝不能"猜"一个明文出来
    expect(text).not.toContain(UNLOCKED_PHONE);
    expect(text).not.toContain(LOCKED_PHONE);
  });
});
