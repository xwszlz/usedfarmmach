/**
 * 单测：ARK 联网检索请求体里 `tools[].sources` 必须是 `["search_engine"]`（回归锁）
 * ─────────────────────────────────────────────────────────────────────────
 * 事故背景（已用真实探针打靶确认，同一 key / 同一模型 doubao-seed-2-1-pro-260915）：
 *
 *   [{"type":"web_search","sources":["doubao"]}]        ⇒ HTTP 403
 *     {"error":{"code":"AccessDenied","message":"Access denied for web search.
 *      Please go to the Volcano Ark Console to verify the activation status."}}
 *   [{"type":"web_search","sources":["search_engine"]}] ⇒ HTTP 200 ✅
 *   [{"type":"web_search","sources":[]}]                ⇒ HTTP 200 ✅
 *   [{"type":"web_search"}]（省略 sources 字段）         ⇒ HTTP 200 ✅
 *   [{"type":"web_search","sources":["search_engine","doubao"]}] ⇒ HTTP 400
 *   [{"type":"web_search","sources":["volc_search"]}]   ⇒ HTTP 400
 *
 * 这个 bug 极其阴险：403 的文案是 "verify the activation status"，会把人一路带去找
 * 火山方舟控制台确认插件有没有开通、找财务确认订单有没有生效 —— 而插件其实早就开通好了，
 * 纯粹是 source 枚举名写错。于是线上表现成「开通了插件仍然 100% 失败」。
 *
 * 本文件唯一职责：**把正确值钉死**。任何把 `search_engine` 改回 `doubao`（或换成
 * 别的什么自定义名字）的改动，都会在这里立刻变红。
 *
 * 实现注意（与本仓既有 mock 口径一致，见 `ark-circuit-4xx.test.ts`）：
 *   传输层是 **axios**（`postWithResilience` 走 `axios.post`，不是 `fetch`）。
 *   因此 mock 的是 `axios.post` —— mock `globalThis.fetch` 在这里打不到任何东西，
 *   测试会静默走真实网络。请求体是 `axios.post` 的第 2 个入参。
 *
 * 运行：npx vitest run src/lib/ai/__tests__/ark-web-search-body.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** axios.post 的 mock（`vi.hoisted` 保证在 `vi.mock` 工厂执行前就已初始化） */
const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock("axios", () => ({ default: { post: postMock } }));

/** 一份合法的 `/responses` 200 响应（`stream:false` ⇒ 单段 JSON） */
const OK_BODY = JSON.stringify({
  output_text: JSON.stringify({
    findings: [{ title: "t", url: "https://example-farm.de/listing/1", snippet: "s", kind: "二手挂牌" }],
  }),
  usage: { total_tokens: 1234, tool_usage: { web_search: 9 } },
});

/** 拿一份全新的 ark-client（熔断计数是模块级私有变量，跨用例会污染） */
async function loadClient() {
  vi.resetModules();
  const client = await import("@/lib/ai/ark-client");
  return client;
}

beforeEach(() => {
  postMock.mockReset();
  // `validateStatus: () => true` ⇒ 非 2xx 也 resolve，形状照抄 `postWithResilience`
  postMock.mockResolvedValue({
    status: 200,
    data: OK_BODY,
    headers: { "content-type": "application/json" },
  });
});

afterEach(() => {
  // 只重置模块缓存（熔断计数是模块私有变量）。
  // ⚠️ **不要**在这里 `vi.doUnmock("axios")`：本文件的 axios mock 是用顶层 `vi.mock` 注册的，
  // `doUnmock` 会把它撤掉，后续用例就会打到真实方舟端点（实测会拿到 401 真响应），
  // 既慢又依赖外网。
  vi.resetModules();
});

describe("arkWebSearch 请求体：tools[].sources", () => {
  it("sources 必须是 [\"search_engine\"]（doubao 是 403 非法值，回归即红）", async () => {
    const client = await loadClient();

    await client.arkWebSearch({ prompt: "CLAAS Jaguar 970 price", site: "com", timeoutMs: 1_000 });

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];

    // 端点选路没被本改动影响
    expect(String(url)).toContain("/responses");

    const tools = body.tools as Array<Record<string, unknown>>;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(1);
    expect(tools[0].type).toBe("web_search");

    // 核心断言（本文件的全部意义）
    expect(tools[0].sources).toEqual(["search_engine"]);
    // 反面对照：那个会导致 403 的历史值不得再出现
    expect(tools[0].sources).not.toContain("doubao");

    // 其余字段保持 arch §1.2.3 形状（防止有人顺手"优化"成流式或换 model 字段名）
    expect(body.stream).toBe(false);
    expect(Array.isArray(body.input)).toBe(true);
    const input = body.input as Array<{ role?: string; content?: Array<{ type?: string; text?: string }> }>;
    expect(input[0].role).toBe("user");
    expect(input[0].content?.[0]?.type).toBe("input_text");
    expect(input[0].content?.[0]?.text).toBe("CLAAS Jaguar 970 price");
  });

  it("sources 不受任何环境变量影响（防止被做成可配置后在生产改回 doubao）", async () => {
    // `sources` 是**协议枚举值**，不是站点配置：它没有"按环境切换"的语义。
    // 一旦有人给它加一个 `ARK_WEB_SEARCH_SOURCES` 之类的开关，生产上就随时可能被填成
    // `doubao`（很多人会直觉认为"豆包自己搜"），于是 403 静默复活、而且只有在线上才暴露。
    // 这条用例把"它必须是常量"这件事也一起钉死。
    process.env.ARK_WEB_SEARCH_SOURCES = "doubao";
    try {
      const client = await loadClient();
      await client.arkWebSearch({ prompt: "q", site: "com", timeoutMs: 1_000 });
      const body = postMock.mock.calls[0][1] as { tools: Array<{ sources?: string[] }> };
      expect(body.tools[0].sources).toEqual(["search_engine"]);
    } finally {
      delete process.env.ARK_WEB_SEARCH_SOURCES;
    }
  });
});
