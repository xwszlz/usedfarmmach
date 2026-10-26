/**
 * 单元测试：Web 检索证据层（T07）
 * ─────────────────────────────────────────────────────────
 * 覆盖（逐条对应任务书 ①–⑦ 与 arch §1.2.5/§1.2.6 验收要点）：
 *   1. `.cn` 站 + 配了 Tavily ⇒ `status:"disabled"` + `reason:"site-blocked"`，**fetch 一次都没被调用**
 *   2. `.cn` 站 + `ARK_PROXY_URL` 已设 ⇒ 端点 host 仍为 `ark.cn-beijing.volces.com`（代理被拒绝采用）
 *   3. 四档 status（ok/partial/timeout/disabled）各产出 ≥1 条 `dataSources`（`disabled` 时 `ref:"—"`）
 *   4. 超时 ⇒ `status:"timeout"` 且**不抛错**
 *   5. 出境闸：请求体不含手机号 / 邮箱 / 图片 URL / cuid(productId 形态)
 *   6. fetch throw / 403 / 500 三种情况都返回结果对象而非抛错
 *   7. 缓存命中：同 key 连续调 2 次，底层只被调用 1 轮
 *
 * 说明：`arkWebSearch` 被 mock（避免真实计费与网络）；`resolveArkResponsesEndpoint` 保留真实实现
 *       （它是合规闸的判定入口，必须被真实测到）。超时用例把 timeoutMs/budgetMs 压到 40/200ms，
 *       靠 `AbortSignal.timeout` 触发，不 sleep 9 秒。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/ai/ark-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/ark-client")>();
  return {
    ...actual,
    // 传输层被 mock：本文件只验证编排层（白名单 / 预算 / 缓存 / 分档 / 出境闸）
    arkWebSearch: vi.fn(),
  };
});

// 装配层（retrieval）单测需要 prisma：mock 掉 DB，避免连库
vi.mock("@/lib/db", () => ({
  prisma: {
    product: { findUnique: vi.fn(), findMany: vi.fn() },
    brandBenchmark: { findMany: vi.fn() },
    rawListing: { findMany: vi.fn() },
    marketIntel: { findMany: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  },
}));

import { arkWebSearch, resolveArkResponsesEndpoint } from "@/lib/ai/ark-client";
import { prisma } from "@/lib/db";
import { retrieveStrategyContext } from "@/lib/sales-strategy/retrieval";
import {
  __clearCache,
  buildEvidenceQueries,
  buildWebDataSource,
  renderEvidenceBlock,
  resolveProvider,
  retrieveWebEvidence,
  sanitizeQuery,
  type WebEvidence,
  type WebQueryInput,
} from "@/lib/search/web-evidence";

const arkWebSearchMock = arkWebSearch as unknown as ReturnType<typeof vi.fn>;

// ═══════════════════════════════════════════════════════════
// 夹具
// ═══════════════════════════════════════════════════════════

/** 标准入参：高端圆捆机（PRD 验收用的真实标的） */
function input(overrides: Partial<WebQueryInput> = {}): WebQueryInput {
  return {
    brand: "Krone",
    model: "VBP 3165",
    category: "打捆机",
    yearRange: "2016-2022",
    markets: ["欧洲", "中亚"],
    ...overrides,
  };
}

/** 构造一份 ARK `/responses` 非流式响应（output_text 里是 findings JSON） */
function arkFindingsResponse(seed: string): {
  text: string;
  urls: string[];
  raw: string;
  contentType: string;
  endpoint: ReturnType<typeof resolveArkResponsesEndpoint>;
} {
  const findings = {
    findings: [
      {
        title: `Krone VBP 3165 二手挂牌 ${seed}`,
        url: `https://example-farm.de/listing/${seed}`,
        snippet: "2019 年 Krone VBP 3165，¥1,180,000",
        kind: "二手挂牌",
      },
    ],
  };
  const raw = JSON.stringify({ output_text: JSON.stringify(findings) });
  return {
    text: JSON.stringify(findings),
    urls: [`https://example-farm.de/listing/${seed}`],
    raw,
    contentType: "application/json",
    endpoint: resolveArkResponsesEndpoint({ site: "com" }),
  };
}

/** 挂起的 fetch（只在 signal abort 时 reject），用于超时用例 */
function hangingFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(
    (_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        const onAbort = (): void => {
          reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
        };
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener("abort", onAbort);
      })
  );
}

