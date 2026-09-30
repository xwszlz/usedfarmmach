/**
 * 修复3：配对 dry-run —— 直接调用**真实生产模块** PriceIntelAgent（不再使用仿制重放）
 *
 * 产出：D:/神雕农机/deliverables/intlprice-pairing-fix/04-real-dryrun-pairing.md
 *
 * 要点：
 *   - dryRun=true（不写库）；diagnostics=true 让真实 agent 透出**全部**逐条匹配结果（allMatches）。
 *   - 对每条命中**独立回查数据库**二次确认 productId → modelName 映射（不盲信 agent 输出）。
 *   - 同一输入**连跑 3 次**，比对逐行签名，证明结果确定性（修复2）。
 *
 * 运行：
 *   node_modules/.bin/tsx scripts/dryrun-pairing-diff.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { normalizeModel } from "../src/lib/model-alias";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const OUT = "D:/神雕农机/deliverables/intlprice-pairing-fix/04-real-dryrun-pairing.md";

/** 人工判定基准（业务待复核）：某榜单型号「可接受」的库存型号（normalizeModel 后）。 */
const ACCEPT: Record<string, string[]> = {
  "Jaguar 970": ["970"],
  "Comprima F 125 XC": ["f125xc"],
  "Comprima F125XC": ["f125xc"],
  "Comprima CF 155 XC": ["cf155xc"],
  "BiG Pack 1290": ["1290", "1290xc", "1290xchdp"],
};

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "n/a");

