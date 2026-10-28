/**
 * 单测：熔断计数只认 429/5xx，4xx 一律不计入（2026-10-28 线上 P0 回归锁）
 * ─────────────────────────────────────────────────────────────────────────
 * 事故链条（已用真实探针打靶确认）：
 *   ① 方舟账号未开通联网检索插件 ⇒ `POST /responses` 恒定 403 AccessDenied；
 *   ② 销售策略生成前固定跑 5 个检索 query（`web-evidence.ts` 的 totalQueries）；
 *   ③ 检索层从不抛错（全部降级成 `status:"error"`），请求继续往下走；
 *   ④ 旧版 `postWithResilience` 在非 2xx 分支**无条件** `circuitFailures += 1`，
 *      5 次 403 恰好把与对话调用共享的计数器喂到阈值 5 ⇒ `circuitOpenUntil = now + 30s`；
 *   ⑤ 紧随其后的 `chatCompletionDoubao` 命中「熔断开启」短路 ⇒ 路由 catch 返回 LLM_FAILED。
 *
 * 于是「一个子功能没开通」连坐了「同账号的主链路生成」，且每次请求都自我熔断，永远好不了。
 *
 * 本文件锁三件事：
 *   ① 403 × 5 **不**熔断 ⇒ 对话生成照常真实发出请求并返回文本（P0 修复的正面证明）；
 *   ② 5xx × 5 仍熔断 ⇒ 证明没把熔断机制本身改废（反面对照）；
 *   ③ 4 次 403 后 snapshots 为 `failures=0 / open=false`，且 5xx 一次失败只计一次（不重复计数）。
 *
 * 实现注意：
 *   - `circuitFailures` / `circuitOpenUntil` 是模块级私有状态 ⇒ 每个用例 `vi.resetModules()`
 *     后重新 `import`，否则用例之间互相污染（cooldown 30s，跑不完就全红）。
 *   - `postWithResilience` 以 `validateStatus: () => true` 调用 axios ⇒ mock 必须**正常 resolve**
 *     （而不是 reject）才能模拟 403/500，否则走的是网络错分支，测不到目标逻辑。
 *
 * 运行：npx vitest run src/lib/ai/__tests__/ark-circuit-4xx.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** 403 响应体（照抄线上方舟返回的 AccessDenied 形状） */
const DENIED_BODY = JSON.stringify({
  code: "AccessDenied",
  message:
    "Access denied for web search. Please go to the Volcano Ark Console to verify the activation status.",
});

type MockResponse = {
  status: number;
  data: unknown;
  headers: Record<string, string>;
};

/**
 * 按 URL 分流的 axios.post mock。
 *
 * `responsesStatus` 控制 `/responses`（检索）的状态码；`/chat/completions` 恒定成功，
 * 这样「对话生成是否被熔断短路」就等价于「post 有没有收到 chat 请求」。
 */
function makePostMock(responsesStatus: number) {
  return vi.fn(async (url: string): Promise<MockResponse> => {
    if (String(url).includes("/responses")) {
      const isOk = responsesStatus >= 200 && responsesStatus < 300;
      return {
        status: responsesStatus,
        data: isOk
          ? JSON.stringify({ output_text: "mock search result", output: [] })
          : DENIED_BODY,
        headers: { "content-type": "application/json" },
      };
    }
    return {
      status: 200,
      data: {
        choices: [{ message: { content: "策略正文 OK" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 11, completion_tokens: 22 },
      },
      headers: { "content-type": "application/json" },
    };
  });
}

/** 每个用例拿一份全新的 ark-client 实例（熔断状态是模块级私有变量） */
async function loadClient(responsesStatus: number) {
  vi.resetModules();
  const post = makePostMock(responsesStatus);
  vi.doMock("axios", () => ({ default: { post } }));
  const client = await import("@/lib/ai/ark-client");
  return { client, post };
}

/** 跑一次检索（`site: "com"` 绕开境内端点闸③，聚焦熔断逻辑本身） */
async function searchOnce(client: Awaited<ReturnType<typeof loadClient>>["client"], output: string) {
  return client.arkWebSearch({ prompt: `query-${output}`, site: "com", timeoutMs: 1_000 });
}

/** 统计 mock 收到的 `/chat/completions` 调用次数 */
function chatCalls(post: ReturnType<typeof makePostMock>): number {
  return post.mock.calls.filter((c) => String(c[0]).includes("/chat/completions")).length;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.doUnmock("axios");
  vi.resetModules();
});

describe("熔断计数口径：4xx 不计入，429/5xx 才计入", () => {
  it("① 403 × 5 不熔断：对话生成仍真实发出请求并正常返回文本", async () => {
    const { client, post } = await loadClient(403);

    // 5 次检索全部 403 —— 这正是线上销售策略每次请求都会发生的事
    for (let i = 0; i < 5; i++) {
      await expect(searchOnce(client, String(i))).rejects.toThrow(/HTTP 403/);
    }

    // 关键断言：计数器必须仍是 0，熔断不开启
    expect(client.getArkCircuitState()).toEqual({ failures: 0, openUntil: 0, open: false });

    // 关键断言：对话生成**真实发出**了 axios 请求（旧代码会在这里抛「熔断开启」）
    const res = await client.chatCompletionDoubao({
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 32,
      timeoutMs: 1_000,
    });
    expect(res.text).toBe("策略正文 OK");
    expect(res.finishReason).toBe("stop");
    expect(res.usage).toEqual({ prompt_tokens: 11, completion_tokens: 22 });
    expect(chatCalls(post)).toBe(1);
  });

  it("② 5xx × 5 仍熔断：对话生成必须快速失败（熔断机制本身没被改废）", async () => {
    const { client, post } = await loadClient(500);

    for (let i = 0; i < 5; i++) {
      await expect(searchOnce(client, String(i))).rejects.toThrow(/HTTP 500/);
    }

    const state = client.getArkCircuitState();
    // 一次失败只计一次（内层已计，外层因 `typeof status === "number"` 不重复计数）
    expect(state.failures).toBe(5);
    expect(state.open).toBe(true);
    expect(state.openUntil).toBeGreaterThan(Date.now());

    await expect(
      client.chatCompletionDoubao({
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 32,
        timeoutMs: 1_000,
      })
    ).rejects.toThrow(/熔断开启/);
    // 熔断短路 ⇒ 根本没发出 chat 请求
    expect(chatCalls(post)).toBe(0);
  });

  it("③ 混合不误伤：4 次 403 后 failures=0 且 open=false，对话生成不受影响", async () => {
    const { client, post } = await loadClient(403);

    for (let i = 0; i < 4; i++) {
      await expect(searchOnce(client, String(i))).rejects.toThrow(/HTTP 403/);
    }

    expect(client.getArkCircuitState().failures).toBe(0);
    expect(client.getArkCircuitState().open).toBe(false);

    const res = await client.chatCompletionDoubao({
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 32,
      timeoutMs: 1_000,
    });
    expect(res.text).toBe("策略正文 OK");
    expect(chatCalls(post)).toBe(1);
  });
});