beforeEach(() => {
  __clearCache();
  arkWebSearchMock.mockReset();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ═══════════════════════════════════════════════════════════
// ① 站点白名单（合规闸门）
// ═══════════════════════════════════════════════════════════

describe("provider 白名单（.cn 只允许 ark）", () => {
  it(".cn 站配了 Tavily ⇒ disabled + site-blocked，且 fetch 一次都没被调用", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ev = await retrieveWebEvidence(input(), {
      runtime: { site: "cn", arkApiKey: "", searchApiKey: "tvly-dev-abcdefghijklmn", searchApiProvider: "tavily" },
    });

    expect(ev.status).toBe("disabled");
    expect(ev.reason).toBe("site-blocked");
    expect(ev.provider).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(arkWebSearchMock).not.toHaveBeenCalled();
    // 四档必有 dataSources（`.cn` 被拦也要能看出"没查"而不是"没查到"）
    expect(ev.dataSources.length).toBe(1);
    expect(ev.dataSources[0]).toEqual({ name: "Web检索", ref: "—", note: expect.stringContaining("未启用") });
  });

  it(".cn 站未配任何凭据 ⇒ disabled + not-configured", async () => {
    const ev = await retrieveWebEvidence(input(), {
      runtime: { site: "cn", arkApiKey: "", searchApiKey: "", searchApiProvider: "" },
    });
    expect(ev.status).toBe("disabled");
    expect(ev.reason).toBe("not-configured");
    expect(ev.dataSources[0].ref).toBe("—");
  });

  it(".cn 站只配 ARK ⇒ 解析为 ark（唯一合法通道）", () => {
    const r = resolveProvider({ site: "cn", arkApiKey: "ark-key", searchApiKey: "tvly-dev-x" });
    // 有 ARK 凭据时按白名单顺序优先 ark（第三方凭据被忽略）
    expect(r.provider).toBe("ark");
    expect(r.reason).toBe("ok");
  });

  it("provider 名不认识 ⇒ unsupported（不瞎猜）", () => {
    const r = resolveProvider({ site: "com", arkApiKey: "k", searchApiProvider: "bing" });
    expect(r.provider).toBeNull();
    expect(r.reason).toBe("unsupported");
  });
});

// ═══════════════════════════════════════════════════════════
// ② `.cn` 端点断言 + 拒绝 ARK_PROXY_URL
// ═══════════════════════════════════════════════════════════

describe(".cn 出境闸：端点必须境内、代理必须被拒", () => {
  it(".cn 站设了 ARK_PROXY_URL ⇒ host 仍是 ark.cn-beijing.volces.com，且标记 proxyRejected", async () => {
    const endpoint = resolveArkResponsesEndpoint({
      site: "cn",
      proxyUrl: "https://hk-proxy.example.com/api/v3",
    });
    expect(endpoint.host).toBe("ark.cn-beijing.volces.com");
    expect(endpoint.domestic).toBe(true);
    expect(endpoint.proxyRejected).toBe(true);
    expect(endpoint.url.startsWith("https://ark.cn-beijing.volces.com/")).toBe(true);
    expect(endpoint.url).not.toContain("hk-proxy");

    // 端到端：`.cn` + 代理 + ARK 凭据 ⇒ 实际请求 URL 也不含代理域名
    arkWebSearchMock.mockImplementation(async () => arkFindingsResponse("cn-proxy"));
    const ev = await retrieveWebEvidence(input(), {
      runtime: {
        site: "cn",
        arkApiKey: "ark-key",
        arkProxyUrl: "https://hk-proxy.example.com/api/v3",
      },
    });
    expect(ev.proxyRejected).toBe(true);
    const passedUrl = String(arkWebSearchMock.mock.calls[0][0].url ?? "");
    expect(passedUrl).toContain("ark.cn-beijing.volces.com");
    expect(passedUrl).not.toContain("hk-proxy");
  });

  it("传输层闸③：`.cn` 被强行传入境外端点 ⇒ arkWebSearch 直接拒绝（不发请求）", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ai/ark-client")>("@/lib/ai/ark-client");
    await expect(
      actual.arkWebSearch({ prompt: "test", site: "cn", url: "https://evil.example.com/api/v3/responses" })
    ).rejects.toThrow(/境内站检索端点必须是/);
  });
});

// ═══════════════════════════════════════════════════════════
// ③ 四档 status ⇒ 每条都有 dataSources
// ═══════════════════════════════════════════════════════════

