/**
 * T8：匹配校验层（P0-3）正/负样本回归 —— 纯函数、零 DB、零写法依赖
 *
 * 运行：
 *   node_modules/.bin/tsx scripts/test-match-validation.ts
 *
 * 覆盖 team-lead 指定的表格用例 + 规则②一对多 + 规则④长度 + 白名单放行。
 */
import {
  validateMatch,
  type MatchCandidate,
  type MatchStep,
  type OneToManyState,
} from "../src/lib/agents/price-intel/match-validation";

let pass = 0;
let fail = 0;

function mk(raw: string, prod: string, viaStep: MatchStep, pid = "P1"): MatchCandidate {
  return {
    brandSlug: "test",
    rawListingModel: raw,
    productId: pid,
    productModelName: prod,
    viaStep,
  };
}

function expect(name: string, cond: boolean, detail: string): void {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}  ${detail}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}  ${detail}`);
  }
}

console.log("=== 校验层正/负样本回归 ===\n");

// ── 正样本（必须通过）──
{
  const r = validateMatch(mk("980 (2016)", "980", 3));
  expect("POS 980(2016)→980", r.ok, r.ok ? "ok" : `被拒 ${r.rejection!.rule}: ${r.rejection!.reason}`);
}
{
  const r = validateMatch(mk("BiG Pack 1290", "1290XC", 5));
  expect("POS BiG Pack 1290→1290XC", r.ok, r.ok ? "ok" : `被拒 ${r.rejection!.rule}: ${r.rejection!.reason}`);
}
{
  const r = validateMatch(mk("Comprima F 125 XC", "F125xc", 5));
  expect("POS Comprima F 125 XC→F125xc", r.ok, r.ok ? "ok" : `被拒 ${r.rejection!.rule}: ${r.rejection!.reason}`);
}
{
  const r = validateMatch(mk("Jaguar 970", "970", 5));
  expect("POS Jaguar 970→970", r.ok, r.ok ? "ok" : `被拒 ${r.rejection!.rule}: ${r.rejection!.reason}`);
}

// ── 负样本（必须拒绝）──
{
  const r = validateMatch(mk("VB 3290", "VbP3165", 4));
  expect("NEG VB 3290 ✗ VbP3165", !r.ok, r.ok ? "竟通过(!)" : `拒绝 ${r.rejection!.rule}`);
}
{
  const r = validateMatch(mk("6R 250", "7250", 4));
  expect("NEG 6R 250 ✗ 7250", !r.ok, r.ok ? "竟通过(!)" : `拒绝 ${r.rejection!.rule}`);
}
{
  const r = validateMatch(mk("LX2204", "LX2004", 5));
  expect("NEG LX2204 ✗ LX2004", !r.ok, r.ok ? "竟通过(!)" : `拒绝 ${r.rejection!.rule}`);
}
{
  const r = validateMatch(mk("Magnum 380", "420", 5));
  expect("NEG Magnum 380 ✗ 420", !r.ok, r.ok ? "竟通过(!)" : `拒绝 ${r.rejection!.rule}`);
}

// ── 规则② 一对多禁令（单次运行内）──
{
  const state: OneToManyState = { seenByProduct: new Map() };
  const a = validateMatch(mk("VB 2160", "VB2160", 5, "PROD_X"), state);
  const b = validateMatch(mk("VB 3190", "VB3190", 5, "PROD_X"), state);
  expect("RULE2 同 productId 第2个不同型号被拒", a.ok && !b.ok,
    `first=${a.ok ? "ok" : "rej"} second=${b.ok ? "ok(!)" : b.rejection!.rule}`);
}
{
  const state: OneToManyState = { seenByProduct: new Map() };
  const a = validateMatch(mk("VB 2160", "VB2160", 5, "PROD_Y"), state);
  const b = validateMatch(mk("vb 2160", "VB2160", 5, "PROD_Y"), state);
  expect("RULE2 同 productId 同型号(归一化后相同)放行", a.ok && b.ok, `a=${a.ok} b=${b.ok}`);
}

// ── 规则④ 长度约束 ──
{
  const r = validateMatch(mk("X", "XY", 5));
  expect("RULE4 单字符候选被拒", !r.ok && r.rejection!.rule === "length", r.ok ? "竟通过(!)" : r.rejection!.rule);
}

// ── 白名单放行（整条放行，用于既有 8 条被误杀时兜底）──
{
  const state: OneToManyState = {
    seenByProduct: new Map(),
    allowlist: new Set(["PROD_Z::vb3290"]),
  };
  const r = validateMatch(mk("VB 3290", "VbP3165", 4, "PROD_Z"), state);
  expect("ALLOWLIST 白名单命中放行", r.ok, r.ok ? "ok" : `被拒 ${r.rejection!.rule}`);
}

console.log(`\n=== 结果：PASS=${pass} FAIL=${fail} ===`);
if (fail > 0) process.exit(1);
