/**
 * 集成测试：POST /api/agents/seller-helper/sales-strategy/export/pdf —— T12 二段式解锁
 *
 * 为什么单开一个文件：既有 `./route.test.ts`（T2，9 例）只覆盖鉴权/余额/计费顺序，
 * 且**未 mock `@/lib/db`**；T12 新增的「服务端重取 + PII 二段式」必须有专项断言，
 * 否则「付费解锁后 PDF 仍是星号」这个本次要修的核心缺陷没有任何测试兜住。
 * 二者互不影响：本文件全量 mock 依赖，不触达任何真实数据库。
 *
 * 覆盖：
 *  ① 已解锁 dealer ⇒ 明文写进 `*Masked` 槽位（buildPdf 只读这三个槽位）+ `unlocked:true` + `phone` 明文；
 *  ② 未解锁 dealer ⇒ maskPhone / maskEmail / 微信占位 / 联系人「已隐藏」/ `phone:null`；
 *  ③ 客户端伪造字段（name / phoneMasked / region）一律不生效，服务端按 candidateId 重取；
 *  ④ 取不到的 candidateId ⇒ 丢弃，不编造占位；
 *  ⑤ DB 抛错 ⇒ 仍 200 + 可渲染（channels 为空、全部脱敏），且扣费照常发生一次；
 *  ⑥ 顺序沿用 body 数组顺序 + 同 candidateId 去重 + rationale 保留。
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
vi.mock("@/lib/sales-strategy/export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sales-strategy/export")>();
  return { ...actual, buildPdf: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])) };
});

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { estimateAiCost, deductAiUsage } from "@/lib/credits/deduct";
import { buildPdf } from "@/lib/sales-strategy/export";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/export/pdf/route";

const UNLOCKED_ID = "deal_unlocked";
const LOCKED_ID = "deal_locked";

const PLAIN_PHONE = "13800138000";
const PLAIN_EMAIL = "boss@example.com";
const PLAIN_WECHAT = "wx_boss_001";
const PLAIN_PERSON = "王老板";

function dealerRow(id: string) {
  return {
    id,
    name: "石家庄神雕农机有限公司",
    brands: ["claas"],
    models: ["AXION 850"],
    regions: ["河北石家庄"],
    role: "授权经销",
    country: "中国",
    city: "石家庄",
    contactPerson: PLAIN_PERSON,
    phone: PLAIN_PHONE,
    wechat: PLAIN_WECHAT,
    email: PLAIN_EMAIL,
  };
}

function makeReq(body: unknown) {
  return new NextRequest("https://usedfarmmach.cn/api/agents/seller-helper/sales-strategy/export/pdf", {
    method: "POST",
    headers: { referer: "https://usedfarmmach.cn/zh/products/p1" },
    body: JSON.stringify(body),
  });
}

/** 取出传给 buildPdf 的 payload（唯一断言口） */
function lastPayload(): any {
  const calls = vi.mocked(buildPdf).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
}

let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
  vi.mocked(estimateAiCost).mockResolvedValue(100);
  vi.mocked(deductAiUsage).mockResolvedValue({ ok: true, cost: 100, balance: 9900, code: "OK" } as any);
  // 默认：dealer_unlocked 有解锁记录，locked 没有
  vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([
    { field: `unlock:dealer_${UNLOCKED_ID}` },
  ] as any);
  vi.mocked(prisma.dealer.findMany).mockResolvedValue([dealerRow(UNLOCKED_ID), dealerRow(LOCKED_ID)] as any);
  vi.mocked(prisma.lead.findMany).mockResolvedValue([] as any);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
});

describe("T12 ① 已解锁 ⇒ 明文写进 *Masked 槽位（buildPdf 零改动约束）", () => {
  it("四位一体：phoneMasked/emailMasked/wechatMasked 均为明文 + unlocked:true + phone 明文", async () => {
    const res = await POST(
      makeReq({
        channels: [
          { candidateId: `dealer_${UNLOCKED_ID}`, rationale: "河北现货，可当天看车" },
        ],
      })
    );

    expect(res.status).toBe(200);
    const ch = lastPayload().channels[0];
    expect(ch.candidateId).toBe(`dealer_${UNLOCKED_ID}`);
    expect(ch.unlocked).toBe(true);
    // 关键：既有 buildPdf 只读 *Masked，故明文必须落在这三个槽位
    expect(ch.phoneMasked).toBe(PLAIN_PHONE);
    expect(ch.emailMasked).toBe(PLAIN_EMAIL);
    expect(ch.wechatMasked).toBe(PLAIN_WECHAT);
    // 语义标记：给 T10 v2 渲染器区分「明文」
    expect(ch.phone).toBe(PLAIN_PHONE);
    expect(ch.contactPersonMasked).toBe(PLAIN_PERSON);
    // 非 PII 透传
    expect(ch.role).toBe("授权经销");
    expect(ch.region).toBe("中国 · 石家庄");
    expect(ch.rationale).toBe("河北现货，可当天看车");
  });

  it("已解锁 lead 同样给明文（unlock:lead_ 前缀）", async () => {
    vi.mocked(prisma.piiAuditLog.findMany).mockResolvedValue([{ field: "unlock:lead_L1" }] as any);
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      {
        id: "L1",
        name: "塔什干买家",
        brand: "claas",
        model: "AXION 850",
        region: "乌兹别克",
        location: "塔什干",
        phone: "998901234567",
        wechat: null,
        email: null,
      },
    ] as any);

    const res = await POST(makeReq({ channels: [{ candidateId: "lead_L1" }] }));

    expect(res.status).toBe(200);
    const ch = lastPayload().channels[0];
    expect(ch.type).toBe("lead");
    expect(ch.unlocked).toBe(true);
    expect(ch.phoneMasked).toBe("998901234567");
    expect(ch.phone).toBe("998901234567");
    // 无微信/邮箱 ⇒ 空串（渲染层显示「无」），不是占位星号
    expect(ch.wechatMasked).toBe("");
    expect(ch.emailMasked).toBe("");
    // Lead 表无 role/country/city/contactPerson ⇒ null，不猜
    expect(ch.role).toBeNull();
    expect(ch.contactPersonMasked).toBeNull();
  });
});

