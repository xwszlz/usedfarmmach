import type { ArenaInput, ArenaCandidate, SixDimScore } from "./types";

const CURRENT_YEAR = 2026;

// 评分权重
const WEIGHTS = {
  costPerformance: 0.3,
  performanceMatch: 0.25,
  brandReputation: 0.15,
  partsAvailability: 0.15,
  residualValue: 0.1,
  crossBorderFit: 0.05,
};

// 品牌等级映射
const BRAND_TIER_SCORE: Record<string, number> = {
  flagship: 100,
  premium: 80,
  standard: 60,
  showcase: 40,
};

// 成色映射
const CONDITION_FACTOR: Record<string, number> = {
  new: 1.0,
  excellent: 1.0,
  good: 0.9,
  fair: 0.75,
  poor: 0.6,
};

const CONDITION_SCORE: Record<string, number> = {
  new: 100,
  excellent: 100,
  good: 75,
  fair: 50,
  poor: 25,
};

// 贸易术语映射
const TRADE_TERM_SCORE: Record<string, number> = {
  FOB: 80,
  CIF: 90,
  EXW: 70,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 1. 性价比评分 (30%)
 * budget 为万元，priceCny 为元
 */
function scoreCostPerformance(priceCny: number, budget: number): number {
  const budgetYuan = budget * 10000;
  if (budgetYuan <= 0) return 50;

  if (priceCny <= budgetYuan) {
    // 在预算内：越接近预算越高（60%-100% 区间得 85-100 分）
    const ratio = priceCny / budgetYuan;
    if (ratio >= 0.6) {
      // 60%-100% 区间：85-100 分
      return clamp(85 + (ratio - 0.6) / 0.4 * 15);
    }
    // 低于 60%：递减，但不低于 70
    return clamp(70 + ratio / 0.6 * 15);
  }

  // 超预算：递减
  const overRatio = (priceCny - budgetYuan) / budgetYuan;
  return clamp(100 - overRatio * 100);
}

/**
 * 2. 性能匹配评分 (25%)
 * 年份 + 工时 + 成色 + 马力 复合评分
 */
function scorePerformanceMatch(product: any): number {
  // 年份评分
  const year = product.year ?? 2010;
  let yearScore: number;
  if (year >= 2022) {
    yearScore = 100;
  } else {
    yearScore = clamp(100 - (2022 - year) * 10);
  }

  // 工时评分
  const hours = product.workingHours ?? 10000;
  let hoursScore: number;
  if (hours <= 2000) hoursScore = 100;
  else if (hours <= 5000) hoursScore = 75;
  else if (hours <= 10000) hoursScore = 50;
  else hoursScore = 25;

  // 成色评分
  const conditionScore = CONDITION_SCORE[product.condition] ?? 50;

  // 马力评分
  const power = product.enginePower;
  let powerScore: number;
  if (power == null) powerScore = 50;
  else if (power > 150) powerScore = 100;
  else if (power >= 100) powerScore = 85;
  else if (power >= 60) powerScore = 70;
  else powerScore = 55;

  return yearScore * 0.3 + hoursScore * 0.25 + conditionScore * 0.25 + powerScore * 0.2;
}

/**
 * 3. 品牌口碑评分 (15%)
 */
function scoreBrandReputation(brandTier: string | null | undefined): number {
  if (!brandTier) return 50;
  return BRAND_TIER_SCORE[brandTier] ?? 50;
}

/**
 * 4. 配件可获性评分 (15%)
 * MVP 简化：用品牌等级代理（无 CompatibleMachine 查询）
 */
function scorePartsAvailability(brandTier: string | null | undefined, partsCount = 0): number {
  if (partsCount >= 10) return 100;
  if (partsCount >= 5) return 80;
  if (partsCount >= 1) return 60;

  // 无数据时用品牌等级代理
  const tier = brandTier ?? "standard";
  const proxy: Record<string, number> = {
    flagship: 80,
    premium: 65,
    standard: 50,
    showcase: 40,
  };
  return proxy[tier] ?? 50;
}

/**
 * 5. 残值预测评分 (10%)
 */
function scoreResidualValue(product: any, brandTier: string | null | undefined): number {
  const year = product.year ?? 2010;
  const yearDepreciation = (CURRENT_YEAR - year) / 10; // 10年寿命

  const conditionFactor = CONDITION_FACTOR[product.condition] ?? 0.75;

  const tier = brandTier ?? "standard";
  const brandFactor: Record<string, number> = {
    flagship: 1.0,
    premium: 0.9,
    standard: 0.8,
    showcase: 0.7,
  };
  const bFactor = brandFactor[tier] ?? 0.8;

  const residualRate = Math.max(0, (1 - yearDepreciation) * conditionFactor * bFactor);
  return clamp(residualRate * 100);
}

/**
 * 6. 跨境适配评分 (5%)
 */
function scoreCrossBorderFit(product: any, input: ArenaInput): number {
  const tradeTerm = product.tradeTerm ?? "FOB";
  const tradeTermScore = TRADE_TERM_SCORE[tradeTerm] ?? 60;

  let score = tradeTermScore;
  if (product.tradePort) score += 10;

  // 无 targetRegion 时中性
  if (!input.targetRegion || input.targetRegion === "any") {
    score = Math.min(score, 70);
  }

  return clamp(score);
}

/**
 * 对单个产品进行六维评分
 */
export function scoreProduct(product: any, input: ArenaInput): SixDimScore {
  const brandTier = product.brand?.brandTier ?? null;

  const costPerformance = scoreCostPerformance(product.priceCny ?? 0, input.budget);
  const performanceMatch = scorePerformanceMatch(product);
  const brandReputation = scoreBrandReputation(brandTier);
  const partsAvailability = scorePartsAvailability(brandTier);
  const residualValue = scoreResidualValue(product, brandTier);
  const crossBorderFit = scoreCrossBorderFit(product, input);

  const total =
    costPerformance * WEIGHTS.costPerformance +
    performanceMatch * WEIGHTS.performanceMatch +
    brandReputation * WEIGHTS.brandReputation +
    partsAvailability * WEIGHTS.partsAvailability +
    residualValue * WEIGHTS.residualValue +
    crossBorderFit * WEIGHTS.crossBorderFit;

  return {
    costPerformance: Math.round(costPerformance * 10) / 10,
    performanceMatch: Math.round(performanceMatch * 10) / 10,
    brandReputation: Math.round(brandReputation * 10) / 10,
    partsAvailability: Math.round(partsAvailability * 10) / 10,
    residualValue: Math.round(residualValue * 10) / 10,
    crossBorderFit: Math.round(crossBorderFit * 10) / 10,
    total: Math.round(total * 10) / 10,
  };
}

/**
 * 对候选产品列表评分并排名
 */
export function rankCandidates(products: any[], input: ArenaInput): ArenaCandidate[] {
  const scored = products.map((product) => ({
    product,
    scores: scoreProduct(product, input),
    rank: 0,
    source: (product.source as "used" | "showcase-new" | "showcase-used") || "used",
  }));

  // 按 total 降序排序
  scored.sort((a, b) => b.scores.total - a.scores.total);

  // 分配排名
  scored.forEach((candidate, index) => {
    candidate.rank = index + 1;
  });

  return scored;
}
