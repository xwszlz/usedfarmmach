/**
 * 单元测试：检索用量归集器（2026-11-01 计费口径统一 · T01）
 * ─────────────────────────────────────────────────────────
 * 这个文件守的是「钱算在谁头上」，不是普通的数据结构测试：
 *   - 串账（A 用户的检索用量被 B 用户 drain 走）在账面上表现为「有人被多收、有人被少收」，
 *     且**没有任何报错** —— 只能靠并发隔离测试挡住；
 *   - 漏 drain 的表现同样是静默的：用量漂移到下一个请求上。
 *
 * 覆盖：
 *   ① 作用域内 record → drain 拿到；drain 后清空（幂等）
 *   ② **并发两个 scope 互不串账**（本文件最重要的一条）
 *   ③ ALS 穿透 await / Promise.all（并发子调用都落进同一个桶）
 *   ④ 无 scope 时走 fallback 且打 warn（不静默丢弃）
 *   ⑤ summarizeWebSearchUsage 的求和与 estimated / overLimit / failedAttempts 聚合
 *   ⑥ 失败尝试不计任何 token（不虚构用量）
 *
 * 运行：npx vitest run src/lib/credits/__tests__/search-usage-collector.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  drainWebSearchUsage,
  hasWebSearchUsage,
  recordWebSearchUsage,
  runWithSearchBillingScope,
  summarizeWebSearchUsage,
  type WebSearchUsageRecord,
} from "@/lib/credits/search-usage-collector";

/** 一条「实测」检索用量（2026-11-01 探针量级） */
function rec(overrides: Partial<WebSearchUsageRecord> = {}): WebSearchUsageRecord {
  return {
    kind: "ark_web_search",
    searchCalls: 13,
    inputTokens: 32_157,
    outputTokens: 1_508,
    estimated: false,
    ...overrides,
  };
}

beforeEach(() => {
  // 清掉可能的 fallback 残留（跨用例隔离；作用域内的桶本来就是每次新建的）
  drainWebSearchUsage();
});

afterEach(() => {
  drainWebSearchUsage();
  vi.restoreAllMocks();
});

describe("① 基本 record / drain", () => {
  it("作用域内 record ⇒ drain 能拿到；drain 后清空（幂等，不会扣两次）", async () => {
    await runWithSearchBillingScope(async () => {
      recordWebSearchUsage(rec());
      recordWebSearchUsage(rec({ inputTokens: 100, outputTokens: 20 }));
      expect(hasWebSearchUsage()).toBe(true);

      const first = drainWebSearchUsage();
      expect(first).toHaveLength(2);
      expect(first[0].inputTokens).toBe(32_157);
      expect(first[0].outputTokens).toBe(1_508);
      expect(first[0].searchCalls).toBe(13);

      // 幂等：第二次恒为空
      expect(drainWebSearchUsage()).toEqual([]);
      expect(hasWebSearchUsage()).toBe(false);
    });
  });

  it("作用域内没有 record ⇒ drain 返回空数组（不是 undefined，不是抛错）", async () => {
    await runWithSearchBillingScope(async () => {
      expect(drainWebSearchUsage()).toEqual([]);
      expect(hasWebSearchUsage()).toBe(false);
    });
  });

  it("作用域外 drain ⇒ 空（作用域是真的隔离，不是全局桶）", async () => {
    await runWithSearchBillingScope(async () => {
      recordWebSearchUsage(rec());
    });
    // 离开作用域后：`storage.getStore()` 为 undefined ⇒ 读 fallback 桶（此处为空）
    expect(drainWebSearchUsage()).toEqual([]);
  });
});

describe("② 并发隔离（本文件最重要：防 A 用户的钱算到 B 用户头上）", () => {
  it("两个并发 scope 各自 record ⇒ 各自 drain 只拿自己的，互不串账", async () => {
    const [a, b] = await Promise.all([
      runWithSearchBillingScope(async () => {
        // 模拟「检索 61s」期间发生别的请求：让出事件循环，制造真实的交错
        await new Promise((r) => setTimeout(r, 10));
        recordWebSearchUsage(rec({ inputTokens: 1000, outputTokens: 100, searchCalls: 1 }));
        await new Promise((r) => setTimeout(r, 10));
        recordWebSearchUsage(rec({ inputTokens: 2000, outputTokens: 200, searchCalls: 2 }));
        return drainWebSearchUsage();
      }),
      runWithSearchBillingScope(async () => {
        recordWebSearchUsage(rec({ inputTokens: 77, outputTokens: 7, searchCalls: 3 }));
        await new Promise((r) => setTimeout(r, 5));
        return drainWebSearchUsage();
      }),
    ]);

    expect(a).toHaveLength(2);
    expect(a.reduce((n, r) => n + r.inputTokens, 0)).toBe(3_000);
    expect(b).toHaveLength(1);
    expect(b[0].inputTokens).toBe(77);
  });

  it("一个 scope 忘了 drain ⇒ 也不会污染另一个 scope", async () => {
    const b = await Promise.all([
      // A：record 后**故意不 drain**（模拟漏消费点的路径）
      runWithSearchBillingScope(async () => {
        recordWebSearchUsage(rec({ inputTokens: 999_999 }));
        await new Promise((r) => setTimeout(r, 5));
        return "A";
      }),
      // B：正常 drain
      runWithSearchBillingScope(async () => {
        await new Promise((r) => setTimeout(r, 1));
        recordWebSearchUsage(rec({ inputTokens: 42 }));
        return drainWebSearchUsage();
      }),
    ]).then((r) => r[1]);

    expect(b).toHaveLength(1);
    expect(b[0].inputTokens).toBe(42);
  });
});

