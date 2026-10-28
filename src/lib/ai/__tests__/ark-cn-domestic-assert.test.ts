/**
 * 单测：`.cn` 主聊天出口的境内端点断言（风控审计 R8-1 回归锁）
 * ─────────────────────────────────────────────────────────
 * 缺口背景：检索通道 `/responses` 早有硬闸（`arkWebSearch` 里 `site==="cn" && !domestic ⇒ throw`），
 * 但**真正承载用户照片、卖家自由文本、RawListing 摘要的主出口** `/chat/completions`
 * 过去完全不校验 host：`.cn` 恒用 `ARK_BASE_URL`，误配成境外地址就会让全部 AI 正文
 * 静默出境 —— 无日志、无报错、健康检查照样绿灯。
 *
 * 本文件锁五件事：
 *   ① `.cn` + 境外 base ⇒ 拒绝，且 **axios.post 调用 0 次**（证明"没发出去"，而不是"发了才失败"）；
 *   ② `.cn` + 境内默认 base ⇒ 正常发出并返回；
 *   ③ `.com` + 境外 base ⇒ 允许（B 通道/直连都合法，不得误伤）；
 *   ④ `.cn` + base 不可解析 ⇒ 也拒绝（fail closed），错误信息说明 base 无法解析；
 *   ⑤ `.cn` + 配了 `ARK_PROXY_URL` 但 base 是境外的 ⇒ 仍然拒绝（代理配置不得把 `.cn` 带偏）。
 *
 * 实现注意（关键，顺序反了测的就是上一个用例的配置）：
 *   `SITE` / `ARK_BASE_URL` / `ARK_PROXY_URL` 都是**模块加载时捕获的 const**
 *   （`@/config/site` 的 `SITE`、`ark-client` 顶部的 `ARK_*`），
 *   所以每个用例必须 `vi.resetModules()` → **先设 env** → 再动态 `import()`。
 *
 * 运行：npx vitest run src/lib/ai/__tests__/ark-cn-domestic-assert.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** 对话调用公共参数（预算充足，避免 `deadlineMs` 闸门干扰） */
const CHAT_OPTS = {
  messages: [{ role: "user", content: "hi" }],
  maxTokens: 16,
  timeoutMs: 1_000,
};

/** 境内默认 base（与 `ark-client.ts` 的 `ARK_BASE_URL` 缺省值一致） */
const CN_BASE = "https://ark.cn-beijing.volces.com/api/v3";
/** 境外 base（模拟 `.env.cn` 被误配） */
const OVERSEAS_BASE = "https://api.openai.com/v1";

const ENV_KEYS = ["SITE", "ARK_BASE_URL", "ARK_PROXY_URL"] as const;
let originalEnv: Record<string, string | undefined> = {};

/**
 * 装载一份全新模块实例。
 *
 * 顺序：resetModules（丢掉旧的 `SITE`/`ARK_*` 快照）→ 设 env → mock axios → 动态 import。
 */
async function loadClient(env: { site: "cn" | "com"; baseUrl: string; proxyUrl?: string }) {
  vi.resetModules();
  process.env.SITE = env.site;
  process.env.ARK_BASE_URL = env.baseUrl;
  if (env.proxyUrl) process.env.ARK_PROXY_URL = env.proxyUrl;
  else delete process.env.ARK_PROXY_URL;

  // 成功形状：`chatCompletionDoubao` 读 choices[0].message.content / finish_reason / usage
  // 形参必须声明出来：否则 `post.mock.calls[0]` 会被推断成空元组，取不到 URL（TS2493）
  const post = vi.fn(async (_url: string) => ({
    status: 200,
    data: {
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    },
  }));
  vi.doMock("axios", () => ({ default: { post } }));

  const client = await import("@/lib/ai/ark-client");
  return { client, post };
}

beforeEach(() => {
  originalEnv = {};
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k] as string;
  }
  vi.doUnmock("axios");
  vi.restoreAllMocks();
  vi.resetModules();
});

describe(".cn 聊天出口的境内端点断言（闸③对称实现）", () => {
  it("① .cn + 境外 base ⇒ 拒绝，且 axios.post 调用 0 次", async () => {
    // 模块加载期自检会 warn（只告警不抛错），这里顺带把它也断言掉
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { client, post } = await loadClient({ site: "cn", baseUrl: OVERSEAS_BASE });

    await expect(client.chatCompletionDoubao(CHAT_OPTS)).rejects.toThrow(
      /境内站聊天端点必须是/
    );
    // 错误信息要能一眼看出是哪个 host 被误配
    await expect(client.chatCompletionDoubao(CHAT_OPTS)).rejects.toThrow(/api\.openai\.com/);

    // 关键断言：根本没发出去（不是"发出去了才失败"）
    expect(post).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(0);

    // 加载期自检：告警里带实际 host，便于部署后第一时间发现误配
    expect(warn.mock.calls.flat().join(" ")).toContain("api.openai.com");
  });

  it("② .cn + 境内默认 base ⇒ 正常发出并返回（不得误伤正常路径）", async () => {
    const { client, post } = await loadClient({ site: "cn", baseUrl: CN_BASE });

    const res = await client.chatCompletionDoubao(CHAT_OPTS);

    expect(res.text).toBe("ok");
    expect(res.finishReason).toBe("stop");
    expect(post).toHaveBeenCalledTimes(1);
    // 请求打到默认境内端点
    expect(String(post.mock.calls[0][0])).toBe(`${CN_BASE}/chat/completions`);
  });

  it("③ .com + 境外 base ⇒ 允许发出（B 通道与直连都合法，不得误伤）", async () => {
    const { client, post } = await loadClient({ site: "com", baseUrl: OVERSEAS_BASE });

    const res = await client.chatCompletionDoubao(CHAT_OPTS);

    expect(res.text).toBe("ok");
    expect(post).toHaveBeenCalledTimes(1);
    expect(String(post.mock.calls[0][0])).toBe(`${OVERSEAS_BASE}/chat/completions`);
  });

  it("④ .cn + base 不可解析 ⇒ fail closed 拒绝，并说明 base 无法解析", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, post } = await loadClient({ site: "cn", baseUrl: "不是URL" });

    await expect(client.chatCompletionDoubao(CHAT_OPTS)).rejects.toThrow(
      /境内站聊天端点必须是/
    );
    await expect(client.chatCompletionDoubao(CHAT_OPTS)).rejects.toThrow(/base 无法解析/);
    expect(post).not.toHaveBeenCalled();
    // 无法解析时自检也要告警（host 显示为"无法解析"）
    expect(warn.mock.calls.flat().join(" ")).toContain("无法解析");
  });

  it("⑤ .cn + 配了 ARK_PROXY_URL 但 base 是境外的 ⇒ 仍然拒绝（代理不得带偏 .cn）", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, post } = await loadClient({
      site: "cn",
      baseUrl: OVERSEAS_BASE,
      proxyUrl: "https://proxy.example.com/v1",
    });

    // 报出的 host 必须是 base 的 host（证明 .cn 没有采用 ARK_PROXY_URL）
    await expect(client.chatCompletionDoubao(CHAT_OPTS)).rejects.toThrow(/api\.openai\.com/);
    expect(post).not.toHaveBeenCalled();
  });
});
