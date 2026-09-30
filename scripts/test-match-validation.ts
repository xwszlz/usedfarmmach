/**
 * 修复A 对抗回归表 —— 规则③「集合成员 + 条件年度豁免」（纯函数、零 DB）
 *
 * 覆盖：
 *   - 正样本（必须通过）；
 *   - v2 独立复验 §3.1 的 16 例（逐例带上 BEFORE/AFTER 期望）；
 *   - v2 §3.2 真链路前缀假阳面（Jaguar 9 / BiG Pack 12 / Comprima F 12 / Jaguar 97 / BiG Pack 129）；
 *   - 年度/空集对抗面（2016→980、Fendt 2000→500、Juwel→500、Cenius→Cenius …）；
 *   - 规则②（一对多）/ 规则④（长度）/ 白名单 的既有回归。
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
  /** 期望拒绝规则（expect=false 时校验） */
  rule?: string;
  note: string;
}

const CASES: Case[] = [
  // ── 正例（修复A 后必须通过）──
  { via: 5, raw: "980 (2016)", prod: "980", expect: true, note: "年度 2016 条件豁免；非年份 [980]⊆[980]" },
  { via: 5, raw: "Jaguar 970", prod: "970", expect: true, note: "[970]=[970]" },
  { via: 5, raw: "BiG Pack 1290", prod: "1290XC", expect: true, note: "[1290]=[1290]（PRD 正样本，规则③层面放行）" },
  { via: 5, raw: "BiG Pack 1290", prod: "1290xchdp", expect: true, note: "[1290]=[1290]" },
  { via: 5, raw: "Comprima F 125 XC", prod: "F125xc", expect: true, note: "[125]=[125]" },
  { via: 5, raw: "Comprima F125XC", prod: "F125xc", expect: true, note: "[125]=[125]" },
  { via: 5, raw: "Comprima CF 155 XC", prod: "CF155XC", expect: true, note: "[155]=[155]" },
  { via: 5, raw: "Comprima f125", prod: "F125xc", expect: true, note: "PRD 正样本；[125]=[125]" },
  { via: 5, raw: "Quadrant 5300", prod: "5300RC", expect: true, note: "[5300]=[5300]" },
  { via: 4, raw: "1290XC", prod: "1290xchdp", expect: true, note: "首词 1290xc 非弱 token；[1290]=[1290]" },
  { via: 5, raw: "1290XC", prod: "1290", expect: true, note: "[1290]=[1290]" },
  { via: 5, raw: "1290", prod: "1290XC", expect: true, note: "[1290]=[1290]" },
  { via: 2, raw: "Juwel", prod: "Juwel", expect: true, note: "步骤2 精确：L=P=空集但 1/2 不受规则③约束" },
  { via: 5, raw: "M2004", prod: "M2004", expect: true, note: "[2004]=[2004]（即便 2004 像年份，相等即通过）" },
  { via: 5, raw: "980 (2016)", prod: "980 (2015)", expect: true, note: "两侧年份不同但均豁免；[980]=[980]" },
  { via: 5, raw: "Z 2000", prod: "Z2001", expect: true, note: "⚠️ 已知启发式局限：两侧均为 19xx/20xx 数字，条件豁免致通过（业务待核）" },

  // ── 负例（修复A 后必须拒绝）──
  { via: 4, raw: "Rubin 9/300 U", prod: "Rubin12/300u", expect: false, rule: "digit_skeleton", note: "🔴 核心误配：9∉[12,300] 且非年份（旧版误放行）" },
  { via: 4, raw: "Jaguar 9", prod: "970", expect: false, rule: "digit_skeleton", note: "🔴 单数字前缀假阳：9∉[970]（旧版真链路命中）" },
  { via: 4, raw: "Jaguar 97", prod: "970", expect: false, rule: "digit_skeleton", note: "🔴 截断前缀假阳：97∉[970]" },
  { via: 5, raw: "BiG Pack 12", prod: "1290", expect: false, rule: "digit_skeleton", note: "🔴 截断前缀假阳（步5 归规则③）：12∉[1290]" },
  { via: 4, raw: "BiG Pack 12", prod: "1290", expect: false, rule: "first_token_prefix", note: "🔴 同例走步4：弱 token「BiG」先被规则①拦（双保险）" },
  { via: 5, raw: "BiG Pack 129", prod: "1290", expect: false, rule: "digit_skeleton", note: "🔴 截断前缀假阳（步5 归规则③）：129∉[1290]" },
  { via: 4, raw: "BiG Pack 129", prod: "1290", expect: false, rule: "first_token_prefix", note: "🔴 同例走步4：弱 token「BiG」先被规则①拦" },
  { via: 5, raw: "Comprima F 12", prod: "F125xc", expect: false, rule: "digit_skeleton", note: "🔴 截断前缀假阳：12∉[125]" },
  { via: 5, raw: "Z 300", prod: "Z3000", expect: false, rule: "digit_skeleton", note: "前缀方向假阳：300∉[3000]" },
  { via: 5, raw: "Z 12", prod: "Z120", expect: false, rule: "digit_skeleton", note: "前缀方向假阳：12∉[120]" },
  { via: 5, raw: "Z 1290", prod: "Z129", expect: false, rule: "digit_skeleton", note: "反向：1290∉[129]" },
  { via: 5, raw: "Rubin 300", prod: "Rubin12/300u", expect: false, rule: "digit_skeleton", note: "🆕 对称②：库存 12∉候选，且非年份 ⇒ 拒绝（旧不对称版放行）" },
  { via: 4, raw: "Rubin 10", prod: "Rubin12/300u", expect: false, rule: "digit_skeleton", note: "10∉[12,300]" },
  { via: 4, raw: "VB 3290", prod: "VbP3165", expect: false, rule: "first_token_prefix", note: "首词 vb 弱 token ⇒ 规则①" },
  { via: 4, raw: "6R 250", prod: "7250", expect: false, rule: "first_token_prefix", note: "首词 6r 弱 token ⇒ 规则①" },
  { via: 5, raw: "6R 250", prod: "7250", expect: false, rule: "digit_skeleton", note: "6∉[7250]" },
  { via: 5, raw: "LX2204", prod: "LX2004", expect: false, rule: "digit_skeleton", note: "2204≠2004" },
  { via: 5, raw: "Magnum 380", prod: "420", expect: false, rule: "digit_skeleton", note: "380≠420" },
  { via: 5, raw: "VB 1122", prod: "VbP3165", expect: false, rule: "digit_skeleton", note: "1122≠3165" },
  { via: 5, raw: "Xerion 5000", prod: "500", expect: false, rule: "digit_skeleton", note: "5000∉[500]（反向 contains 陷阱）" },
  { via: 5, raw: "M2004-5G", prod: "2004", expect: false, rule: "digit_skeleton", note: "🔴 年度启发式：5∉[2004] 且非年份 ⇒ 拒绝（2004 被当型号数字，双向校验更严）" },
  { via: 5, raw: "2016", prod: "980", expect: false, rule: "digit_skeleton", note: "🔴 年度绕过：候选 [2016] 全年度豁免，但库存 980∉候选且非年份 ⇒ 拒绝（修 v2 空集/年度漏洞）" },
  { via: 5, raw: "1990", prod: "980", expect: false, rule: "digit_skeleton", note: "纯年度候选 ⇒ 拒绝" },
  { via: 5, raw: "Fendt 2000", prod: "500", expect: false, rule: "digit_skeleton", note: "🔴 型号似年份：2000 豁免，但库存 500∉候选 ⇒ 拒绝" },
  { via: 5, raw: "Juwel", prod: "500", expect: false, rule: "digit_skeleton", note: "🆕 候选空集 vs 库存有段：500∉[] 且非年份 ⇒ 拒绝" },
  { via: 5, raw: "Cenius", prod: "Cenius", expect: false, rule: "digit_skeleton", note: "🆕 双边空集 + 模糊步骤 ⇒ 拒绝（③）" },
  { via: 5, raw: "X", prod: "XY", expect: false, rule: "length", note: "规则④ 单字符" },
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

console.log("=== 修复A 规则③ 对抗回归表（集合成员 + 条件年度豁免） ===\n");
console.log("| # | viaStep | 候选型号 | 产品型号 | 期望 | 实际 | 通过 | 说明 |");
console.log("|---|---|---|---|---|---|---|---|");

CASES.forEach((c, i) => {
  const r = validateMatch(mk(c.raw, c.prod, c.via));
  const actual = r.ok ? "通过" : `拒绝(${r.rejection!.rule})`;
  const ruleOk = c.expect ? true : c.rule === undefined || r.rejection?.rule === c.rule;
  const ok = r.ok === c.expect && ruleOk;
  if (ok) pass++;
  else fail++;
  console.log(
    `| ${i + 1} | ${c.via} | \`${c.raw}\` | \`${c.prod}\` | ${c.expect ? "通过" : "拒绝"} | ${actual} | ${ok ? "✅" : "❌"} | ${c.note} |`
  );
});

// ── 规则② 一对多禁令（仅在显式传入 state 时生效）──
console.log("\n=== 规则②／④／白名单 附加回归 ===");
{
  const state: OneToManyState = { seenByProduct: new Map() };
  const a = validateMatch(mk("VB 2160", "VB2160", 5, "PROD_X"), state);
  const b = validateMatch(mk("VB 3190", "VB3190", 5, "PROD_X"), state);
  const ok = a.ok && !b.ok && b.rejection!.rule === "one_to_many";
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
  // 不传 state ⇒ 规则②不生效（生产链路改由 Pass2 全局裁决）
  const a = validateMatch(mk("VB 2160", "VB2160", 5, "PROD_Z"));
  const b = validateMatch(mk("VB 3190", "VB3190", 5, "PROD_Z"));
  const ok = a.ok && b.ok;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} RULE2 不传 state 时不拦截（Pass2 职责）  a=${a.ok} b=${b.ok}`);
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

console.log(`\n=== 结果：PASS=${pass} FAIL=${fail}  （纯函数用例 ${CASES.length} 例）===`);
if (fail > 0) process.exit(1);
