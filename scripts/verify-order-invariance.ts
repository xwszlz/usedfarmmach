/**
 * 修复B 验收：顺序不变性
 *
 * 【证据分两类，分开列表，不混表】
 *   A. 真跑组：每次**全量真实 DB 往返**（`resolveItems` / `resolveItemsDetailed`）：
 *        ① 原始顺序  ② 完全倒序  ③ 固定种子洗牌 0xC0FFEE
 *   B. 拼装组：复用真跑①的 Pass1 claims，仅重排后跑**真实 Pass2**（`arbitrateClaims`，纯函数，零 DB）：
 *        A′ 原始顺序（应 == 真跑①）  B′ 完全倒序（应 == 真跑②）  D 洗牌 0xDEADBEEF
 *   依据：Pass1（claimProduct）逐条独立、与遍历顺序无关；故拼装组与真跑组应恒等——用于**交叉验证**，
 *         但拼装组**不作为**"顺序不变性的真跑证据"。
 *
 * 修复C：输出到独立 run-<时间戳>/ 目录。
 * 运行：
 *   node_modules/.bin/tsx scripts/verify-order-invariance.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { normalizeModel } from "../src/lib/model-alias";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const OUT_DIR =
  process.env.INTLPRICE_OUT_DIR ??
  path.join("D:/神雕农机/deliverables/intlprice-pairing-fix", `run-${STAMP}`);
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, "order-invariance.txt");

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededOrder(n: number, seed: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

type RowRes = { index: number; productId: string | null; productModelName: string | null };

async function main() {
  const { priceIntelAgent, arbitrateClaims } = await import("../src/lib/agents/price-intel/agent");
  const { collectFromSource } = await import("../src/lib/agents/price-intel/sources");

  const base = await collectFromSource("benchmark", 3);
  const N = base.length;
  if (N !== 92) throw new Error(`benchmark 行数=${N} ≠ 92（疑似 DB 瞬断），重试`);

  const summarize = (rows: RowRes[]) => {
    const hits = rows.filter((r) => r.productId);
    const hitSet = [...new Set(hits.map((r) => r.productId!))].sort();
    const hitHash = sha(hitSet.join("\n"));
    const map = new Map<string, string>();
    for (const r of rows) map.set(normalizeModel(base[r.index].modelName), r.productId ?? "-");
    const mapHash = sha([...map.entries()].sort().map(([k, v]) => `${k}=${v}`).join("\n"));
    return { hitRows: hits.length, hitSet, hitHash, mapHash, map };
  };

  // ───── A. 真跑组（每次全量真实 DB 往返）─────
  const det = await priceIntelAgent.resolveItemsDetailed(base); // 真跑①
  const realA = det.resolved.map((r) => ({ index: r.index, productId: r.productId, productModelName: r.productModelName }));

  const orderRev = Array.from({ length: N }, (_, i) => N - 1 - i);
  const orderSh1 = seededOrder(N, 0xc0ffee);
  const orderSh2 = seededOrder(N, 0xdeadbeef);

  const resB = await priceIntelAgent.resolveItems(orderRev.map((i) => base[i])); // 真跑②
  const realB = resB.map((r, pos) => ({ index: orderRev[pos], productId: r.productId, productModelName: r.productModelName }));

  const resC = await priceIntelAgent.resolveItems(orderSh1.map((i) => base[i])); // 真跑③
  const realC = resC.map((r, pos) => ({ index: orderSh1[pos], productId: r.productId, productModelName: r.productModelName }));

  const real = [
    { name: "真跑① 原始顺序（全量真实）", ...summarize(realA) },
    { name: "真跑② 完全倒序（全量真实）", ...summarize(realB) },
    { name: "真跑③ 洗牌 0xC0FFEE（全量真实）", ...summarize(realC) },
  ];

  // ───── B. 拼装组（复用真跑① claims，仅跑真实 Pass2）─────
  const identity = Array.from({ length: N }, (_, i) => i);
  const viaClaims = (order: number[]): RowRes[] => {
    const reordered = order.map((orig, newIdx) => ({ ...det.claims[orig], index: newIdx }));
    const verdict = arbitrateClaims(reordered);
    return order.map((orig, newIdx) => {
      const v = verdict.get(newIdx)!;
      return { index: orig, productId: v.productId, productModelName: v.productModelName };
    });
  };
  const asmA = viaClaims(identity);
  const asmB = viaClaims(orderRev);
  const asmD = viaClaims(orderSh2);
  const assembled = [
    { name: "拼装A′ 原始顺序（复用 claims）", ...summarize(asmA) },
    { name: "拼装B′ 完全倒序（复用 claims）", ...summarize(asmB) },
    { name: "拼装D 洗牌 0xDEADBEEF（复用 claims）", ...summarize(asmD) },
  ];

  const out: string[] = [];
  const log = (s = "") => out.push(s);
  log("=".repeat(96));
  log("修复B 顺序不变性验收（真实 PriceIntelAgent · Pass1 收集 + Pass2 全局裁决）");
  log(`行数=${N}  生成时间=${new Date().toISOString()}`);
  log("=".repeat(96));
  log("");

  const table = (title: string, note: string, rows: typeof real) => {
    log(`## ${title}`);
    log(note);
    log("");
    log("| 顺序 | 命中条数 | distinct 产品数 | 命中 productId 集合 | 集合 sha256 | 逐条映射 sha256 |");
    log("|---|---|---|---|---|---|");
    for (const r of rows) {
      log(`| ${r.name} | ${r.hitRows} | ${r.hitSet.length} | ${r.hitSet.length ? r.hitSet.map((x) => x.slice(0, 8)).join(", ") : "(空)"} | ${r.hitHash.slice(0, 16)}… | ${r.mapHash.slice(0, 16)}… |`);
    }
    const eq = rows.every((r) => r.hitHash === rows[0].hitHash && r.mapHash === rows[0].mapHash);
    log("");
    log(`- 组内命中集 & 逐条映射 **全等 = ${eq}**（组内基准 = 本组第 1 行）`);
    log("");
    return eq;
  };

  const realEq = table(
    "1. 【真跑组】每次全量真实 DB 往返（顺序不变性的**真跑证据**，共 3 次 ≥ 2 次）",
    "> 每组每行都是对 92 行**完整重跑一遍真实管线**（各自独立查询 DB）。",
    real
  );

  const asmEq = table(
    "2. 【拼装组】复用真跑①的 Pass1 claims，仅重排后跑真实 Pass2（**非真跑**，仅交叉验证）",
    "> Pass1 逐条独立 ⇒ 复用之；Pass2 为真实 `arbitrateClaims`。此组**不作为**顺序不变性的真跑证据。",
    assembled
  );

  log("## 3. 跨组交叉验证");
  log("");
  log(`- 真跑组 vs 拼装组 命中集一致：**${real[0].hitHash === assembled[0].hitHash}**（sha ${real[0].hitHash.slice(0, 16)}…）`);
  log(`- 真跑① vs 拼装A′（同为原始顺序）：**${real[0].hitHash === assembled[0].hitHash && real[0].mapHash === assembled[0].mapHash}**`);
  log(`- 真跑② vs 拼装B′（同为倒序）：**${real[1].hitHash === assembled[1].hitHash && real[1].mapHash === assembled[1].mapHash}**`);
  log("");
  log("## 4. 命中 productId 集合（真跑①）");
  log("");
  for (const pid of real[0].hitSet) log(`- ${pid}`);
  log("");
  log("## 5. Comprima F125xc 竞争组可见性（一对多裁决）");
  for (const r of [...real, ...assembled]) {
    const f = [...r.map.entries()].filter(([k]) => k.includes("comprima") || k.includes("f125"));
    log(`  [${r.name}] ` + f.map(([k, v]) => `${k}→${v === "-" ? "null" : v.slice(0, 8)}`).join("  "));
  }
  log("");
  log("=".repeat(96));
  log(`结论：真跑组（3 次全量真实重跑）命中集恒等 = ${realEq} ｜ 拼装组恒等 = ${asmEq}`);
  log("=".repeat(96));

  fs.writeFileSync(OUT, out.join("\n"), "utf8");
  console.log(out.join("\n"));
  console.log(`\nwritten -> ${OUT}`);
  process.exit(realEq && asmEq ? 0 : 1);
}

async function boot() {
  const { prisma } = await import("../src/lib/db");
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      await main();
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`FATAL(attempt ${attempt}/8): ${msg.split("\n").find((l) => l.trim()) ?? ""}`.slice(0, 200));
      try { await prisma.$disconnect(); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  process.exit(1);
}
boot();
