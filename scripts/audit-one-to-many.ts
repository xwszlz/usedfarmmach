/**
 * 一对多审计（AC-5）—— 直接调用**真实生产模块** PriceIntelAgent（修复3：废弃仿制重放）
 *
 * 目标：证明「同一个 productId 不会被 ≥ 2 个语义不同的 rawModel 命中」。
 *   dryRun=true 只读，不写库；diagnostics=true 拿到全部逐条匹配结果。
 *
 * 运行：
 *   node_modules/.bin/tsx scripts/audit-one-to-many.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { normalizeModel } from "../src/lib/model-alias";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const OUT = "D:/神雕农机/deliverables/intlprice-pairing-fix/audit-one-to-many.txt";

/** 按「语义归一化后的型号」分组（'Comprima F 125 XC' 与 'Comprima F125XC' 属同一型号，不算冲突） */
function group(list: Array<{ pid: string; raw: string }>): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const x of list) {
    const norm = normalizeModel(x.raw);
    if (!norm) continue;
    if (!m.has(x.pid)) m.set(x.pid, new Set());
    m.get(x.pid)!.add(norm);
  }
  return m;
}

async function main() {
  const { priceIntelAgent } = await import("../src/lib/agents/price-intel/agent");
  const { prisma } = await import("../src/lib/db");

  const res = await priceIntelAgent.run({
    sources: ["benchmark"],
    maxFilesPerSource: 3,
    force: false,
    dryRun: true,
    diagnostics: true,
  });
  const rows = res.perSource.find((s) => s.source === "benchmark")?.allMatches ?? [];
  const totalProducts = await prisma.product.count({ where: { status: "active" } });

  const out: string[] = [];
  const log = (s = "") => out.push(s);

  log("=".repeat(88));
  log(`一对多审计（AC-5）  在库 active 产品=${totalProducts}  有效benchmark=${rows.length}`);
  log("口径：真实 PriceIntelAgent.run(sources=['benchmark'], dryRun=true, diagnostics=true)");
  log("=".repeat(88));

  const afterHits = rows.filter((r) => r.productId).map((r) => ({ pid: r.productId!, raw: r.modelName }));
  const afterGroup = group(afterHits);

  const conflicts = [...afterGroup.entries()].filter(([, s]) => s.size > 1);
  log("");
  log(`【改造后 after（DB索引 + P0-3 校验 + 修复1/2）】`);
  log(`  命中产品数=${afterGroup.size}  冲突产品数(distinct rawModel>1)=${conflicts.length}`);
  for (const [pid, set] of conflicts) {
    log(`   ⚠️ productId=${pid} 被 ${set.size} 个型号命中: ${[...set].join(" | ")}`);
  }
  if (!conflicts.length) log("   ✅ 无一对多冲突");

  log("");
  log("=".repeat(88));
  const ac5 = conflicts.length;
  log(`AC-5 结论：改造后一对多冲突数 = ${ac5}  ${ac5 === 0 ? "✅ PASS" : "❌ FAIL"}`);
  log("=".repeat(88));

  fs.writeFileSync(OUT, out.join("\n"), "utf8");
  console.log(out.join("\n"));
  console.log(`\nwritten -> ${OUT}`);

  await prisma.$disconnect();
  process.exit(ac5 === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e && (e.stack || e.message));
  process.exit(1);
});
