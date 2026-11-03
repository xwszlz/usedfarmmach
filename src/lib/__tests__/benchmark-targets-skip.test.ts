/**
 * 单测：mascus 已从 benchmark 的「按型号靶标」循环中摘除
 * ─────────────────────────────────────────────────────────
 * 背景（2026-11 实测）：mascus 品牌/型号筛选在 URL 层失效，38 个靶标只落在 4 个
 * 品类页上（去重 9.5 倍），且 97% 挂牌为询价（priceEURO=0）。runRefresh(dryRun)
 * 仅 mascus：ok=1 / skip=37，skip 不计熔断、永不收敛 ⇒ 每天白打 37 次只换 1 条。
 * 故给 mascus 的 SOURCES 条目加 `skipInTargets:true`，buildTargets() 跳过它。
 *
 * 覆盖：
 *   ① buildTargets() 结果里 sourceSite==='mascus' 的条数为 0
 *   ② 总条数 = 228（38 品牌×型号组合 × 剩余 6 源），且全部非 mascus、每源各 38 条
 *   ③ SOURCES 里 mascus 仍存在（skipInTargets=true），buildSearchUrl 仍能产出合法 mascus URL
 *      —— 防有人顺手把 SOURCES 整条删了，导致 checkSourceStaleness 把 mascus 误判成 not-in-crawl-list
 *
 * ⚠️ 文件名必须是 `.test.ts`（vitest.config.ts include = `src/**\/*.test.ts`）。
 *
 * benchmark-engine.js 在模块加载时会 new PrismaClient 并读取 DATABASE_URL，
 * 故在动态 import 前注入占位串（本测试全程不查库）。
 *
 * 运行：npx vitest run src/lib/__tests__/benchmark-targets-skip.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

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

/** 按 sourceSite 统计每个源的靶标条数 */
function countBySite(targets: Array<Record<string, any>>): Record<string, number> {
  const bySite: Record<string, number> = {};
  for (const t of targets) {
    const site = String(t.sourceSite);
    bySite[site] = (bySite[site] || 0) + 1;
  }
  return bySite;
}

describe("buildTargets —— mascus 已摘除", () => {
  it("① sourceSite === 'mascus' 的条目数为 0", () => {
    const all = engine.buildTargets();
    expect(all.filter((t) => t.sourceSite === "mascus").length).toBe(0);
  });

  it("② 总条数 = 228（38 组合 × 剩余 6 源），全部非 mascus，每源各 38 条", () => {
    const all = engine.buildTargets();
    expect(all.length).toBe(228);
    // 全部条目都不是 mascus
    expect(all.filter((t) => t.sourceSite !== "mascus").length).toBe(all.length);

    // 剩余 6 个源，每个都应恰好 38 条（38 = 品牌×型号组合数）
    const bySite = countBySite(all);
    expect(Object.keys(bySite).sort()).toEqual([
      "agroline",
      "avito",
      "efarm",
      "machinerypete",
      "olx",
      "tractorhouse",
    ]);
    for (const site of Object.keys(bySite)) {
      expect(bySite[site]).toBe(38);
    }
    // 6 源 × 38 = 228 的闭合校验
    expect(Object.keys(bySite).length * 38).toBe(all.length);
  });
});

describe("SOURCES —— mascus 定义仍保留（防误删）", () => {
  it("③ mascus 仍在 SOURCES 且标记 skipInTargets；buildSearchUrl 仍产出合法 mascus 品类 URL", () => {
    const mascus = engine.SOURCES.find((s) => s.key === "mascus");
    expect(mascus).toBeTruthy();
    expect(mascus?.skipInTargets).toBe(true);

    // 即便不参与靶标采集，buildSearchUrl 仍须能按 key 找到并用真实品类路径
    const url = engine.buildSearchUrl(
      { key: "mascus", currency: "EUR", name: "Mascus" },
      { nameEn: "Claas", model: "Lexion 8600", category: "combine" }
    );
    expect(url).toMatch(/^https:\/\/www\.mascus\.com\/agriculture\/.+\?lastcreateddays=7$/);
    expect(url).toContain("/agriculture/agricultural-harvesters");
  });
});
