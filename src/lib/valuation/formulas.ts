/**
 * AI智能估值引擎 — 核心公式
 *
 * 版本：V4 (2026-07-04)
 * 模型架构：
 *   V2: 估值 = 基准价 × 品牌系数 × 年份因子 × 工时因子 × 成色因子 × 市场因子
 *   V4: 估值 = V2公式结果 × 规格因子 × (视觉成色因子 OR 传统成色因子)
 *
 * V4新增功能：
 *   1. 多模态LLM评估成色（图片分析）
 *   2. 规格字段影响因子（马力/驱动方式/配置/重量/尺寸）
 *   3. 升级的置信度计算
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

// V4: 导入图片分析模块（可选，客户端调用避免服务端绑定）
import type { VisualValuationResult } from "./image-analyzer";

/**
 * V4估值输入接口（扩展V2）
 */
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

  // V4 新增：多模态输入
  imageUrls?: string[];       // 产品图片URL列表
  videoUrls?: string[];       // 产品视频URL列表

  // V4 新增：规格字段
  enginePower?: number;        // 马力 HP
  driveSystem?: string;        // 驱动方式：2WD/4WD/Full Hydraulic
  mainConfig?: string;         // 主要配置
  netWeight?: number;          // 整机净重 kg
  overallLength?: number;      // 总长 mm
  overallWidth?: number;       // 总宽 mm
  overallHeight?: number;      // 总高 mm

  // V4 新增：预分析的视觉结果（避免重复调用LLM）
  visualResult?: VisualValuationResult;
}

export interface ValuationDetail {
  label: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
  description: string;
}

/**
 * V4估值结果接口（扩展V2）
 */
export interface ValuationResult {
  estimatedValue: number;         // 最终估值（元）
  basePrice: number;              // 基准新机价（元）
  brandFactor: number;            // 品牌系数
  yearFactor: number;             // 年份折旧因子
  hoursFactor: number;            // 工时影响因子
  conditionFactor: number;        // 成色因子（V2传统或V4视觉）
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

  // V4 新增：版本标识
  version: string;               // 估值引擎版本

  // V4 新增：视觉成色评估
  visualConditionScore?: number;   // 视觉成色评分 1-10
  visualConditionAnalysis?: string; // 视觉评估依据

  // V4 新增：规格因子
  specFactor?: number;            // 规格综合因子
  specDetails?: ValuationDetail[]; // 规格影响详情

