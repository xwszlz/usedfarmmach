/**
 * T05 两个 admin API 单测：列表 GET + 单条复核 POST。
 * 只 mock 数据层（@/lib/db）与鉴权底层（@/lib/auth），保留真实 requireSuperAdmin、
 * 真实 image-review 纯函数层；不连库不触网。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  imageFindMany: vi.fn(),
  imageCount: vi.fn(),
  imageFindUnique: vi.fn(),
  imageUpdateMany: vi.fn(),
  imageDelete: vi.fn(),
  imageDeleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: h.userFindUnique },
    subsidyModelImage: {
      findMany: h.imageFindMany,
      count: h.imageCount,
      findUnique: h.imageFindUnique,
      updateMany: h.imageUpdateMany,
      delete: h.imageDelete,
      deleteMany: h.imageDeleteMany,
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: (headers: Headers) => headers.get("x-test-token"),
  verifyToken: (t: string) =>
    t === "good" ? { userId: "u1", role: "super_admin", tier: "free" } : null,
}));

import { GET as listGET } from "@/app/api/admin/system/subsidy-images/route";
import { POST as reviewPOST } from "@/app/api/admin/system/subsidy-images/[id]/review/route";

const BASE = "http://localhost/api/admin/system/subsidy-images";

function req(
  method: "GET" | "POST",
  path = "",
  token: string | null = "good",
  body?: unknown
) {
  const headers: Record<string, string> = {};
  if (token) headers["x-test-token"] = token;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function ctx(id = "img1") {
  return { params: Promise.resolve({ id }) };
}

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "img1",
    modelKey: "品牌|品类|型号",
    brandName: "品牌",
    category: "品类",
    modelName: "型号",
    sourceUrl: "https://example.com/a.jpg",
    sourceDomain: "example.com",
    finalUrl: "https://example.com/a.jpg",
    httpStatus: 200,
    contentType: "image/jpeg",
    fetchedAt: new Date("2026-11-08T00:00:00Z"),
    sha256: "deadbeef",
    ossUrl: "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/subsidy-images/deadbeef.jpg",
    sortOrder: 0,
    isPrimary: false,
    reviewStatus: "pending",
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    ...overrides,
  };
}

const ALL_CHECKS = {
  modelMatch: true,
  sourceReal: true,
  notAi: true,
  licensed: true,
};

beforeEach(() => {
  h.userFindUnique.mockReset().mockResolvedValue({ role: "super_admin" });
  h.imageFindMany.mockReset().mockResolvedValue([]);
  h.imageCount.mockReset().mockResolvedValue(0);
  h.imageFindUnique.mockReset().mockResolvedValue(fakeRow());
  h.imageUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  h.imageDelete.mockReset();
  h.imageDeleteMany.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("① 鉴权负向（两个 admin API 均 403）", () => {
  it("列表 GET：无 token / 无效 token / role=editor → 403", async () => {
    const noToken = await listGET(req("GET", "", null));
    expect(noToken.status).toBe(403);

    const badToken = await listGET(req("GET", "", "bad"));
    expect(badToken.status).toBe(403);

    h.userFindUnique.mockResolvedValue({ role: "editor" });
    const editor = await listGET(req("GET"));
    expect(editor.status).toBe(403);
    expect(h.imageFindMany).not.toHaveBeenCalled();
  });

  it("复核 POST：无 token / 无效 token / role=editor → 403（且不落库）", async () => {
    const noToken = await reviewPOST(req("POST", "/img1/review", null, { action: "approve", checks: ALL_CHECKS }), ctx());
    expect(noToken.status).toBe(403);

    const badToken = await reviewPOST(req("POST", "/img1/review", "bad", { action: "approve", checks: ALL_CHECKS }), ctx());
    expect(badToken.status).toBe(403);

    h.userFindUnique.mockResolvedValue({ role: "editor" });
    const editor = await reviewPOST(req("POST", "/img1/review", "good", { action: "approve", checks: ALL_CHECKS }), ctx());
    expect(editor.status).toBe(403);
    expect(h.imageUpdateMany).not.toHaveBeenCalled();
  });
});

describe("② 列表 GET", () => {
  it("super_admin → 200 信封 + no-store + 分页参数", async () => {
    h.imageFindMany.mockResolvedValue([fakeRow()]);
    h.imageCount.mockResolvedValue(1);

    const res = await listGET(req("GET", "?status=pending&page=2&pageSize=20"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1);
    expect(body.data.page).toBe(2);
    expect(body.data.pageSize).toBe(20);

    const arg = h.imageFindMany.mock.calls[0][0] as Record<string, unknown>;
    expect((arg.where as Record<string, unknown>).reviewStatus).toBe("pending");
    expect(arg.skip).toBe(20);
    expect(arg.take).toBe(20);
  });

  it("非法 status 不加过滤；pageSize 走 clampPageSize 上限 100", async () => {
    await listGET(req("GET", "?status=bogus&pageSize=999"));
    const arg = h.imageFindMany.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.where).toEqual({});
    expect(arg.take).toBe(100);
  });

  it("数据层抛错 → 500 统一信封（不泄漏堆栈）", async () => {
    h.imageFindMany.mockRejectedValue(new Error("boom"));
    const res = await listGET(req("GET"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("boom");
  });
});

describe("③ 复核 POST：approve", () => {
  it("4 项 checks 全 true → 200，写 approved + reviewedBy=u1 + reviewedAt", async () => {
    const res = await reviewPOST(
      req("POST", "/img1/review", "good", { action: "approve", checks: ALL_CHECKS }),
      ctx()
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.reviewStatus).toBe("approved");

    expect(h.imageUpdateMany).toHaveBeenCalledTimes(1);
    const arg = h.imageUpdateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "img1", reviewStatus: "pending" });
    expect(arg.data.reviewStatus).toBe("approved");
    expect(arg.data.reviewedBy).toBe("u1");
    expect(arg.data.reviewedAt).toBeInstanceOf(Date);
  });

  it("缺 1 项 check → 400 CHECKS_INCOMPLETE，零落库", async () => {
    const res = await reviewPOST(
      req("POST", "/img1/review", "good", { action: "approve", checks: { ...ALL_CHECKS, notAi: false } }),
      ctx()
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CHECKS_INCOMPLETE");
    expect(h.imageUpdateMany).not.toHaveBeenCalled();
  });

  it("非法 action / 非法 JSON → 400", async () => {
    const badAction = await reviewPOST(req("POST", "/img1/review", "good", { action: "delete" }), ctx());
    expect(badAction.status).toBe(400);

    const badJson = new NextRequest(`${BASE}/img1/review`, {
      method: "POST",
      headers: { "x-test-token": "good", "content-type": "application/json" },
      body: "{not json",
    });
    const r = await reviewPOST(badJson, ctx());
    expect(r.status).toBe(400);
  });
});

describe("④ 复核 POST：reject / 状态机 / 留痕", () => {
  it("reject 有 note → 200，保留 reviewNote，绝不物理删行", async () => {
    const res = await reviewPOST(
      req("POST", "/img1/review", "good", { action: "reject", reviewNote: "来源不实" }),
      ctx()
    );
    expect(res.status).toBe(200);
    const arg = h.imageUpdateMany.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.reviewStatus).toBe("rejected");
    expect(arg.data.reviewNote).toBe("来源不实");
    expect(h.imageDelete).not.toHaveBeenCalled();
    expect(h.imageDeleteMany).not.toHaveBeenCalled();
  });

  it("reject 无 note → 400 NOTE_REQUIRED，零落库", async () => {
    const res = await reviewPOST(req("POST", "/img1/review", "good", { action: "reject" }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NOTE_REQUIRED");
    expect(h.imageUpdateMany).not.toHaveBeenCalled();
  });

  it("重复复核（reviewStatus=approved）→ 409 STATE_CONFLICT，零落库", async () => {
    h.imageFindUnique.mockResolvedValue(fakeRow({ reviewStatus: "approved" }));
    const res = await reviewPOST(
      req("POST", "/img1/review", "good", { action: "approve", checks: ALL_CHECKS }),
      ctx()
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("STATE_CONFLICT");
    expect(h.imageUpdateMany).not.toHaveBeenCalled();
  });

  it("rejected→approved 被状态机拒绝 → 409", async () => {
    h.imageFindUnique.mockResolvedValue(fakeRow({ reviewStatus: "rejected" }));
    const res = await reviewPOST(
      req("POST", "/img1/review", "good", { action: "approve", checks: ALL_CHECKS }),
      ctx()
    );
    expect(res.status).toBe(409);
    expect(h.imageUpdateMany).not.toHaveBeenCalled();
  });

  it("缺 1 项留痕（sha256 空）→ 422 TRACE_INCOMPLETE，零落库 ⇒ 状态保持 pending", async () => {
    h.imageFindUnique.mockResolvedValue(fakeRow({ sha256: "" }));
    const res = await reviewPOST(
      req("POST", "/img1/review", "good", { action: "approve", checks: ALL_CHECKS }),
      ctx()
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("TRACE_INCOMPLETE");
    expect(h.imageUpdateMany).not.toHaveBeenCalled();
  });

  it("并发抢占失败（updateMany count=0）→ 409", async () => {
    h.imageUpdateMany.mockResolvedValue({ count: 0 });
    const res = await reviewPOST(
      req("POST", "/img1/review", "good", { action: "approve", checks: ALL_CHECKS }),
      ctx()
    );
    expect(res.status).toBe(409);
  });

  it("记录不存在 → 404，零落库", async () => {
    h.imageFindUnique.mockResolvedValue(null);
    const res = await reviewPOST(
      req("POST", "/img1/review", "good", { action: "approve", checks: ALL_CHECKS }),
      ctx()
    );
    expect(res.status).toBe(404);
    expect(h.imageUpdateMany).not.toHaveBeenCalled();
  });
});
