/**
 * 修复C：配对 dry-run —— 直接调用**真实生产模块** PriceIntelAgent（两趟全局裁决）
 *
 * 产出（修复C：不再覆写交付目录，改输出到独立 run-<时间戳>/ 目录，可用 $INTLPRICE_OUT_DIR 覆盖）：
 *   <OUT_DIR>/04-real-dryrun-pairing.md
 *
 * 误配率**两条基线分列表**，分母口径各自写明：
 *   表A 自定基准  —— 分母 = **全部命中条数**
 *   表B PRD 正样本 —— 分母 = **PRD 可比条数**
 *
 * 运行：
 *   node_modules/.bin/tsx scripts/dryrun-pairing-diff.ts
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
const OUT = path.join(OUT_DIR, "04-real-dryrun-pairing.md");

/** 基线A（自定基准，业务待复核）：某榜单型号「可接受」的库存型号（normalizeModel 后） */
const ACCEPT_SELF: Record<string, string[]> = {
  "Jaguar 970": ["970"],
  "Comprima F 125 XC": ["f125xc"],
  "Comprima F125XC": ["f125xc"],
  "Comprima CF 155 XC": ["cf155xc"],
  // 说明：1290/1290XC/1290xchdp 三个变体均列入"可接受"⇒ 基线A 自带自证成分；故并列基线B
  "BiG Pack 1290": ["1290", "1290xc", "1290xchdp"],
};

