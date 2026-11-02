/**
 * 单测：`chatCompletionDoubao` 重试链路的 token 用量累加
 * ─────────────────────────────────────────────────────────
 * 背景：本函数对 429/5xx 会退避重试一次（`attempts = 2`）。每一次尝试只要把请求
 * 发到了方舟，那一轮的 input token 就已经真实烧掉了；但旧实现只返回**最后一次**
 * 尝试的 usage ⇒ 前面几次尝试的 token 静默漏计 ⇒ 平台少扣用户积分。
 *
 * 覆盖：
 *   ① 纯函数 `accumulateDoubaoUsage`：多次尝试逐次累加 / 缺字段按 0 / 顺序无关 / 不改入参
 *   ② 第 1 次失败（错误响应体带 usage）+ 第 2 次成功 ⇒ 返回两次用量之和
 *   ③ 失败尝试拿不到 usage ⇒ 按 0 计，但**必须打日志留痕**（不许静默吞）
 *   ④ 全程无 usage ⇒ 返回 `undefined`（保住计费侧 `ESTIMATED_TOKENS` 兜底契约）
 *   ⑤ usage 存在但缺字段 ⇒ 该字段继续缺省（同样为了不破坏 `?? ESTIMATED_TOKENS`）
 *   ⑥ 回归：归集改造不影响重试次数与熔断判定
 *
 * 运行：npx vitest run src/lib/ai/__tests__/ark-retry-usage.test.ts --no-file-parallelism
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** 可重试的服务端错误（429 / 5xx）；`data` 用于模拟「错误响应体里带 usage」的情形 */
function httpError(status: number, data?: unknown): Error & { response: { status: number; data?: unknown } } {
  return Object.assign(new Error(`mock HTTP ${status}`), {
    response: data === undefined ? { status } : { status, data },
  });
}

/** 成功响应体 */
function ok(usage?: unknown) {
  return {
    data: {
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      ...(usage === undefined ? {} : { usage }),
    },
  };
}

/**
 * 每个用例独立加载模块：熔断计数（`circuitFailures`）与用量累计值都是模块级/
 * 闭包状态，跨用例共享会互相污染。
 */
