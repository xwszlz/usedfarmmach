/**
 * 一对多审计（AC-5）—— 直接调用**真实生产模块** PriceIntelAgent（两趟全局裁决）
 *
 * 目标：证明「同一个 productId 不会被 ≥ 2 个**语义不同**的 rawModel 命中」
 *       （归一化后相同视为同一型号，不算冲突——与规则②/Pass2 口径一致）。
 *
 * 修复C：输出改到独立 run-<时间戳>/ 目录，不再覆写交付目录。
 * 运行：
 *   node_modules/.bin/tsx scripts/audit-one-to-many.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { normalizeModel } from "../src/lib/model-alias";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const OUT_DIR =
  process.env.INTLPRICE_OUT_DIR ??
  path.join("D:/神雕农机/deliverables/intlprice-pairing-fix", `run-${STAMP}`);
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, "audit-one-to-many.txt");

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
  if (rows.length !== 92) throw new Error(`benchmark 处理条数=${rows.length} ≠ 92（疑似 DB 瞬断），重试`);
  const totalProducts = await prisma.product.count({ where: { status: "active" } });

  const out: string[] = [];
  const log = (s = "") => out.push(s);

  log("=".repeat(88));
  log(`一对多审计（AC-5）  在库 active 产品=${totalProducts}  有效benchmark=${rows.length}`);
  log("口径：真实 PriceIntelAgent.run(sources=['benchmark'], dryRun=true, diagnostics=true)（两趟全局裁决）");
  log("=".repeat(88));

  const hits = rows.filter((r) => r.productId).map((r) => ({ pid: r.productId!, raw: r.modelName }));
  const g = group(hits);

  const conflicts = [...g.entries()].filter(([, s]) => s.size > 1);
  log("");
  log("【修复A/B 后】");
  log(`  命中产品数=${g.size}  冲突产品数(distinct 语义型号>1)=${conflicts.length}`);
  for (const [pid, set] of conflicts) {
    log(`   ⚠️ productId=${pid} 被 ${set.size} 个语义不同型号命中: ${[...set].join(" | ")}`);
  }
  if (!conflicts.length) log("   ✅ 无一对多冲突");

  log("");
  log("=".repeat(88));
  const ac5 = conflicts.length;
  log(`AC-5 结论：一对多冲突数 = ${ac5}  ${ac5 === 0 ? "✅ PASS" : "❌ FAIL"}`);
  log("=".repeat(88));

  fs.writeFileSync(OUT, out.join("\n"), "utf8");
  console.log(out.join("\n"));
  console.log(`\nwritten -> ${OUT}`);

  await prisma.$disconnect();
  process.exit(ac5 === 0 ? 0 : 1);
}

async function boot() {
  const { prisma } = await import("../src/lib/db");
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      await main();
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`FATAL(attempt ${attempt}/8): ${msg.split("\n")[0].slice(0, 200)}`);
      try { await prisma.$disconnect(); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  process.exit(1);
}
boot();
