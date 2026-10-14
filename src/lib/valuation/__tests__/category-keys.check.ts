/**
 * 品类键修复回归检查（2026-10-15）
 *
 * 背景（两个 Bug）：
 * ① resolve-category.ts 的同义词表把青储类归一到「青贮机」——该名在 Category 表
 *    （canonical 名是「青贮饲料收获机」，code=forage_harvester）与估值表中均不存在，
 *    导致 AI 识别的新品挂不上 DB 品类、估值落 800,000 默认价、MODEL_BASE_PRICES
 *    品类一致性检查失效（如 Jaguar 980 丢 350 万型号价）。
 * ② 估值页国产下拉 15 个品类中 10 个在 CATEGORY_BASE_PRICES / CATEGORY_MAPPING /
 *    SUBSIDY_CATEGORY_PRICES 中全部无键，无马力机器一律落 800,000 默认价。
 *
 * 本脚本为纯计算回归（除同义词 Prompt 外不需要数据库）：
 *   - getCategorySynonymPrompt 需要 @/lib/db（import 时校验 DATABASE_URL），
 *     故用动态 import + 兜底 dummy URL（不实际连接）。
 *
 * 运行：./node_modules/.bin/tsx src/lib/valuation/__tests__/category-keys.check.ts
 */

// @/lib/db 在模块加载时即校验 DATABASE_URL；给个不连接的 dummy 值（仅同义词 Prompt 需要）
process.env.DATABASE_URL ||= "postgresql://dummy:dummy@127.0.0.1:5432/dummy";

import {
  calcCombinedDepreciation,
  calculateValuation,
  calculateValuationV4,
} from "../formulas";

