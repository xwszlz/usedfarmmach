/**
 * mascus 线索池后台 —— 路由入口面测试（SITE 闸门 / 鉴权 / 信封 / 审计 / 校验）
 *
 * 只测 `src/app/api/admin/mascus-listings/**` 的**HTTP 适配层**：
 * 把数据层（`listMascusListings` 等）与 db 全部 mock 掉，不连库不触网。
 *
 * 钉住的怀疑点：
 *   ① `.cn` 侧必须**先判 SITE 再鉴权** —— 无 token 也应撞 SITE 闸（403 SITE_BLOCKED），
 *      且不产生任何 DB 查询，外部无法凭 401/403 反推 token 是否有效；
 *   ② `editor` 能进后台 layout，但**不能**访问线索池 API（含卖家电话 PII）；
 *   ③ 单条详情必须**先写 PII 审计再返回明文**，且审计里的目标 id 是这条线索；
 *      🔴 fail-closed：审计落库失败必须 500 且不下发明文；
 *   ④ 非法 `followStatus` 必须 400（真实走 lib 校验，不 mock 掉）；
 *   ⑤ 🔴 `?view=sellers` 的响应体不得含明文电话（用真实 `aggregateBySeller` 穿透路由信封验证）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  list: vi.fn(),
  bySeller: vi.fn(),
  byBrand: vi.fn(),
  detail: vi.fn(),
  /** mock `prisma.piiAuditLog.create`（路由现在直接落库，不再走 writePiiAuditLog） */
  audit: vi.fn(),
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  mascusFindUnique: vi.fn(),
  mascusFindMany: vi.fn(),
  mascusCount: vi.fn(),
  mascusGroupBy: vi.fn(),
  executeRaw: vi.fn(),
  /** 真实 `aggregateBySeller`（在 mock factory 里捕获），供 PII 防回归用例穿透路由 */
  realBySeller: null as null | ((q: Record<string, unknown>) => Promise<unknown[]>),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mascusListing: {
      findUnique: h.mascusFindUnique,
      findMany: h.mascusFindMany,
      count: h.mascusCount,
      groupBy: h.mascusGroupBy,
    },
    user: { findUnique: h.userFindUnique, findMany: h.userFindMany },
    piiAuditLog: { create: h.audit },
    $executeRaw: h.executeRaw,
  },
}));

vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: (headers: Headers) => headers.get("x-test-token"),
  verifyToken: (token: string) =>
    token === "good-token" ? { userId: "u1", role: "admin", tier: "free" } : null,
}));

vi.mock("@/lib/mascus-leads/query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mascus-leads/query")>();
  h.realBySeller = actual.aggregateBySeller as unknown as (
    q: Record<string, unknown>
  ) => Promise<unknown[]>;
  return {
    ...actual,
    listMascusListings: h.list,
    aggregateBySeller: h.bySeller,
    aggregateByBrand: h.byBrand,
    getMascusListingDetail: h.detail,
    // 刻意**保留真实** updateMascusListing：这里要验「非法 followStatus → 400」走真校验
  };
});

import { NextRequest } from "next/server";
import { GET as listGET } from "@/app/api/admin/mascus-listings/route";
import {
  GET as detailGET,
  PATCH as detailPATCH,
} from "@/app/api/admin/mascus-listings/[id]/route";

const BASE = "http://localhost/api/admin/mascus-listings";