describe("四档 status 都产出 ≥1 条 dataSources", () => {
  const comArkRuntime = { site: "com" as const, arkApiKey: "ark-key" };

  it("ok 档：ref 是真实 URL 列表", async () => {
    arkWebSearchMock.mockImplementation(async () => arkFindingsResponse("ok"));
    const ev = await retrieveWebEvidence(input(), { runtime: comArkRuntime });

    expect(ev.status).toBe("ok");
    expect(ev.successQueries).toBe(5);
    expect(ev.totalQueries).toBe(5);
    expect(ev.dataSources.length).toBe(1);
    expect(ev.dataSources[0].name).toBe("Web检索");
    expect(ev.dataSources[0].ref).toContain("https://example-farm.de/listing/ok");
    expect(ev.items.length).toBeGreaterThanOrEqual(1);
  });

  it("partial 档：note 带 N/M 成功数，ref 是成功 URL", async () => {
    let call = 0;
    arkWebSearchMock.mockImplementation(async () => {
      call += 1;
      if (call % 2 === 0) throw Object.assign(new Error("upstream 500"), { status: 500 });
      return arkFindingsResponse(`p${call}`);
    });

    const ev = await retrieveWebEvidence(input(), { runtime: comArkRuntime, retry: 0 });

    expect(ev.status).toBe("partial");
    expect(ev.successQueries).toBe(3);
    expect(ev.totalQueries).toBe(5);
    expect(ev.dataSources.length).toBe(1);
    expect(ev.dataSources[0].ref).toContain("https://example-farm.de/listing/p");
    expect(ev.dataSources[0].note).toBe("部分检索超时（3/5 成功）");
  });

  it("timeout 档：ref 必须是「—」（PRD §6.3）", async () => {
    arkWebSearchMock.mockImplementation(
      (opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        })
    );

    const ev = await retrieveWebEvidence(input(), {
      runtime: comArkRuntime,
      timeoutMs: 40,
      budgetMs: 200,
      retry: 0,
    });

    expect(ev.status).toBe("timeout");
    expect(ev.reason).toBe("timeout");
    expect(ev.dataSources.length).toBe(1);
    expect(ev.dataSources[0]).toEqual({
      name: "Web检索",
      ref: "—",
      note: "外部证据未接入（检索超时）",
    });
  });

  it("disabled 档：ref 必须是「—」", async () => {
    const ev = await retrieveWebEvidence(input(), {
      runtime: { site: "com", arkApiKey: "", searchApiKey: "" },
    });
    expect(ev.status).toBe("disabled");
    expect(ev.dataSources.length).toBe(1);
    expect(ev.dataSources[0].ref).toBe("—");
    expect(ev.dataSources[0].note).toContain("未启用");
  });

  it("buildWebDataSource 对四种 status 都返回 1 条记录（纯函数口径）", () => {
    const base: WebEvidence = {
      status: "ok",
      provider: "ark",
      items: [],
      urls: ["https://a.example.com/1"],
      successQueries: 1,
      totalQueries: 1,
      note: "",
      elapsedMs: 1,
      cached: false,
      dataSources: [],
      reason: "ok",
    };
    const cases: WebEvidence[] = [
      { ...base, status: "ok" },
      { ...base, status: "partial", successQueries: 1, totalQueries: 5, note: "" },
      { ...base, status: "timeout", urls: [], successQueries: 0 },
      { ...base, status: "disabled", urls: [], successQueries: 0 },
    ];
    for (const ev of cases) {
      const record = buildWebDataSource(ev);
      expect(record.name).toBe("Web检索");
      expect(typeof record.ref).toBe("string");
      expect(record.ref.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// ④ 超时 / 异常：永不抛错
// ═══════════════════════════════════════════════════════════

describe("retrieveWebEvidence 永不抛错", () => {
  const comTavilyRuntime = { site: "com" as const, searchApiKey: "tvly-dev-abcdefghijklmn" };

  it("fetch 挂起 ⇒ timeout 档，不抛错", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const ev = await retrieveWebEvidence(input(), {
      runtime: comTavilyRuntime,
      timeoutMs: 40,
      budgetMs: 200,
      retry: 0,
    });
    expect(ev.status).toBe("timeout");
    expect(ev.items).toEqual([]);
    expect(ev.urls).toEqual([]);
  });

  it("fetch throw ⇒ 返回结果对象", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    const ev = await retrieveWebEvidence(input(), {
      runtime: comTavilyRuntime,
      timeoutMs: 100,
      budgetMs: 500,
      retry: 0,
    });
    expect(ev.status).toBe("timeout");
    expect(ev.reason).toBe("error");
    expect(typeof ev.errorDetail).toBe("string");
  });

  it("HTTP 403 ⇒ 返回结果对象（4xx 不重试）", async () => {
    const fetchMock = vi.fn(async () => new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const ev = await retrieveWebEvidence(input(), {
      runtime: comTavilyRuntime,
      timeoutMs: 100,
      budgetMs: 500,
      retry: 0,
    });
    expect(ev.status).toBe("timeout");
    expect(ev.reason).toBe("error");
    expect(ev.dataSources[0].ref).toBe("—");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("HTTP 500 ⇒ 返回结果对象（可重试但预算内只重试 1 次）", async () => {
    const fetchMock = vi.fn(async () => new Response("boom", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const ev = await retrieveWebEvidence(input(), {
      runtime: comTavilyRuntime,
      timeoutMs: 200,
      budgetMs: 3_500,
      retry: 1,
    });
    expect(ev.status).toBe("timeout");
    // 5 条 query ×（1 次 + 1 次重试）= 10 次
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});

// ═══════════════════════════════════════════════════════════
// ⑤ 出境闸：请求体不得含 PII / productId / 图片 URL
// ═══════════════════════════════════════════════════════════

describe("出境闸", () => {
  it("sanitizeQuery 抹掉手机号 / 邮箱 / URL / cuid / 价格", () => {
    const dirty =
      "Krone VBP 3165 13800001111 seller@farm.de https://img.example.com/a.jpg cclx9z8k70000abcd1234efgh ¥1180000";
    const clean = sanitizeQuery(dirty);
    expect(clean).not.toMatch(/1[3-9]\d{9}/);
    expect(clean).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(clean).not.toContain("http");
    expect(clean).not.toContain("cclx9z8k70000abcd1234efgh");
    expect(clean).not.toContain("¥1180000");
    expect(clean).toContain("Krone");
  });

  it("请求体（fetch body）不含手机号 / 邮箱 / 图片 URL / productId 形态串", async () => {
    const captured: string[] = [];
    const fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
      captured.push(String(init?.body ?? ""));
      return new Response(JSON.stringify({ results: [{ title: "t", url: "https://x.example.com/1", content: "c" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const ev = await retrieveWebEvidence(
      input({
        brand: "Krone 13800001111",
        model: "VBP 3165 seller@farm.de https://img.example.com/p.jpg cclx9z8k70000abcd1234efgh",
        category: "打捆机",
      }),
      {
        runtime: { site: "com", searchApiKey: "tvly-dev-abcdefghijklmn" },
        timeoutMs: 200,
        budgetMs: 1_000,
        retry: 0,
      }
    );

    expect(captured.length).toBe(5);
    const joined = captured.join("\n");
    expect(joined).not.toMatch(/1[3-9]\d{9}/);
    expect(joined).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(joined).not.toContain("img.example.com");
    expect(joined).not.toContain("cclx9z8k70000abcd1234efgh");
    expect(joined).not.toContain("productId");
    expect(ev.status).toBe("ok");
  });

  it("ARK 通道同样只发清洗后的 query", async () => {
    arkWebSearchMock.mockImplementation(async () => arkFindingsResponse("gate"));
    await retrieveWebEvidence(
      input({ model: "VBP 3165 13800001111 https://img.example.com/p.jpg" }),
      { runtime: { site: "cn", arkApiKey: "ark-key" } }
    );
    const prompts = arkWebSearchMock.mock.calls.map((c) => String(c[0]?.prompt ?? "")).join("\n");
    expect(prompts).not.toMatch(/1[3-9]\d{9}/);
    expect(prompts).not.toContain("img.example.com");
  });
});

// ═══════════════════════════════════════════════════════════
// ⑥ 缓存
// ═══════════════════════════════════════════════════════════

describe("进程内缓存", () => {
  it("同 key 连续调 2 次 ⇒ 底层只跑 1 轮（5 次），第二次 cached=true", async () => {
    arkWebSearchMock.mockImplementation(async () => arkFindingsResponse("cache"));
    const runtime = { site: "com" as const, arkApiKey: "ark-key" };

    const first = await retrieveWebEvidence(input(), { runtime });
    expect(arkWebSearchMock).toHaveBeenCalledTimes(5);
    expect(first.cached).toBe(false);

    const second = await retrieveWebEvidence(input(), { runtime });
    expect(arkWebSearchMock).toHaveBeenCalledTimes(5);
    expect(second.cached).toBe(true);
    expect(second.status).toBe("ok");
    expect(second.dataSources.length).toBe(1);
  });

  it("cacheTtlMs=0 ⇒ 关闭缓存", async () => {
    arkWebSearchMock.mockImplementation(async () => arkFindingsResponse("nocache"));
    const runtime = { site: "com" as const, arkApiKey: "ark-key" };
    await retrieveWebEvidence(input(), { runtime, cacheTtlMs: 0 });
    await retrieveWebEvidence(input(), { runtime, cacheTtlMs: 0 });
    expect(arkWebSearchMock).toHaveBeenCalledTimes(10);
  });
});

// ═══════════════════════════════════════════════════════════
// ⑦ query 构造与渲染
// ═══════════════════════════════════════════════════════════

describe("query 构造 / 证据渲染", () => {
  it("固定 5 条 query，覆盖价格 / 新机对标 / 准入 / 关税 / 规格", () => {
    const queries = buildEvidenceQueries(input());
    expect(queries).toHaveLength(5);
    expect(queries[0]).toContain("Krone VBP 3165");
    expect(queries[1]).toContain("新机");
    expect(queries[2]).toContain("欧洲");
    expect(queries[3]).toContain("关税");
    expect(queries[4]).toContain("规格");
  });

  it("renderEvidenceBlock：非 ok 时返回带原因的块而不是空字符串", () => {
    const disabled: WebEvidence = {
      status: "disabled",
      provider: null,
      items: [],
      urls: [],
      successQueries: 0,
      totalQueries: 5,
      note: "外部证据未接入（未启用）",
      elapsedMs: 3,
      cached: false,
      dataSources: [],
      reason: "not-configured",
    };
    const block = renderEvidenceBlock(disabled);
    expect(block.length).toBeGreaterThan(20);
    expect(block).toContain("未启用");
    expect(block).toContain("禁止");
  });
});

// ═══════════════════════════════════════════════════════════
// ⑧ retrieval 装配：三块 additive + 机型进 where + 不用 locationCode/goodsRegion
// ═══════════════════════════════════════════════════════════

describe("retrieval 装配（T07 增量块）", () => {
  const prismaMock = prisma as unknown as {
    product: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    brandBenchmark: { findMany: ReturnType<typeof vi.fn> };
    rawListing: { findMany: ReturnType<typeof vi.fn> };
    marketIntel: { findMany: ReturnType<typeof vi.fn> };
    $queryRawUnsafe: ReturnType<typeof vi.fn>;
  };

  const savedEnv = {
    arkApiKey: process.env.ARK_API_KEY,
    arkProxyUrl: process.env.ARK_PROXY_URL,
    searchApiKey: process.env.SEARCH_API_KEY,
    searchApiProvider: process.env.SEARCH_API_PROVIDER,
    webSearchProvider: process.env.WEB_SEARCH_PROVIDER,
  };

  beforeEach(() => {
    __clearCache();
    // 强制"未配置检索凭据"⇒ webEvidence 走 disabled，测试不触网
    process.env.ARK_API_KEY = "";
    process.env.ARK_PROXY_URL = "";
    process.env.SEARCH_API_KEY = "";
    process.env.SEARCH_API_PROVIDER = "";
    process.env.WEB_SEARCH_PROVIDER = "";

    prismaMock.$queryRawUnsafe.mockResolvedValue([]);
    prismaMock.product.findUnique.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.marketIntel.findMany.mockResolvedValue([]);
    prismaMock.rawListing.findMany.mockResolvedValue([
      {
        id: "rl1",
        source: "agroline",
        sourceUrl: "https://example-farm.de/listing/rl1",
        brandName: "Krone",
        modelName: "VBP 3165",
        year: 2019,
        priceCny: 1_180_000,
        currency: "EUR",
        location: "München, Germany",
        scrapedAt: new Date("2026-10-01T00:00:00Z"),
      },
    ]);
    prismaMock.brandBenchmark.findMany.mockImplementation(async (args: { select?: Record<string, unknown>; where?: { AND?: unknown } }) => {
      if (args?.select && "region" in args.select && !("model" in args.select)) {
        return [
          { region: "EU", priceCny: 1_200_000 },
          { region: "EU", priceCny: 1_000_000 },
          { region: "US", priceCny: 900_000 },
          { region: null, priceCny: null },
        ];
      }
      const modelRows = [
        { brand: "krone", model: "VBP 3165", priceCny: 1_250_000, region: "EU", sourceSite: "agroline" },
        { brand: "krone", model: "VBP 3165", priceCny: 1_150_000, region: "EU", sourceSite: "mascus" },
      ];
      // 机型级查询带 AND（model 条件）；品牌级查询只有品牌 OR ⇒ 多返回一台非同机型（用于回落填充）
      const isModelQuery = Array.isArray(args?.where?.AND);
      return isModelQuery
        ? modelRows
        : [
            ...modelRows,
            { brand: "krone", model: "Comprima F155", priceCny: 980_000, region: "EU", sourceSite: "agroline" },
          ];
    });
  });

  afterEach(() => {
    process.env.ARK_API_KEY = savedEnv.arkApiKey ?? "";
    process.env.ARK_PROXY_URL = savedEnv.arkProxyUrl ?? "";
    process.env.SEARCH_API_KEY = savedEnv.searchApiKey ?? "";
    process.env.SEARCH_API_PROVIDER = savedEnv.searchApiProvider ?? "";
    process.env.WEB_SEARCH_PROVIDER = savedEnv.webSearchProvider ?? "";
  });

  it("三块增量字段都在：webEvidence / rawListings / benchmarkDetail", async () => {
    const ctx = await retrieveStrategyContext({ brandName: "Krone", modelName: "VBP 3165", categoryName: "打捆机" });

    expect(ctx.webEvidence).toBeDefined();
    expect(ctx.webEvidence?.dataSources.length).toBe(1);
    expect(ctx.webEvidence?.status).toBe("disabled");

    expect(ctx.rawListings?.length).toBe(1);
    expect(ctx.rawListings?.[0].source).toBe("agroline");
    expect(ctx.rawListings?.[0].countryIso).toBe("DE");
    // 老 8 块仍在
    expect(Array.isArray(ctx.benchmarks)).toBe(true);
    // realtimeExternal 依赖仓库内真实日报快照（有则 true），只断言类型不硬化取值
    expect(typeof ctx.realtimeExternal).toBe("boolean");
  });

  it("机型名进 where（matchScope=model），不足 3 条才回落品牌级", async () => {
    await retrieveStrategyContext({ brandName: "Krone", modelName: "VBP 3165", categoryName: "打捆机" });

    const modelCall = prismaMock.brandBenchmark.findMany.mock.calls[0][0] as {
      where: { AND?: Array<{ OR?: Array<{ model?: { contains?: string } }> }> };
    };
    const modelContains = JSON.stringify(modelCall.where.AND ?? []);
    // 修正前：modelName 只用于早退，where 里根本没有 model 条件
    expect(modelContains).toContain("VBP 3165");
  });

  it("rawListings 查询不用 locationCode / goodsRegion 过滤（实测这两列几乎全空）", async () => {
    await retrieveStrategyContext({ brandName: "Krone", modelName: "VBP 3165", categoryName: "打捆机" });

    const rawCall = JSON.stringify(prismaMock.rawListing.findMany.mock.calls[0][0]);
    expect(rawCall).not.toContain("locationCode");
    expect(rawCall).not.toContain("goodsRegion");
    expect(rawCall).toContain("priceCny");
    // PII / 媒体列一律不 select
    expect(rawCall).not.toContain("sellerPhone");
    expect(rawCall).not.toContain("sellerEmail");
    expect(rawCall).not.toContain("images");
  });

  it("benchmarkDetail.byRegion 聚合出 count / min / max / median", async () => {
    const ctx = await retrieveStrategyContext({ brandName: "Krone", modelName: "VBP 3165", categoryName: "打捆机" });

    const eu = ctx.benchmarkDetail?.byRegion.find((r) => r.region === "EU");
    expect(eu).toEqual({ region: "EU", count: 2, minCny: 1_000_000, maxCny: 1_200_000, medianCny: 1_100_000 });
    // 机型级命中 2 条（<3）⇒ 品牌级回落被启用
    expect(ctx.benchmarkDetail?.byModel.length).toBe(2);
    expect(ctx.benchmarkDetail?.byBrand.length).toBeGreaterThan(0);
    expect(ctx.benchmarkDetail?.byBrand[0].matchScope).toBe("brand");
  });
});
