/**
 * `createTimeoutSignal` 单测。
 *
 * 背景：线上 P0 —— 客户端的 `AbortSignal.timeout(ms)` 在老浏览器 /
 * 国产双核浏览器旧内核里是 `undefined`，调用即 `TypeError`，
 * 「AI 深度分析」按钮点了直接红字报错。改用 `AbortController` + `setTimeout`
 * 手工实现后，本文件守住三条契约：
 *   1. 返回的 signal 初始未 abort；
 *   2. 到点自动 abort；
 *   3. `dispose()` 能取消定时器，且幂等。
 *
 * ⚠️ 全部用**真实计时器**（不用 fake timers），避免与项目 vitest 配置差异耦合；
 *    用例里的延时都取得很小，整个文件耗时控制在 ~100ms 量级。
 */
import { describe, it, expect } from "vitest";
import { createTimeoutSignal } from "@/lib/net/abort-timeout";

/** 简单睡眠，用于等待真实定时器推进。 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createTimeoutSignal", () => {
  it("返回 AbortSignal 且初始未 abort", () => {
    const t = createTimeoutSignal(1000);
    try {
      expect(t.signal).toBeInstanceOf(AbortSignal);
      expect(t.signal.aborted).toBe(false);
      expect(typeof t.dispose).toBe("function");
    } finally {
      t.dispose();
    }
  });

  it("超时后自动 abort", async () => {
    const t = createTimeoutSignal(10);
    try {
      // 等 30ms > 10ms 超时点
      await sleep(30);
      expect(t.signal.aborted).toBe(true);
    } finally {
      t.dispose();
    }
  });

  it("dispose() 后即使超过 ms 也不会 abort（定时器被取消）", async () => {
    const t = createTimeoutSignal(20);
    t.dispose();
    // 等 50ms，远超 20ms 的超时点
    await sleep(50);
    expect(t.signal.aborted).toBe(false);
  });

  it("ms = 0 时立刻 abort", async () => {
    const t = createTimeoutSignal(0);
    try {
      // 只让出一个宏任务，不需要真的等 0ms 之外的东西
      await sleep(5);
      expect(t.signal.aborted).toBe(true);
    } finally {
      t.dispose();
    }
  });

  it("dispose() 幂等：重复调用不抛异常", () => {
    const t = createTimeoutSignal(1000);
    expect(() => {
      t.dispose();
      t.dispose();
      t.dispose();
    }).not.toThrow();
  });
});