async function loadClient(postImpl: () => unknown) {
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

// ── ① 纯函数 `accumulateDoubaoUsage` ────────────────────────────────
describe("accumulateDoubaoUsage —— 多次尝试用量累加（纯函数）", () => {
  it("① 逐次累加：两次尝试的用量相加", async () => {
    const { client } = await loadClient(() => ok());
    const { accumulateDoubaoUsage } = client;
    let total = accumulateDoubaoUsage(null, { prompt_tokens: 30_000, completion_tokens: 0 });
    total = accumulateDoubaoUsage(total, { prompt_tokens: 30_000, completion_tokens: 1_200 });
    expect(total).toEqual({ prompt_tokens: 60_000, completion_tokens: 1_200 });
  });

  it("② 缺失 / null / NaN / 非对象 ⇒ 按 0 处理，不丢已累计部分", async () => {
    const { client } = await loadClient(() => ok());
    const { accumulateDoubaoUsage } = client;
    expect(accumulateDoubaoUsage({ prompt_tokens: 100, completion_tokens: 50 }, null)).toEqual({
      prompt_tokens: 100,
      completion_tokens: 50,
    });
    expect(accumulateDoubaoUsage({ prompt_tokens: 100, completion_tokens: 50 }, undefined)).toEqual({
      prompt_tokens: 100,
      completion_tokens: 50,
    });
    expect(accumulateDoubaoUsage({ prompt_tokens: 100, completion_tokens: 50 }, {})).toEqual({
      prompt_tokens: 100,
      completion_tokens: 50,
    });
    expect(
      accumulateDoubaoUsage({ prompt_tokens: 100, completion_tokens: 50 }, {
        prompt_tokens: Number.NaN,
        completion_tokens: "oops",
      })
    ).toEqual({ prompt_tokens: 100, completion_tokens: 50 });
    expect(accumulateDoubaoUsage({ prompt_tokens: 100, completion_tokens: 50 }, "not an object")).toEqual({
      prompt_tokens: 100,
      completion_tokens: 50,
    });
  });

  it("③ 累加顺序无关（任何顺序都得到同一个总和）", async () => {
    const { client } = await loadClient(() => ok());
    const { accumulateDoubaoUsage } = client;
    const a = { prompt_tokens: 1_000, completion_tokens: 10 };
    const b = { prompt_tokens: 2_000, completion_tokens: 20 };
    const c = { prompt_tokens: 3_000, completion_tokens: 30 };

    const sum = (list: unknown[]) =>
      list.reduce<{ prompt_tokens?: number; completion_tokens?: number }>(
        (acc, u) => accumulateDoubaoUsage(acc, u),
        {}
      );

    expect(sum([a, b, c])).toEqual({ prompt_tokens: 6_000, completion_tokens: 60 });
    expect(sum([c, b, a])).toEqual(sum([a, b, c]));
    expect(sum([b, c, a])).toEqual(sum([a, b, c]));
  });

  it("④ 纯函数：不修改入参", async () => {
    const { client } = await loadClient(() => ok());
    const { accumulateDoubaoUsage } = client;
    const base = { prompt_tokens: 1_000, completion_tokens: 100 };
    const snapshot = { ...base };
    const total = accumulateDoubaoUsage(base, { prompt_tokens: 500, completion_tokens: 20 });
    expect(base).toEqual(snapshot);
    expect(total).not.toBe(base);
  });
});

// ── ②~⑥ 集成：`chatCompletionDoubao` 重试链路 ──────────────────────
describe("chatCompletionDoubao —— 重试场景的用量归集", () => {
  it("⑤ 第 1 次 503（错误体带 usage）+ 第 2 次成功 ⇒ 返回两次用量之和", async () => {
    let call = 0;
    const { client, post } = await loadClient(() => {
      call += 1;
      if (call === 1) {
        // 方舟部分 5xx 会回带当次已消耗的 input token
        throw httpError(503, { usage: { prompt_tokens: 30_000, completion_tokens: 0 } });
      }
      return ok({ prompt_tokens: 30_000, completion_tokens: 1_200 });
    });

    const res = await client.chatCompletionDoubao({
      ...BASE_OPTS,
      deadlineMs: Date.now() + 200_000,
    });

    // 旧实现这里只会回 30_000 / 1_200（最后一次），第一次烧掉的 30_000 input 被静默丢掉
    expect(res.usage).toEqual({ prompt_tokens: 60_000, completion_tokens: 1_200 });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("⑥ 失败尝试无 usage ⇒ 按 0 计入且打结构化日志留痕（不静默吞掉）", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    let call = 0;
    const { client } = await loadClient(() => {
      call += 1;
      if (call === 1) throw httpError(503); // 错误体里没有 usage（最常见）
      return ok({ prompt_tokens: 5_000, completion_tokens: 800 });
    });

    const res = await client.chatCompletionDoubao({
      ...BASE_OPTS,
      deadlineMs: Date.now() + 200_000,
    });

    expect(res.usage).toEqual({ prompt_tokens: 5_000, completion_tokens: 800 });
    // 首轮失败（无 usage）+ 次轮成功（非首次尝试）⇒ 两行打点；首行必须是
    // `[ARK][retry-usage]` 且字段固定可 grep（hasUsage=false / errorKind=status-5xx）
    expect(info).toHaveBeenCalledTimes(2);
    const lines = info.mock.calls.map((c) => String(c[0]));
    expect(lines[0]).toContain("[ARK][retry-usage]");
    expect(lines[0]).toContain("attempt=1/2");
    expect(lines[0]).toContain("hasUsage=false");
    expect(lines[0]).toContain("errorKind=status-5xx");
    // 次轮成功也要打（非首次尝试），hasUsage=true / errorKind=none
    expect(lines[1]).toContain("attempt=2/2");
    expect(lines[1]).toContain("hasUsage=true");
    expect(lines[1]).toContain("errorKind=none");
  });

  it("⑦ 全程无 usage ⇒ 返回 undefined（保住 ESTIMATED_TOKENS 兜底契约）", async () => {
    const { client } = await loadClient(() => ok()); // 成功但不带 usage
    const res = await client.chatCompletionDoubao({ ...BASE_OPTS });
    // 不能返回 {0,0}：计费侧写的是 `usage?.prompt_tokens ?? ESTIMATED_TOKENS.input`，
    // 补 0 会让 `??` 不触发 ⇒ 从「保守估算计费」退化成「按 0 计费」，反而更漏。
    expect(res.usage).toBeUndefined();
  });

  it("⑧ usage 存在但缺字段 ⇒ 该字段继续缺省（同样为不破坏兜底）", async () => {
    const { client } = await loadClient(() => ok({ completion_tokens: 500 }));
    const res = await client.chatCompletionDoubao({ ...BASE_OPTS });
    expect(res.usage?.completion_tokens).toBe(500);
    expect(res.usage?.prompt_tokens).toBeUndefined();
  });

  it("⑨ 向后兼容：单次成功时 usage 与旧版完全一致", async () => {
    const { client, post } = await loadClient(() =>
      ok({ prompt_tokens: 3, completion_tokens: 4 })
    );
    const res = await client.chatCompletionDoubao({ ...BASE_OPTS });
    expect(res.usage).toEqual({ prompt_tokens: 3, completion_tokens: 4 });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("⑩ 回归：归集改造不影响重试次数与熔断判定（503 仍重试 1 次）", async () => {
    const { client, post } = await loadClient(() => {
      throw httpError(503);
    });
    await expect(
      client.chatCompletionDoubao({ ...BASE_OPTS, deadlineMs: Date.now() + 200_000 })
    ).rejects.toThrow(/mock HTTP 503/);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("⑪ 首次尝试成功且有 usage ⇒ 不打点（避免正常成功路径刷屏）", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { client } = await loadClient(() => ok({ prompt_tokens: 3, completion_tokens: 4 }));
    await client.chatCompletionDoubao({ ...BASE_OPTS });
    expect(info).not.toHaveBeenCalled();
  });

  it("⑫ 首次尝试成功但无 usage ⇒ 仍打点（hasUsage=false，可观测漏计量）", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { client } = await loadClient(() => ok());
    await client.chatCompletionDoubao({ ...BASE_OPTS });
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0][0]);
    expect(line).toContain("hasUsage=false");
    expect(line).toContain("errorKind=none");
    expect(line).toContain("promptTokens=0");
  });

  it("⑬ 重试成功：首轮失败 + 次轮成功 ⇒ 两行打点，errorKind 分别为 status-5xx 与 none", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    let call = 0;
    const { client } = await loadClient(() => {
      call += 1;
      if (call === 1) throw httpError(503);
      return ok({ prompt_tokens: 5_000, completion_tokens: 800 });
    });
    await client.chatCompletionDoubao({ ...BASE_OPTS, deadlineMs: Date.now() + 200_000 });
    const lines = info.mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("attempt=1/2");
    expect(lines[0]).toContain("errorKind=status-5xx");
    expect(lines[1]).toContain("attempt=2/2");
    expect(lines[1]).toContain("errorKind=none");
    expect(lines[1]).toContain("promptTokens=5000");
  });

  it("⑭ 超时（ECONNABORTED）⇒ errorKind=timeout，且单次无 usage 按 0 留痕", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const timeoutErr = Object.assign(new Error("timeout of 1000ms exceeded"), {
      code: "ECONNABORTED",
    });
    const { client } = await loadClient(() => {
      throw timeoutErr;
    });
    await expect(
      client.chatCompletionDoubao({ ...BASE_OPTS, deadlineMs: Date.now() + 200_000 })
    ).rejects.toThrow();
    expect(info.mock.calls.some((c) => String(c[0]).includes("errorKind=timeout"))).toBe(true);
    expect(info.mock.calls.some((c) => String(c[0]).includes("hasUsage=false"))).toBe(true);
  });
});

