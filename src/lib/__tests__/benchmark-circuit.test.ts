/**
 * 单测：源级熔断器 + runRefresh 总预算兜底
 * ─────────────────────────────────────────────────────────
 * 背景（2026-11 实测）：266 个采集目标 / 并发 12 / 单目标 8s ≈ 184s。
 * 若只把超时提到 20s 而不做源级熔断，就是 266/20×20s ≈ 266s 起步，
 * 且 tractorhouse(Cloudflare 403, 0.9s)、machinerypete(自研反爬 470, 3.2s)
 * 这类硬拦源会反复吃满超时 —— 必然撞 maxDuration=300 被平台 kill。
 *
 * 覆盖：
 *   ① 同源连续 3 次 failed ⇒ 开路
 *   ② 中途出现 ok ⇒ 计数归零、不开路（允许恢复）
 *   ③ skip（无样本）既不增加也不重置计数
 *   ④ 多源互不影响（熔断按源隔离）
 *   ⑤ budgetMs 兜底：超预算立即停止派发，计入 skippedByBudget
 *
 * ⚠️ 文件名用 `.test.ts` 而非 `.test.js`：本仓 vitest.config.ts 的
 *    `include` 只有 `src/**\/*.test.ts`，`.test.js` 永远不会被 `npm test` 收集到。
 *
 * 运行：npx vitest run src/lib/__tests__/benchmark-circuit.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// benchmark-engine.js 在模块加载时就会 new PrismaClient 并读取 DATABASE_URL，
// 故必须在动态 import 之前注入一个合法的占位串（本测试全程不查库，不会真连接）。
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://bench:bench@127.0.0.1:5432/benchmark_test";
process.env.SITE = process.env.SITE || "com";

type Engine = typeof import("@/lib/benchmark-engine");
let engine: Engine;

beforeAll(async () => {
  engine = await import("@/lib/benchmark-engine");
});

afterAll(async () => {
  // 未真正建连，$disconnect 是安全的收尾
  await engine.disconnectBenchmark().catch(() => {});
});

describe("makeSourceCircuit —— 源级熔断", () => {
  it("① 同源连续 3 次 failed ⇒ 开路", () => {
    const c = engine.makeSourceCircuit({ failureThreshold: 3 });
    expect(c.shouldSkip("tractorhouse")).toBe(false);
    c.record("tractorhouse", "failed");
    c.record("tractorhouse", "failed");
    expect(c.shouldSkip("tractorhouse")).toBe(false); // 2 次还不够
    const after3 = c.record("tractorhouse", "failed");
    expect(after3).toEqual({ consecutiveFails: 3, open: true });
    expect(c.shouldSkip("tractorhouse")).toBe(true);
  });

  it("② 中途出现 ok ⇒ 计数归零、不开路", () => {
    const c = engine.makeSourceCircuit({ failureThreshold: 3 });
    c.record("mascus", "failed");
    c.record("mascus", "failed");
    c.record("mascus", "ok"); // 恢复到 0
    expect(c.snapshot().mascus).toEqual({ consecutiveFails: 0, open: false });
    c.record("mascus", "failed");
    c.record("mascus", "failed");
    expect(c.shouldSkip("mascus")).toBe(false); // 归零后只累计到 2
    c.record("mascus", "failed");
    expect(c.shouldSkip("mascus")).toBe(true);
  });

  it("③ skip（无样本）既不增加也不重置计数", () => {
    const c = engine.makeSourceCircuit({ failureThreshold: 3 });
    c.record("agroline", "failed");
    c.record("agroline", "failed");
    // 中间夹一堆 skip：计数必须原地不动
    c.record("agroline", "skip");
    c.record("agroline", "skip");
    c.record("agroline", "skip");
    expect(c.snapshot().agroline).toEqual({ consecutiveFails: 2, open: false });
    c.record("agroline", "failed");
    expect(c.shouldSkip("agroline")).toBe(true);
  });

  it("④ 多源互相隔离：一个源开路不影响其他源", () => {
    const c = engine.makeSourceCircuit({ failureThreshold: 3 });
    c.record("tractorhouse", "failed");
    c.record("tractorhouse", "failed");
    c.record("tractorhouse", "failed");
    expect(c.shouldSkip("tractorhouse")).toBe(true);

    // 其他三个源完全不受影响
    expect(c.shouldSkip("mascus")).toBe(false);
    expect(c.shouldSkip("agroline")).toBe(false);
    expect(c.shouldSkip("machinerypete")).toBe(false);

    c.record("mascus", "ok");
    c.record("agroline", "failed");
    c.record("machinerypete", "skip");

    const snap = c.snapshot();
    expect(snap.tractorhouse.open).toBe(true);
    expect(snap.mascus).toEqual({ consecutiveFails: 0, open: false });
    expect(snap.agroline).toEqual({ consecutiveFails: 1, open: false });
    expect(snap.machinerypete).toEqual({ consecutiveFails: 0, open: false });
  });

  it("④b 默认阈值就是 3", () => {
    const c = engine.makeSourceCircuit();
    c.record("x", "failed");
    c.record("x", "failed");
    expect(c.shouldSkip("x")).toBe(false);
    c.record("x", "failed");
    expect(c.shouldSkip("x")).toBe(true);
  });
});

describe("runRefresh —— 总预算兜底（dryRun）", () => {
  // ⚠️ 这两条刻意做成**零竞态**：
  //   曾用 `budgetMs: 0` 一条同时断言「预算耗尽」和「no-source 计数」，
  //   但 `budgetMs: 0` 下 20 个 worker 是否在同一毫秒内完成首次预算检查，
  //   完全取决于调度时序 —— 同毫秒则各跑一个目标（no-source=20），
  //   翻毫秒则一个都不跑（no-source=0）⇒ CI 上随机红。
  //   现在拆成两条各自确定收敛的用例。
  it("⑤a budgetMs 耗尽（-1 保证首次检查即超）⇒ 一个目标都不派发", async () => {
    const targets = Array.from({ length: 50 }, () => ({ sourceSite: "__nosrc__" }));
    const stats = await engine.runRefresh({
      fx: {}, // 显式给 fx，避免走 getFxRates() 的真实网络
      targets,
      dryRun: true,
      // budgetMs: -1 ⇒ `Date.now() - startTs > -1` 恒真（elapsed 恒 >= 0）
      // ⇒ 第一个 worker 的首轮检查就 break，零目标被派发，完全不依赖时序。
      budgetMs: -1,
      concurrency: 20,
    });

    expect(stats.budgetExhausted).toBe(true);
    expect(stats.skippedByBudget).toBe(stats.total); // 全部计入"未派发"
    expect(stats.ok).toBe(0);
    expect(stats.skip).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("⑤b no-source 逐条计数（预算充裕 ⇒ 确定收敛，不触网）", async () => {
    // `__nosrc__` 走 probeOneTarget 的 `!source` 早退分支：不触网、不写库、极快。
    const targets = Array.from({ length: 5000 }, () => ({ sourceSite: "__nosrc__" }));
    const stats = await engine.runRefresh({
      fx: {},
      targets,
      dryRun: true,
      budgetMs: 260000, // 5000 条无网络的目标几十毫秒跑完，预算绰绰有余
      concurrency: 20,
    });

    expect(stats.budgetExhausted).toBe(false);
    expect(stats.skippedByBudget).toBe(0);
    expect(stats.skip).toBe(5000);
    expect(stats.skipReasons["no-source"]).toBe(5000);
    // 账目闭合
    expect(stats.ok + stats.skip + stats.failed + stats.skippedByBudget).toBe(stats.total);
  });

  it("⑥ 预算充裕时不误报 budgetExhausted（回归）", async () => {
    const stats = await engine.runRefresh({
      fx: {},
      targets: [{ sourceSite: "__nosrc__" }, { sourceSite: "__nosrc__" }],
      dryRun: true,
      budgetMs: 260000,
      concurrency: 2,
    });
    expect(stats.budgetExhausted).toBe(false);
    expect(stats.skippedByBudget).toBe(0);
    expect(stats.total).toBe(2);
    expect(stats.skip).toBe(2);
    expect(stats.skipReasons["no-source"]).toBe(2);
    expect(stats.bySource.__nosrc__).toEqual({ ok: 0, skip: 2, failed: 0, opened: false });
    expect(stats.circuitOpen).toEqual([]);
  });
});
