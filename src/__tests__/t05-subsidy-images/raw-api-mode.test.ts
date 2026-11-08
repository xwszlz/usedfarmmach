/**
 * T05 raw JSON API 的 DB 即时开关贯通单测：
 * 证明 126 行改成 `await getEffectiveRawMode()` 后，DB 模式真的驱动 login 401 / off 404，
 * 且 env=off 不读库、.com 站点闸仍先于 mode 读取。
 * 只 mock 数据层 / 站点 / 身份 / raw-detail 链，保留真实 raw-mode.ts 的 getEffectiveRawMode。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  isCn: true,
  systemFindUnique: vi.fn(),
  catalogFindUnique: vi.fn(),
}));

vi.mock("@/config/site", () => ({ isCnSite: () => h.isCn }));

vi.mock("@/lib/db", () => ({
  prisma: {
    systemConfig: { findUnique: h.systemFindUnique },
    subsidyCatalog: { findUnique: h.catalogFindUnique },
  },
}));

vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: (headers: Headers) => headers.get("x-test-token"),
  verifyToken: () => null, // 匿名解析一律失败
  getUserFromToken: vi.fn(),
}));

vi.mock("@/lib/subsidy/raw-detail", () => ({
  assertRawDetailAllowedOrThrow: vi.fn(() => ({ mode: "login" })),
  queryRawDetail: vi.fn(),
  resolveGroupKey: vi.fn(),
}));
vi.mock("@/lib/subsidy/raw-detail-view", () => ({ toRawDetailView: vi.fn() }));
vi.mock("@/lib/subsidy/raw-audit", () => ({ logRawAccess: vi.fn() }));

import { GET } from "@/app/api/(cn)/subsidy/raw/[id]/route";

const URL = "http://localhost/api/(cn)/subsidy/raw/entry-1";

function req(token: string | null = null) {
  const headers: Record<string, string> = {};
  if (token) headers["x-test-token"] = token;
  return new NextRequest(URL, { method: "GET", headers });
}
function ctx() {
  return { params: Promise.resolve({ id: "entry-1" }) };
}

beforeEach(() => {
  h.isCn = true;
  h.systemFindUnique.mockReset().mockResolvedValue({ value: "login" });
  h.catalogFindUnique.mockReset().mockResolvedValue(null);
  process.env.CN_SUBSIDY_RAW_MODE = "login"; // env≠off，才会读 DB
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.CN_SUBSIDY_RAW_MODE;
  vi.restoreAllMocks();
});

describe("① .com 站点闸（先于 mode 读取，仍 404 + no-store）", () => {
  it("isCnSite=false → 404，且不读 DB 模式", async () => {
    h.isCn = false;
    const res = await GET(req(), ctx());
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });
});

describe("② DB 模式贯通（await getEffectiveRawMode 生效）", () => {
  it("DB=login 且匿名 → 401（不是 404），且确实读了库", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "login" });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(h.systemFindUnique).toHaveBeenCalledTimes(1);
  });

  it("DB=off → 404 + no-store，且确实读了库", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "off" });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(h.systemFindUnique).toHaveBeenCalledTimes(1);
  });

  it("DB 值非法 → fail-closed 回落 env(login) → 匿名 401", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "garbage" });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(401);
  });
});

describe("③ env=off 是硬锁（不读库、DB 值被忽略）", () => {
  it("env=off 且 DB=public → 仍 404，且 systemConfig.findUnique 零调用", async () => {
    process.env.CN_SUBSIDY_RAW_MODE = "off";
    h.systemFindUnique.mockResolvedValue({ value: "public" });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });

  it("env=off 且 DB=login → 仍 404", async () => {
    process.env.CN_SUBSIDY_RAW_MODE = "off";
    h.systemFindUnique.mockResolvedValue({ value: "login" });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(404);
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });
});
