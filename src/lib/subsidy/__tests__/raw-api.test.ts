/**
 * T04 `api/(cn)/subsidy/raw/[id]/route.ts` 单测 —— **零 IO / 零真实连接串 / 零 Prisma 实例**。
 *
 * 覆盖 4 路径：
 *   (A) SITE=com                  → 404；且 prisma.subsidyRecordRaw 调用次数 = 0（零 PII 出站）
 *   (B) .cn + mode=off             → 404；零 raw 查询
 *   (C) .cn + mode=login 匿名      → 401（不 302 / 不 redirect / 不 notFound）
 *   (D) .cn + mode=login 已登录    → 200；rows.length ≤ 50；响应含 Cache-Control: no-store
 *
 * 另断言 next.config.js 的 headers() 对 subsidy 路径返回 Cache-Control: no-store。
 *
 * 全程 @/lib/db 被桩化：任何真实 connect / 取连接串都会由探针记名，绝不触达数据库。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";
import path from "path";

/* ── 探针：任何真实 DB 访问都会记名 ── */
const probes = vi.hoisted(() => ({
  calls: [] as string[],
  findUnique: null as unknown as (id: string) => Promise<unknown>,
  count: null as unknown as () => Promise<number>,
  findMany: null as unknown as () => Promise<unknown[]>,
  create: null as unknown as () => Promise<void>,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subsidyCatalog: {
      findUnique: async (args: { where: { id: string } }) => {
        probes.calls.push("db.subsidyCatalog.findUnique");
        return probes.findUnique(args.where.id);
      },
    },
    subsidyRecordRaw: {
      count: async () => {
        probes.calls.push("db.subsidyRecordRaw.count");
        return probes.count();
      },
      findMany: async () => {
        probes.calls.push("db.subsidyRecordRaw.findMany");
        return probes.findMany();
      },
    },
    subsidyRawAccessLog: {
      create: async () => {
        probes.calls.push("db.subsidyRawAccessLog.create");
        return probes.create();
      },
    },
  },
  getCurrentDatabaseUrl: () => {
    probes.calls.push("db.getCurrentDatabaseUrl");
    return "mock://no-real-database";
  },
}));

/* ── 站点判定：可控 ── */
const siteProbe = vi.hoisted(() => ({ isCom: false }));
vi.mock("@/config/site", () => ({
  isCnSite: () => !siteProbe.isCom,
  siteConfig: {},
}));

/* ── 身份链路：可控 ── */
const authProbe = vi.hoisted(() => ({
  token: null as string | null,
  payload: null as { userId: string; role: string; tier: string } | null,
  user: null as { id: string; role: string; isActive: boolean } | null,
}));
vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: () => authProbe.token,
  verifyToken: () => authProbe.payload,
  getUserFromToken: async () => authProbe.user,
}));

/* ── raw-mode：固定 zh 放行所需的 getRawMode / pageSize，保留 clampPageSize 真实实现 ── */
const modeProbe = vi.hoisted(() => ({ mode: "login" as "off" | "login" | "public" }));
vi.mock("@/lib/subsidy/raw-mode", async () => {
  const actual = await vi.importActual<typeof import("@/lib/subsidy/raw-mode")>(
    "@/lib/subsidy/raw-mode"
  );
  return {
    ...actual,
    getRawMode: () => modeProbe.mode,
    getRawFeatureConfig: () => ({
      mode: modeProbe.mode,
      roles: [],
      pageSize: 50,
      imageEnabled: false,
      imageSourceAllowlist: [],
      imageModelLimit: 100,
    }),
  };
});

/* ── next/server：避免引入真实 Next 运行时；提供可断言的 NextResponse ── */
vi.mock("next/server", () => {
  class NextResponse {
    status: number;
    headers: Headers;
    body: unknown;
    constructor(init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }
    static json(data: unknown, init?: ResponseInit) {
      const res = new NextResponse(init);
      res.body = data;
      return res;
    }
  }
  class NextRequest {}
  return { NextResponse, NextRequest };
});

import { GET } from "@/app/api/(cn)/subsidy/raw/[id]/route";

/* ── 测试数据 ── */
const ENTRY = {
  id: "cat-2020-sd",
  batchCode: "B2020",
  manufacturer: "潍柴",
  brandName: "潍柴",
  category: "拖拉机",
  modelName: "WD-200",
  province: "山东",
  policyYear: 2020,
  sampleSize: 20,
};

function makeRawRows(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      batchCode: "B2020",
      sourceFile: "s.csv",
      province: "山东",
      county: "历城区",
      township: "唐王镇",
      buyerName: "张" + i,
      manufacturer: "潍柴",
      category: "拖拉机",
      productName: "WD",
      modelName: "WD-200",
      quantity: 1,
      dealer: "山东农机",
      purchaseDate: new Date(Date.UTC(2020, 0, 1 + (i % 28))),
      salePriceCny: 1000 + i,
      centralSubsidyCny: 100,
      totalSubsidyCny: 200,
      serialNo: "SN" + i,
      status: "已兑付",
    });
  }
  return rows;
}

