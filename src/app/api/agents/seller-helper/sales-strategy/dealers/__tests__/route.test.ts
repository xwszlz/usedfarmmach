/**
 * 集成测试：POST /api/agents/seller-helper/sales-strategy/dealers（T4）
 *
 * 覆盖点：
 *  ① .cn 站 → site="cn"，domestic（境内）+ international（跨境候选）两分区都返回；
 *  ② .cn 站 partition="cn" → 仅 domestic；partition="intl" → 仅 international；
 *  ③ .com 站 → site="com"，domestic 恒为 []（库不持境内 PII）；
 *  ④ 合规红线：dealers 路由不调用任何 ARK / 不向 .com / ARK_PROXY_URL 发请求
 *     （chatCompletionDoubao 绝不被调用）；
 *  ⑤ 联系方式默认脱敏（phoneMasked / emailMasked 非明文）。
 *
 * 说明：除 @/lib/db（prisma 查询 mock）、@/config/site（控制 SITE）、
 *       @/lib/ai/ark-client（合规断言用，应不被调用）外，retrieveDealers 服务层与
 *       @/lib/pii（真实脱敏）均保持真实，验证端到端分区与脱敏逻辑。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    dealer: {
      findMany: vi.fn(),
    },
  },
}));

// 控制 SITE：isCnSite() 在测试中被动态改写
vi.mock("@/config/site", () => ({
  SITE: "cn",
  isCnSite: vi.fn(() => true),
  isComSite: vi.fn(() => false),
  getSiteVariant: vi.fn(() => "cn"),
}));

// 合规断言：dealers 路由不应触达 ARK 客户端
vi.mock("@/lib/ai/ark-client", () => ({
  chatCompletionDoubao: vi.fn(),
  getArkModelId: vi.fn(() => "doubao-seed-2-1-pro-260915"),
  getArkLinkPath: vi.fn(() => "direct"),
}));

import { prisma } from "@/lib/db";
import { isCnSite } from "@/config/site";
import { chatCompletionDoubao } from "@/lib/ai/ark-client";
import { POST } from "@/app/api/agents/seller-helper/sales-strategy/dealers/route";

const DEALER_ROWS = [
  {
    id: "d_cn_1",
    name: "科乐收农业机械贸易(北京)",
    brands: ["claas"],
    models: ["AXION 850"],
    regions: ["北京"],
    nature: "授权经销商",
    grade: "A",
    sourceUrl: "https://claas.cn",
    partition: "cn",
    phone: "4006999663",
    wechat: null,
    email: "infochina@claas.com",
  },
  {
    id: "d_intl_1",
    name: "AGRAVIS Technik Center",
    brands: ["claas"],
    models: ["AXION 850"],
    regions: ["德国"],
    nature: "拍卖行/平台",
    grade: "B",
    sourceUrl: null,
    partition: "intl",
    phone: "+49 4288 927713",
    wechat: null,
    email: null,
  },
];

function makeReq(body: unknown) {
  return new NextRequest("https://usedfarmmach.cn/zh/sales-strategy/dealers", {
    method: "POST",
    headers: { referer: "https://usedfarmmach.cn/zh/sales-strategy/dealers" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.dealer.findMany).mockImplementation((async (args: any) => {
    const p = args?.where?.partition;
    return DEALER_ROWS.filter((r) => r.partition === p);
  }) as any);
});

describe("T4 分区经销商列表 — .cn 站", () => {
  beforeEach(() => {
    vi.mocked(isCnSite).mockReturnValue(true);
  });

  it("partition=all → site=cn，domestic 与 international 两分区均返回", async () => {
    const res = await POST(makeReq({ partition: "all" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.data.site).toBe("cn");
    expect(j.data.domestic).toHaveLength(1);
    expect(j.data.international).toHaveLength(1);
    expect(j.data.domestic[0].id).toBe("d_cn_1");
    expect(j.data.international[0].id).toBe("d_intl_1");
    // 合规：不调用 ARK
    expect(chatCompletionDoubao).not.toHaveBeenCalled();
  });

  it("partition=cn → 仅 domestic", async () => {
    const res = await POST(makeReq({ partition: "cn" }));
    const j = await res.json();
    expect(j.data.domestic).toHaveLength(1);
    expect(j.data.international).toHaveLength(0);
  });

  it("partition=intl → 仅 international", async () => {
    const res = await POST(makeReq({ partition: "intl" }));
    const j = await res.json();
    expect(j.data.domestic).toHaveLength(0);
    expect(j.data.international).toHaveLength(1);
  });

  it("默认（缺省 partition）→ 同 all", async () => {
    const res = await POST(makeReq({}));
    const j = await res.json();
    expect(j.data.domestic).toHaveLength(1);
    expect(j.data.international).toHaveLength(1);
  });

  it("联系方式默认脱敏（非明文）", async () => {
    const res = await POST(makeReq({ partition: "all" }));
    const j = await res.json();
    const cn = j.data.domestic[0];
    expect(cn.phoneMasked).not.toBe("4006999663");
    expect(cn.phoneMasked).toContain("****");
    expect(cn.emailMasked).not.toBe("infochina@claas.com");
    expect(cn.emailMasked).toContain("***");
  });
});

describe("T4 分区经销商列表 — .com 站（合规：库不持境内 PII）", () => {
  beforeEach(() => {
    vi.mocked(isCnSite).mockReturnValue(false);
  });

  it("site=com，domestic 恒为 []，仅 international", async () => {
    const res = await POST(makeReq({ partition: "all" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.site).toBe("com");
    expect(j.data.domestic).toEqual([]);
    expect(j.data.international).toHaveLength(1);
    expect(chatCompletionDoubao).not.toHaveBeenCalled();
  });

  it(".com 站即便请求 partition=cn，domestic 仍为 []（无境内数据）", async () => {
    const res = await POST(makeReq({ partition: "cn" }));
    const j = await res.json();
    expect(j.data.domestic).toEqual([]);
  });
});
