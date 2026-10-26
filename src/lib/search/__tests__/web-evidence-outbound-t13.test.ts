/**
 * T13 独立验收（第 5 条）· 出境闸：`.cn` 场景下**一个出境请求都不许发**
 * ─────────────────────────────────────────────────────────
 * 为什么独立再验一遍（不采信 T07 自测）：
 *   ① T07 既有测试只数 `fetch`（第三方源），但 ARK 通道走的是 **axios** ——
 *      「代理被拒」这条如果只在 fetch 上断言，等于没验；
 *   ② 本站红线是「数据不出境」，其充分条件是「所有出站 host 必须是境内域名」，
 *      而不是「不响代理配置」。故本文件同时挂 axios + fetch 两个探针，逐条断言 URL host。
 *
 * 断言口径（严格区分「零出境」与「零请求」）：
 *   - 第三方 provider（Tavily/Serper/Brave）在 `.cn` ⇒ **零请求**（fetch=0、axios=0）+ disabled/site-blocked；
 *   - `.cn` + `ARK_PROXY_URL` ⇒ 允许发请求，但**每一跳 host 必须是 ark.cn-beijing.volces.com**，
 *     `proxyRejected=true`（设计取舍：代理被拒后走境内直连，非 bug，见 web-evidence.ts 闸③注释）；
 *   - `.cn` + 非境内 `ARK_BASE_URL` ⇒ **零请求** + disabled/site-blocked。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// axios 探针（ARK 通道）：记录每一跳 URL，绝不真发网络
const axiosPost = vi.hoisted(() => vi.fn());
vi.mock("axios", () => ({
  default: { post: axiosPost, get: axiosPost },
  post: axiosPost,
}));

// 避免任何模块顺带拉起真实 prisma 连接
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { retrieveWebEvidence, sanitizeQuery, __clearCache } from "@/lib/search/web-evidence";

const DOMESTIC_HOST = "ark.cn-beijing.volces.com";
const PROXY_URL = "https://proxy.example.com";
const FOREIGN_BASE = "https://api.example.com";

const ARK_OK_RESPONSE = {
  status: 200,
  data: JSON.stringify({
    output_text: JSON.stringify({
      findings: [
        { title: "t1", url: "https://example.org/a", snippet: "s1", kind: "二手挂牌" },
      ],
    }),
  }),
  headers: { "content-type": "application/json" },
};

/** 把 axios.post 收到的 URL 收集起来 */
function capturedUrls(): string[] {
  return axiosPost.mock.calls.map((c) => String(c[0]));
}

function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

