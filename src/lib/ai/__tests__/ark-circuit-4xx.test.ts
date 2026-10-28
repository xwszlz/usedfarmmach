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
 * 本文件锁五件事：
 *   ① 403 × 5 **不**熔断 ⇒ 对话生成照常真实发出请求并返回文本（P0 修复的正面证明，
 *      同时即跨通道不连坐：检索 403 与对话生成不共命运）；
 *   ② 5xx × 5 仍熔断 ⇒ 证明没把熔断机制本身改废（反面对照）；
 *   ③ 4 次 403 后 snapshots 为 `failures=0 / open=false`，且 5xx 一次失败只计一次（不重复计数）；
 *   ④ 对话侧 400 × 5 不熔断 ⇒ 单个路由的错误参数烧不掉全站 AI（与 ① 同类，换到 chat 通道）；
 *   ⑤ 对话侧 500 × 5 仍熔断 ⇒ 对话侧的熔断也没被改废。
 *
 * 实现注意：
 *   - `circuitFailures` / `circuitOpenUntil` 是模块级私有状态 ⇒ 每个用例 `vi.resetModules()`
 *     后重新 `import`，否则用例之间互相污染（cooldown 30s，跑不完就全红）。
 *   - 两条通道的 mock 形状**不同**，这是照抄 axios 真实行为：
 *     `postWithResilience` 带 `validateStatus: () => true` ⇒ 非 2xx 也 **resolve**；
 *     `chatCompletionDoubao` 不带 ⇒ 非 2xx 由 axios **reject**，错误里带 `response.status`。
 *     写错形状会走错分支，测不到目标逻辑。
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
 * - `/responses`（检索）：`responsesStatus` 控制状态码，恒以 **resolve** 返回（对应
 *   `validateStatus: () => true`）。
 * - `/chat/completions`（对话）：按 `chatStatuses` 队列逐个消费，队列耗尽后返回 200；
 *   非 2xx 以 **reject** 返回并带 `response.status`（对应 axios 默认行为）。
 *
 * 这样「对话生成是否被熔断短路」就等价于「post 有没有收到新的 chat 请求」。
 */
function makePostMock(responsesStatus: number, chatStatuses: number[] = []) {
  const chatQueue = [...chatStatuses];
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
    const next = chatQueue.shift() ?? 200;
    if (next >= 200 && next < 300) {
      return {
        status: next,
        data: {
          choices: [{ message: { content: "策略正文 OK" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 11, completion_tokens: 22 },
        },
        headers: { "content-type": "application/json" },
      };
    }
    throw Object.assign(new Error(`mock chat HTTP ${next}`), { response: { status: next } });
  });
}

/** 每个用例拿一份全新的 ark-client 实例（熔断状态是模块级私有变量） */
async function loadClient(responsesStatus: number, chatStatuses: number[] = []) {
  vi.resetModules();
  const post = makePostMock(responsesStatus, chatStatuses);
  vi.doMock("axios", () => ({ default: { post } }));
  const client = await import("@/lib/ai/ark-client");
  return { client, post };
}

/** 对话调用的公共参数（预算足够，避免 `deadlineMs` 闸门干扰计数） */
const CHAT_OPTS = {
  messages: [{ role: "user", content: "hi" }],
  maxTokens: 32,
  timeoutMs: 1_000,
};

/**
 * 预算不足的对话参数：让内层 429/5xx 的「退避 1s 再试一次」被 `deadlineMs` 闸门挡住，
 * 从而每次调用**只发 1 个请求、只计 1 次失败**，计数可以精确断言。
 */
const CHAT_OPTS_NO_RETRY = { ...CHAT_OPTS, deadlineMs: Date.now() + 5_000 };

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
  it("① / ⑥ 403 × 5 不熔断（跨通道不连坐）：对话生成仍真实发出请求并正常返回文本", async () => {
    const { client, post } = await loadClient(403);

    // 5 次检索全部 403 —— 这正是线上销售策略每次请求都会发生的事
    for (let i = 0; i < 5; i++) {
      await expect(searchOnce(client, String(i))).rejects.toThrow(/HTTP 403/);
    }

    // 关键断言：计数器必须仍是 0，熔断不开启
    expect(client.getArkCircuitState()).toEqual({ failures: 0, openUntil: 0, open: false });

    // 关键断言：对话生成**真实发出**了 axios 请求（旧代码会在这里抛「熔断开启」）
    const res = await client.chatCompletionDoubao(CHAT_OPTS);
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

    const res = await client.chatCompletionDoubao(CHAT_OPTS);
    expect(res.text).toBe("策略正文 OK");
    expect(chatCalls(post)).toBe(1);
  });

  it("④ 对话侧 400 × 5 不熔断：错误参数烧不掉全站 AI，第 6 次仍真实发出请求", async () => {
    // 400 不在 401/403/402 的提前抛出名单里 ⇒ 会走到计数逻辑，正是本次要修的那条路
    const { client, post } = await loadClient(200, [400, 400, 400, 400, 400]);

    for (let i = 0; i < 5; i++) {
      await expect(client.chatCompletionDoubao(CHAT_OPTS)).rejects.toThrow(/mock chat HTTP 400/);
    }
    // 400 不可重试 ⇒ 每次调用只发 1 个请求
    expect(chatCalls(post)).toBe(5);

    // 关键断言：参数类错误不计入熔断
    expect(client.getArkCircuitState().failures).toBe(0);
    expect(client.getArkCircuitState().open).toBe(false);

    // 关键断言：第 6 次（队列耗尽 ⇒ 200）仍然真实发出，没有被短路
    const res = await client.chatCompletionDoubao(CHAT_OPTS);
    expect(res.text).toBe("策略正文 OK");
    expect(chatCalls(post)).toBe(6);
  });

  it(
    "⑤ 对话侧 500 × 5 仍熔断：第 6 次快速失败且不再发请求（chat 侧熔断没被改废）",
    async () => {
      const { client, post } = await loadClient(200, [500, 500, 500, 500, 500, 500]);

      // 用预算闸挡住内层「退避 1s 再试一次」⇒ 每次调用只发 1 个请求、只计 1 次失败。
      // 注意：退避的 1s sleep 发生在预算闸**之前**，所以每个调用固定耗时 ~1s，5 次共 ~5s，
      // 这也是本用例必须显式放大超时（默认 5s 会刚好卡在边界上）的原因。
      for (let i = 0; i < 5; i++) {
        await expect(client.chatCompletionDoubao(CHAT_OPTS_NO_RETRY)).rejects.toThrow(
          /mock chat HTTP 500/
        );
      }
      expect(chatCalls(post)).toBe(5);

      const state = client.getArkCircuitState();
      expect(state.failures).toBe(5);
      expect(state.open).toBe(true);
      expect(state.openUntil).toBeGreaterThan(Date.now());

      await expect(client.chatCompletionDoubao(CHAT_OPTS_NO_RETRY)).rejects.toThrow(/熔断开启/);
      // 熔断短路 ⇒ 请求数不再增加
      expect(chatCalls(post)).toBe(5);
    },
    20_000
  );
});