  // V4 新增：多模态信息
  imageCount?: number;           // 图片数量
  videoCount?: number;           // 视频数量
  usedV4Condition?: boolean;    // 是否使用了V4视觉成色
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
 * 优先级：精确匹配 > 型号含子串匹配（按key长度降序，品类一致）> 品类名匹配 > 默认值
 */
function getCategoryBasePrice(category: string, modelName?: string): number {
  // 0. 附件品类前置检查 — 捡拾台/割台/捡拾器等是附件，不是整机
  const ATTACHMENT_KEYWORDS = ["捡拾台", "割台", "捡拾器", "割草台", "捡拾头"];
  const isAttachment = ATTACHMENT_KEYWORDS.some((kw) => category.includes(kw));
  if (isAttachment) {
    return 100000; // 10万
  }

  // 子品类别名映射
  const CATEGORY_ALIASES: Record<string, string[]> = {
    "打捆机": ["小方捆", "大方捆", "圆捆机", "打包机"],
    "收获机": ["茎穗兼收机", "茎穗双收", "单收"],
    "青储机": [],
  };

  if (modelName) {
    // 按 key 长度降序排列，长键优先匹配
    const sortedEntries = Object.entries(MODEL_BASE_PRICES).sort(
      (a, b) => b[0].length - a[0].length
    );

    // 1. 精确匹配
    for (const [key, val] of sortedEntries) {
      if (modelName === key) return val.basePrice * 10000;
    }

    // 2. 型号含子串匹配 + 品类一致性检查
    const aliases = CATEGORY_ALIASES[category] || [];
    for (const [key, val] of sortedEntries) {
      if (modelName.includes(key) || key.includes(modelName)) {
        if (category.includes(val.category) || val.category.includes(category) ||
            aliases.includes(val.category)) {
          return val.basePrice * 10000;
        }
      }
    }
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
    const ratio = 1 - (workingHours / expectedHours);
    return 1 + ratio * HOURS_PARAMS.lowHoursBonus;
  } else {
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
 * V4: 计算规格因子
 * 
 * 考虑：马力、驱动方式、配置、重量、尺寸等规格字段
 * 返回规格综合因子和各规格详情
 */
function calcSpecFactor(input: ValuationInput): {
  specFactor: number;
  specDetails: ValuationDetail[];
} {
  const specDetails: ValuationDetail[] = [];
  let specFactor = 1.0;

  // 1. 马力因子
  let enginePowerFactor = 1.0;
  if (input.enginePower && input.enginePower > 0) {
    // 获取同类产品平均马力（估算）
    const avgPower = getAveragePowerForCategory(input.category);
    
    if (input.enginePower > avgPower * 1.2) {
      enginePowerFactor = 1.08; // 马力明显高于平均 → 加分
      specDetails.push({
        label: "马力优势",
        value: `+${Math.round((input.enginePower / avgPower - 1) * 100)}%`,
        impact: "positive",
        description: `${input.enginePower}HP，高于同类平均${avgPower}HP`,
      });
    } else if (input.enginePower < avgPower * 0.8) {
      enginePowerFactor = 0.95; // 马力偏低 → 扣分
      specDetails.push({
        label: "马力偏低",
        value: `-${Math.round((1 - input.enginePower / avgPower) * 100)}%`,
        impact: "negative",
        description: `${input.enginePower}HP，低于同类平均${avgPower}HP`,
      });
    } else {
      specDetails.push({
        label: "马力标准",
        value: "标准",
        impact: "neutral",
        description: `${input.enginePower}HP，符合同类平均`,
      });
    }
  }
  specFactor *= enginePowerFactor;

  // 2. 驱动方式因子
  let driveSystemFactor = 1.0;
  if (input.driveSystem) {
    const driveUpper = input.driveSystem.toUpperCase();
    if (driveUpper.includes("4WD") || driveUpper.includes("四驱")) {
      driveSystemFactor = 1.05;
      specDetails.push({
        label: "驱动方式",
        value: "四驱(4WD)",
        impact: "positive",
        description: "四驱系统，通过性强，加分5%",
      });
    } else if (driveUpper.includes("FULL HYDRAULIC") || driveUpper.includes("全液压")) {
      driveSystemFactor = 1.03;
      specDetails.push({
        label: "驱动方式",
        value: "全液压",
        impact: "positive",
        description: "全液压驱动，操控精准，加分3%",
      });
    } else if (driveUpper.includes("2WD") || driveUpper.includes("二驱")) {
      driveSystemFactor = 1.0;
      specDetails.push({
        label: "驱动方式",
        value: "二驱(2WD)",
        impact: "neutral",
        description: "标准二驱，无加减分",
      });
    } else {
      specDetails.push({
        label: "驱动方式",
        value: input.driveSystem,
        impact: "neutral",
        description: "驱动方式已记录",
      });
    }
  }
  specFactor *= driveSystemFactor;

  // 3. 主要配置因子
  let mainConfigFactor = 1.0;
  if (input.mainConfig && input.mainConfig.trim().length > 0) {
    mainConfigFactor = 1.02; // 有配置描述 → 轻微加分
    specDetails.push({
      label: "主要配置",
      value: "有配置描述",
      impact: "positive",
      description: `已记录配置信息，加分2%`,
    });
  }
  specFactor *= mainConfigFactor;

  // 4. 重量因子（净重）
  if (input.netWeight && input.netWeight > 0) {
    const avgWeight = getAverageWeightForCategory(input.category);
    if (input.netWeight > avgWeight * 1.1) {
      specDetails.push({
        label: "整机重量",
        value: `${Math.round(input.netWeight / 1000)}吨`,
        impact: "positive",
        description: "重量充足，结构扎实",
      });
    } else {
      specDetails.push({
        label: "整机重量",
        value: `${Math.round(input.netWeight / 1000)}吨`,
        impact: "neutral",
        description: "重量符合标准",
      });
    }
  }

  // 5. 尺寸因子（可选，用于记录）
  if (input.overallLength || input.overallWidth || input.overallHeight) {
    specDetails.push({
      label: "外形尺寸",
      value: "已记录",
      impact: "neutral",
      description: `${input.overallLength ? `长${Math.round(input.overallLength / 1000)}m ` : ""}${input.overallWidth ? `宽${Math.round(input.overallWidth / 1000)}m ` : ""}${input.overallHeight ? `高${Math.round(input.overallHeight / 1000)}m` : ""}`,
    });
  }

  return { specFactor, specDetails };
}

/**
 * 获取品类平均马力（估算）
 */
function getAveragePowerForCategory(category: string): number {
  const powerMap: Record<string, number> = {
    "青储机": 450,
    "打捆机": 120,
    "收获机": 180,
    "拖拉机": 120,
    "收割机": 150,
  };

  for (const [key, val] of Object.entries(powerMap)) {
    if (category.includes(key)) return val;
  }
  return 150; // 默认150HP
}

/**
 * 获取品类平均重量（估算）
 */
function getAverageWeightForCategory(category: string): number {
  const weightMap: Record<string, number> = {
    "青储机": 12000,
    "打捆机": 4000,
    "收获机": 6000,
    "拖拉机": 4500,
    "收割机": 5500,
  };

  for (const [key, val] of Object.entries(weightMap)) {
    if (category.includes(key)) return val;
  }
  return 5000; // 默认5吨
}

/**
 * V4: 计算升级版置信度
 * 
 * 基准：0.7
 * 加分项：
 *   - 有图片分析：+0.15 × imageAnalysis.confidence
 *   - 有视频：+0.05
 *   - 规格字段完整度：每有1个规格字段 +0.02（最多+0.12）
 *   - 国际市场价：+0.05
 *   - 卖家报价：+0.03
 * 最终限制在 0.5-0.98 区间
 */
function calcConfidenceV4(
  input: ValuationInput,
  hasVisualCondition: boolean,
  visualConfidence: number
): number {
  let confidenceScore = 0.7; // 基准

  // V2 基础加分
  if (input.workingHours) confidenceScore += 0.05;
  if (input.foreignPriceCny) confidenceScore += 0.10;
  if (input.condition) confidenceScore += 0.05;
  if (input.priceCny) confidenceScore += 0.05;

  // V4 新增加分
  if (hasVisualCondition) {
    confidenceScore += 0.15 * visualConfidence;
  }
  if (input.videoUrls && input.videoUrls.length > 0) {
    confidenceScore += 0.05;
  }

  // 规格字段完整度
  const specFields = [
    input.enginePower,
    input.driveSystem,
    input.mainConfig,
    input.netWeight,
    input.overallLength,
    input.overallWidth,
    input.overallHeight,
  ];
  const specCount = specFields.filter((f) => f !== undefined && f !== null && f !== "").length;
  confidenceScore += Math.min(specCount * 0.02, 0.12);

  // 限制在 0.5-0.98 区间
  return Math.max(0.5, Math.min(confidenceScore, 0.98));
}

/**
 * V4: 获取成色因子（支持视觉评估降级到V2）
 * 
 * @param input 估值输入
 * @param visualResult 视觉评估结果（如有）
 * @returns 成色因子 和 是否使用了V4
 */
function getConditionFactorV4(
  input: ValuationInput,
  visualResult?: VisualValuationResult
): { conditionFactor: number; usedV4: boolean; visualScore?: number; visualAnalysis?: string } {
  // 优先使用V4视觉评估结果
  if (visualResult && visualResult.usedV4Condition && visualResult.visualConditionScore > 0) {
    // 动态导入避免服务端绑定问题
    // 这里直接使用映射表（避免循环依赖）
    const visualFactor = visualScoreToConditionFactor(visualResult.visualConditionScore);
    return {
      conditionFactor: visualFactor,
      usedV4: true,
      visualScore: visualResult.visualConditionScore,
      visualAnalysis: visualResult.visualConditionAnalysis,
    };
  }

  // 降级：使用V2传统成色因子
  const conditionFactor = CONDITION_FACTORS[input.condition || "good"] || 1.0;
  return {
    conditionFactor,
    usedV4: false,
  };
}

/**
 * V4: 将视觉成色评分转换为成色因子
 * 
 * @param visualScore 视觉成色评分 1-10
 * @returns 成色因子 0.7-1.05
 */
function visualScoreToConditionFactor(visualScore: number): number {
  if (visualScore >= 9) return 1.05;
  if (visualScore >= 8) return 1.0;
  if (visualScore >= 7) return 0.98;
  if (visualScore >= 6) return 0.95;
  if (visualScore >= 5) return 0.90;
  if (visualScore >= 4) return 0.85;
  if (visualScore >= 3) return 0.78;
  return 0.70;
}

/**
 * V4 主估值函数（兼容V2）
 * 
 * @param input 估值输入（V2或V4）
 * @param visualResult 预分析的视觉结果（可选，避免重复调用LLM）
 * @returns V4估值结果
 */
export async function calculateValuationV4(
  input: ValuationInput,
  visualResult?: VisualValuationResult
): Promise<ValuationResult> {
  const currentYear = new Date().getFullYear();

  // === V2 基础计算 ===
  
  // 1. 基准价
  const categoryBasePrice = getCategoryBasePrice(input.category, input.modelName);
  const brandFactor = getBrandFactor(input.brand);
  const basePrice = categoryBasePrice * brandFactor;

  // 2. 年份因子
  const yearFactor = calcYearFactor(input.year, currentYear);

  // 3. 工时因子
  const hoursFactor = calcHoursFactor(input.workingHours, input.year, currentYear);

  // 4. 成色因子（V4视觉 OR V2传统）
  let visualAnalysisResult: VisualValuationResult | undefined = visualResult || input.visualResult;
  
  // 如果没有预分析结果，但有图片，需要调用图片分析
  // 注意：此函数不直接调用LLM，避免async递归。由API层负责调用。
  // 这里只使用已提供的visualResult
  
  const conditionInfo = getConditionFactorV4(input, visualAnalysisResult);
  const conditionFactor = conditionInfo.conditionFactor;

  // 5. 市场因子
  const baseValue = basePrice * yearFactor * hoursFactor * conditionFactor;
  const marketFactor = calcMarketFactor(input.foreignPriceCny, baseValue);

  // 6. 最终估值（V2公式）
  let estimatedValue = Math.round(baseValue * marketFactor);

  // 6a. 估值上限保护
  if (input.priceCny && input.priceCny > 0 && estimatedValue > input.priceCny * 2) {
    estimatedValue = Math.round(input.priceCny * 2);
  }

  // === V4 新增：规格因子 ===
  
  const { specFactor, specDetails } = calcSpecFactor(input);
  estimatedValue = Math.round(estimatedValue * specFactor);

  // 7. 折旧率
  const depreciationPercent = Math.round((1 - estimatedValue / basePrice) * 100);

  // 8. 价格区间
  const mid = estimatedValue;
  const priceRange = {
    low: Math.round(mid * 0.85),
    mid,
    high: Math.round(mid * 1.15),
  };

  // 9. V4 置信度
  const hasVisualCondition = conditionInfo.usedV4;
  const visualConfidence = visualAnalysisResult?.imageConfidence || 0.5;
  const confidenceScore = calcConfidenceV4(input, hasVisualCondition, visualConfidence);

  // 10. 买卖分析
  let priceDifference: number | undefined;
  let priceDiffPercent: number | undefined;
  let isGoodDeal: boolean | undefined;
  if (input.priceCny && input.priceCny > 0) {
    priceDifference = estimatedValue - input.priceCny;
    priceDiffPercent = Math.round((priceDifference / input.priceCny) * 100);
    isGoodDeal = priceDiffPercent > 10;
  }

  // 11. 详情（合并V2基础详情和V4规格详情）
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
      label: conditionInfo.usedV4 ? "视觉成色(V4)" : "成色状态(V2)",
      value: conditionInfo.usedV4
        ? `${conditionInfo.visualScore}/10分`
        : input.condition === "excellent" ? "优秀" : input.condition === "good" ? "良好" : input.condition === "fair" ? "一般" : input.condition || "未提供",
      impact: conditionInfo.usedV4
        ? (conditionInfo.visualScore! >= 7 ? "positive" : "neutral")
        : (input.condition === "excellent" || input.condition === "good") ? "positive" : "neutral",
      description: conditionInfo.usedV4
        ? conditionInfo.visualAnalysis || "视觉评估完成"
        : input.condition === "excellent" ? "设备保养极佳" : input.condition === "good" ? "正常使用状态" : "",
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

  // 添加规格详情
  if (specDetails.length > 0) {
    details.push(...specDetails);
  }

  // 12. 一句话分析
  let analysis = "";
  const v4Tag = conditionInfo.usedV4 ? "🎯 V4多模态" : "📊 V2传统";
  
  if (isGoodDeal === true) {
    analysis = `${v4Tag} ✅ 超值！卖方报价¥${Math.round(input.priceCny! / 10000)}万，AI估值¥${Math.round(estimatedValue / 10000)}万，价差${priceDiffPercent}%。`;
  } else if (isGoodDeal === false && priceDiffPercent !== undefined) {
    analysis = `${v4Tag} ⚠️ 卖方报价¥${Math.round(input.priceCny! / 10000)}万，AI估值¥${Math.round(estimatedValue / 10000)}万，差价${Math.abs(priceDiffPercent!)}%。`;
  } else {
    analysis = yearFactor > 0.5
      ? `${v4Tag} 📊 该设备属于${age}年龄机，品牌${brandFactor >= 0.85 ? "认可度高" : "中等"}，估值¥${Math.round(estimatedValue / 10000)}万。`
      : `${v4Tag} 📊 该设备已使用${age}年，折旧明显，估值¥${Math.round(estimatedValue / 10000)}万。`;
  }

  // 添加规格因子说明
  if (specFactor !== 1.0) {
    analysis += ` 规格调整${specFactor > 1 ? "+" : ""}${Math.round((specFactor - 1) * 100)}%。`;
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
    version: "v4-20260704",

    // V4 新增字段
    visualConditionScore: conditionInfo.visualScore,
    visualConditionAnalysis: conditionInfo.visualAnalysis,
    specFactor,
    specDetails,
    imageCount: input.imageUrls?.length || 0,
    videoCount: input.videoUrls?.length || 0,
    usedV4Condition: conditionInfo.usedV4,
  };
}

/**
 * V2 主估值函数（保持兼容）
 * 
 * @param input 估值输入
 * @returns V2估值结果
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

  // 6a. 估值上限保护
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
    version: "v2-20260527",
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
