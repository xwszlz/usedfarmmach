/**
 * 修复1 回归对照表（T8）：校验层正/负样本 —— 纯函数、零 DB
 *
 * 覆盖「数字骨架 全对齐 + 年度豁免」（修复1）≥13 例回归，逐例打印期望 / 实际 / 通过与否。
 * 同时保留规则②（一对多）/ 规则④（长度）/ 白名单的既有回归。
 *
 * 运行：
 *   node_modules/.bin/tsx scripts/test-match-validation.ts
 */
import {
  validateMatch,
  type MatchCandidate,
  type MatchStep,
  type OneToManyState,
} from "../src/lib/agents/price-intel/match-validation";

interface Case {
  via: MatchStep;
  raw: string;
  prod: string;
  expect: boolean;
  note: string;
}

const CASES: Case[] = [
  // ── 正例（必须通过）──
  { via: 3, raw: "980 (2016)", prod: "980", expect: true, note: "年度 2016 豁免，非年份 [980]⊆[980]" },
  { via: 5, raw: "BiG Pack 1290", prod: "1290xchdp", expect: true, note: "非年份 [1290]⊆[1290]" },
  { via: 5, raw: "BiG Pack 1290", prod: "1290XC", expect: true, note: "非年份 [1290]⊆[1290]" },
  { via: 5, raw: "Comprima F 125 XC", prod: "F125xc", expect: true, note: "非年份 [125]⊆[125]" },
  { via: 5, raw: "Comprima F125XC", prod: "F125xc", expect: true, note: "非年份 [125]⊆[125]" },
  { via: 5, raw: "Comprima CF 155 XC", prod: "CF155XC", expect: true, note: "非年份 [155]⊆[155]" },
  { via: 5, raw: "Comprima f125", prod: "F125xc", expect: true, note: "PRD 正样本：非年份 [125]⊆[125]（规则③通过；真实链路另受规则②约束）" },
  { via: 5, raw: "Quadrant 5300", prod: "5300RC", expect: true, note: "非年份 [5300]⊆[5300]" },
  { via: 5, raw: "Jaguar 970", prod: "970", expect: true, note: "非年份 [970]⊆[970]" },
  { via: 4, raw: "1290XC", prod: "1290xchdp", expect: true, note: "非年份 [1290]⊆[1290]；首词 1290xc 非弱 token" },
  { via: 3, raw: "Rubin 300", prod: "Rubin12/300u", expect: true, note: "非年份 [300]⊆[12,300]（300 命中）" },

  // ── 负例（必须拒绝）──
  { via: 4, raw: "Rubin 9/300 U", prod: "Rubin12/300u", expect: false, note: "🔴 修复1 核心：非年份 [9,300] ⊄ [12,300]，9 对不上 ⇒ 拒绝（旧版误放行）" },
  { via: 4, raw: "Rubin 10", prod: "Rubin12/300u", expect: false, note: "非年份 [10] ⊄ [12,300]" },
  { via: 4, raw: "VB 3290", prod: "VbP3165", expect: false, note: "首词 vb 为弱 token ⇒ 规则①" },
  { via: 4, raw: "6R 250", prod: "7250", expect: false, note: "首词 6r 为弱 token ⇒ 规则①" },
  { via: 5, raw: "6R 250", prod: "7250", expect: false, note: "非年份 [6,250] ⊄ [7250]" },
  { via: 5, raw: "LX2204", prod: "LX2004", expect: false, note: "非年份 [2204] ≠ [2004]" },
  { via: 5, raw: "Magnum 380", prod: "420", expect: false, note: "非年份 [380] ≠ [420]" },
  { via: 5, raw: "VB 1122", prod: "VbP3165", expect: false, note: "非年份 [1122] ≠ [3165]" },
  { via: 5, raw: "Xerion 5000", prod: "500", expect: false, note: "非年份 [5000] ⊄ [500]（反向 contains 陷阱）" },
];

function mk(raw: string, prod: string, via: MatchStep, pid = "P1"): MatchCandidate {
  return {
    brandSlug: "test",
    rawListingModel: raw,
    productId: pid,
    productModelName: prod,
    viaStep: via,
  };
}

let pass = 0;
let fail = 0;

console.log("=== 修复1 校验层回归对照表（≥13 例） ===\n");
console.log("| # | viaStep | 候选型号 | 产品型号 | 期望 | 实际 | 通过 | 说明 |");
console.log("|---|---|---|---|---|---|---|---|");

CASES.forEach((c, i) => {
  const r = validateMatch(mk(c.raw, c.prod, c.via));
  const actual = r.ok ? "通过" : `拒绝(${r.rejection!.rule})`;
  const ok = r.ok === c.expect;
  if (ok) pass++;
  else fail++;
  console.log(
    `| ${i + 1} | ${c.via} | \`${c.raw}\` | \`${c.prod}\` | ${c.expect ? "通过" : "拒绝"} | ${actual} | ${ok ? "✅" : "❌"} | ${c.note} |`
  );
});

// ── 规则② 一对多禁令（单次运行内）──
console.log("\n=== 规则②／④／白名单 附加回归 ===");
{
  const state: OneToManyState = { seenByProduct: new Map() };
  const a = validateMatch(mk("VB 2160", "VB2160", 5, "PROD_X"), state);
  const b = validateMatch(mk("VB 3190", "VB3190", 5, "PROD_X"), state);
  const ok = a.ok && !b.ok;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} RULE2 同 productId 第2个不同型号被拒  first=${a.ok ? "ok" : "rej"} second=${b.ok ? "ok(!" : b.rejection!.rule}`);
}
{
  const state: OneToManyState = { seenByProduct: new Map() };
  const a = validateMatch(mk("VB 2160", "VB2160", 5, "PROD_Y"), state);
  const b = validateMatch(mk("vb 2160", "VB2160", 5, "PROD_Y"), state);
  const ok = a.ok && b.ok;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} RULE2 同 productId 同型号(归一化后相同)放行  a=${a.ok} b=${b.ok}`);
}
{
  const r = validateMatch(mk("X", "XY", 5));
  const ok = !r.ok && r.rejection!.rule === "length";
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} RULE4 单字符候选被拒  ${r.ok ? "竟通过(!" : r.rejection!.rule}`);
}
{
  const state: OneToManyState = { seenByProduct: new Map(), allowlist: new Set(["PROD_Z::vb3290"]) };
  const r = validateMatch(mk("VB 3290", "VbP3165", 4, "PROD_Z"), state);
  r.ok ? pass++ : fail++;
  console.log(`  ${r.ok ? "✅" : "❌"} ALLOWLIST 白名单命中放行  ${r.ok ? "ok" : `被拒 ${r.rejection!.rule}`}`);
}

console.log(`\n=== 结果：PASS=${pass} FAIL=${fail} ===`);
if (fail > 0) process.exit(1);