/** 基线B（PRD 正样本，01-incremental-PRD.md L227-229）：必须命中的**指定**型号（normalizeModel 后） */
const PRD_POSITIVE: Record<string, string> = {
  "BiG Pack 1290": "1290xc",   // PRD 白纸黑字：→ 1290XC
  "Comprima F 125 XC": "f125xc",
  "Jaguar 970": "970",
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
    const rows = src?.allMatches ?? [];
    if (rows.length !== 92) {
      throw new Error(`benchmark 处理条数=${rows.length} ≠ 92（疑似 DB 瞬断），重试`);
    }
    return rows;
  };

  // ── 同序确定性：连跑 3 次 ──
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

  // ── 基线A：自定基准；分母 = 全部命中条数 ──
  const wrongA: string[] = [];
  const unjudgedA: string[] = [];
  for (const h of hits) {
    const exp = ACCEPT_SELF[h.modelName];
    const pm = normalizeModel(h.productModelName ?? "");
    if (!exp) { unjudgedA.push(`${h.modelName} -> ${h.productModelName}`); continue; }
    if (!exp.includes(pm)) wrongA.push(`${h.modelName} -> ${h.productModelName}`);
  }
  const denomA = hits.length;                 // 全部命中条数
  const judgedA = hits.length - unjudgedA.length;

  // ── 基线B：PRD 正样本；分母 = PRD 可比条数 ──
  const prdRows: { model: string; expect: string; actual: string; hit: boolean; ok: boolean }[] = [];
  for (const [model, expect] of Object.entries(PRD_POSITIVE)) {
    const h = rows.find((r) => r.modelName === model);
    const actual = h ? normalizeModel(h.productModelName ?? "") : "(未命中)";
    const hit = !!h?.productId;
    prdRows.push({ model, expect, actual, hit, ok: hit && actual === expect });
  }
  const denomB = prdRows.length;              // PRD 可比条数
  const prdDev = prdRows.filter((r) => !r.ok).length;

  const L: string[] = [];
  const p = (s = "") => L.push(s);
  p("# 04 · 配对修复 dry-run（真实生产模块 PriceIntelAgent · 两趟全局裁决）");
  p("");
  p(`> 生成时间：${new Date().toISOString()} ｜ 输出目录：\`${OUT_DIR}\``);
  p(`> 调用方式：\`priceIntelAgent.run({ sources:['benchmark'], dryRun:true, diagnostics:true })\` —— **非仿制重放**。`);
  p(`> 命中映射已**独立回查数据库**二次确认；同一输入连跑 3 次比对签名。顺序不变性见 \`order-invariance.txt\`。`);
  p("");
  p("## 1. 核心指标");
  p("");
  p("| 指标 | 本次（修复 A/B 后） |");
  p("|---|---|");
  p(`| 品牌解析成功率 | **${brandOk}/${N} (${pct(brandOk, N)})** |`);
  p(`| 端到端过闸配对 | **${hits.length}/${N} (${pct(hits.length, N)})** |`);
  p(`| A/B/C 分布 | **${classA.length} / ${classB.length} / ${classC.length}** |`);
  p(`| 可配对分母 (N−A−B) | **${denominator}** |`);
  p(`| 可配对覆盖率 (命中/分母) | **${hits.length}/${denominator} (${pct(hits.length, denominator)})** |`);
  p(`| 全域 101 覆盖率 | ${hits.length}/101 (${pct(hits.length, 101)}) |`);
  p("");
  p("## 2. 误配率 —— 两条基线**分列表**（各自写明分母口径）");
  p("");
  p("### 2.1 基线A · 自定基准（业务待核）");
  p("");
  p("- **分母口径 = 全部命中条数**（命中行数，含同名多行；= " + denomA + "）");
  p(`- 结果：误配 **${wrongA.length}/${denomA} = ${pct(wrongA.length, denomA)}**（其中有基准可判定 ${judgedA} 条、未判定 ${unjudgedA.length} 条）`);
  p("- ⚠️ 自证成分：`BiG Pack 1290` 的 1290 系列 3 变体（1290/1290XC/1290xchdp）**全部**列入“可接受”⇒ 该基准对 1290 不具区分力。");
  p("");
  p("### 2.2 基线B · PRD 正样本（01-incremental-PRD.md L227-229）");
  p("");
  p(`- **分母口径 = PRD 可比条数**（PRD 指定 3 条正样本，均在 92 行内出现；= ${denomB}）`);
  p(`- 结果：偏离 **${prdDev}/${denomB} = ${pct(prdDev, denomB)}**`);
  p("");
  p("| PRD 正样本 | PRD 指定型号 | 实际命中型号 | 命中 | 判定 |");
  p("|---|---|---|---|---|");
  for (const r of prdRows) p(`| \`${r.model}\` | \`${r.expect}\` | \`${r.actual}\` | ${r.hit} | ${r.ok ? "✅ 符合" : "❌ 偏离"} |`);
  p("");
  if (prdDev > 0) {
    p(`> ⚠️ 偏离：PRD 要求 \`BiG Pack 1290\` → \`1290XC\`，实际 \`1290\`。`);
    p(`> 根因：别名基表 \`bigpack1290 → "1290"\` + \`pickBestProducts\`「精确相等优先」把裸型号当标准答案；`);
    p(`> 库内 \`1290XC\`/\`1290xchdp\` 亦为同系列在售。属**业务归属未拍板**（别名配置不在本次改动范围，按纪律未动）。`);
  }
  p("");
  p("## 3. 同序确定性（连跑 3 次）");
  p("");
  p(`- run#1 vs run#2：**${detFlags[0]}**；run#2 vs run#3：**${detFlags[1]}** ⇒ ${deterministic ? "✅ 同序稳定" : "❌ 不稳定"}`);
  p(`- （顺序不变性见 \`order-invariance.txt\`：真跑组 3 次全量真实重跑命中集恒等。）`);
  p("");
  p("## 4. 全部命中（含独立回查确认）");
  p("");
  p("| # | 品牌 | 榜单型号 | 命中 productId | 产品型号(诊断) | 独立回查 modelName | 一致 | 判定(基线A) |");
  p("|---|---|---|---|---|---|---|---|");
  hits.forEach((h, i) => {
    const c = h.productId ? confirmById.get(h.productId) : undefined;
    const match = c ? normalizeModel(c.modelName) === normalizeModel(h.productModelName ?? "") : false;
    const exp = ACCEPT_SELF[h.modelName];
    const verdict = !exp ? "未判定(业务待核)" : exp.includes(normalizeModel(h.productModelName ?? "")) ? "✅ 正确" : "❌ 误配";
    p(`| ${i + 1} | ${h.brandNameZh} | \`${h.modelName}\` | ${h.productId ?? "-"} | \`${h.productModelName ?? "-"}\` | \`${c?.modelName ?? "-"}\` | ${match} | ${verdict} |`);
  });
  p("");
  p(`- 命中条数 = ${hits.length}；distinct productId = ${new Set(hits.map((h) => h.productId)).size}`);
  p("");
  p("## 5. 被校验层拒绝的规则分布（修复A 生效证据）");
  p("");
  const ruleCount = new Map<string, number>();
  for (const r of rows) for (const rule of r.rejectRules) ruleCount.set(rule, (ruleCount.get(rule) ?? 0) + 1);
  for (const [k, v] of [...ruleCount.entries()].sort()) p(`- ${k}: ${v}`);
  if (!ruleCount.size) p("- （无）");
  p("");
  p("### 5.1 含 `Rubin` 的行（修复A 关键反例）");
  p("");
  for (const r of rows.filter((x) => /rubin/i.test(x.modelName))) {
    p(`- \`${r.modelName}\` → 命中 ${r.productId ?? "-"}(${r.productModelName ?? "-"}) 拒绝规则=[${r.rejectRules.join(",") || "无"}]`);
  }
  p("");
  p("## 6. 逐条明细（全部 92 行，A/B/C/命中）");
  p("");
  p("| # | 品牌 | 榜单型号 | brandId | 品牌货量 | 结果 | 产品型号 | 拒绝规则 |");
  p("|---|---|---|---|---|---|---|---|");
  rows.forEach((r, i) => {
    const cnt = r.brandId ? countByBrand.get(r.brandId) ?? 0 : 0;
    const status = r.productId ? "命中" : !r.brandId ? "A(品牌未解析)" : cnt === 0 ? "B(库内无货)" : "C(型号未配)";
    p(`| ${i + 1} | ${r.brandNameZh} | \`${r.modelName}\` | ${r.brandId ?? "-"} | ${cnt} | ${status} | ${r.productModelName ?? "-"} | ${r.rejectRules.join(",") || "-"} |`);
  });
  p("");
  p("## 7. 误配逐条（基线A 命中但实际错）");
  p("");
  if (!wrongA.length) p("- **无**（基线A 下误配率 = 0）");
  for (const w of wrongA) p(`- ❌ ${w}`);
  if (unjudgedA.length) {
    p("");
    p("### 未纳入基线A 判定的命中（无自定基准，业务待核）");
    for (const u of unjudgedA) p(`- ${u}`);
  }

  fs.writeFileSync(OUT, L.join("\n"), "utf8");
  console.log(L.join("\n"));
  console.log(`\nwritten -> ${OUT}`);

  await prisma.$disconnect();
  process.exit(deterministic ? 0 : 1);
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
