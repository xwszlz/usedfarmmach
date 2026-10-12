/**
 * 两级马力档常量层 —— 行为回归测试
 *
 * 运行：`npx tsx scripts/test-model-tiers.ts`（或 `node --loader` 之类）。
 * 目的：锁定 `expandModelQuery` / `resolveModelFilter` / `resolveBrandKey` 的契约，
 * 防止重蹈 v1 把 `2504` 过度指定为单一 `CLAAS AXION 2504` 的覆辙。
 *
 * ⚠️ 本目录在根 `tsconfig.json` 的 `exclude` 中（不进 `tsc --noEmit` 全量检查），
 * 可单独运行做契约守护。
 */
import { expandModelQuery, resolveModelFilter, resolveBrandKey } from "../src/lib/raw-listing/model-aliases";
import { channel, rowKind, derivePlatform } from "../src/lib/raw-listing/source-catalog";

let failures = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}`);
  }
}

function hasAll(input: string, expected: string[]): boolean {
  const out = expandModelQuery(input);
  return expected.every((e) => out.includes(e));
}

console.log("== 1) 2504 跨品牌展开（修复点：不应只剩 CLAAS） ==");
check('"2504" 含 CLAAS AXION 2504', hasAll("2504", ["CLAAS AXION 2504"]));
check('"2504" 含 雷沃 RG2504', hasAll("2504", ["雷沃 RG2504"]));
check('"2504" 含 东方红 2504', hasAll("2504", ["东方红 2504"]));
check('"2504" 含 常发 2504', hasAll("2504", ["常发 2504"]));
check('"2504" 含 850 旧称', hasAll("2504", ["850"]));
check('"850" 反查到 2504 档（旧称归一）', hasAll("850", ["CLAAS AXION 2504", "雷沃 RG2504"]));

console.log("== 2) 2204 跨品牌展开 ==");
check('"2204" 含 CLAAS AXION 2204', hasAll("2204", ["CLAAS AXION 2204"]));
check('"2204" 含 东方红 2204', hasAll("2204", ["东方红 2204"]));
check('"2204" 含 华夏 2204', hasAll("2204", ["华夏 2204"]));

console.log("== 3) 9080 含纽荷兰大方捆 ==");
check('"9080" 含 NEW HOLLAND BB 9080', hasAll("9080", ["NEW HOLLAND BB 9080"]));
check('"9080" 含 BB 9080', hasAll("9080", ["BB 9080"]));

console.log("== 4) 空输入 / 无匹配 不报错 ==");
check('空串返回 []', expandModelQuery("").length === 0);
check('whitespace 返回 []', expandModelQuery("   ").length === 0);
check('未知机型只含原样', JSON.stringify(expandModelQuery("X99")) === JSON.stringify(["X99"]));

console.log("== 5) resolveModelFilter 品牌收窄 ==");
const f1 = resolveModelFilter("2504", "CLAAS");
check('model=2504 brand=CLAAS 不含 雷沃', !f1.modelTerms.includes("雷沃 RG2504"));
check('model=2504 brand=CLAAS 含 CLAAS AXION 2504', f1.modelTerms.includes("CLAAS AXION 2504"));
check('brand=CLAAS brandTerms 含 AXION（双通道）', f1.brandTerms.includes("AXION"));
const f2 = resolveModelFilter("2504", undefined);
check('model=2504 无 brand 含全部官方', f2.modelTerms.includes("雷沃 RG2504") && f2.modelTerms.includes("CLAAS AXION 2504"));
check('无 brand 时 brandTerms 为空（不限品牌）', f2.brandTerms.length === 0);

console.log("== 6) resolveBrandKey 归一 ==");
check('"克拉斯" → claas', resolveBrandKey("克拉斯") === "claas");
check('"纽荷兰" → new_holland', resolveBrandKey("纽荷兰") === "new_holland");
check('"NH" → new_holland', resolveBrandKey("NH") === "new_holland");
check('"洋马" → yanmar', resolveBrandKey("洋马") === "yanmar");
check('合并串 "CLAAS/New Holland" 歧义 → null', resolveBrandKey("CLAAS/New Holland") === null);
check('未知品牌 → null', resolveBrandKey("随便一个牌子") === null);

console.log("== 7) source-catalog 派生 ==");
check('channel(domestic_websearch) → websearch', channel("domestic_websearch") === "websearch");
check('channel(domestic_x) → crawler', channel("domestic_x") === "crawler");
check('channel(manual_x) → manual', channel("manual_x") === "manual");
check('channel(未知) 兜底 → crawler', channel("legacy") === "crawler");
check('rowKind(manual_x) → dealer', rowKind("manual_x") === "dealer");
check('rowKind(domestic_x) → listing', rowKind("domestic_x") === "listing");
check('derivePlatform 剥 www', derivePlatform("https://www.nongji360.com/a") === "nongji360.com");
check('derivePlatform 无 host → ""', derivePlatform("not a url") === "");
check('derivePlatform 空串 → ""', derivePlatform("") === "");

if (failures > 0) {
  console.error(`\nFAILED: ${failures} 条断言未通过`);
  process.exit(1);
}
console.log("\nALL PASSED");
