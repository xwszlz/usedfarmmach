/**
 * 多品牌国际基准价 — CLI 入口（本地 / 海外 VPS / ECS 手动跑）
 *
 * 采集与聚合逻辑已抽到 src/lib/benchmark-engine.js（单一真相源），
 * 本文件只做命令行分发，可被 node 直接执行（无需 TS 编译）。
 *
 * 用法：
 *   node scripts/fetch-benchmark.js --seed scripts/benchmark-seed.json
 *   node scripts/fetch-benchmark.js --refresh
 *   node scripts/fetch-benchmark.js --report
 */

const engine = require('../src/lib/benchmark-engine');

async function main() {
  const mode = process.argv[2];
  if (mode === '--seed') {
    const fx = await engine.getFxRates();
    console.log('FX(→CNY):', fx);
    await engine.seedFromResearch(process.argv[3] || 'scripts/benchmark-seed.json');
  } else if (mode === '--refresh') {
    const fx = await engine.getFxRates();
    console.log('FX(→CNY):', fx);
    const stats = await engine.runRefresh({ fx, concurrency: 12, timeoutMs: 8000 });
    console.log(`  ✅ 成功 ${stats.ok} / 跳过(无样本) ${stats.skip} / 失败(网络) ${stats.failed} / 共 ${stats.total}`);
  } else if (mode === '--report') {
    await engine.report();
  } else {
    console.log('用法:');
    console.log('  node scripts/fetch-benchmark.js --seed scripts/benchmark-seed.json');
    console.log('  node scripts/fetch-benchmark.js --refresh');
    console.log('  node scripts/fetch-benchmark.js --report');
  }
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exitCode = 1;
  })
  .finally(() => engine.disconnectBenchmark().catch(() => {}));
