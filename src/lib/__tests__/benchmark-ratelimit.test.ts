/**
 * 单测：agroline 限流加固（429 退避 + 源级并发上限）—— **全程离线**
 * ─────────────────────────────────────────────────────────
 * 背景（2026-11）：agroline 是 12 个品牌的**唯一**数据源（51 机型 / 61 行）。
 * 全局 12 路并发全压给它时，10 分钟内连打三轮就把 failed 从 2 抬到 10（全是 429）。
 * 一轮周更没事，但改日更/临时补数据立刻翻车，这 12 个品牌的价格会同时归零。
 *
 * 三条纪律（本文件每条都有对应断言）：
 *   ① 429 **不进熔断**（`ratelimited` 既不 +1 也不重置）—— ⑨ / ⑩
 *   ② 退避硬上限：最多重试 2 次（1s→2s，±30% 抖动），`Retry-After` 封顶 10s —— ② ③ ④
 *   ③ 源级并发上限：`min(全局, 源 maxConcurrency)`，429 后再减半（下限 2） —— ⑥ ⑦ ⑧
 *
 * ⚠️ 文件名必须是 `.test.ts`（vitest.config.ts include = `src/**\/*.test.ts`）。
 * 运行：npx vitest run src/lib/__tests__/benchmark-ratelimit.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://bench:bench@127.0.0.1:5432/benchmark_test";
process.env.SITE = process.env.SITE || "com";

type Engine = typeof import("@/lib/benchmark-engine");
let engine: Engine;

beforeAll(async () => {
  engine = await import("@/lib/benchmark-engine");
});

afterAll(async () => {
  await engine.disconnectBenchmark().catch(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** 造一个带状态码/Retry-After 的 HTTP 错误（与 httpGet 抛出的形状一致） */
function httpError(statusCode: number, retryAfterMs?: number | null) {
  const err: any = new Error(`HTTP ${statusCode}`);
  err.statusCode = statusCode;
  err.retryAfterMs = retryAfterMs == null ? null : retryAfterMs;
  return err;
}

/** rand 固定 0.5 ⇒ 抖动系数 = 1 + (0.5*2-1)*ratio = 1，延迟就是纯基数 */
const RAND_MID = () => 0.5;

describe("parseRetryAfterMs —— 两种合法格式都要认", () => {
  it("① 秒数（含小数/空格）", () => {
    expect(engine.parseRetryAfterMs("2")).toBe(2000);
    expect(engine.parseRetryAfterMs(" 2.5 ")).toBe(2500);
    expect(engine.parseRetryAfterMs("0")).toBe(0);
    expect(engine.parseRetryAfterMs(["3"])).toBe(3000); // node 偶尔给数组
  });

  it("①b HTTP-date（按 now 折算成剩余毫秒）", () => {
    const now = Date.parse("2026-11-04T00:00:00Z");
    const at = "Wed, 04 Nov 2026 00:00:03 GMT";
    expect(engine.parseRetryAfterMs(at, now)).toBe(3000);
    // 已经过去的时间点 ⇒ 0（不返回负数）
    expect(engine.parseRetryAfterMs("Wed, 04 Nov 2026 00:00:00 GMT", now + 5000)).toBe(0);
  });

  it("①c 缺失/非法/负数 ⇒ null（交给指数退避兜底）", () => {
    expect(engine.parseRetryAfterMs(undefined)).toBeNull();
    expect(engine.parseRetryAfterMs(null)).toBeNull();
    expect(engine.parseRetryAfterMs("")).toBeNull();
    expect(engine.parseRetryAfterMs("   ")).toBeNull();
    expect(engine.parseRetryAfterMs("not-a-date")).toBeNull();
    expect(engine.parseRetryAfterMs("-5")).toBeNull();
  });
});

