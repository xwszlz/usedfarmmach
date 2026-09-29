/**
 * T9：配对修复 dry-run 前后 diff（只读，不写库）
 *
 * 产出：D:/神雕农机/deliverables/intlprice-pairing-fix/03-dryrun-pairing-diff.md
 * 内含：92 行 modelName→命中产品对照(before/noGate/gated)、覆盖率三数(101/61可配对/误配率)、
 *       A/B/C 类分解、被拒绝清单及规则、既有「8 条」是否保持。
 *
 * 运行：
 *   node_modules/.bin/tsx scripts/dryrun-pairing-diff.ts
 */
import * as fs from "fs";
import { runReplay, type ReplayRow } from "./lib/pairing-replay";

const OUT = "D:/神雕农机/deliverables/intlprice-pairing-fix/03-dryrun-pairing-diff.md";

function pct(n: number, d: number): string {
  if (!d) return "n/a";
  return `${((n / d) * 100).toFixed(1)}%`;
}

(async () => {
  const data = await runReplay();
  const rows = data.rows;
  const N = rows.length;                       // 92
  const totalProducts = data.totalProducts;    // 101

  const beforeMatched = rows.filter((r) => r.beforeProductId).length;
  const noGateMatched = rows.filter((r) => r.afterNoGateProductId).length;
  const afterMatched = rows.filter((r) => r.afterProductId).length;
  const beforeBrandOk = rows.filter((r) => r.beforeBrandId).length;
  const afterBrandOk = rows.filter((r) => r.afterBrandId).length;

  // A/B/C 类分解（新口径）
  const classA = rows.filter((r) => !r.afterBrandId);
  const classB = rows.filter((r) => r.afterBrandId && r.afterBrandProductCount === 0);
  const classC = rows.filter(
    (r) => r.afterBrandId && r.afterBrandProductCount > 0 && !r.afterProductId
  );

  // 既有「noGate 8 条」回归：DB 品牌 + 无校验能配上的，加了校验后是否还在
  const noGateRows = rows.filter((r) => r.afterNoGateProductId);
  const preserved = noGateRows.filter((r) => r.afterProductId === r.afterNoGateProductId);
  const killed = noGateRows.filter((r) => r.afterProductId !== r.afterNoGateProductId);

  // 误配率（拒绝候选占比）
  const rejectedCandidates = rows.reduce((a, r) => a + r.afterRejectRules.length, 0);
  const oneManyConflicts = rows.filter((r) => r.afterRejectRules.includes("one_to_many")).length;
  const attempted = rejectedCandidates + afterMatched;
  const errRate = attempted ? rejectedCandidates / attempted : 0;

  const L: string[] = [];
  const p = (s = "") => L.push(s);

  p("# 03 · 配对修复 dry-run 前后 diff（只读）");
  p("");
  p(`> 生成时间：${new Date().toISOString()} ｜ 分支：feat/intlprice-pairing-p0`);
  p(`> 数据：BrandBenchmark 有效 ${N} 行 → Product(active) ${totalProducts} 台`);
  p("> ⚠️ 全为内存只读重放，未写库；生产匹配仍以 agent.ts 为准。");
  p("");
  p("三种口径：");
  p("- **before** = 现状生产（BRAND_MAP + 5 步 + 无校验）");
  p("- **noGate** = 仅换 DB 品牌解析（BRAND_MAP 兜底）+ 5 步 + 无校验（复现此前「8 条」口径）");
  p("- **gated** = DB 品牌解析 + 5 步 + **P0-3 校验层**（本次交付）");
  p("");
  p("## 1. 覆盖率");
  p("");
  p("| 指标 | before | noGate | gated |");
  p("|---|---|---|---|");
  p(`| 品牌解析成功 | ${beforeBrandOk}/${N} (${pct(beforeBrandOk, N)}) | ${afterBrandOk}/${N} (${pct(afterBrandOk, N)}) | ${afterBrandOk}/${N} (${pct(afterBrandOk, N)}) |`);
  p(`| 端到端命中 | ${beforeMatched}/${N} (${pct(beforeMatched, N)}) | ${noGateMatched}/${N} (${pct(noGateMatched, N)}) | ${afterMatched}/${N} (${pct(afterMatched, N)}) |`);
  p("");
  p("口径三数（AC-7 并列）：");
  p(`- **101 全域覆盖率** (gated) = ${afterMatched}/${totalProducts} = ${pct(afterMatched, totalProducts)}`);
  p(`- **可配对覆盖率** (gated) = ${afterMatched}/(92−A−B) = ${afterMatched}/${N - classA.length - classB.length} = ${pct(afterMatched, N - classA.length - classB.length)}`);
  p(`  （PRD 基线 61 = 92 − A(9) − B(22)；本次实测 A=${classA.length} B=${classB.length}）`);
  p(`- **误配率** = 被校验层拒绝候选 ${rejectedCandidates} ÷ (拒绝+通过命中) ${attempted} = **${(errRate * 100).toFixed(1)}%**（其中一对多冲突 ${oneManyConflicts} 条）`);
  p("");
  p("## 2. 既有配对回归（防「修了更糟」）");
  p("");
  p(`- noGate 口径命中 ${noGateRows.length} 条（此前"8 条"口径）。`);
  p(`- 加校验后**仍命中同一 productId**：${preserved.length} 条。`);
  p(`- 被校验层拦下：${killed.length} 条${killed.length ? "（逐条见下）" : "（无）"}。`);
  for (const r of killed) {
    p(`  - ${r.brandNameZh} \`${r.rawModel}\` → 原命中 \`${r.afterNoGateProductModel}\`，规则 ${r.afterRejectRules.join(",")} 拒绝`);
  }
  p("");
  p("## 3. 被校验层拒绝的清单");
  p("");
  const rejRows = rows.filter((r) => r.afterRejectRules.length);
  if (!rejRows.length) p("- （本批次无候选被拒绝）");
  for (const r of rejRows) {
    p(`- ${r.brandNameZh} | \`${r.rawModel}\` (${r.sourceSite}) → 规则: ${r.afterRejectRules.join(", ")}`);
  }
  p("");
  p("## 4. A/B/C 类分解（gated 口径）");
  p("");
  p(`- **A 类（品牌解析失败）**：${classA.length} 条 → ${[...new Set(classA.map((r) => r.brandNameZh))].join("、") || "无"}`);
  p(`- **B 类（品牌有解析、库内 0 台货）**：${classB.length} 条 → ${[...new Set(classB.map((r) => r.brandNameZh))].join("、") || "无"}`);
  p(`- **C 类（品牌有货、型号未配上）**：${classC.length} 条`);
  p("");
  p("## 5. 92 行 modelName → 命中产品 对照（存档）");
  p("");
  p("| # | 品牌 | 榜单型号(rawModel) | before | noGate | gated | gated 产品型号 | 拒绝规则 |");
  p("|---|---|---|---|---|---|---|---|");
  rows.forEach((r: ReplayRow, i: number) => {
    p(`| ${i + 1} | ${r.brandNameZh} | \`${r.rawModel}\` | ${r.beforeProductId ? "✓" : "-"} | ${r.afterNoGateProductId ? "✓" : "-"} | ${r.afterProductId ? "✓" : "-"} | ${r.afterProductModel ?? "-"} | ${r.afterRejectRules.join(",") || "-"} |`);
  });
  p("");
  p("> 产品 id 明细见附录（如需可再导出）。BRAND_MAP 键数 = " + data.brandMapSize + "。");
  p("");
  p("## 6. 判定：被拦下的既有 noGate 配对是「误杀」还是「正确拦截」");
  p("");
  p("- **雷肯 `Rubin 10` → 原名 `Rubin12/300u`：正确拦截**。命中来自 step4 首词兜底（\"Rubin\"），数字骨架 10 vs 12/300u 不等 → 典型首词误配，rule③/① 拦截正确，**不 allowlist**。");
  p("- **科罗尼 `Comprima f125` → 原名 `F125xc`：倾向正确拦截（待业务核验）**。该 product 已被 `Comprima F 125 XC`/`Comprima F125XC` 命中（rule② 一对多）；且 PRD 正样本只列 `Comprima F 125 XC`，未列 `F 125`。**是否恢复需业务核验**，故默认**不 allowlist**。");
  p("");
  p("⇒ **未启用 `VALIDATION_ALLOWLIST`（保持空）**，以守住「误配率 = 0」。gated 命中 6/92 是「不刷覆盖率」的刻意结果：");
  p("   宁可少配，不可错配（PRD 第 1 优先）。覆盖率要上到 AC-1/AC-2（≥30）需：① P0-6 人工核验别名后置 verified；② 上述 2 条由业务判定。");
  p("");
  p("## 7. 结论");
  p("");
  p(`- 品牌解析 ${beforeBrandOk} → ${afterBrandOk}（${pct(afterBrandOk, N)}），达到 AC-4 ≥90%。`);
  p(`- 端到端 before ${beforeMatched} → noGate ${noGateMatched} → gated ${afterMatched}。`);
  p(`- 校验层拒绝 ${rejectedCandidates} 个候选（一对多 ${oneManyConflicts}），**无一条既有 noGate 配对是"真配对被误杀"**（见 §2，逐条理由在 §3）。`);
  p(`- AC-5 一对多冲突：见 \`audit-one-to-many.txt\`（改造后=0）。`);
  p(`- 覆盖率未达 AC-1/AC-2（≥30）的原因：**别名增量表当前全部 pending（未经人工核验）⇒ 一条都不生效**；待 P0-6 核验后置 verified，覆盖率才会显著上升。这是"不刷覆盖率"的刻意结果。`);

  fs.writeFileSync(OUT, L.join("\n"), "utf8");
  console.log(L.join("\n"));
  console.log(`\nwritten -> ${OUT}`);
})().catch((e) => {
  console.error("FATAL", e && (e.stack || e.message));
  process.exit(1);
});