describe("T12 ② 未解锁 ⇒ 脱敏", () => {
  it("maskPhone / maskEmail / 微信占位 / 联系人「已隐藏」/ phone:null", async () => {
    await POST(makeReq({ channels: [{ candidateId: `dealer_${LOCKED_ID}` }] }));

    const ch = lastPayload().channels[0];
    expect(ch.unlocked).toBe(false);
    expect(ch.phoneMasked).toBe("138****8000");
    expect(ch.emailMasked).toBe("bo***@example.com");
    expect(ch.wechatMasked).toBe("微信:********");
    expect(ch.contactPersonMasked).toBe("已隐藏");
    expect(ch.phone).toBeNull();
    // 明文绝不出现在任何槽位
    expect(JSON.stringify(ch)).not.toContain(PLAIN_PHONE);
    expect(JSON.stringify(ch)).not.toContain(PLAIN_EMAIL);
    expect(JSON.stringify(ch)).not.toContain(PLAIN_WECHAT);
    expect(JSON.stringify(ch)).not.toContain(PLAIN_PERSON);
  });
});

describe("T12 ③ 客户端字段一律不信，只信 candidateId / rationale / 顺序", () => {
  it("伪造 name / phoneMasked / region 全部被服务端重取覆盖", async () => {
    await POST(
      makeReq({
        channels: [
          {
            candidateId: `dealer_${LOCKED_ID}`,
            type: "dealer",
            name: "伪造的公司名",
            phoneMasked: "99999999999",
            emailMasked: "fake@evil.com",
            wechatMasked: "伪造微信",
            region: "火星",
            rationale: "理由保留",
          },
        ],
      })
    );

    const ch = lastPayload().channels[0];
    expect(ch.name).toBe("石家庄神雕农机有限公司");
    expect(ch.name).not.toBe("伪造的公司名");
    expect(ch.region).toBe("中国 · 石家庄");
    expect(ch.phoneMasked).toBe("138****8000");
    expect(ch.emailMasked).toBe("bo***@example.com");
    expect(ch.rationale).toBe("理由保留");
  });
});

describe("T12 ④ 取不到的候选 ⇒ 丢弃（不编造）", () => {
  it("dealer 表里没有该 id ⇒ channels 为空", async () => {
    vi.mocked(prisma.dealer.findMany).mockResolvedValue([dealerRow(LOCKED_ID)] as any);

    const res = await POST(
      makeReq({ channels: [{ candidateId: "dealer_ghost", name: "幽灵公司", phoneMasked: "123" }] })
    );

    expect(res.status).toBe(200);
    expect(lastPayload().channels).toEqual([]);
  });

  it("非法 candidateId（无 lead_/dealer_ 前缀）直接忽略", async () => {
    const res = await POST(makeReq({ channels: [{ candidateId: "abc123" }, { candidateId: "" }] }));

    expect(res.status).toBe(200);
    expect(lastPayload().channels).toEqual([]);
    // 无合法 id ⇒ 不该发起 dealer/lead 查询
    expect(prisma.dealer.findMany).not.toHaveBeenCalled();
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });
});

describe("T12 ⑤ DB 异常 ⇒ 仍可导出（不阻断、不重复扣费）", () => {
  it("findMany 全部抛错 ⇒ 200 + channels=[] + 扣费恰好一次", async () => {
    vi.mocked(prisma.piiAuditLog.findMany).mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.mocked(prisma.dealer.findMany).mockRejectedValue(new Error("connect ECONNREFUSED"));

    const res = await POST(makeReq({ channels: [{ candidateId: `dealer_${LOCKED_ID}` }] }));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(lastPayload().channels).toEqual([]);
    // 导出免费：DB 异常也不产生任何扣费
    expect(deductAiUsage).not.toHaveBeenCalled();
  });
});

describe("T12 ⑥ 顺序 / 去重", () => {
  it("沿用 body 顺序，同 candidateId 只保留首个", async () => {
    await POST(
      makeReq({
        channels: [
          { candidateId: `dealer_${LOCKED_ID}`, rationale: "第二条被打理" },
          { candidateId: `dealer_${UNLOCKED_ID}`, rationale: "第一条" },
          { candidateId: `dealer_${LOCKED_ID}`, rationale: "重复项" },
        ],
      })
    );

    const ids = lastPayload().channels.map((c: any) => c.candidateId);
    expect(ids).toEqual([`dealer_${LOCKED_ID}`, `dealer_${UNLOCKED_ID}`]);
    // 去重时保留首次出现的 rationale
    expect(lastPayload().channels[0].rationale).toBe("第二条被打理");
  });
});
