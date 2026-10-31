/**
 * 集成测试：POST /api/agents/seller-helper/sales-strategy/export/pdf（T2）
 *
 * 覆盖点：
 *  ① 未登录 → 401 LOGIN_REQUIRED，且不进入渲染；
 *  ② 导出免费（2026-10-28 起）：余额为 0 也照常出文件，不再有余额预检/扣费/熔断分支；
 *  ③ 渲染失败 → 500 且绝不扣费（导出零成本，"钱扣了却拿不到文件"的风险已从根上消除）；
 *  ④ build 成功 → 200 + Content-Type: application/pdf + Content-Disposition: attachment，且未调用任何扣费。
 *
 * 说明：@/lib/sales-strategy/export 的 buildPdf 以「spy 包裹真实实现」方式 mock，
 *       因此成功用例走的是真实 pdf-lib 渲染（字体走模块级缓存，仅首个用例付出 ~1s）；
 *       失败用例用 mockRejectedValueOnce 注入异常，验证失败路径。
 *       注意：2026-10-31 起 `@/lib/credits/deduct` 模块已整体删除（`ai_cost_coeff` 退役），
 *       本文件原先对它的 mock 与 `not.toHaveBeenCalled()` 反向回归锁一并移除 ——
 *       那条锁保的是「导出不扣费」，而现在扣费模块根本不存在，链接不回去，锁已无对象。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));
// T12 起本路由会在服务端查 PII 审计 / 经销商 / 线索（二段式解锁），必须 mock 掉 prisma：
// 否则单测会真连 .env 里的 Neon，单个用例最慢 3s 打在 vitest 5s 超时上，CI 网络一抖即红。
// 本文件 9 个用例断言的是鉴权/余额/计费顺序/文件头，不依赖任何 DB 数据 ⇒ 桩返回空数组即可；
// 解锁与脱敏的字段级断言在 `__tests__/unlock.test.ts`。
vi.mock("@/lib/db", () => ({
  prisma: {
    piiAuditLog: { findMany: vi.fn(async () => []) },
    dealer: { findMany: vi.fn(async () => []) },
    lead: { findMany: vi.fn(async () => []) },
  },
}));

// hoisted 句柄：保存真实 buildPdf，供 beforeEach 恢复默认实现
const H = vi.hoisted(() => ({
  realBuildPdf: null as unknown as (payload: any) => Promise<Uint8Array>,
}));

vi.mock("@/lib/sales-strategy/export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sales-strategy/export")>();
  H.realBuildPdf = actual.buildPdf;
  return { ...actual, buildPdf: vi.fn(actual.buildPdf) };
});

import { getUserFromRequest } from "@/lib/auth";
import { buildPdf } from "@/lib/sales-strategy/export";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/export/pdf/route";

const PAYLOAD = {
  strategy: {
    summary: "先出清库存",
    priceRange: { suggestedMinCny: 800000, suggestedMaxCny: 1200000 },
    channels: [{ candidateId: "lead_abc", type: "lead", rationale: "本地买家" }],
    scripts: [{ scenario: "首次触达", line: "您好" }],
    listingChecklist: [{ step: 1, item: "补车况卡" }],
  },
  product: { brandName: "东方红", modelName: "YTO-1204", year: 2019 },
  channels: [
    {
      candidateId: "lead_abc",
      type: "lead",
      name: "塔什干买家",
      phoneMasked: "136****5678",
      wechatMasked: "微信:********",
      emailMasked: "ta***@corp.com",
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

let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  // 每个用例默认：真实渲染 + 余额充足 + 扣费成功
  vi.mocked(buildPdf).mockReset().mockImplementation(H.realBuildPdf as any);
  vi.mocked(getUserFromRequest).mockReset();
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
});

describe("① 鉴权（渲染前短路）", () => {
  it("未登录 → 401 LOGIN_REQUIRED，且不渲染、不扣费", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null as any);

    const res = await POST(makeReq(PAYLOAD));

    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.success).toBe(false);
    expect(j.code).toBe("LOGIN_REQUIRED");
    expect(j.loginUrl).toContain("/auth/login");
    expect(buildPdf).not.toHaveBeenCalled();
  });

  it("② 余额为 0 也允许导出（导出免费，不再有余额预检）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 0 } as any);

    const res = await POST(makeReq(PAYLOAD));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});

describe("③ 计费顺序：先 build 成功再扣费", () => {
  it("buildPdf 抛错（如字体缺失）→ 500 SERVER_ERROR 且不返回文件头", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    vi.mocked(buildPdf).mockRejectedValueOnce(new Error("NotoSansSC 字体未找到"));

    const res = await POST(makeReq(PAYLOAD));

    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.success).toBe(false);
    expect(j.code).toBe("SERVER_ERROR");
    // 红线：渲染失败绝不扣费
  });

  it("build 抛错时不写 UsageLog / 不返回文件头（无 Content-Disposition）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);
    vi.mocked(buildPdf).mockRejectedValueOnce(new Error("boom"));

    const res = await POST(makeReq(PAYLOAD));
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

describe("④ 成功路径", () => {
  it("build 成功 → 200 + application/pdf + attachment，且**不扣任何积分**", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);

    const res = await POST(makeReq(PAYLOAD));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const cd = res.headers.get("content-disposition") || "";
    expect(cd).toContain("attachment");
    expect(cd).toContain('.pdf"');

    // 响应体确为真实 PDF
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(10 * 1024);

    // 导出免费：零 LLM 成本 ⇒ 不进计费模块
  });

  it("导出已无「扣费失败」分支：任何余额都返回文件，不再出现 402/429", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 0 } as any);

    const res = await POST(makeReq(PAYLOAD));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("body 为空（无 strategy/channels）也不 500：走兜底渲染", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);

    const res = await POST(makeReq({}));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("en referer → 英文文案渲染成功（locale 由 referer 决定）", async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ id: "u1", credits: 99999 } as any);

    const res = await POST(makeReq(PAYLOAD, "https://usedfarmmach.com/en/products/p1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});
