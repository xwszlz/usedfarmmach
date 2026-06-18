/**
 * CLI 触发 #3 国际价格采集 Agent
 *
 * 用法：
 *   tsx scripts/agent-price-intel.ts                     # 全量跑（dryRun=false）
 *   tsx scripts/agent-price-intel.ts --dry-run           # 只看不写
 *   tsx scripts/agent-price-intel.ts --sources=manual     # 只跑 manual
 *   tsx scripts/agent-price-intel.ts --max-files=5       # 每个源最多 5 个文件
 *   tsx scripts/agent-price-intel.ts --force             # 强制重写
 *   tsx scripts/agent-price-intel.ts --date=20260615     # 回填某天
 *   tsx scripts/agent-price-intel.ts --status             # 仅查询状态
 */
import { priceIntelAgent } from "../src/lib/agents/price-intel/agent";

function parseArgs() {
  const args = process.argv.slice(2);
  const out: {
    sources?: string[];
    maxFilesPerSource?: number;
    force?: boolean;
    dryRun?: boolean;
    targetDate?: string;
    status?: boolean;
  } = {};
  for (const a of args) {
    if (a.startsWith("--sources=")) out.sources = a.split("=")[1].split(",") as any;
    else if (a.startsWith("--max-files=")) out.maxFilesPerSource = parseInt(a.split("=")[1], 10);
    else if (a === "--force") out.force = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--date=")) out.targetDate = a.split("=")[1];
    else if (a === "--status") out.status = true;
  }
  return out;
}

async function main() {
  const args = parseArgs();
  if (args.status) {
    const s = await priceIntelAgent.getStatus();
    console.log("\n🤖 price-intel agent status");
    console.log(JSON.stringify(s, null, 2));
    process.exit(0);
  }
  console.log(`\n🤖 启动 #3 国际价格采集 Agent`);
  if (args.sources) console.log(`  sources: ${args.sources.join(",")}`);
  if (args.maxFilesPerSource) console.log(`  maxFiles: ${args.maxFilesPerSource}`);
  console.log(`  dryRun: ${!!args.dryRun}  force: ${!!args.force}`);
  if (args.targetDate) console.log(`  targetDate: ${args.targetDate}`);
  console.log("");

  const result = await priceIntelAgent.run({
    sources: args.sources as any,
    maxFilesPerSource: args.maxFilesPerSource ?? 3,
    force: !!args.force,
    dryRun: !!args.dryRun,
    targetDate: args.targetDate,
  });

  console.log("\n========================================");
  console.log(`✅  ok:           ${result.ok}`);
  console.log(`⏱️  duration:     ${result.durationMs}ms`);
  console.log(`📦  collected:    ${result.totalCollected}`);
  console.log(`🆕 imported:     ${result.totalImported}`);
  console.log(`🔄 updated:      ${result.totalUpdated}`);
  console.log(`⏭️  skipped:      ${result.totalSkipped}`);
  console.log("--- per source ---");
  for (const s of result.perSource) {
    console.log(`  ${s.source.padEnd(10)} proc=${s.processed} imp=${s.imported} upd=${s.updated} skip=${s.skipped} err=${s.errors.length} ${s.durationMs}ms`);
    if (s.samples.length > 0) {
      for (const m of s.samples.slice(0, 2)) {
        const price = m.priceEur ? `€${m.priceEur.toLocaleString()}` : m.priceUsd ? `$${m.priceUsd.toLocaleString()}` : "-";
        console.log(`    ↳ ${m.brandNameZh} ${m.modelName} ${m.year ?? ""} ${price} → ¥${m.priceForeignCny.toLocaleString()} status=${m.matchStatus} productId=${m.productId ?? "—"}`);
      }
    }
  }
  if (result.error) console.log(`❌  error: ${result.error}`);
  console.log("========================================\n");

  process.exit(result.ok ? 0 : 1);
}

main().catch(e => {
  console.error("Agent 异常:", e);
  process.exit(1);
});