function makeReq(headers: Record<string, string> = {}): never {
  const h = new Headers();
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  return {
    headers: h,
    nextUrl: { searchParams: new URLSearchParams() },
  } as never;
}

beforeEach(() => {
  process.env.DATABASE_URL = "mock://no-real-database";
  probes.calls.length = 0;
  probes.findUnique = async () => ENTRY;
  probes.count = async () => ENTRY.sampleSize;
  probes.findMany = async () => makeRawRows(ENTRY.sampleSize);
  probes.create = async () => undefined;
  siteProbe.isCom = false;
  modeProbe.mode = "login";
  authProbe.token = null;
  authProbe.payload = null;
  authProbe.user = null;
});

afterAll(() => {
  delete process.env.DATABASE_URL;
});

describe("T04 raw API 三重 fail-closed", () => {
  it("A) SITE=com → 404 且零 raw 查询", async () => {
    siteProbe.isCom = true;
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "cat-2020-sd" }) });
    expect(res.status).toBe(404);
    expect(probes.calls.filter((c) => c.includes("subsidyRecordRaw"))).toHaveLength(0);
    expect(probes.calls.filter((c) => c.includes("subsidyCatalog"))).toHaveLength(0);
  });

  it("B) .cn + mode=off → 404 且零 raw 查询", async () => {
    siteProbe.isCom = false;
    modeProbe.mode = "off";
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "cat-2020-sd" }) });
    expect(res.status).toBe(404);
    expect(probes.calls.filter((c) => c.includes("subsidyRecordRaw"))).toHaveLength(0);
    expect(probes.calls.filter((c) => c.includes("subsidyCatalog"))).toHaveLength(0);
  });

  it("C) .cn + mode=login 匿名（无 token）→ 401 不导航", async () => {
    siteProbe.isCom = false;
    modeProbe.mode = "login";
    authProbe.token = null; // 无凭证
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "cat-2020-sd" }) });
    expect(res.status).toBe(401);
    expect(probes.calls.filter((c) => c.includes("subsidyRecordRaw"))).toHaveLength(0);
    expect(probes.calls.filter((c) => c.includes("subsidyRawAccessLog"))).toHaveLength(0);
  });

  it("D) .cn + mode=login 已登录 → 200 且 rows.length ≤ 50，含 no-store", async () => {
    siteProbe.isCom = false;
    modeProbe.mode = "login";
    authProbe.token = "tok-valid";
    authProbe.payload = { userId: "u1", role: "admin", tier: "free" };
    authProbe.user = { id: "u1", role: "admin", isActive: true };
    const res = await GET(makeReq({ authorization: "Bearer tok-valid" }), {
      params: Promise.resolve({ id: "cat-2020-sd" }),
    });
    expect(res.status).toBe(200);
    const body = (res as unknown as { body: { ok: boolean; rows: unknown[]; total: number; consistent: boolean } }).body;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows.length).toBeLessThanOrEqual(50);
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.total).toBe(ENTRY.sampleSize);
    expect(body.consistent).toBe(true);
    expect((res as unknown as { headers: Headers }).headers.get("Cache-Control")).toBe("no-store");
    // logRawAccess 是 fire-and-forget（不阻塞响应），flush 一个 tick 再断言审计写入
    await new Promise((r) => setTimeout(r, 10));
    expect(probes.calls.filter((c) => c.includes("subsidyRawAccessLog"))).toHaveLength(1);
  });
});

describe("T04 next.config.js headers() 对 subsidy 路径返回 no-store", () => {
  it("headers() 含 /:locale(zh|en)/subsidy/:path* → Cache-Control: no-store", async () => {
    const require = createRequire(import.meta.url);
    const cfgPath = path.resolve(process.cwd(), "next.config.js");
    let cfg: { headers?: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> };
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cfg = require(cfgPath) as typeof cfg;
    } catch (e) {
      throw new Error("无法加载 next.config.js 进行 headers() 断言：" + (e as Error).message);
    }
    expect(typeof cfg.headers).toBe("function");
    const headersList = await cfg.headers!();
    const hit = headersList.find(
      (h) =>
        h.source === "/:locale(zh|en)/subsidy/:path*" &&
        h.headers.some((m) => m.key === "Cache-Control" && m.value === "no-store")
    );
    expect(hit).toBeTruthy();
    // 其余路由段未被改动：redirects / images / env 仍为函数/对象
    expect(typeof (cfg as { redirects?: unknown }).redirects).toBe("function");
    expect(typeof (cfg as { images?: unknown }).images).toBe("object");
    expect(typeof (cfg as { env?: unknown }).env).toBe("object");
  });
});
