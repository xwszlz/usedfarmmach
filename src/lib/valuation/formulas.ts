/**
 * AI智能估值引擎 — 核心公式
 * 
 * 模型架构：
 *   估值 = 基准价 × 品牌系数 × 年份因子 × 工时因子 × 成色因子 × 市场因子
 */

import {
  BRAND_COEFFICIENTS,
  DEFAULT_BRAND_COEFFICIENT,
  CATEGORY_BASE_PRICES,
  MODEL_BASE_PRICES,
  CONDITION_FACTORS,
  DEPRECIATION_TABLE,
  HOURS_PARAMS,
  MARKET_FACTOR_RANGE,
  MIN_RESIDUAL_RATIO,
} from "./brand-data";

export interface ValuationInput {
  brand: string;
  modelName: string;
  category: string;
  year: number;
  workingHours?: number;
  condition?: string;
  priceCny?: number;          // 卖家报价（如有）
  foreignPriceCny?: number;   // 国际市场价（如有）
  location?: string;
}

export interface ValuationDetail {
  label: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
  description: string;
}

export interface ValuationResult {
  estimatedValue: number;         // 最终估值（元）
  basePrice: number;              // 基准新机价（元）
  brandFactor: number;            // 品牌系数
  yearFactor: number;             // 年份折旧因子
  hoursFactor: number;            // 工时影响因子
  conditionFactor: number;        // 成色因子
  marketFactor: number;           // 市场修正因子
  depreciationPercent: number;    // 总折旧率
  confidenceScore: number;        // 置信度 (0-1)
  priceRange: { low: number; mid: number; high: number };
  details: ValuationDetail[];
  sellerPrice?: number;           // 卖家报价
  priceDifference?: number;       // 买卖价差
  priceDiffPercent?: number;      // 价差百分比
  isGoodDeal?: boolean;           // 是否值得买
  analysis: string;               // 一句话分析
}

/**
 * 获取品牌系数
 */
function getBrandFactor(brand: string): number {
  const cnBrand = BRAND_COEFFICIENTS[brand];
  if (cnBrand) return cnBrand;
  // 模糊匹配
  for (const [key, val] of Object.entries(BRAND_COEFFICIENTS)) {
    if (brand.includes(key) || key.includes(brand)) return val;
  }
  return DEFAULT_BRAND_COEFFICIENT;
}

/**
 * 获取品类基准价
 * 优先级：精确匹配 > 型号含子串匹配（按key长度降序，品类一致）> 型号降级匹配 > 品类名匹配 > 默认值
 *
 * 改进：
 * 1. 型号匹配时先检查品类一致性，避免数字型号跨品类误匹配
 * 2. 按 key 长度降序排列，防止短数字键（如 "300"）抢先匹配长型号（如 "5300RC"）
 *    （JavaScript 对象迭代时整数键会优先于非整数键，导致 "300" 在 "5300RC" 前被遍历）
 */
function getCategoryBasePrice(category: string, modelName?: string): number {
  // 0. 附件品类前置检查 — 捡拾台/割台/捡拾器等是附件，不是整机
  // 即使型号匹配到整机价格（如 "890" 匹配到大方捆70万），附件也应使用附件基准价
  const ATTACHMENT_KEYWORDS = ["捡拾台", "割台", "捡拾器", "割草台", "捡拾头"];
  const isAttachment = ATTACHMENT_KEYWORDS.some((kw) => category.includes(kw));
  if (isAttachment) {
    // 附件基准价：5-15万区间
    return 100000; // 10万
  }

  // 子品类别名映射（让"打捆机"能匹配到"小方捆"/"大方捆"等子品类）
  const CATEGORY_ALIASES: Record<string, string[]> = {
    "打捆机": ["小方捆", "大方捆", "圆捆机", "打包机"],
    "收获机": ["茎穗兼收机", "茎穗双收", "单收"],
    "青储机": [],  // 青储机没有子品类
  };

  if (modelName) {
    // 按 key 长度降序排列，长键优先匹配（避免 "300" 抢先匹配 "5300RC"）
    const sortedEntries = Object.entries(MODEL_BASE_PRICES).sort(
      (a, b) => b[0].length - a[0].length
    );

    // 1. 精确匹配（型号完全等于 key）
    for (const [key, val] of sortedEntries) {
      if (modelName === key) return val.basePrice * 10000;
    }

    // 2. 型号含子串匹配 + 品类一致性检查（含子品类别名）
    const aliases = CATEGORY_ALIASES[category] || [];
    for (const [key, val] of sortedEntries) {
      if (modelName.includes(key) || key.includes(modelName)) {
        // 检查品类一致：直接匹配 或 通过别名匹配
        if (category.includes(val.category) || val.category.includes(category) ||
            aliases.includes(val.category)) {
          return val.basePrice * 10000;
        }
      }
    }
    // 注意：已删除"降级匹配"（无品类一致性的子串匹配），因为它会导致
    // 捡拾台型号"890"误匹配到大方捆70万、捡拾台型号"1290"误匹配到大方捆75万等问题
  }

  // 3. 按品类名匹配
  for (const [key, val] of Object.entries(CATEGORY_BASE_PRICES)) {
    if (category.includes(key) || key.includes(category)) return val * 10000;
  }

  return 800000; // 默认80万
}