// ── classifyArkErrorKind（纯函数）──────────────────────────────────────
describe("classifyArkErrorKind —— 失败原因分类", () => {
  it("有 response.status 按状态码分类", async () => {
    const { client } = await loadClient(() => ok());
    const { classifyArkErrorKind } = client;
    expect(classifyArkErrorKind({ response: { status: 429 } })).toBe("status-429");
    expect(classifyArkErrorKind({ response: { status: 500 } })).toBe("status-5xx");
    expect(classifyArkErrorKind({ response: { status: 503 } })).toBe("status-5xx");
    expect(classifyArkErrorKind({ response: { status: 400 } })).toBe("status-4xx");
    expect(classifyArkErrorKind({ response: { status: 403 } })).toBe("status-4xx");
    expect(classifyArkErrorKind({ response: { status: 418 } })).toBe("status-4xx");
  });

  it("客户端 abort（ECONNABORTED / ETIMEDOUT）⇒ timeout，且不靠错误文案猜", async () => {
    const { client } = await loadClient(() => ok());
    const { classifyArkErrorKind } = client;
    expect(classifyArkErrorKind({ code: "ECONNABORTED", message: "timeout exceeded" })).toBe(
      "timeout"
    );
    expect(classifyArkErrorKind({ code: "ETIMEDOUT" })).toBe("timeout");
    // 没有 code、只有文案说 timeout ⇒ 仍归 network（不靠文案）
    expect(classifyArkErrorKind({ message: "timeout of 1000ms exceeded" })).toBe("network");
  });

  it("无 code 也无 status ⇒ network", async () => {
    const { client } = await loadClient(() => ok());
    const { classifyArkErrorKind } = client;
    expect(classifyArkErrorKind(new Error("getaddrinfo ENOTFOUND"))).toBe("network");
    expect(classifyArkErrorKind({})).toBe("network");
    expect(classifyArkErrorKind(null)).toBe("network");
    expect(classifyArkErrorKind(undefined)).toBe("network");
  });
});
