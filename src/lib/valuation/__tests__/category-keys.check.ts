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
 *
 * 2026-10-15 新增【F】组：国际品牌 P2 长尾补齐回归——
 *   引擎 BRAND_COEFFICIENTS 新增 Zetor/MTZ/Rostselmash/Sampo/Jacto/Iseki/
 *   Mitsubishi/BCS/Goldoni/Vermeer/Valtra（此前走 0.85 兜底）；页面两张国际
 *   品牌表按引擎值补齐；EXPORT_COUNTRIES 扩至六大区域 58 国并分组渲染。
 *   "罗斯特"（国产青储机 0.45）与 Rostselmash（俄系收割机 0.88）撞名保护。
 */

// @/lib/db 在模块加载时即校验 DATABASE_URL；给个不连接的 dummy 值（仅同义词 Prompt 需要）
process.env.DATABASE_URL ||= "postgresql://dummy:dummy@127.0.0.1:5432/dummy";

import fs from "node:fs";
import path from "node:path";
import {
  calcCombinedDepreciation,
  calculateValuation,
  calculateValuationV4,
} from "../formulas";
import { BRAND_COEFFICIENTS } from "../brand-data";

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
  console.log("\n【F】国际品牌 P2 长尾补齐 + 页面表/出口国一致性（2026-10-15）");
  // ═══════════════════════════════════════════════════════════════

  // F1 引擎精确值（11 个新英文键 + 8 个中文别名）
  const P2_EXPECTED: Record<string, number> = {
    "Zetor": 0.90, "MTZ": 0.85, "Rostselmash": 0.88, "Sampo": 0.95,
    "Jacto": 0.85, "Iseki": 0.90, "Mitsubishi": 0.90, "BCS": 0.90,
    "Goldoni": 0.92, "Vermeer": 0.95, "Valtra": 1.10,
  };
  const P2_ALIASES: Record<string, number> = {
    "泽特": 0.90, "明斯克": 0.85, "雅克托": 0.85, "井关": 0.90,
    "三菱": 0.90, "戈尔多尼": 0.92, "弗米尔": 0.95, "维尔特拉": 1.10,
  };
  for (const [k, v] of Object.entries(P2_EXPECTED)) {
    assert(
      BRAND_COEFFICIENTS[k] === v,
      `引擎「${k}」系数应为 ${v}（实得 ${BRAND_COEFFICIENTS[k]}）`
    );
  }
  for (const [k, v] of Object.entries(P2_ALIASES)) {
    assert(
      BRAND_COEFFICIENTS[k] === v,
      `引擎中文别名「${k}」系数应为 ${v}（实得 ${BRAND_COEFFICIENTS[k]}）`
    );
  }
  // 撞名保护：国产青储机「罗斯特」0.45 与俄系 Rostselmash 0.88 必须并存且互不污染
  assert(
    BRAND_COEFFICIENTS["罗斯特"] === 0.45,
    `「罗斯特」（国产青储机）应保持 0.45（实得 ${BRAND_COEFFICIENTS["罗斯特"]}）`
  );
  assert(
    BRAND_COEFFICIENTS["Rostselmash"] === 0.88,
    `Rostselmash（俄系收割机）应为 0.88（实得 ${BRAND_COEFFICIENTS["Rostselmash"]}）`
  );

  // F2 端到端：calculateValuation 品牌系数取配置值，不再静默走 0.85 兜底
  for (const [brand, expected] of Object.entries(P2_EXPECTED)) {
    const r = await calculateValuation({
      brand, category: "轮式拖拉机", modelName: "",
      year: 2018, condition: "good", workingHours: 2000,
    });
    assert(
      r.brandFactor === expected,
      `calculateValuation(${brand}).brandFactor 应为 ${expected}，实得 ${r.brandFactor}（不得走 0.85 兜底）`
    );
  }
  const luo = await calculateValuation({
    brand: "罗斯特", category: "青贮饲料收获机", modelName: "",
    year: 2018, condition: "good", workingHours: 2000,
  });
  assert(
    luo.brandFactor === 0.45,
    `calculateValuation(罗斯特).brandFactor 应仍为国产 0.45（实得 ${luo.brandFactor}，防 Rostselmash 污染）`
  );
  // 对照组：未知国际品牌仍走 0.85 兜底（证明 F2 断言有效区分）
  const unknown = await calculateValuation({
    brand: "NoSuchBrandXYZ", category: "轮式拖拉机", modelName: "",
    year: 2018, condition: "good", workingHours: 2000,
  });
  assert(
    unknown.brandFactor === 0.85,
    `对照组未知品牌应仍走 0.85 兜底（实得 ${unknown.brandFactor}）`
  );

  // F3 页面两张国际品牌表：引擎全部英文键必须在表内（源码级一致性）
  const pageSrc = fs.readFileSync(
    path.join(__dirname, "../../../app/[locale]/services/valuation/page.tsx"),
    "utf8"
  );
  const extractBlock = (src: string, name: string): string => {
    const m = src.match(new RegExp(`const ${name}[^{]*\\{([\\s\\S]*?)\\n\\};`));
    return m ? m[1] : "";
  };
  const coeffSrc = extractBlock(pageSrc, "INTL_BRAND_COEFFICIENTS");
  const retentionSrc = extractBlock(pageSrc, "INTL_BRAND_RETENTION");
  assert(coeffSrc.length > 0, "应能提取页面 INTL_BRAND_COEFFICIENTS 代码块");
  assert(retentionSrc.length > 0, "应能提取页面 INTL_BRAND_RETENTION 代码块");
  const engineIntlKeys = Object.keys(BRAND_COEFFICIENTS).filter(
    (b) => !/[\u4e00-\u9fa5]/.test(b) && b !== "进口"
  );
  for (const key of engineIntlKeys) {
    assert(coeffSrc.includes(`"${key}"`), `页面 INTL_BRAND_COEFFICIENTS 应含引擎键「${key}」`);
    assert(retentionSrc.includes(`"${key}"`), `页面 INTL_BRAND_RETENTION 应含引擎键「${key}」`);
  }
  // 既有 9 项页面历史口径不变（additive-only 回归保护）
  const pageLegacy9: Record<string, string> = {
    "John Deere": '"John Deere": 1.15', "Kubota": '"Kubota": 1.10',
    "Fendt": '"Fendt": 1.085', "CLAAS": '"CLAAS": 1.08',
    "Case IH": '"Case IH": 1.00', "New Holland": '"New Holland": 0.95',
    "Massey Ferguson": '"Massey Ferguson": 0.92', "Valtra": '"Valtra": 0.90',
    "其他国际": '"其他国际": 0.95',
  };
  for (const [k, lit] of Object.entries(pageLegacy9)) {
    assert(
      coeffSrc.includes(lit) && retentionSrc.includes(lit),
      `页面既有 9 项「${k}」历史口径应保持不变（${lit}）`
    );
  }

  // F4 出口国家：六大区域分组与 EXPORT_COUNTRIES 键一一对应 + 既有 19 国系数不变
  const mapSrc = extractBlock(pageSrc, "EXPORT_COUNTRIES");
  assert(mapSrc.length > 0, "应能提取页面 EXPORT_COUNTRIES 代码块");
  const groupsSrcMatch = pageSrc.match(/const EXPORT_REGION_GROUPS[\s\S]*?\n\];/);
  assert(!!groupsSrcMatch, "页面应定义 EXPORT_REGION_GROUPS（下拉分组渲染）");
  const groupsSrc = groupsSrcMatch ? groupsSrcMatch[0] : "";
  const mapCountries = new Set(
    [...mapSrc.matchAll(/"([^"]+)":\s*\{\s*buy:\s*[\d.]+,\s*sell:\s*[\d.]+/g)].map((m) => m[1])
  );
  const grouped = new Set<string>();
  for (const gm of groupsSrc.matchAll(/countries:\s*\[([^\]]+)\]/g)) {
    for (const cm of gm[1].matchAll(/"([^"]+)"/g)) grouped.add(cm[1]);
  }
  assert(mapCountries.size >= 50, `出口国家应覆盖六大区域 ≥50 国（实得 ${mapCountries.size}）`);
  assert(
    grouped.size === mapCountries.size && [...grouped].every((c) => mapCountries.has(c)),
    `分组国家(${grouped.size}) 与 EXPORT_COUNTRIES 键(${mapCountries.size}) 应一一对应、无孤儿`
  );
  for (const region of ["中东欧与巴尔干", "俄语区与中亚", "南美", "非洲", "东南亚与南亚", "中东"]) {
    assert(groupsSrc.includes(`"${region}"`), `出口分组应含区域「${region}」`);
  }
  // 既有 19 国 buy/sell 系数回归保护
  const legacy19: Record<string, string> = {
    "阿根廷": '"阿根廷": { buy: 0.75, sell: 1.40 }', "尼日利亚": '"尼日利亚": { buy: 0.70, sell: 1.50 }',
    "俄罗斯": '"俄罗斯": { buy: 0.85, sell: 1.25 }', "泰国": '"泰国": { buy: 0.80, sell: 1.30 }',
    "哈萨克斯坦": '"哈萨克斯坦": { buy: 0.82, sell: 1.28 }', "乌兹别克斯坦": '"乌兹别克斯坦": { buy: 0.82, sell: 1.28 }',
    "南非": '"南非": { buy: 0.75, sell: 1.35 }', "肯尼亚": '"肯尼亚": { buy: 0.72, sell: 1.45 }',
    "加纳": '"加纳": { buy: 0.72, sell: 1.45 }', "巴西": '"巴西": { buy: 0.78, sell: 1.35 }',
    "越南": '"越南": { buy: 0.80, sell: 1.32 }', "菲律宾": '"菲律宾": { buy: 0.80, sell: 1.32 }',
    "缅甸": '"缅甸": { buy: 0.75, sell: 1.40 }', "柬埔寨": '"柬埔寨": { buy: 0.75, sell: 1.40 }',
    "巴基斯坦": '"巴基斯坦": { buy: 0.78, sell: 1.35 }', "伊朗": '"伊朗": { buy: 0.80, sell: 1.30 }',
    "伊拉克": '"伊拉克": { buy: 0.80, sell: 1.30 }', "沙特阿拉伯": '"沙特阿拉伯": { buy: 0.85, sell: 1.25 }',
    "阿联酋": '"阿联酋": { buy: 0.85, sell: 1.25 }',
  };
  for (const [c, lit] of Object.entries(legacy19)) {
    assert(mapSrc.includes(lit), `既有出口国「${c}」系数应保持不变（${lit}）`);
  }

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
