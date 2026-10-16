/**
 * 运维清除脚本：清理 BrandBenchmark 的 isActive 重复行（按 brand, model, sourceSite）。
 *
 * 背景：cn-postgres（阿里云 RDS 北京）在整表镜像自 Neon 时若未先清旧行，会残留旧
 * lastVerified 批次，导致同一机型两行。本脚本用于在生产库上彻底清除历史残留，与 API
 * 读层 src/lib/benchmark-dedupe.ts 共用同一去重口径（dedupeBrandBenchmark），保证
 * 线上（读层过滤）与线下（物理删除）一致。
 *
 * 用法（在 ECS 容器内执行，需 tsx）：
 *   # dry-run（默认）：只列出重复组与预计删除条数，不删任何数据
 *   SITE=cn npx tsx scripts/dedupe-benchmark.ts
 *   SITE=cn npx tsx scripts/dedupe-benchmark.ts --dry-run
 *   # 真正删除：每组保留 lastVerified 最新一行，删除其余（较旧）行
 *   SITE=cn npx tsx scripts/dedupe-benchmark.ts --apply
 *
 * 幂等：重复执行 --apply 不会二次删除（第二次扫描已无重复组，删除 0 条）。
 * 输出：重复组数、预计/实际删除条数、保留条数。
 */

import "dotenv/config";

import { dedupeBrandBenchmark } from "../src/lib/benchmark-dedupe";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const dryRun = !apply; // 默认 dry-run，安全优先

  // 分站：固定 db.ts 单例走 cn 库（必须早于 import db 设置，db.ts 在导入时即读取 SITE）。
  const site: "cn" | "com" = process.env.SITE === "cn" ? "cn" : "com";
  process.env.SITE = site;

  // 动态 import，确保 SITE 已就绪后再实例化 PrismaClient（避免误连 Neon）。
  const { prisma } = await import("../src/lib/db");

  console.log(`[dedupe-benchmark] SITE=${site}  mode=${apply ? "APPLY" : "dry-run"}`);

  const rows = await prisma.brandBenchmark.findMany({
    where: { isActive: true },
    orderBy: [{ sourceSite: "asc" }, { brand: "asc" }, { model: "asc" }],
    select: {
      id: true,
      brand: true,
      model: true,
      sourceSite: true,
      lastVerified: true,
      updatedAt: true,
    },
  });

  // 复用与 API 读层完全相同的去重口径，确定“保留集”。
  const kept = dedupeBrandBenchmark(rows);
  const keptIds = new Set(kept.map((r) => r.id));
  const toDelete = rows.filter((r) => !keptIds.has(r.id));

  // 统计重复组（每组 >1 行）。
  const groupCount = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.brand}||${r.model}||${r.sourceSite}`;
    groupCount.set(key, (groupCount.get(key) ?? 0) + 1);
  }
  const dupGroups = [...groupCount.entries()].filter(([, n]) => n > 1);

  console.log(`[dedupe-benchmark] isActive 行总数=${rows.length}`);
  console.log(`[dedupe-benchmark] 去重后保留=${kept.length}（唯一键=${groupCount.size}）`);
  console.log(`[dedupe-benchmark] 重复组数=${dupGroups.length}（每组 >1 行）`);
  console.log(`[dedupe-benchmark] 预计删除=${toDelete.length} 条`);

  if (dupGroups.length > 0) {
    console.log("[dedupe-benchmark] 重复组明细（brand||model||sourceSite -> 行数）：");
    for (const [key, n] of dupGroups) {
      console.log(`  - ${key} -> ${n}`);
    }
  }

  if (dryRun) {
    console.log("[dedupe-benchmark] dry-run：未删除任何数据。加 --apply 才真删。");
    return;
  }

  if (toDelete.length === 0) {
    console.log("[dedupe-benchmark] 无重复行可删，无需操作（已幂等）。");
    return;
  }

  const deleteIds = toDelete.map((r) => r.id);
  const result = await prisma.brandBenchmark.deleteMany({
    where: { id: { in: deleteIds } },
  });
  console.log(`[dedupe-benchmark] 已删除 ${result.count} 条；保留 ${kept.length} 条。`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("[dedupe-benchmark] 执行失败：", e instanceof Error ? e.message : e);
    process.exit(1);
  });