/** 构造请求；`token` 为 null 时表示未登录 */
function req(method: "GET" | "PATCH", path = "", token: string | null = "good-token", body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers["x-test-token"] = token;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** `[id]` 路由的第二个参数（Next 15 的 params 是 Promise） */
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function fakeListResult() {
  return {
    items: [
      {
        id: "lead-1",
        productId: "{GUID-1}",
        brandName: "John Deere",
        modelName: "450M",
        year: 2018,
        priceEuro: null,
        priceOriginal: null,
        priceCurrency: null,
        sellerPhoneMasked: "141****6160",
        hasPhone: true,
        companyName: "Agri Co",
        locationCity: "Mansfield",
        locationCountry: "US",
        scanSegment: "tractors",
        assetUrl: "https://www.mascus.com/a/1",
        imageUrl: null,
        listedAt: null,
        lastSeenAt: new Date("2024-06-01T00:00:00Z"),
        followStatus: "未联系",
        assignedTo: null,
        assignedToName: null,
        note: null,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 30,
    totalPages: 1,
    statusCounts: { 未联系: 1 },
    lookups: { segments: ["tractors"], countries: ["US"], assignees: [] },
  };
}

beforeEach(() => {
  h.list.mockReset().mockResolvedValue(fakeListResult());
  h.bySeller.mockReset().mockResolvedValue([]);
  h.byBrand.mockReset().mockResolvedValue([]);
  h.detail.mockReset().mockResolvedValue({
    id: "lead-1",
    sellerPhone: "+1 419-529-6160",
    followStatus: "未联系",
    assignedTo: null,
    assignedToName: null,
  });
  h.audit.mockReset().mockResolvedValue(undefined);
  h.userFindUnique.mockReset().mockResolvedValue({ role: "admin", isActive: true });
  h.userFindMany.mockReset().mockResolvedValue([]);
  h.mascusFindUnique.mockReset().mockResolvedValue({
    id: "lead-1",
    sellerPhone: "+1 419-529-6160",
    followStatus: "已联系",
    assignedTo: null,
    assignedToName: null,
  });
  h.executeRaw.mockReset().mockResolvedValue(1);
  h.mascusFindMany.mockReset().mockResolvedValue([]);
  h.mascusCount.mockReset().mockResolvedValue(0);
  h.mascusGroupBy.mockReset().mockResolvedValue([]);

  process.env.SITE = "com";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.SITE;
  vi.restoreAllMocks();
});

describe("① SITE 闸门先于鉴权（.cn 侧不泄漏 token 有效性、不查库）", () => {
  beforeEach(() => {
    process.env.SITE = "cn";
  });

  it("SITE=cn 且**无 token** ⇒ 403 + SITE_BLOCKED（不是 401）", async () => {
    const res = await listGET(req("GET", "", null));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("SITE_BLOCKED");
    // 根本没走到鉴权 ⇒ 没有任何 DB 查询
    expect(h.userFindUnique).not.toHaveBeenCalled();
    expect(h.list).not.toHaveBeenCalled();
  });

  it("SITE=cn 且**带合法 token** ⇒ 同样 403 + SITE_BLOCKED（两种输入同响应）", async () => {
    const withToken = await listGET(req("GET", "", "good-token"));
    const withoutToken = await listGET(req("GET", "", null));

    expect(withToken.status).toBe(403);
    expect(withoutToken.status).toBe(403);
    expect(await withToken.json()).toEqual(await withoutToken.json());
    expect(h.list).not.toHaveBeenCalled();
  });

  it("SITE=cn 时单条详情与 PATCH 同样 403，且不写审计", async () => {
    const getRes = await detailGET(req("GET", "/lead-1"), ctx("lead-1"));
    expect(getRes.status).toBe(403);
    expect(h.audit).not.toHaveBeenCalled();

    const patchRes = await detailPATCH(
      req("PATCH", "/lead-1", "good-token", { followStatus: "已联系" }),
      ctx("lead-1")
    );
    expect(patchRes.status).toBe(403);
    expect(h.executeRaw).not.toHaveBeenCalled();
  });
});

describe("② 鉴权", () => {
  it("无 token ⇒ 401 UNAUTHORIZED", async () => {
    const res = await listGET(req("GET", "", null));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
    expect(h.list).not.toHaveBeenCalled();
  });

  it("无效 token ⇒ 401", async () => {
    const res = await listGET(req("GET", "", "wrong-token"));
    expect(res.status).toBe(401);
  });

  it("role=editor ⇒ 403 FORBIDDEN（layout 放行 editor，API 必须挡）", async () => {
    h.userFindUnique.mockResolvedValue({ role: "editor", isActive: true });

    const res = await listGET(req("GET"));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
    expect(h.list).not.toHaveBeenCalled();
  });

  it("isActive=false 的 admin 也 ⇒ 403", async () => {
    h.userFindUnique.mockResolvedValue({ role: "admin", isActive: false });
    const res = await listGET(req("GET"));
    expect(res.status).toBe(403);
  });
});

describe("③ 列表视图", () => {
  it("admin ⇒ 200 且信封为 { success:true, data:{...} }", async () => {
    const res = await listGET(req("GET"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.view).toBe("listings");
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1);
    // 列表不含明文电话
    expect(JSON.stringify(body)).not.toContain("419-529-6160");
  });

  it("query 参数正确透传给数据层", async () => {
    await listGET(
      req(
        "GET",
        "?page=2&pageSize=50&q=deere&segment=tractors&country=US&hasPhone=1&onlyActive=true&followStatus=%E5%B7%B2%E8%81%94%E7%B3%BB&assignedTo=unassigned&orderBy=priceEuro&order=asc"
      )
    );

    expect(h.list).toHaveBeenCalledTimes(1);
    const q = h.list.mock.calls[0][0] as Record<string, unknown>;
    expect(q.page).toBe(2);
    expect(q.pageSize).toBe(50);
    expect(q.q).toBe("deere");
    expect(q.segment).toBe("tractors");
    expect(q.country).toBe("US");
    expect(q.hasPhone).toBe(true);
    expect(q.onlyActive).toBe(true);
    expect(q.followStatus).toBe("已联系");
    expect(q.assignedTo).toBe("unassigned");
    expect(q.orderBy).toBe("priceEuro");
    expect(q.order).toBe("asc");
  });

  it("?view=sellers / ?view=brands 走各自聚合函数", async () => {
    const sellerRes = await listGET(req("GET", "?view=sellers"));
    const sellerBody = await sellerRes.json();
    expect(sellerBody.data.view).toBe("sellers");
    expect(h.bySeller).toHaveBeenCalledTimes(1);

    const brandRes = await listGET(req("GET", "?view=brands"));
    const brandBody = await brandRes.json();
    expect(brandBody.data.view).toBe("brands");
    expect(h.byBrand).toHaveBeenCalledTimes(1);
  });

  /**
   * 🔴 PII 防回归：让路由里被 mock 的 `aggregateBySeller` 委托给**真实实现**，
   * 从而验证「明文电话在输出投影之前就已被掩码」，而不是只验证一个手写的假 fixture。
   */
  it("🔴 GET ?view=sellers 响应体不得含明文电话（真实聚合实现穿透路由信封）", async () => {
    h.bySeller.mockImplementation((q) => h.realBySeller!(q as Record<string, unknown>));

    const mkSellerRow = (id: string, phone: string) => ({
      id,
      productId: `{GUID-${id}}`,
      brandName: "John Deere",
      year: 2018,
      priceEuro: 1000,
      sellerPhone: phone,
      companyName: "Agri Co",
      locationCountry: "US",
      locationCity: "Mansfield",
      scanSegment: "tractors",
      assetUrl: "https://www.mascus.com/a/1",
      listedAt: new Date("2024-01-01T00:00:00Z"),
      lastSeenAt: new Date("2024-06-01T00:00:00Z"),
      followStatus: "未联系",
      assignedTo: null,
    });
    h.mascusCount.mockResolvedValue(3);
    h.mascusFindMany.mockResolvedValue([
      mkSellerRow("a", "+1 419-529-6160"),
      mkSellerRow("b", "+14195296160"),
      mkSellerRow("c", "1 (419) 529-6160"),
    ]);

    const res = await listGET(req("GET", "?view=sellers"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.view).toBe("sellers");
    expect(body.data.items).toHaveLength(1);
    const serialized = JSON.stringify(body);
    for (const plain of ["+1 419-529-6160", "4195296160", "+14195296160"]) {
      expect(serialized).not.toContain(plain);
    }
    expect(body.data.items[0].phoneKeyMasked).toBe("419****6160");
    expect(body.data.items[0].phoneVariants).toHaveLength(3);
    expect(body.data.items[0].sampleListingId).toBeTruthy();
    expect(Object.keys(body.data.items[0])).not.toContain("phoneKey");
    expect(body.data.items[0].phoneVariants[0]).not.toHaveProperty("raw");
  });

  it("数据层抛错 ⇒ 统一错误信封（不泄漏堆栈）", async () => {
    h.list.mockRejectedValue(new Error("boom"));

    const res = await listGET(req("GET"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("at ");
  });
});

describe("④ 单条详情：先落审计再返回明文（fail-closed）", () => {
  it("GET ⇒ 200，且 prisma.piiAuditLog.create 五参齐全", async () => {
    const res = await detailGET(req("GET", "/lead-1"), ctx("lead-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    expect(h.audit).toHaveBeenCalledTimes(1);
    const auditArg = (h.audit.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(auditArg.targetListingId).toBe("lead-1");
    expect(auditArg.actorId).toBe("u1");
    expect(auditArg.targetUserId).toBeNull();
    expect(auditArg.field).toBe("sellerPhone");
    expect(auditArg.action).toBe("view_full");
    // PiiAuditLog.targetListingId 无外键、无法区分源表 ⇒ 必须带 mascus 前缀标记
    expect(String(auditArg.purpose)).toContain("mascus_listing");
  });

  it("审计写入发生在返回之前（detail 先取到、审计后才有响应）", async () => {
    const order: string[] = [];
    h.detail.mockImplementation(async () => {
      order.push("detail");
      return { id: "lead-1", sellerPhone: "+1 419-529-6160" };
    });
    h.audit.mockImplementation(async () => {
      order.push("audit");
    });

    await detailGET(req("GET", "/lead-1"), ctx("lead-1"));
    expect(order).toEqual(["detail", "audit"]);
  });

  it("不存在的 id ⇒ 404 NOT_FOUND 且不写审计", async () => {
    h.detail.mockResolvedValue(null);

    const res = await detailGET(req("GET", "/missing"), ctx("missing"));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
    expect(h.audit).not.toHaveBeenCalled();
  });

  /** 🔴 fail-closed：审计写不进去时，宁可 500，也不能把明文发出去 */
  it("🔴 审计写入失败时不得下发明文电话（fail-closed）", async () => {
    h.audit.mockRejectedValue(new Error("audit db down"));

    const res = await detailGET(req("GET", "/lead-1"), ctx("lead-1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("+1 419-529-6160");
  });
});

describe("⑤ 单条更新", () => {
  it("非法 followStatus ⇒ 400（真实走 lib 校验），且不落库", async () => {
    const res = await detailPATCH(
      req("PATCH", "/lead-1", "good-token", { followStatus: "乱填的状态" }),
      ctx("lead-1")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(h.executeRaw).not.toHaveBeenCalled();
  });

  it("合法 followStatus ⇒ 200 且返回更新后的行", async () => {
    const res = await detailPATCH(
      req("PATCH", "/lead-1", "good-token", { followStatus: "已联系", note: "已电话沟通" }),
      ctx("lead-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("lead-1");
    expect(h.executeRaw).toHaveBeenCalledTimes(1);
  });

  it("线索不存在（executeRaw 影响 0 行）⇒ 404 NOT_FOUND", async () => {
    h.executeRaw.mockResolvedValue(0);

    const res = await detailPATCH(
      req("PATCH", "/lead-1", "good-token", { followStatus: "已联系" }),
      ctx("lead-1")
    );

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("空 body ⇒ 400", async () => {
    const res = await detailPATCH(req("PATCH", "/lead-1", "good-token", {}), ctx("lead-1"));
    expect(res.status).toBe(400);
  });

  it("非法 JSON ⇒ 400", async () => {
    const bad = new NextRequest(`${BASE}/lead-1`, {
      method: "PATCH",
      headers: { "x-test-token": "good-token", "content-type": "application/json" },
      body: "{not json",
    });
    const res = await detailPATCH(bad, ctx("lead-1"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });
});
