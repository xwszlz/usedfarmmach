/**
 * 单测：`chatCompletionDoubao` 的重试预算闸门（`deadlineMs`）
 * ─────────────────────────────────────────────────────────
 * 背景：本函数对 429/5xx 有「退避 1s 再试一次」的重试。若每次都吃满 `timeoutMs`，
 * 总耗时就是 2×timeout —— 调用方按 `maxDuration` 算出的预算会被这一次盲重试直接击穿
 * （表现为平台杀进程返 HTML 504，前端拿到的是 HTML 而不是 JSON 错误）。
 *
 * 三条断言：
 *   ① 不传 `deadlineMs` ⇒ 行为与旧版**完全一致**（重试照旧，向后兼容 deep-analysis / valuation）
 *   ② `deadlineMs` 已近 ⇒ 不再重试，直接抛错（快速失败）
 *   ③ `deadlineMs` 充裕 ⇒ 正常重试一次
 *
 * 运行：npx vitest run src/lib/ai/__tests__/ark-client-deadline.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** 503 形状的错误（ark-client 会把它判为可重试） */
function httpError(status: number): Error & { response: { status: number } } {
  return Object.assign(new Error(`mock HTTP ${status}`), { response: { status } });
}

/**
 * 每个用例独立加载模块：熔断计数（`circuitFailures`）是模块级私有变量，
 * 同一份实例里累积到 5 次会开启 30s 熔断，把后面的用例全打红。
 */
async function loadClient(postImpl: () => Promise<unknown>) {
  vi.resetModules();
  const post = vi.fn(postImpl);
  vi.doMock("axios", () => ({ default: { post } }));
  const client = await import("@/lib/ai/ark-client");
  return { client, post };
}

const BASE_OPTS = {
  messages: [{ role: "user", content: "hi" }],
  maxTokens: 16,
  timeoutMs: 1_000,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("deadlineMs 重试预算闸门", () => {
  it("① 不传 deadlineMs ⇒ 保留旧行为：503 重试 1 次（共 2 次请求）", async () => {
    const { client, post } = await loadClient(async () => {
      throw httpError(503);
    });

    await expect(client.chatCompletionDoubao({ ...BASE_OPTS })).rejects.toThrow(/mock HTTP 503/);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("② deadlineMs 已近（剩余 < 15s）⇒ 不重试，只打 1 次就抛错", async () => {
    const { client, post } = await loadClient(async () => {
      throw httpError(503);
    });

    await expect(
      client.chatCompletionDoubao({ ...BASE_OPTS, deadlineMs: Date.now() + 5_000 })
    ).rejects.toThrow(/mock HTTP 503/);
    // 若闸门失效，这里会变成 2 —— 也就是把"快速失败"拖成"慢速失败 + 超时被杀"
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("③ deadlineMs 充裕 ⇒ 正常重试（不会被闸门误杀）", async () => {
    const { client, post } = await loadClient(async () => {
      throw httpError(429);
    });

    await expect(
      client.chatCompletionDoubao({ ...BASE_OPTS, deadlineMs: Date.now() + 200_000 })
    ).rejects.toThrow(/mock HTTP 429/);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("成功路径不受影响：正常返回 text / usage / finishReason", async () => {
    const { client, post } = await loadClient(async () => ({
      data: {
        choices: [{ message: { content: "hello" }, finish_reason: "length" }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      },
    }));

    const res = await client.chatCompletionDoubao({ ...BASE_OPTS, deadlineMs: Date.now() + 5_000 });
    expect(res.text).toBe("hello");
    expect(res.finishReason).toBe("length");
    expect(res.usage).toEqual({ prompt_tokens: 3, completion_tokens: 4 });
    expect(post).toHaveBeenCalledTimes(1);
  });
});