/**
 * 计算年份折旧因子
 */
function calcYearFactor(year: number, currentYear: number): number {
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

/**
 * 计算工时因子
 */
function calcHoursFactor(workingHours: number | undefined, year: number, currentYear: number): number {
  if (!workingHours || workingHours <= 0) return 1.0;

  const age = Math.max(currentYear - year, 1);
  const expectedHours = age * HOURS_PARAMS.expectedAnnualHours;

  if (workingHours <= expectedHours) {
    // 低于预期工时 → 轻微加分
    const ratio = 1 - (workingHours / expectedHours);
    return 1 + ratio * HOURS_PARAMS.lowHoursBonus;
  } else {
    // 超出预期工时 → 扣分
    const ratio = (workingHours - expectedHours) / (expectedHours * 3);
    return 1 - Math.min(ratio, 1) * HOURS_PARAMS.maxWearPenalty;
  }
}

/**
 * 计算市场修正因子
 */
function calcMarketFactor(foreignPriceCny: number | undefined, baseValue: number): number {
  if (!foreignPriceCny || foreignPriceCny <= 0) return 1.0;

  const ratio = foreignPriceCny / baseValue;
  return Math.max(MARKET_FACTOR_RANGE.min, Math.min(ratio, MARKET_FACTOR_RANGE.max));
}

/**
 * 主估值函数
 */
export function calculateValuation(input: ValuationInput): ValuationResult {
  const currentYear = new Date().getFullYear();

  // 1. 基准价
  const categoryBasePrice = getCategoryBasePrice(input.category, input.modelName);
  const brandFactor = getBrandFactor(input.brand);
  const basePrice = categoryBasePrice * brandFactor;

  // 2. 年份因子
  const yearFactor = calcYearFactor(input.year, currentYear);

  // 3. 工时因子
  const hoursFactor = calcHoursFactor(input.workingHours, input.year, currentYear);

  // 4. 成色因子
  const conditionFactor = CONDITION_FACTORS[input.condition || "good"] || 1.0;

  // 5. 市场因子
  const baseValue = basePrice * yearFactor * hoursFactor * conditionFactor;
  const marketFactor = calcMarketFactor(input.foreignPriceCny, baseValue);

  // 6. 最终估值
  let estimatedValue = Math.round(baseValue * marketFactor);

  // 6a. 估值上限保护：如果AI估值远超卖家报价（>2倍），说明可能是配件/残值机
  // 或者基准价对该产品不适用，将估值限制在报价的2倍以内
  if (input.priceCny && input.priceCny > 0 && estimatedValue > input.priceCny * 2) {
    estimatedValue = Math.round(input.priceCny * 2);
  }

  // 7. 折旧率
  const depreciationPercent = Math.round((1 - estimatedValue / basePrice) * 100);

  // 8. 价格区间
  const mid = estimatedValue;
  const priceRange = {
    low: Math.round(mid * 0.85),
    mid,
    high: Math.round(mid * 1.15),
  };

  // 9. 置信度
  let confidenceScore = 0.75; // 基准
  if (input.workingHours) confidenceScore += 0.05;
  if (input.foreignPriceCny) confidenceScore += 0.10;
  if (input.condition) confidenceScore += 0.05;
  if (input.priceCny) confidenceScore += 0.05;
  confidenceScore = Math.min(confidenceScore, 0.98);

  // 10. 买卖分析
  let priceDifference: number | undefined;
  let priceDiffPercent: number | undefined;
  let isGoodDeal: boolean | undefined;
  if (input.priceCny && input.priceCny > 0) {
    priceDifference = estimatedValue - input.priceCny;
    priceDiffPercent = Math.round((priceDifference / input.priceCny) * 100);
    isGoodDeal = priceDiffPercent > 10;
  }

  // 11. 详情
  const age = currentYear - input.year;
  const details: ValuationDetail[] = [
    {
      label: "品牌溢价",
      value: `${Math.round(brandFactor * 100)}%`,
      impact: brandFactor >= 0.85 ? "positive" : "neutral",
      description: `${input.brand} 国际市场认可度${brandFactor >= 0.85 ? "高" : "中等"}`,
    },
    {
      label: "年份折旧",
      value: `${Math.round((1 - yearFactor) * 100)}% (${age}年)`,
      impact: yearFactor > 0.5 ? "neutral" : "negative",
      description: `${age}年折旧率约${Math.round((1 - yearFactor) * 100)}%`,
    },
    {
      label: "工时影响",
      value: input.workingHours
        ? hoursFactor >= 1.0 ? `+${Math.round((hoursFactor - 1) * 100)}%` : `${Math.round((1 - hoursFactor) * 100)}%`
        : "无数据",
      impact: !input.workingHours ? "neutral" : hoursFactor >= 1 ? "positive" : "negative",
      description: input.workingHours
        ? `${input.workingHours.toLocaleString()}小时${hoursFactor >= 1 ? "，低于预期，加分" : "，超出预期"}`
        : "未提供工时数据",
    },
    {
      label: "成色状态",
      value: input.condition === "excellent" ? "优秀" : input.condition === "good" ? "良好" : input.condition === "fair" ? "一般" : input.condition || "未提供",
      impact: (input.condition === "excellent" || input.condition === "good") ? "positive" : "neutral",
      description: input.condition === "excellent" ? "设备保养极佳" : input.condition === "good" ? "正常使用状态" : "",
    },
    {
      label: "市场修正",
      value: `${Math.round(marketFactor * 100)}%`,
      impact: marketFactor >= 1.0 ? "positive" : "negative",
      description: input.foreignPriceCny
        ? `基于国际市场价¥${Math.round(input.foreignPriceCny / 10000)}万修正`
        : "暂无国际市场价格参考",
    },
  ];

  // 12. 一句话分析
  let analysis = "";
  if (isGoodDeal === true) {
    analysis = `✅ 超值！卖方报价¥${Math.round(input.priceCny! / 10000)}万，AI估值¥${Math.round(estimatedValue / 10000)}万，价差${priceDiffPercent}%。`;
  } else if (isGoodDeal === false && priceDiffPercent !== undefined) {
    analysis = `⚠️ 卖方报价¥${Math.round(input.priceCny! / 10000)}万，AI估值¥${Math.round(estimatedValue / 10000)}万，差价${Math.abs(priceDiffPercent!)}%。`;
  } else {
    analysis = yearFactor > 0.5
      ? `📊 该设备属于${age}年龄机，品牌${brandFactor >= 0.85 ? "认可度高" : "中等"}，估值¥${Math.round(estimatedValue / 10000)}万。`
      : `📊 该设备已使用${age}年，折旧明显，估值¥${Math.round(estimatedValue / 10000)}万。`;
  }

  return {
    estimatedValue,
    basePrice,
    brandFactor,
    yearFactor,
    hoursFactor,
    conditionFactor,
    marketFactor,
    depreciationPercent,
    confidenceScore,
    priceRange,
    details,
    sellerPrice: input.priceCny,
    priceDifference,
    priceDiffPercent,
    isGoodDeal,
    analysis,
  };
}

/**
 * 格式化金额
 */
export function formatValuationMoney(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`;
  }
  return `¥${value.toLocaleString()}`;
}
