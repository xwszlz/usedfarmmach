/**
 * T05-A ③ raw JSON API 的 DB 真源贯通（对 T05 raw-api-mode.test.ts 的完整矩阵补强）。
 *
 * 保留真实 raw-mode.ts / raw-detail.ts / raw-detail-view.ts（门禁、查询、审计 mode 全真实链路）；
 * 只 mock 站点、数据层、身份(@/lib/auth) 与审计写入(@/lib/subsidy/raw-audit)。
 * 证明：DB 值驱动 404 / 401 / 200；login 匿名是 401（不是 404）；
 * allowed 时审计 mode=login/public；denied/off 绝不查 raw、绝不写审计；
 * env=off 硬锁、.com 站点闸、DB 异常 fail-closed 回落 envMode。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  isCn: true,
  systemFindUnique: vi.fn(),
  catalogFindUnique: vi.fn(),
  rawCount: vi.fn(),
  rawFindMany: vi.fn(),
  logRawAccess: vi.fn(),
}));

vi.mock("@/config/site", () => ({ isCnSite: () => h.isCn }));
vi.mock("@/lib/db", () => ({
  prisma: {
    systemConfig: { findUnique: h.systemFindUnique },
    subsidyCatalog: { findUnique: h.catalogFindUnique },
    subsidyRecordRaw: { count: h.rawCount, findMany: h.rawFindMany },
  },
  getCurrentDatabaseUrl: () => "mock://no-real-db",
}));
vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: (headers: Headers) => headers.get("x-test-token"),
  verifyToken: (t: string | null) => (t === "valid-token" ? { sub: "u1" } : null),
  getUserFromToken: async (t: string | null) =>
    t === "valid-token" ? { id: "u1", role: "user", isActive: true } : null,
}));
vi.mock("@/lib/subsidy/raw-audit", () => ({ logRawAccess: h.logRawAccess }));

import { GET } from "@/app/api/(cn)/subsidy/raw/[id]/route";

const URL = "http://localhost/api/(cn)/subsidy/raw/entry-1";
const ENTRY = {
  id: "entry-1",
  batchCode: "domestic-seed-2026-11",
  manufacturer: "测试厂家",
  brandName: "测试品牌",
  category: "轮式拖拉机",
  modelName: "XX-1804",
  province: "河北省",
  policyYear: 2024,
  sampleSize: 16,
};

function req(token: string | null = null) {
  const headers: Record<string, string> = {};
  if (token) headers["x-test-token"] = token;
  return new NextRequest(URL, { method: "GET", headers });
}
function ctx() {
  return { params: Promise.resolve({ id: "entry-1" }) };
}

const ENV_KEYS = ["CN_SUBSIDY_RAW_MODE", "CN_SUBSIDY_RAW_ROLES"] as const;
const origEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) origEnv[k] = process.env[k];

beforeEach(() => {
  h.isCn = true;
  h.systemFindUnique.mockReset().mockResolvedValue({ value: "login" });
  h.catalogFindUnique.mockReset().mockResolvedValue(ENTRY);
  h.rawCount.mockReset().mockResolvedValue(16);
  h.rawFindMany.mockReset().mockResolvedValue([]);
  h.logRawAccess.mockReset().mockResolvedValue(undefined);
  process.env.CN_SUBSIDY_RAW_MODE = "login";
  delete process.env.CN_SUBSIDY_RAW_ROLES;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (origEnv[k] === undefined) delete process.env[k];
    else process.env[k] = origEnv[k];
  }
  vi.restoreAllMocks();
});

describe("① env=off 硬锁：恒 404 + no-store、零读库", () => {
  it.each(["off", "login", "public"])(
    "env=off + DB=%s ⇒ 404，findUnique 零调用",
    async (dbValue) => {
      process.env.CN_SUBSIDY_RAW_MODE = "off";
      h.systemFindUnique.mockResolvedValue({ value: dbValue });
      const res = await GET(req(), ctx());
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(h.systemFindUnique).not.toHaveBeenCalled();
    }
  );
});

describe("② DB 值驱动状态码（DB 是唯一真源）", () => {
  it("env=login + DB=off ⇒ 404 + no-store，且确实读库、不查 raw", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "off" });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(h.systemFindUnique).toHaveBeenCalledTimes(1);
    expect(h.rawCount).not.toHaveBeenCalled();
  });

  it("env=login + DB=login + 匿名 ⇒ 401（不是 404）+ no-store", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "login" });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(h.rawCount).not.toHaveBeenCalled();
  });

  it("env=login + DB=login + 有效 token ⇒ 200，审计 mode=login、确实查 raw", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "login" });
    const res = await GET(req("valid-token"), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(h.rawCount).toHaveBeenCalledTimes(1);
    expect(h.rawFindMany).toHaveBeenCalledTimes(1);
    expect(h.logRawAccess).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "login", decision: "allowed", catalogId: "entry-1" })
    );
  });

  it("env=login + DB=public ⇒ 匿名也 200（public 放行），审计 mode=public", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "public" });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    expect(h.logRawAccess).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "public", decision: "allowed" })
    );
  });
});

describe("③ DB 缺失 / 非法 / 抛错 ⇒ fail-closed 回落 envMode", () => {
  it("DB 行缺失 + 匿名 ⇒ 401（回落 login，不是 off 的 404）", async () => {
    h.systemFindUnique.mockResolvedValue(null);
    const res = await GET(req(), ctx());
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("DB 值非法 + 匿名 ⇒ 401（回落 login）", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "garbage" });
    expect((await GET(req(), ctx())).status).toBe(401);
  });

  it("DB 抛错 + 有效 token ⇒ 200（回落 login 且不抛）", async () => {
    h.systemFindUnique.mockRejectedValue(new Error("db down"));
    const res = await GET(req("valid-token"), ctx());
    expect(res.status).toBe(200);
  });

  it("env=public + DB 非法 ⇒ 回落 public ⇒ 匿名 200", async () => {
    process.env.CN_SUBSIDY_RAW_MODE = "public";
    h.systemFindUnique.mockResolvedValue({ value: "garbage" });
    expect((await GET(req(), ctx())).status).toBe(200);
  });
});

describe("④ .com 站点闸（先于 mode 读取）", () => {
  it(".com ⇒ 404 + no-store，零读库（即便 DB=login + 有效 token）", async () => {
    h.isCn = false;
    h.systemFindUnique.mockResolvedValue({ value: "login" });
    const res = await GET(req("valid-token"), ctx());
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });
});

describe("⑤ 回归：denied / off 绝不触发 raw 查询与审计写入", () => {
  it("off 404 / login 401 时 subsidyRecordRaw 与 logRawAccess 均零调用", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "off" });
    await GET(req("valid-token"), ctx());
    h.systemFindUnique.mockResolvedValue({ value: "login" });
    await GET(req(), ctx());
    expect(h.rawCount).not.toHaveBeenCalled();
    expect(h.rawFindMany).not.toHaveBeenCalled();
    expect(h.logRawAccess).not.toHaveBeenCalled();
  });
});
