/**
 * 一对多审计（纠正 2 / AC-5）—— 只读重放，零写入
 *
 * 目标：证明改造后「同一个 productId 不会被 ≥ 2 个语义不同的 rawModel 命中」。
 *   不写 notes、不改 schema（纠正 2：删除原 §5.6 的 notes 内嵌 raw= 方案）。
 *   用内存重放替代全局 SQL：把 92 行读进内存 → 跑改造后 matcher → GROUP BY productId。
 *
 * 运行：
 *   node_modules/.bin/tsx scripts/audit-one-to-many.ts
 */
import * as fs from "fs";
import { runReplay } from "./lib/pairing-replay";
import { normalizeModel } from "../src/lib/model-alias";

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

(async () => {
  const data = await runReplay();
  const out: string[] = [];
  const log = (s = "") => out.push(s);

  log("=".repeat(88));
  log(`一对多审计（AC-5）  在库产品=${data.totalProducts}  有效benchmark=${data.validBenchmarkCount}`);
  log("=".repeat(88));

  const beforeHits = data.rows
    .filter((r) => r.beforeProductId)
    .map((r) => ({ pid: r.beforeProductId!, raw: r.rawModel }));
  const afterHits = data.rows
    .filter((r) => r.afterProductId)
    .map((r) => ({ pid: r.afterProductId!, raw: r.rawModel }));

  const beforeGroup = group(beforeHits);
  const afterGroup = group(afterHits);

  const dump = (title: string, g: Map<string, Set<string>>) => {
    log("");
    log(`${title}`);
    const conflicts = [...g.entries()].filter(([, s]) => s.size > 1);
    log(`  命中产品数=${g.size}  冲突产品数(distinct rawModel>1)=${conflicts.length}`);
    for (const [pid, set] of conflicts) {
      log(`   ⚠️ productId=${pid} 被 ${set.size} 个型号命中: ${[...set].join(" | ")}`);
    }
    if (!conflicts.length) log("   ✅ 无一对多冲突");
  };

  dump("【改造前 before（BRAND_MAP + 无校验）】", beforeGroup);
  dump("【改造后 after（DB索引 + P0-3 校验）】", afterGroup);

  log("");
  log("=".repeat(88));
  const ac5 = [...afterGroup.entries()].filter(([, s]) => s.size > 1).length;
  log(`AC-5 结论：改造后一对多冲突数 = ${ac5}  ${ac5 === 0 ? "✅ PASS" : "❌ FAIL"}`);
  log("=".repeat(88));

  fs.writeFileSync(OUT, out.join("\n"), "utf8");
  console.log(out.join("\n"));
  console.log(`\nwritten -> ${OUT}`);
  process.exit(ac5 === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FATAL", e && (e.stack || e.message));
  process.exit(1);
});
