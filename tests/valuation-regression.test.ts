/**
 * QA回归测试 — AI智能估值引擎品类基准价修复
 * 测试范围：
 *   1. 核心Bug修复验证（纽荷兰5070估值从42.2万降到5-10万）
 *   2. 其他打捆机估值合理性
 *   3. 其他品类不受影响
 *   4. 型号匹配边界
 */

import {
  calculateValuation,
  formatValuationMoney,
  type ValuationInput,
  type ValuationResult,
} from "../src/lib/valuation/formulas";

import {
  BRAND_COEFFICIENTS,
  CATEGORY_BASE_PRICES,
  MODEL_BASE_PRICES,
  DEFAULT_BRAND_COEFFICIENT,
  CONDITION_FACTORS,
  DEPRECIATION_TABLE,
  HOURS_PARAMS,
  MARKET_FACTOR_RANGE,
  MIN_RESIDUAL_RATIO,
} from "../src/lib/valuation/brand-data";

// ============================================================
// 简易测试框架
// ============================================================
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: { name: string; expected: string; actual: string; detail?: string }[] = [];

function assert(condition: boolean, name: string, expected?: string, actual?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ ${name}`);
  } else {
    failedTests++;
    const failEntry = { name, expected: expected || "", actual: actual || "" };
    failures.push(failEntry);
    console.log(`  ❌ ${name} — Expected: ${expected}, Got: ${actual}`);
  }
}

function assertInRange(value: number, low: number, high: number, name: string) {
  const inRange = value >= low && value <= high;
  totalTests++;
  if (inRange) {
    passedTests++;
    console.log(`  ✅ ${name} — ${value} ∈ [${low}, ${high}]`);
  } else {
    failedTests++;
    const failEntry = { name, expected: `[${low}, ${high}]`, actual: String(value) };
    failures.push(failEntry);
    console.log(`  ❌ ${name} — ${value} ∉ [${low}, ${high}]`);
  }
}

const currentYear = new Date().getFullYear();

// ============================================================
// 辅助：计算年份折旧因子（与源码一致，用于交叉验证）
// ============================================================
function calcYearFactor(year: number): number {
  const age = currentYear - year;
  if (age <= 0) return 1.0;
  let remaining = 1.0;
  let yearsLeft = Math.min(age, 3);
  remaining -= yearsLeft * DEPRECIATION_TABLE[0].rate;
  if (age > 3) {
    yearsLeft = Math.min(age - 3, 4);
    remaining -= yearsLeft * DEPRECIATION_TABLE[1].rate;
  }
  if (age > 7) {
    yearsLeft = Math.min(age - 7, 5);
    remaining -= yearsLeft * DEPRECIATION_TABLE[2].rate;
  }
  if (age > 12) {
    yearsLeft = age - 12;
    remaining -= yearsLeft * DEPRECIATION_TABLE[3].rate;
  }
  return Math.max(remaining, MIN_RESIDUAL_RATIO);
}

// ============================================================
// 测试1：核心Bug修复验证 — 纽荷兰5070（2013款）
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试1：核心Bug修复验证 — 纽荷兰5070（2013款）");
console.log("═══════════════════════════════════════════════");

const nh5070Input: ValuationInput = {
  brand: "纽荷兰",
  modelName: "5070",
  category: "打捆机",
  year: 2013,
  condition: "good",
};

const nh5070Result = calculateValuation(nh5070Input);

// 基准价应为20万（小方捆），不是120万（打捆机默认）
assert(
  nh5070Result.basePrice === 200000 * 1.10,
  "纽荷兰5070 基准价 = 小方捆20万 × 纽荷兰系数1.10 = 22万",
  `${200000 * 1.10}`,
  `${nh5070Result.basePrice}`
);

// 品牌系数应为1.10
assert(
  nh5070Result.brandFactor === 1.10,
  "纽荷兰5070 品牌系数 = 1.10",
  "1.10",
  `${nh5070Result.brandFactor}`
);

// 年份折旧：2013 → 13年 → 计算剩余比率
const nh5070ExpectedYearFactor = calcYearFactor(2013);
assert(
  Math.abs(nh5070Result.yearFactor - nh5070ExpectedYearFactor) < 0.001,
  `纽荷兰5070 年份因子 = ${nh5070ExpectedYearFactor.toFixed(4)} (13年折旧)`,
  `${nh5070ExpectedYearFactor.toFixed(4)}`,
  `${nh5070Result.yearFactor.toFixed(4)}`
);

// 最终估值应在5-10万区间（这是核心Bug修复验证）
const nh5070Wan = nh5070Result.estimatedValue / 10000;
assertInRange(
  nh5070Wan,
  5,
  10,
  "纽荷兰5070(2013) 最终估值应在5-10万区间"
);

// 验证不再是之前的42.2万
assert(
  nh5070Wan < 20,
  "纽荷兰5070(2013) 估值不再是旧值42.2万级别（<20万）",
  "< 20万",
  `${nh5070Wan.toFixed(1)}万`
);

console.log(`  ℹ️  纽荷兰5070(2013) 详细估值: ¥${nh5070Wan.toFixed(1)}万 (区间: ¥${(nh5070Result.priceRange.low / 10000).toFixed(1)}万 ~ ¥${(nh5070Result.priceRange.high / 10000).toFixed(1)}万)`);

// ============================================================
// 测试2：其他打捆机估值合理性
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试2：其他打捆机估值合理性");
console.log("═══════════════════════════════════════════════");

// 克拉斯5300RC (2020)
const claas5300_2020: ValuationInput = {
  brand: "克拉斯",
  modelName: "5300RC",
  category: "打捆机",
  year: 2020,
  condition: "good",
};
const claas5300_2020_result = calculateValuation(claas5300_2020);
const claas5300_2020_wan = claas5300_2020_result.estimatedValue / 10000;

assert(
  claas5300_2020_result.basePrice === 800000 * 1.30,
  "克拉斯5300RC 基准价 = 大方捆80万 × 克拉斯系数1.30 = 104万",
  `${800000 * 1.30}`,
  `${claas5300_2020_result.basePrice}`
);

assertInRange(
  claas5300_2020_wan,
  50,
  80,
  "克拉斯5300RC(2020) 估值应在50-80万区间"
);

console.log(`  ℹ️  克拉斯5300RC(2020) 详细估值: ¥${claas5300_2020_wan.toFixed(1)}万`);

// 克拉斯5300RC (2022) — 估值应接近95万报价
const claas5300_2022: ValuationInput = {
  brand: "克拉斯",
  modelName: "5300RC",
  category: "打捆机",
  year: 2022,
  condition: "good",
  priceCny: 950000, // 卖家报价95万
};
const claas5300_2022_result = calculateValuation(claas5300_2022);
const claas5300_2022_wan = claas5300_2022_result.estimatedValue / 10000;

assertInRange(
  claas5300_2022_wan,
  65,
  100,
  "克拉斯5300RC(2022) 估值应在65-100万区间（接近95万报价）"
);

console.log(`  ℹ️  克拉斯5300RC(2022) 详细估值: ¥${claas5300_2022_wan.toFixed(1)}万`);

// 纽荷兰870 (2013) — 大方捆
const nh870_2013: ValuationInput = {
  brand: "纽荷兰",
  modelName: "870",
  category: "打捆机",
  year: 2013,
  condition: "good",
};
const nh870_2013_result = calculateValuation(nh870_2013);
const nh870_2013_wan = nh870_2013_result.estimatedValue / 10000;

assert(
  nh870_2013_result.basePrice === 650000 * 1.10,
  "纽荷兰870 基准价 = 大方捆870型号65万 × 纽荷兰系数1.10 = 71.5万",
  `${650000 * 1.10}`,
  `${nh870_2013_result.basePrice}`
);

assertInRange(
  nh870_2013_wan,
  15,
  25,
  "纽荷兰870(2013) 估值应在15-25万区间"
);

console.log(`  ℹ️  纽荷兰870(2013) 详细估值: ¥${nh870_2013_wan.toFixed(1)}万`);

// ============================================================
// 测试3：其他品类不受影响
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试3：其他品类不受影响");
console.log("═══════════════════════════════════════════════");

// 青储机 — 克拉斯Jaguar 970
const jaguar970: ValuationInput = {
  brand: "克拉斯",
  modelName: "970",
  category: "青储机",
  year: 2020,
  condition: "good",
};
const jaguar970_result = calculateValuation(jaguar970);

assert(
  jaguar970_result.basePrice === 2800000 * 1.30,
  "青储机(970) 基准价 = 型号映射280万 × 克拉斯1.30 = 364万",
  `${2800000 * 1.30}`,
  `${jaguar970_result.basePrice}`
);

// 青储机估值应远高于打捆机
const jaguar970_wan = jaguar970_result.estimatedValue / 10000;
assert(
  jaguar970_wan > 100,
  "青储机(克拉斯Jaguar 970) 估值应>100万",
  "> 100万",
  `${jaguar970_wan.toFixed(1)}万`
);

console.log(`  ℹ️  克拉斯Jaguar 970(2020) 详细估值: ¥${jaguar970_wan.toFixed(1)}万`);

// 割草机
const mower: ValuationInput = {
  brand: "库恩",
  modelName: "FC313",
  category: "割草机",
  year: 2021,
  condition: "good",
};
const mower_result = calculateValuation(mower);
const mower_wan = mower_result.estimatedValue / 10000;

assert(
  mower_result.basePrice === 600000 * 1.00,
  "割草机 基准价 = 60万 × 库恩1.00 = 60万",
  `${600000 * 1.00}`,
  `${mower_result.basePrice}`
);

assertInRange(
  mower_wan,
  30,
  55,
  "割草机(库恩FC313 2021) 估值应在30-55万区间"
);

console.log(`  ℹ️  库恩FC313(2021) 详细估值: ¥${mower_wan.toFixed(1)}万`);

// 裹包机
const wrapper: ValuationInput = {
  brand: "库恩",
  modelName: "RW1812",
  category: "裹包机",
  year: 2022,
  condition: "good",
};
const wrapper_result = calculateValuation(wrapper);
const wrapper_wan = wrapper_result.estimatedValue / 10000;

assert(
  wrapper_result.basePrice === 300000 * 1.00,
  "裹包机 基准价 = 30万 × 库恩1.00 = 30万",
  `${300000 * 1.00}`,
  `${wrapper_result.basePrice}`
);

assertInRange(
  wrapper_wan,
  18,
  30,
  "裹包机(库恩RW1812 2022) 估值应在18-30万区间"
);

console.log(`  ℹ️  库恩RW1812(2022) 详细估值: ¥${wrapper_wan.toFixed(1)}万`);

// ============================================================
// 测试4：型号匹配边界
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试4：型号匹配边界");
console.log("═══════════════════════════════════════════════");

// modelName="5070" 应匹配 MODEL_BASE_PRICES["5070"]
const model5070: ValuationInput = {
  brand: "纽荷兰",
  modelName: "5070",
  category: "打捆机",
  year: 2020,
  condition: "good",
};
const model5070_result = calculateValuation(model5070);
assert(
  model5070_result.basePrice === 200000 * 1.10,
  'modelName="5070" 匹配 MODEL_BASE_PRICES["5070"] → 小方捆20万',
  `${200000 * 1.10}`,
  `${model5070_result.basePrice}`
);

// modelName="9YDB-0.5" 应匹配 MODEL_BASE_PRICES["9YDB"]
const model9YDB: ValuationInput = {
  brand: "东方红",
  modelName: "9YDB-0.5",
  category: "打捆机",
  year: 2022,
  condition: "good",
};
const model9YDB_result = calculateValuation(model9YDB);
assert(
  model9YDB_result.basePrice === 80000 * 0.65,
  'modelName="9YDB-0.5" 匹配 MODEL_BASE_PRICES["9YDB"] → 小方捆8万',
  `${80000 * 0.65}`,
  `${model9YDB_result.basePrice}`
);

// modelName="890大方捆" 应匹配 MODEL_BASE_PRICES["890"]
const model890: ValuationInput = {
  brand: "纽荷兰",
  modelName: "890大方捆",
  category: "打捆机",
  year: 2021,
  condition: "good",
};
const model890_result = calculateValuation(model890);
assert(
  model890_result.basePrice === 700000 * 1.10,
  'modelName="890大方捆" 匹配 MODEL_BASE_PRICES["890"] → 大方捆70万',
  `${700000 * 1.10}`,
  `${model890_result.basePrice}`
);

// 无匹配的型号应回退到品类默认价
const unknownModel: ValuationInput = {
  brand: "纽荷兰",
  modelName: "未知型号XYZ",
  category: "打捆机",
  year: 2020,
  condition: "good",
};
const unknownModel_result = calculateValuation(unknownModel);
assert(
  unknownModel_result.basePrice === 1200000 * 1.10,
  '无匹配型号回退到品类"打捆机"默认价120万',
  `${1200000 * 1.10}`,
  `${unknownModel_result.basePrice}`
);

// 子品类名称匹配测试：category="小方捆" 不带型号
const smallBaleCat: ValuationInput = {
  brand: "纽荷兰",
  modelName: "",
  category: "小方捆",
  year: 2020,
  condition: "good",
};
const smallBaleCat_result = calculateValuation(smallBaleCat);
assert(
  smallBaleCat_result.basePrice === 200000 * 1.10,
  'category="小方捆" 无型号 → 匹配品类小方捆20万',
  `${200000 * 1.10}`,
  `${smallBaleCat_result.basePrice}`
);

// 子品类名称匹配测试：category="大方捆" 不带型号
const bigBaleCat: ValuationInput = {
  brand: "克拉斯",
  modelName: "",
  category: "大方捆",
  year: 2020,
  condition: "good",
};
const bigBaleCat_result = calculateValuation(bigBaleCat);
assert(
  bigBaleCat_result.basePrice === 800000 * 1.30,
  'category="大方捆" 无型号 → 匹配品类大方捆80万 × 1.30',
  `${800000 * 1.30}`,
  `${bigBaleCat_result.basePrice}`
);

// ============================================================
// 测试5：数据完整性验证
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试5：数据完整性验证");
console.log("═══════════════════════════════════════════════");

// MODEL_BASE_PRICES 应包含关键型号
assert(
  "5070" in MODEL_BASE_PRICES,
  'MODEL_BASE_PRICES 包含 "5070" 键',
  "true",
  `"5070" in MODEL_BASE_PRICES = ${"5070" in MODEL_BASE_PRICES}`
);
assert(
  "5300RC" in MODEL_BASE_PRICES,
  'MODEL_BASE_PRICES 包含 "5300RC" 键',
  "true",
  `"5300RC" in MODEL_BASE_PRICES = ${"5300RC" in MODEL_BASE_PRICES}`
);
assert(
  "870" in MODEL_BASE_PRICES,
  'MODEL_BASE_PRICES 包含 "870" 键',
  "true",
  `"870" in MODEL_BASE_PRICES = ${"870" in MODEL_BASE_PRICES}`
);
assert(
  "9YDB" in MODEL_BASE_PRICES,
  'MODEL_BASE_PRICES 包含 "9YDB" 键',
  "true",
  `"9YDB" in MODEL_BASE_PRICES = ${"9YDB" in MODEL_BASE_PRICES}`
);

// 子品类基准价应存在于 CATEGORY_BASE_PRICES
assert(
  "小方捆" in CATEGORY_BASE_PRICES && CATEGORY_BASE_PRICES["小方捆"] === 20,
  'CATEGORY_BASE_PRICES["小方捆"] = 20万',
  "20",
  `${CATEGORY_BASE_PRICES["小方捆"]}`
);
assert(
  "大方捆" in CATEGORY_BASE_PRICES && CATEGORY_BASE_PRICES["大方捆"] === 80,
  'CATEGORY_BASE_PRICES["大方捆"] = 80万',
  "80",
  `${CATEGORY_BASE_PRICES["大方捆"]}`
);
assert(
  "圆捆机" in CATEGORY_BASE_PRICES && CATEGORY_BASE_PRICES["圆捆机"] === 120,
  'CATEGORY_BASE_PRICES["圆捆机"] = 120万',
  "120",
  `${CATEGORY_BASE_PRICES["圆捆机"]}`
);

// 所有 MODEL_BASE_PRICES 条目应有 category 和 basePrice
let allModelEntriesValid = true;
for (const [key, val] of Object.entries(MODEL_BASE_PRICES)) {
  if (!val.category || !val.basePrice || val.basePrice <= 0) {
    console.log(`    ⚠️  MODEL_BASE_PRICES["${key}"] 无效: ${JSON.stringify(val)}`);
    allModelEntriesValid = false;
  }
}
assert(allModelEntriesValid, "MODEL_BASE_PRICES 所有条目均含有效 category 和 basePrice", "true", `${allModelEntriesValid}`);

// ============================================================
// 测试6：估值结果结构完整性
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试6：估值结果结构完整性");
console.log("═══════════════════════════════════════════════");

const sampleResult = calculateValuation(nh5070Input);

assert(
  typeof sampleResult.estimatedValue === "number" && sampleResult.estimatedValue > 0,
  "estimatedValue 为正数",
  "> 0",
  `${sampleResult.estimatedValue}`
);
assert(
  typeof sampleResult.basePrice === "number" && sampleResult.basePrice > 0,
  "basePrice 为正数",
  "> 0",
  `${sampleResult.basePrice}`
);
assert(
  typeof sampleResult.brandFactor === "number" && sampleResult.brandFactor > 0,
  "brandFactor 为正数",
  "> 0",
  `${sampleResult.brandFactor}`
);
assert(
  typeof sampleResult.yearFactor === "number" && sampleResult.yearFactor > 0 && sampleResult.yearFactor <= 1,
  "yearFactor 在 (0, 1] 范围内",
  "(0, 1]",
  `${sampleResult.yearFactor}`
);
assert(
  typeof sampleResult.hoursFactor === "number" && sampleResult.hoursFactor > 0,
  "hoursFactor 为正数",
  "> 0",
  `${sampleResult.hoursFactor}`
);
assert(
  typeof sampleResult.conditionFactor === "number" && sampleResult.conditionFactor > 0,
  "conditionFactor 为正数",
  "> 0",
  `${sampleResult.conditionFactor}`
);
assert(
  typeof sampleResult.marketFactor === "number" && sampleResult.marketFactor > 0,
  "marketFactor 为正数",
  "> 0",
  `${sampleResult.marketFactor}`
);
assert(
  "low" in sampleResult.priceRange && "mid" in sampleResult.priceRange && "high" in sampleResult.priceRange,
  "priceRange 包含 low/mid/high",
  "true",
  `${"low" in sampleResult.priceRange && "mid" in sampleResult.priceRange && "high" in sampleResult.priceRange}`
);
assert(
  sampleResult.priceRange.low <= sampleResult.priceRange.mid && sampleResult.priceRange.mid <= sampleResult.priceRange.high,
  "priceRange: low ≤ mid ≤ high",
  "true",
  `${sampleResult.priceRange.low} ≤ ${sampleResult.priceRange.mid} ≤ ${sampleResult.priceRange.high}`
);
assert(
  Array.isArray(sampleResult.details) && sampleResult.details.length > 0,
  "details 为非空数组",
  "true",
  `${Array.isArray(sampleResult.details) && sampleResult.details.length > 0}`
);
assert(
  typeof sampleResult.analysis === "string" && sampleResult.analysis.length > 0,
  "analysis 为非空字符串",
  "true",
  `${typeof sampleResult.analysis === "string" && sampleResult.analysis.length > 0}`
);

// ============================================================
// 测试7：formatValuationMoney 辅助函数
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试7：formatValuationMoney 辅助函数");
console.log("═══════════════════════════════════════════════");

assert(
  formatValuationMoney(70000) === "¥7.0万",
  "formatValuationMoney(70000) = '¥7.0万'",
  "¥7.0万",
  formatValuationMoney(70000)
);
assert(
  formatValuationMoney(5000) === "¥5,000",
  "formatValuationMoney(5000) = '¥5,000'",
  "¥5,000",
  formatValuationMoney(5000)
);
assert(
  formatValuationMoney(100000) === "¥10.0万",
  "formatValuationMoney(100000) = '¥10.0万'",
  "¥10.0万",
  formatValuationMoney(100000)
);

// ============================================================
// 测试8：奥库DENS-X估值修复（V2核心Bug）
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试8：奥库DENS-X估值修复（V2核心Bug）");
console.log("═══════════════════════════════════════════════");

const orkelDensX: ValuationInput = {
  brand: "奥库",
  modelName: "DENS-X",
  category: "裹包机",
  year: 2019,
  condition: "good",
};
const orkelDensX_result = calculateValuation(orkelDensX);

assert(
  orkelDensX_result.brandFactor === 1.15,
  "奥库品牌系数 = 1.15（从0.85调高）",
  "1.15",
  `${orkelDensX_result.brandFactor}`
);

assert(
  orkelDensX_result.basePrice === 1600000 * 1.15,
  "奥库DENS-X 基准价 = 型号映射160万 × 奥库1.15 = 184万",
  `${1600000 * 1.15}`,
  `${orkelDensX_result.basePrice}`
);

const orkelDensX_wan = orkelDensX_result.estimatedValue / 10000;
assertInRange(
  orkelDensX_wan,
  80,
  150,
  "奥库DENS-X(2019) 估值应在80-150万区间（修复前仅15.6万）"
);

assert(
  orkelDensX_wan > 50,
  "奥库DENS-X 估值不再严重偏低（>50万，修复前15.6万）",
  "> 50万",
  `${orkelDensX_wan.toFixed(1)}万`
);

console.log(`  ℹ️  奥库DENS-X(2019) 详细估值: ¥${orkelDensX_wan.toFixed(1)}万`);

// ============================================================
// 测试9：5300RC key匹配Bug修复验证
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试9：5300RC key匹配Bug修复验证");
console.log("═══════════════════════════════════════════════");

const claas5300rc_check: ValuationInput = {
  brand: "克拉斯",
  modelName: "5300RC",
  category: "打捆机",
  year: 2022,
  condition: "good",
};
const claas5300rc_check_result = calculateValuation(claas5300rc_check);

assert(
  claas5300rc_check_result.basePrice === 800000 * 1.30,
  '5300RC 匹配 "5300RC"键 → 大方捆80万（不是"300"键15万）',
  `${800000 * 1.30}`,
  `${claas5300rc_check_result.basePrice}`
);

assert(
  claas5300rc_check_result.basePrice > 1000000,
  "5300RC 基准价 > 100万（确认未被300键误匹配为15万）",
  "> 100万",
  `${claas5300rc_check_result.basePrice}`
);

// ============================================================
// 测试10：牧农品牌系数修复
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试10：牧农品牌系数修复");
console.log("═══════════════════════════════════════════════");

const munongYT: ValuationInput = {
  brand: "牧农",
  modelName: "YT",
  category: "青储机",
  year: 2020,
  condition: "good",
};
const munongYT_result = calculateValuation(munongYT);

assert(
  munongYT_result.brandFactor === 0.45,
  "牧农品牌系数 = 0.45（不是默认0.85）",
  "0.45",
  `${munongYT_result.brandFactor}`
);

assert(
  munongYT_result.basePrice === 120000 * 0.45,
  "牧农YT 基准价 = 型号映射12万 × 牧农0.45 = 5.4万",
  `${120000 * 0.45}`,
  `${munongYT_result.basePrice}`
);

console.log(`  ℹ️  牧农YT(2020) 详细估值: ¥${(munongYT_result.estimatedValue / 10000).toFixed(1)}万`);

// ============================================================
// 测试11：新增品类验证
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试11：新增品类验证");
console.log("═══════════════════════════════════════════════");

// 单收 - 无型号，回退品类匹配
const danShou: ValuationInput = {
  brand: "废铁",
  modelName: "未知型号",
  category: "单收",
  year: 2024,
  condition: "good",
};
const danShou_result = calculateValuation(danShou);
assert(
  danShou_result.basePrice === 80000 * 0.30,
  '品类"单收" 无匹配型号 → 8万 × 废铁0.30 = 2.4万',
  `${80000 * 0.30}`,
  `${danShou_result.basePrice}`
);

// 甜菜机 - 无型号，回退品类匹配
const tianCai: ValuationInput = {
  brand: "艾美特",
  modelName: "未知型号",
  category: "甜菜机",
  year: 2023,
  condition: "good",
};
const tianCai_result = calculateValuation(tianCai);
assert(
  tianCai_result.basePrice === 300000 * 0.45,
  '品类"甜菜机" 无匹配型号 → 30万 × 艾美特0.45 = 13.5万',
  `${300000 * 0.45}`,
  `${tianCai_result.basePrice}`
);

// 伸缩臂夹包机 - 无型号，回退品类匹配
const shensuobi: ValuationInput = {
  brand: "曼尼通",
  modelName: "未知型号",
  category: "伸缩臂夹包机",
  year: 2021,
  condition: "good",
};
const shensuobi_result = calculateValuation(shensuobi);
assert(
  shensuobi_result.basePrice === 250000 * 1.10,
  '品类"伸缩臂夹包机" 无匹配型号 → 25万 × 曼尼通1.10 = 27.5万',
  `${250000 * 1.10}`,
  `${shensuobi_result.basePrice}`
);

// ============================================================
// 汇总报告
// ============================================================
console.log("\n═══════════════════════════════════════════════");
console.log("测试汇总");
console.log("═══════════════════════════════════════════════");
console.log(`  Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log(`  Coverage: 估算 ~85% (核心公式 + 数据映射 + 边界条件)`);

if (failures.length > 0) {
  console.log("\n  失败详情:");
  for (const f of failures) {
    console.log(`    ❌ ${f.name}`);
    console.log(`       Expected: ${f.expected}`);
    console.log(`       Actual:   ${f.actual}`);
  }
}

console.log("\n═══════════════════════════════════════════════");

// 退出码
process.exit(failedTests > 0 ? 1 : 0);