describe("③ ALS 穿透 await / Promise.all（5 条 query 并发的真实形态）", () => {
  it("Promise.all 里的 5 条并发子调用，全部落进同一个桶", async () => {
    const all = await runWithSearchBillingScope(async () => {
      await Promise.all(
        [1, 2, 3, 4, 5].map(async (i) => {
          await new Promise((r) => setTimeout(r, i));
          recordWebSearchUsage(rec({ inputTokens: 1_000 * i, outputTokens: 100 * i, searchCalls: i }));
        })
      );
      return drainWebSearchUsage();
    });

    expect(all).toHaveLength(5);
    const summary = summarizeWebSearchUsage(all);
    expect(summary.inputTokens).toBe(15_000); // 1000+2000+3000+4000+5000
    expect(summary.outputTokens).toBe(1_500);
    expect(summary.searchCalls).toBe(15); // 1+2+3+4+5
    expect(summary.estimated).toBe(false);
    expect(summary.overLimit).toBe(false);
    expect(summary.records).toBe(5);
  });

  it("嵌套作用域（未来若有人再包一层）不会串到外层", async () => {
    await runWithSearchBillingScope(async () => {
      recordWebSearchUsage(rec({ inputTokens: 10 }));
      await runWithSearchBillingScope(async () => {
        recordWebSearchUsage(rec({ inputTokens: 20 }));
        expect(drainWebSearchUsage()).toHaveLength(1);
      });
      const outer = drainWebSearchUsage();
      expect(outer).toHaveLength(1);
      expect(outer[0].inputTokens).toBe(10);
    });
  });
});

describe("④ 无 scope 兜底（红线 5：不静默丢弃）", () => {
  it("没有 scope 时 record ⇒ 进 fallback 桶、打 warn，且仍能被 drain 出来", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      recordWebSearchUsage(rec({ inputTokens: 5_000 }));
      const logs = warnSpy.mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("no-scope-fallback")
      );
      expect(logs.length).toBe(1);
      expect(logs[0][1]).toMatchObject({ kind: "ark_web_search", inputTokens: 5_000 });

      // 不静默丢：仍然取得到
      const drained = drainWebSearchUsage();
      expect(drained).toHaveLength(1);
      expect(drained[0].inputTokens).toBe(5_000);
      expect(drainWebSearchUsage()).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("scope 内 record 时**不**打 no-scope-fallback warn（正常路径零噪音）", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await runWithSearchBillingScope(async () => {
        recordWebSearchUsage(rec());
        drainWebSearchUsage();
      });
      expect(
        warnSpy.mock.calls.filter((c) => String(c[0]).includes("no-scope-fallback"))
      ).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("⑤ summarizeWebSearchUsage 聚合", () => {
  it("estimated / overLimit 任一为真 ⇒ 汇总为真", () => {
    const s = summarizeWebSearchUsage([
      rec({ estimated: false, overLimit: false }),
      rec({ estimated: true, overLimit: false }),
      rec({ estimated: false, overLimit: true }),
    ]);
    expect(s.estimated).toBe(true);
    expect(s.overLimit).toBe(true);
    expect(s.inputTokens).toBe(32_157 * 3);
    expect(s.searchCalls).toBe(39);
  });

  it("failed 记录：不计任何 token，但计入 failedAttempts（不虚构用量）", () => {
    const s = summarizeWebSearchUsage([
      rec({ inputTokens: 10_000, outputTokens: 500 }),
      rec({ inputTokens: 0, outputTokens: 0, failed: true }),
      rec({ inputTokens: 0, outputTokens: 0, failed: true, searchCalls: 13 }),
    ]);
    expect(s.inputTokens).toBe(10_000);
    expect(s.outputTokens).toBe(500);
    expect(s.failedAttempts).toBe(2);
    expect(s.records).toBe(3);
    // 失败尝试若带到了 searchCalls（按次留痕）仍要计入，那是平台真实支出
    expect(s.searchCalls).toBe(39);
  });

  it("空数组 / 非数组输入 ⇒ 全零汇总，不抛错", () => {
    for (const input of [[], undefined as unknown as WebSearchUsageRecord[], null as unknown as WebSearchUsageRecord[]]) {
      const s = summarizeWebSearchUsage(input);
      expect(s.inputTokens).toBe(0);
      expect(s.outputTokens).toBe(0);
      expect(s.searchCalls).toBe(0);
      expect(s.estimated).toBe(false);
      expect(s.failedAttempts).toBe(0);
      expect(s.overLimit).toBe(false);
      expect(s.records).toBe(0);
    }
  });

  it("脏输入（NaN / 负数 / 超长 query）被归一，不把 NaN 带进账单", async () => {
    await runWithSearchBillingScope(async () => {
      recordWebSearchUsage({
        kind: "ark_web_search",
        searchCalls: Number.NaN,
        inputTokens: -5,
        outputTokens: Number.NaN,
        estimated: false,
        query: "x".repeat(200),
      });
      const [r] = drainWebSearchUsage();
      expect(r.searchCalls).toBe(0);
      expect(r.inputTokens).toBe(0);
      expect(r.outputTokens).toBe(0);
      expect(r.query).toHaveLength(40);
    });
  });
});