const CURRENT_YEAR = 2026;

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ❌ FAIL: ${message}`);
  }
}

async function main() {
  // ═══════════════════════════════════════════════════════════════
  console.log("【A】resolve-category 同义词目标（Bug ①）");
  // ═══════════════════════════════════════════════════════════════
  const { getCategorySynonymPrompt } = await import(
    "../../agents/seller-helper/resolve-category"
  );
  const synPrompt = getCategorySynonymPrompt();
  assert(
    synPrompt.includes('标准名: "青贮饲料收获机"'),
    "同义词标准名应为「青贮饲料收获机」（Category 表 canonical 名，code=forage_harvester）"
  );
  assert(
    !synPrompt.includes('标准名: "青贮机"'),
    "不得再归一到三不沾的「青贮机」（Category 表/估值表均无此键）"
  );
  assert(
    synPrompt.includes("forage harvester"),
    "英文同义词（forage harvester）应仍在同义词表中"
  );

  // ═══════════════════════════════════════════════════════════════
  console.log("\n【B】DB canonical 名估值不再落 80 万默认价（Bug ①）");
  // ═══════════════════════════════════════════════════════════════
  const jagInput = {
    brand: "CLAAS",
    modelName: "JAGUAR 980",
    year: 2018,
    condition: "good",
    workingHours: 2000,
  };
  const canonical = await calculateValuationV4({ ...jagInput, category: "青贮饲料收获机" });
  const brokenName = await calculateValuationV4({ ...jagInput, category: "青贮机" });
  console.log(
    `  ℹ️  CLAAS JAGUAR 980(2018/2000h)：canonical=¥${canonical.estimatedValue.toLocaleString()}  broken「青贮机」=¥${brokenName.estimatedValue.toLocaleString()}`
  );
  assert(
    canonical.estimatedValue > brokenName.estimatedValue * 2,
    `canonical 名估值(${canonical.estimatedValue}) 应显著高于坏名(${brokenName.estimatedValue})——350万型号价 vs 80万默认价（期望≈4倍）`
  );
  assert(
    canonical.estimatedValue > 800000,
    `canonical 名估值(${canonical.estimatedValue}) 应达到 350 万型号价量级（>80万）`
  );

  // ═══════════════════════════════════════════════════════════════
  console.log("\n【C】国产下拉品类：无马力机器不再落 80 万默认价（Bug ②）");
  // ═══════════════════════════════════════════════════════════════
  // 12 个修复对象：10 个原本全表无键 + 谷物联合收割机/玉米收获机（原缺补贴映射）
  const fixedCategories = [
    "单粒精密播种机", "穴播机", "条播机", "犁", "秸秆粉碎还田机",
    "花生收获机", "微型耕耘机", "田园管理机", "饲料粉碎机", "辅助驾驶系统设备",
    "谷物联合收割机", "玉米收获机",
  ];
  for (const category of fixedCategories) {
    const r = await calculateValuation({
      brand: "东方红",
      category,
      modelName: "", // 空串：不触发型号匹配，专测品类回退路径
      year: 2021, // 5年机龄
      condition: "good",
      // 不传 enginePower / workingHours —— 专门打"无马力回退路径"
    });
    assert(
      r.estimatedValue > 500 && r.estimatedValue < 200000,
      `「${category}」无马力估值 ¥${r.estimatedValue.toLocaleString()} 应落在合理区间(500~20万)，而非 80 万默认价量级`
    );
  }
  // 对照组：垃圾品类名必须仍然落到 80 万默认价量级（证明上面的断言非空转）
  const garbage = await calculateValuation({
    brand: "东方红",
    category: "不存在的品类XYZ",
    modelName: "",
    year: 2021,
    condition: "good",
  });
  console.log(`  ℹ️  对照组「不存在的品类XYZ」= ¥${garbage.estimatedValue.toLocaleString()}（80万默认价量级）`);
  assert(
    garbage.estimatedValue > 200000,
    `对照组垃圾品类(${garbage.estimatedValue}) 应仍在 80 万默认价量级（>20万，为修复品类最高值的2倍以上）——证明 C 组断言有效区分`
  );

  // ═══════════════════════════════════════════════════════════════
  console.log("\n【D】新品类工时合成三态（Bug ② 配套：CATEGORY_ANNUAL_HOURS）");
  // ═══════════════════════════════════════════════════════════════
  const cases: Array<{ category: string; expected: "synthesized" | "none"; hours: number | null; note: string }> = [
    { category: "穴播机", expected: "synthesized", hours: 1400, note: "类比播种机 280h/年 × 5年" },
    { category: "条播机", expected: "synthesized", hours: 1400, note: "同上" },
    { category: "单粒精密播种机", expected: "synthesized", hours: 1400, note: "同上" },
    { category: "花生收获机", expected: "synthesized", hours: 1500, note: "类比收获机 300h/年 × 5年" },
    { category: "田园管理机", expected: "synthesized", hours: 1000, note: "估算 200h/年 × 5年" },
    { category: "青贮饲料收获机", expected: "synthesized", hours: 1750, note: "350h/年 × 5年（既有键，回归保护）" },
    { category: "犁", expected: "none", hours: null, note: "无动力农具，禁合成" },
    { category: "秸秆粉碎还田机", expected: "none", hours: null, note: "无自带动力，禁合成" },
    { category: "微型耕耘机", expected: "none", hours: null, note: "类比微耕机，禁合成" },
    { category: "饲料粉碎机", expected: "none", hours: null, note: "类比饲料加工机，禁合成" },
    { category: "辅助驾驶系统设备", expected: "none", hours: null, note: "电子设备，禁合成" },
  ];
  for (const c of cases) {
    const dep = calcCombinedDepreciation(undefined, 2021, CURRENT_YEAR, c.category);
    const ok = dep.hoursSource === c.expected && dep.effectiveHours === c.hours;
    assert(
      ok,
      `「${c.category}」缺工时 → src=${dep.hoursSource} eff=${dep.effectiveHours}（期望 ${c.expected}/${c.hours}，${c.note}）`
    );
  }

  // ═══════════════════════════════════════════════════════════════
  console.log("\n【E】既有品类口径不动（回归保护）");
  // ═══════════════════════════════════════════════════════════════
  const t = calcCombinedDepreciation(1600, 2022, CURRENT_YEAR, "轮式拖拉机");
  assert(
    t.hoursSource === "actual" && t.effectiveHours === 1600,
    `轮式拖拉机传入真实工时 → actual/1600（实得 ${t.hoursSource}/${t.effectiveHours}）`
  );
  const b = calcCombinedDepreciation(undefined, 2021, CURRENT_YEAR, "打捆机");
  assert(
    b.hoursSource === "none" && b.effectiveHours === null,
    `打捆机缺工时 → none（无工时表品类，实得 ${b.hoursSource}/${b.effectiveHours}）`
  );
  const qc = calcCombinedDepreciation(undefined, 2021, CURRENT_YEAR, "青储机");
  assert(
    qc.hoursSource === "synthesized" && qc.effectiveHours === 1750,
    `「青储机」（估值表旧键）缺工时 → synthesized/1750（实得 ${qc.hoursSource}/${qc.effectiveHours}）`
  );
  // 旧键与新 canonical 名估值口径一致性：同输入同输出
  const oldKey = await calculateValuation({
    brand: "CLAAS", category: "青储机", modelName: "JAGUAR 980",
    year: 2018, condition: "good", workingHours: 2000,
  });
  assert(
    Math.abs(oldKey.estimatedValue - canonical.estimatedValue) < 1,
    `「青储机」旧键(${oldKey.estimatedValue}) 与「青贮饲料收获机」新键(${canonical.estimatedValue}) 估值应完全一致`
  );

  // ═══════════════════════════════════════════════════════════════
  console.log("\n══════════════════════════════════════════════");
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  if (failed > 0) {
    console.log("失败项:");
    failures.forEach((f) => console.log(`  ❌ ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("检查脚本异常:", e);
  process.exit(1);
});