describe("computeRetryDelay —— 指数退避 + 抖动 + 封顶", () => {
  it("② 无 Retry-After ⇒ 1s → 2s", () => {
    expect(engine.computeRetryDelay(1, null, { rand: RAND_MID })).toBe(1000);
    expect(engine.computeRetryDelay(2, null, { rand: RAND_MID })).toBe(2000);
  });

  it("②b 有 Retry-After ⇒ 听服务端的", () => {
    expect(engine.computeRetryDelay(1, 5000, { rand: RAND_MID })).toBe(5000);
    // 但必须封顶，否则 `Retry-After: 3600` 直接把 260s 预算吃穿
    expect(engine.computeRetryDelay(1, 999_999, { rand: RAND_MID })).toBe(
      engine.HTTP_429_MAX_RETRY_AFTER_MS
    );
  });

  it("②c 抖动 ±30%（12 路并发不能在同一毫秒醒来）", () => {
    const lo = engine.computeRetryDelay(1, null, { rand: () => 0 });
    const hi = engine.computeRetryDelay(1, null, { rand: () => 0.999999 });
    expect(lo).toBe(700); // 1000 * 0.7
    expect(hi).toBeLessThanOrEqual(1300);
    expect(hi).toBeGreaterThan(1290);
  });
});

describe("httpGetWithRetry —— 只对 429 重试", () => {
  it("③ 429 → 429 → 200：两次退避后成功", async () => {
    const sleeps: number[] = [];
    const events: any[] = [];
    let n = 0;
    const getImpl = async () => {
      n += 1;
      if (n <= 2) throw httpError(429);
      return "<html>ok</html>";
    };
    const body = await engine.httpGetWithRetry("https://www.agroline.com/x", {
      getImpl,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      rand: RAND_MID,
      onRateLimited: (info: any) => events.push(info),
    });
    expect(body).toContain("ok");
    expect(n).toBe(3); // 1 次原始 + 2 次重试
    expect(sleeps).toEqual([1000, 2000]);
    expect(events.map((e) => e.attempt)).toEqual([1, 2]);
  });

  it("③b 有 Retry-After 时按它等，而不是指数退避", async () => {
    let n = 0;
    const sleeps: number[] = [];
    const getImpl = async () => {
      n += 1;
      if (n === 1) throw httpError(429, 1500);
      return "ok";
    };
    await engine.httpGetWithRetry("https://www.agroline.com/x", {
      getImpl,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      rand: RAND_MID,
    });
    expect(sleeps).toEqual([1500]);
  });

  it("④ 重试 2 次后仍 429 ⇒ 放弃并抛出（不带无限重试）", async () => {
    let n = 0;
    const getImpl = async () => {
      n += 1;
      throw httpError(429);
    };
    await expect(
      engine.httpGetWithRetry("https://www.agroline.com/x", {
        getImpl,
        sleep: async () => {},
        rand: RAND_MID,
      })
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(n).toBe(3); // 硬上限：1 + 2
    expect(engine.HTTP_429_MAX_RETRIES).toBe(2);
  });

  it("④c 预算闸：这一觉会越过 deadlineTs 就放弃重试（否则 306 目标能造出 100 分钟等待）", async () => {
    let n = 0;
    const sleeps: number[] = [];
    const events: any[] = [];
    const getImpl = async () => {
      n += 1;
      throw httpError(429, 10_000); // Retry-After 10s
    };
    await expect(
      engine.httpGetWithRetry("https://www.agroline.com/x", {
        getImpl,
        sleep: async (ms: number) => {
          sleeps.push(ms);
        },
        rand: RAND_MID,
        deadlineTs: Date.now() + 500, // 只剩 500ms
        onRateLimited: (info: any) => events.push(info),
      })
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(n).toBe(1); // 一次都没重试
    expect(sleeps).toEqual([]); // 也没真的睡
    expect(events).toEqual([expect.objectContaining({ willRetry: false })]);
  });

  it("④b 5xx / 网络错误一律不重试（它们的处置是熔断，不是再等一轮）", async () => {    let n = 0;
    const sleeps: number[] = [];
    const getImpl = async () => {
      n += 1;
      throw httpError(503);
    };
    await expect(
      engine.httpGetWithRetry("https://www.agroline.com/x", {
        getImpl,
        sleep: async (ms: number) => {
          sleeps.push(ms);
        },
      })
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(n).toBe(1);
    expect(sleeps).toEqual([]);
  });
});

describe("makeSourceLimiter —— 源级信号量", () => {
  const SOURCES = [
    { key: "agroline", maxConcurrency: 6 },
    { key: "machinerypete" },
  ];

  it("⑥ 上限 = min(全局, 源的 maxConcurrency)；不配就是全局值", () => {
    const lim = engine.makeSourceLimiter(12, SOURCES);
    expect(lim.limitOf("agroline")).toBe(6);
    expect(lim.limitOf("machinerypete")).toBe(12);
    expect(lim.limitOf("unknown")).toBe(12);
    // 全局比源上限还小时，取全局
    expect(engine.makeSourceLimiter(3, SOURCES).limitOf("agroline")).toBe(3);
  });

  it("⑥b 在飞数不超限：第 7 个 acquire 要等 release", async () => {
    const lim = engine.makeSourceLimiter(12, SOURCES);
    for (let i = 0; i < 6; i += 1) await lim.acquire("agroline");
    expect(lim.snapshot().agroline.inflight).toBe(6);
    expect(lim.snapshot().agroline.waiting).toBe(0);

    let resolved = false;
    const pending = lim.acquire("agroline").then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false); // 卡住
    expect(lim.snapshot().agroline.waiting).toBe(1);

    lim.release("agroline"); // 槽位转交给等待者
    await pending;
    expect(resolved).toBe(true);
    expect(lim.snapshot().agroline.inflight).toBe(6); // 仍是 6，没有超额
  });

  it("⑦ reduce：命中 429 后减半，下限 2，且不越过新上限放行", async () => {
    const lim = engine.makeSourceLimiter(12, SOURCES);
    expect(lim.reduce("agroline")).toBe(3); // 6 → 3
    expect(lim.reduce("agroline")).toBe(2); // 3 → floor(1.5)=1 → 取下限 2
    expect(lim.reduce("agroline")).toBe(2); // 到底了，不再降
    expect(engine.SOURCE_MIN_CONCURRENCY).toBe(2);

    // 已在飞的 4 个（降限之前抢到的）在降限之后释放：只还额度，不再放行新请求
    const slim = engine.makeSourceLimiter(12, SOURCES);
    for (let i = 0; i < 4; i += 1) await slim.acquire("agroline");
    expect(slim.snapshot().agroline.inflight).toBe(4);
    slim.reduce("agroline"); // 6 → 3
    slim.reduce("agroline"); // 3 → 2
    expect(slim.snapshot().agroline.inflight).toBe(4);
    slim.release("agroline"); // inflight 4 > limit 2 ⇒ 只还额度
    await Promise.resolve();
    expect(slim.snapshot().agroline.inflight).toBe(3);
    slim.release("agroline");
    await Promise.resolve();
    expect(slim.snapshot().agroline.inflight).toBe(2); // 回落到新上限，仍不放行
    slim.release("agroline");
    await Promise.resolve();
    expect(slim.snapshot().agroline.inflight).toBe(1); // 低于上限 ⇒ 之后才能收新请求
  });
});

describe("makeSourceCircuit —— 429 不进熔断（口径单元测试）", () => {
  it("⑨b 'ratelimited' 既不 +1 也不重置：连喂 10 次限流也不开路", () => {
    const c = engine.makeSourceCircuit({ failureThreshold: 3 });
    for (let i = 0; i < 10; i += 1) c.record("agroline", "ratelimited");
    expect(c.snapshot().agroline).toEqual({ consecutiveFails: 0, open: false });
    expect(c.shouldSkip("agroline")).toBe(false);
    // 反而 'failed' 三次就开路（该封的还是要封）
    c.record("agroline", "failed");
    c.record("agroline", "failed");
    expect(c.shouldSkip("agroline")).toBe(false);
    c.record("agroline", "failed");
    expect(c.shouldSkip("agroline")).toBe(true);
  });

  it("⑨c 限流不会把已有的失败计数清零（'ratelimited' ≠ 'ok'）", () => {
    const c = engine.makeSourceCircuit({ failureThreshold: 3 });
    c.record("agroline", "failed");
    c.record("agroline", "failed");
    c.record("agroline", "ratelimited");
    expect(c.snapshot().agroline.consecutiveFails).toBe(2); // 没被清零，也没 +1
    c.record("agroline", "failed");
    expect(c.shouldSkip("agroline")).toBe(true);
  });
});

describe("fetchOneTarget —— 429 打标", () => {  it("⑤ 重试仍 429 ⇒ failed + reason 'http-429' + rateLimited 标记", async () => {
    const target = {
      sourceSite: "agroline",
      brand: "claas",
      brandNameZh: "克拉斯",
      nameEn: "CLAAS",
      model: "Arion 420",
      category: "tractor",
      region: "EU",
      currency: "EUR",
      russian: false,
    };
    const getImpl = async () => {
      throw httpError(429);
    };
    const r = await engine.fetchOneTarget(target, { EUR: 8, CNY: 1 }, 8000, {
      getImpl,
      sleep: async () => {},
      rand: RAND_MID,
    });
    expect(r.status).toBe("failed");
    expect(r.reason).toBe("http-429");
    expect(r.rateLimited).toBe(true);
  });
});

describe("runRefresh —— 429 不进熔断 / 源级并发 / 失败原因", () => {
  const mkTargets = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      sourceSite: "agroline",
      brand: "claas",
      brandNameZh: "克拉斯",
      nameEn: "CLAAS",
      model: `Arion ${400 + i}`,
      category: "tractor",
      region: "EU",
      currency: "EUR",
      russian: false,
    }));

  const FX = { EUR: 8, USD: 7.2, CNY: 1 };

  it("⑨ 连打 429：全部 failed 但**熔断不开**，failReasons 区分 http-429", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const getImpl = async () => {
      throw httpError(429);
    };
    const stats = await engine.runRefresh({
      fx: FX,
      targets: mkTargets(6),
      dryRun: true,
      concurrency: 12,
      failureThreshold: 3,
      httpGetImpl: getImpl,
      retrySleep: async () => {},
      rand: RAND_MID,
    });
    expect(stats.total).toBe(6);
    expect(stats.failed).toBe(6);
    expect(stats.ok).toBe(0);
    expect(stats.failReasons["http-429"]).toBe(6);
    expect(stats.circuitOpen).toEqual([]); // 🔴 关键：限流没把整源封死
    expect(stats.skip).toBe(0); // 没有目标被 circuit-open 掠过
    expect(stats.rateLimited).toBe(18); // 6 目标 × 3 次尝试（1 + 2 重试）
    expect(stats.retries).toBe(12); // 6 目标 × 2 次退避
    expect(stats.retryWaitMs).toBe(18_000); // 6 × (1000 + 2000)
    // 闭合不变量不受影响
    expect(stats.ok + stats.skip + stats.failed + stats.skippedByBudget).toBe(stats.total);
  });

  it("⑩ 5xx 仍然进熔断（该封的还是要封）", async () => {
    const getImpl = async () => {
      throw httpError(503);
    };
    const stats = await engine.runRefresh({
      fx: FX,
      targets: mkTargets(6),
      dryRun: true,
      concurrency: 1,
      failureThreshold: 3,
      httpGetImpl: getImpl,
      retrySleep: async () => {},
      rand: RAND_MID,
    });
    expect(stats.circuitOpen).toContain("agroline");
    expect(stats.failed).toBe(3); // 阈值 3
    expect(stats.skip).toBe(3); // 剩下 3 个 circuit-open 直接跳过
    expect(stats.skipReasons["circuit-open"]).toBe(3);
    expect(stats.failReasons["HTTP 503"]).toBe(3);
    expect(stats.retries).toBe(0); // 5xx 不重试
    expect(stats.ok + stats.skip + stats.failed + stats.skippedByBudget).toBe(stats.total);
  });

  it("⑧ 源级并发真的被压住：agroline 在飞峰值 ≤ 6（全局仍是 12）", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let inflight = 0;
    let peak = 0;
    const getImpl = async () => {
      inflight += 1;
      peak = Math.max(peak, inflight);
      // 让出事件循环，保证并发能真的叠起来
      await new Promise((r) => setTimeout(r, 5));
      inflight -= 1;
      throw httpError(429);
    };
    const stats = await engine.runRefresh({
      fx: FX,
      targets: mkTargets(20),
      dryRun: true,
      concurrency: 12,
      httpGetImpl: getImpl,
      retrySleep: async () => {},
      rand: RAND_MID,
    });
    expect(peak).toBeLessThanOrEqual(6); // 不配 maxConcurrency 的话这里会是 12
    expect(stats.total).toBe(20);
    expect(stats.circuitOpen).toEqual([]);
    // 429 会把上限一路减半到下限 2
    expect(stats.sourceConcurrency.agroline.limit).toBe(engine.SOURCE_MIN_CONCURRENCY);
    expect(stats.sourceConcurrency.agroline.inflight).toBe(0);
  });
});