const BASE_INPUT = {
  brand: "东方红",
  model: "YTO-1204",
  category: "拖拉机",
  markets: ["乌兹别克斯坦"],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __clearCache();
  axiosPost.mockReset();
  axiosPost.mockResolvedValue(ARK_OK_RESPONSE);
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("闸① provider 白名单：.cn 不许用第三方源（零请求）", () => {
  it(".cn + Tavily 凭据 ⇒ disabled + site-blocked，fetch=0 且 axios=0", async () => {
    const ev = await retrieveWebEvidence(BASE_INPUT, {
      runtime: { site: "cn", searchApiKey: "tvly-live-xxx" },
      cacheTtlMs: 0,
    });

    expect(ev.status).toBe("disabled");
    expect(ev.reason).toBe("site-blocked");
    expect(ev.provider).toBeNull();
    expect(ev.note).toContain("site-blocked");
    expect(ev.note).toContain("tavily");
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(axiosPost).toHaveBeenCalledTimes(0);
    expect(ev.dataSources).toHaveLength(1);
    expect(ev.dataSources[0].name).toBe("Web检索");
  });

  it(".cn + 显式 WEB_SEARCH_PROVIDER=serper ⇒ 同样零请求（显式也不能越权）", async () => {
    const ev = await retrieveWebEvidence(BASE_INPUT, {
      runtime: { site: "cn", searchApiKey: "serper-key", webSearchProvider: "serper" },
      cacheTtlMs: 0,
    });

    expect(ev.status).toBe("disabled");
    expect(ev.reason).toBe("site-blocked");
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(axiosPost).toHaveBeenCalledTimes(0);
  });
});

describe("闸③ 端点境内：.cn 的每一跳都必须是境内域名", () => {
  it(".cn + ARK_PROXY_URL ⇒ 所有出站 host 都是境内 ARK，绝不出现 proxy 域名", async () => {
    const ev = await retrieveWebEvidence(BASE_INPUT, {
      runtime: { site: "cn", arkApiKey: "ark-key", arkProxyUrl: PROXY_URL },
      cacheTtlMs: 0,
    });

    expect(ev.status).toBe("ok"); // 代理被拒后走境内直连，检索照常
    expect(ev.proxyRejected).toBe(true);

    const urls = capturedUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(hostOf(u), `出现出境请求：${u}`).toBe(DOMESTIC_HOST);
      expect(u).not.toContain("proxy.example.com");
    }
  });

  it(".cn + 非境内 ARK_BASE_URL ⇒ disabled + site-blocked，零请求（axios=0 / fetch=0）", async () => {
    const ev = await retrieveWebEvidence(BASE_INPUT, {
      runtime: { site: "cn", arkApiKey: "ark-key", arkBaseUrl: FOREIGN_BASE },
      cacheTtlMs: 0,
    });

    expect(ev.status).toBe("disabled");
    expect(ev.reason).toBe("site-blocked");
    expect(ev.note).toContain(DOMESTIC_HOST);
    expect(axiosPost).toHaveBeenCalledTimes(0);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});

describe("闸② 运行时清洗：query 里的 PII 一律抹掉才允许出站", () => {
  it("sanitizeQuery 独立验证：手机号 / 邮箱 / URL / 价格 / 长数字全部消失", () => {
    const raw =
      "东方红 YTO-1204 价格 ¥98,000 电话 13800138000 邮箱 boss@corp.com 见 https://x.example.com/p/1 序列号 123456789012345";
    const out = sanitizeQuery(raw);

    expect(out).not.toContain("13800138000");
    expect(out).not.toContain("boss@corp.com");
    expect(out).not.toContain("https://");
    expect(out).not.toContain("¥98,000");
    expect(out).not.toContain("123456789012345");
    // 业务词保留（否则检索失效）
    expect(out).toContain("东方红");
    expect(out).toContain("YTO-1204");
  });

  it(".cn ARK 通道：真正发出去的请求体不含任何手机号 / 邮箱 / 价格串", async () => {
    await retrieveWebEvidence(
      { ...BASE_INPUT, markets: ["乌兹别克斯坦"] },
      { runtime: { site: "cn", arkApiKey: "ark-key" }, cacheTtlMs: 0 }
    );

    expect(axiosPost).toHaveBeenCalled();
    const bodyText = JSON.stringify(axiosPost.mock.calls[0][1] ?? {});
    expect(bodyText).not.toMatch(/1[3-9]\d{9}/);
    expect(bodyText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(bodyText).not.toMatch(/¥\s*[\d,.]+/);
    // 出站只带「品牌 / 机型 / 品类 / 国别 / 检索问题」，不带站内主键
    expect(bodyText).not.toMatch(/\bc[a-z0-9]{20,30}\b/);
  });
});

describe("对照组：.com 站允许第三方源（证明闸门是按站点、不是一律禁）", () => {
  it(".com + Tavily ⇒ 放行，fetch 被调用且 axios 未被调用", async () => {
    // ⚠️ 必须每次新建 Response：Response body 只能读一次，复用同一实例会让后续 query 抛错
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ results: [{ title: "t", url: "https://example.org/r", content: "c" }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );

    const ev = await retrieveWebEvidence(BASE_INPUT, {
      runtime: { site: "com", searchApiKey: "tvly-live-xxx" },
      cacheTtlMs: 0,
    });

    expect(ev.status).toBe("ok");
    expect(ev.provider).toBe("tavily");
    expect(fetchMock).toHaveBeenCalled();
    expect(axiosPost).toHaveBeenCalledTimes(0);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain("api.tavily.com");
    }
  });
});