async function main() {
  const { priceIntelAgent } = await import("../src/lib/agents/price-intel/agent");
  const { prisma } = await import("../src/lib/db");

  const runOnce = async () => {
    const res = await priceIntelAgent.run({
      sources: ["benchmark"],
      maxFilesPerSource: 3,
      force: false,
      dryRun: true,
      diagnostics: true,
    });
    const src = res.perSource.find((s) => s.source === "benchmark");
    return src?.allMatches ?? [];
  };

  // ── 确定性：连跑 3 次 ──
  const runs = [] as Awaited<ReturnType<typeof runOnce>>[];
  for (let i = 0; i < 3; i++) runs.push(await runOnce());
  const sig = (a: typeof runs[number]) =>
    a.map((m) => `${m.brandNameZh}|${m.modelName}|${m.productId ?? "-"}|${m.productModelName ?? "-"}`).join("\n");
  const detFlags = [sig(runs[0]) === sig(runs[1]), sig(runs[1]) === sig(runs[2])];
  const deterministic = detFlags[0] && detFlags[1];

  const rows = runs[0];
  const N = rows.length;

  // ── 独立回查：产品映射 + 品牌 active 产品数 ──
  const confirm: { id: string; brandId: string; modelName: string; status: string }[] = [];
  for (const m of rows) {
    if (!m.productId) continue;
    const p = await prisma.product.findFirst({
      where: { id: m.productId },
      select: { id: true, brandId: true, modelName: true, status: true },
    });
    if (p) confirm.push(p);
  }
  const confirmById = new Map(confirm.map((c) => [c.id, c]));

  const grouped = await prisma.product.groupBy({
    by: ["brandId"],
    where: { status: "active" },
    _count: { _all: true },
  });
  const countByBrand = new Map(grouped.map((g) => [g.brandId, g._count._all]));

  // ── 分类 ──
  const classA = rows.filter((r) => !r.brandId);
  const classB = rows.filter((r) => r.brandId && (countByBrand.get(r.brandId) ?? 0) === 0);
  const classC = rows.filter((r) => r.brandId && (countByBrand.get(r.brandId) ?? 0) > 0 && !r.productId);
  const hits = rows.filter((r) => r.productId);
  const brandOk = rows.filter((r) => r.brandId).length;
  const denominator = N - classA.length - classB.length;

  // ── 误配判定 ──
  const wrong: string[] = [];
  const unjudged: string[] = [];
  for (const h of hits) {
    const exp = ACCEPT[h.modelName];
    const pm = normalizeModel(h.productModelName ?? "");
    if (!exp) { unjudged.push(`${h.modelName} -> ${h.productModelName}`); continue; }
    if (!exp.includes(pm)) wrong.push(`${h.modelName} -> ${h.productModelName}`);
  }
  const judged = hits.length - unjudged.length;
  const errRate = judged ? wrong.length / judged : 0;

  const L: string[] = [];
  const p = (s = "") => L.push(s);
  p("# 04 · 配对修复 dry-run（真实生产模块 PriceIntelAgent）");
  p("");
  p(`> 生成时间：${new Date().toISOString()} ｜ 分支：feat/intlprice-pairing-p0（修复1/2/3）`);
  p(`> 调用方式：\`priceIntelAgent.run({ sources:['benchmark'], dryRun:true, diagnostics:true })\` —— **非仿制重放**。`);
  p(`> 命中映射已**独立回查数据库**二次确认；同一输入连跑 3 次比对签名。`);
  p("");
  p("## 1. 核心指标");
  p("");
  p("| 指标 | 本次（修复后） | 改前（独立复验基线） |");
  p("|---|---|---|");
  p(`| 品牌解析成功率 | **${brandOk}/${N} (${pct(brandOk, N)})** | 86/92 (93.5%) |`);
  p(`| 端到端过闸配对 | **${hits.length}/${N} (${pct(hits.length, N)})** | 6/92 (6.5%) |`);
  p(`| A/B/C 分布 | **${classA.length} / ${classB.length} / ${classC.length}** | 6 / 25 / 55 |`);
  p(`| 可配对分母 (N−A−B) | **${denominator}** | 61 |`);
  p(`| 误配率（命中且实际错 ÷ 命中） | **${errRate * 100}% (${wrong.length}/${judged})** | 1/6 = 16.7% |`);
  p(`| 全域分母 101 覆盖率 | ${hits.length}/101 (${pct(hits.length, 101)}) | 6/101 (5.9%) |`);
  p("");
  p("## 2. 确定性（修复2）");
  p("");
  p(`- run#1 vs run#2 逐行签名一致：**${detFlags[0]}**`);
  p(`- run#2 vs run#3 逐行签名一致：**${detFlags[1]}**`);
  p(`- 结论：同一输入连跑 3 次输出**完全一致** ⇒ ${deterministic ? "✅ 确定性达标" : "❌ 仍不确定"}`);
  p("");
  p("## 3. 全部命中（含独立回查确认）");
  p("");
  p("| # | 品牌 | 榜单型号 | 命中 productId | 产品型号(诊断) | 独立回查 modelName | 一致 | 判定 |");
  p("|---|---|---|---|---|---|---|---|");
  hits.forEach((h, i) => {
    const c = h.productId ? confirmById.get(h.productId) : undefined;
    const match = c ? normalizeModel(c.modelName) === normalizeModel(h.productModelName ?? "") : false;
    const exp = ACCEPT[h.modelName];
    const verdict = !exp ? "未判定(业务待核)" : exp.includes(normalizeModel(h.productModelName ?? "")) ? "✅ 正确" : "❌ 误配";
    p(`| ${i + 1} | ${h.brandNameZh} | \`${h.modelName}\` | ${h.productId ?? "-"} | \`${h.productModelName ?? "-"}\` | \`${c?.modelName ?? "-"}\` | ${match} | ${verdict} |`);
  });
  p("");
  p(`- 命中数（distinct productId）= ${new Set(hits.map((h) => h.productId)).size}`);
  p("");
  p("## 4. 被校验层拒绝的规则分布（修复1 生效证据）");
  p("");
  const ruleCount = new Map<string, number>();
  for (const r of rows) for (const rule of r.rejectRules) ruleCount.set(rule, (ruleCount.get(rule) ?? 0) + 1);
  for (const [k, v] of [...ruleCount.entries()].sort()) p(`- ${k}: ${v}`);
  if (!ruleCount.size) p("- （无）");
  p("");
  p("### 4.1 含 `Rubin 9/300 U` 的行（修复1 关键反例）");
  p("");
  for (const r of rows.filter((x) => /rubin/i.test(x.modelName))) {
    p(`- \`${r.modelName}\` → 命中 ${r.productId ?? "-"}(${r.productModelName ?? "-"}) 拒绝规则=[${r.rejectRules.join(",") || "无"}]`);
  }
  p("");
  p("## 5. 逐条明细（全部 92 行，A/B/C/命中）");
  p("");
  p("| # | 品牌 | 榜单型号 | brandId | 品牌货量 | 结果 | 产品型号 | 拒绝规则 |");
  p("|---|---|---|---|---|---|---|---|");
  rows.forEach((r, i) => {
    const cnt = r.brandId ? countByBrand.get(r.brandId) ?? 0 : 0;
    const status = r.productId ? "命中" : !r.brandId ? "A(品牌未解析)" : cnt === 0 ? "B(库内无货)" : "C(型号未配)";
    p(`| ${i + 1} | ${r.brandNameZh} | \`${r.modelName}\` | ${r.brandId ?? "-"} | ${cnt} | ${status} | ${r.productModelName ?? "-"} | ${r.rejectRules.join(",") || "-"} |`);
  });
  p("");
  p("## 6. 误配逐条（命中但实际错）");
  p("");
  if (!wrong.length) p("- **无**（AC-3 误配率 = 0 达成）");
  for (const w of wrong) p(`- ❌ ${w}`);
  if (unjudged.length) {
    p("");
    p("### 未纳入误配判定的命中（无人工基准，业务待复核）");
    for (const u of unjudged) p(`- ${u}`);
  }

  fs.writeFileSync(OUT, L.join("\n"), "utf8");
  console.log(L.join("\n"));
  console.log(`\nwritten -> ${OUT}`);

  await prisma.$disconnect();
  process.exit(deterministic && wrong.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e && (e.stack || e.message));
  process.exit(1);
});
