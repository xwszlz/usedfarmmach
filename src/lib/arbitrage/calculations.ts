/**
 * 套利计算工具函数
 */
import type {
  ArbitrageCalculatorParams,
  ArbitrageResult,
  CostBreakdown,
  ProfitAnalysis,
  ArbitrageAssessment,
  RiskFactor,
} from '../../types/arbitrage';
import {
  DEFAULT_SHIPPING_RATE,
  DEFAULT_IMPORT_TAX_RATE,
  DEFAULT_INSURANCE_RATE,
  DEFAULT_OTHER_COSTS_RATE,
  MIN_PROFIT_MARGIN_THRESHOLD,
  HIGH_PROFIT_THRESHOLD,
  MEDIUM_PROFIT_THRESHOLD,
  LOW_PROFIT_THRESHOLD,
  MIN_PRICE_DIFF_PERCENTAGE,
  ARBITRAGE_ASSESSMENT_WEIGHTS,
  RISK_FACTOR_THRESHOLDS,
  CURRENCY_SYMBOLS,
} from './formulas';

/**
 * 计算价格差异
 * @param domesticPrice 国内价格(CNY)
 * @param foreignPriceCny 国外价格(CNY)
 * @returns 价差和百分比
 */
export function calculatePriceDifference(
  domesticPrice: number,
  foreignPriceCny: number
): { diff: number; percent: number } {
  if (domesticPrice <= 0) {
    throw new Error('国内价格必须大于0');
  }
  
  const diff = foreignPriceCny - domesticPrice;
  const percent = (Math.abs(diff) / domesticPrice) * 100;
  
  return { diff, percent };
}

/**
 * 成本计算参数
 */
export interface CostCalculationParams {
  foreignPriceCny: number;        // 国外价格(CNY)
  shippingCost?: number;          // 运输成本(CNY) - 可选
  shippingCostPercentage?: number; // 运输成本百分比 - 可选
  importTaxRate?: number;         // 进口关税率
  insuranceRate?: number;         // 保险费率
  otherCosts?: number;            // 其他成本(CNY)
}

/**
 * 计算总成本
 * @param params 成本计算参数
 * @returns 总成本(CNY)
 */
export function calculateTotalCost(params: CostCalculationParams): number {
  const {
    foreignPriceCny,
    shippingCost,
    shippingCostPercentage = DEFAULT_SHIPPING_RATE,
    importTaxRate = DEFAULT_IMPORT_TAX_RATE,
    insuranceRate = DEFAULT_INSURANCE_RATE,
    otherCosts = foreignPriceCny * DEFAULT_OTHER_COSTS_RATE,
  } = params;
  
  if (foreignPriceCny <= 0) {
    throw new Error('国外价格必须大于0');
  }
  
  // 计算运输成本（优先使用固定值，否则使用百分比计算）
  const calculatedShippingCost = shippingCost !== undefined 
    ? shippingCost 
    : foreignPriceCny * shippingCostPercentage;
  
  // 计算关税
  const importTax = foreignPriceCny * importTaxRate;
  
  // 计算保险费用
  const insurance = foreignPriceCny * insuranceRate;
  
  // 总附加成本
  const totalAdditionalCost = calculatedShippingCost + importTax + insurance + otherCosts;
  
  return totalAdditionalCost;
}

/**
 * 计算成本分解
 * @param params 成本计算参数
 * @returns 成本分解
 */
export function calculateCostBreakdown(params: CostCalculationParams): CostBreakdown {
  const {
    foreignPriceCny,
    shippingCost,
    shippingCostPercentage = DEFAULT_SHIPPING_RATE,
    importTaxRate = DEFAULT_IMPORT_TAX_RATE,
    insuranceRate = DEFAULT_INSURANCE_RATE,
    otherCosts = foreignPriceCny * DEFAULT_OTHER_COSTS_RATE,
  } = params;
  
  // 计算各项成本
  const calculatedShippingCost = shippingCost !== undefined 
    ? shippingCost 
    : foreignPriceCny * shippingCostPercentage;
  
  const importTax = foreignPriceCny * importTaxRate;
  const insurance = foreignPriceCny * insuranceRate;
  
  const totalAdditional = calculatedShippingCost + importTax + insurance + otherCosts;
  
  return {
    shipping: calculatedShippingCost,
    importTax,
    insurance,
    other: otherCosts,
    totalAdditional,
  };
}

/**
 * 计算利润率
 * @param priceDiff 价差(CNY)
 * @param totalCost 总成本(CNY)
 * @param domesticPrice 国内价格(CNY)
 * @returns 利润率（百分比小数，如0.15表示15%）
 */
export function calculateProfitMargin(
  priceDiff: number,
  totalCost: number,
  domesticPrice: number
): number {
  if (domesticPrice <= 0) {
    throw new Error('国内价格必须大于0');
  }
  
  // 净利润 = 价差 - 总成本
  const netProfit = priceDiff - totalCost;
  
  // 利润率 = 净利润 / 国内价格
  const profitMargin = netProfit / domesticPrice;
  
  return profitMargin;
}

/**
 * 计算盈亏平衡价格
 * @param foreignPriceCny 国外价格(CNY)
 * @param totalCost 总成本(CNY)
 * @returns 盈亏平衡价格(CNY)
 */
export function calculateBreakEvenPrice(
  foreignPriceCny: number,
  totalCost: number
): number {
  return foreignPriceCny + totalCost;
}

/**
 * 计算投资回报率（ROI）
 * @param netProfit 净利润(CNY)
 * @param totalInvestment 总投资(CNY) = 国外价格 + 总成本
 * @returns ROI（百分比小数）
 */
export function calculateROI(
  netProfit: number,
  totalInvestment: number
): number {
  if (totalInvestment <= 0) {
    throw new Error('总投资必须大于0');
  }
  
  return netProfit / totalInvestment;
}

/**
 * 格式化货币金额
 * @param amount 金额
 * @param currency 货币代码
 * @param locale 本地化设置，默认'zh-CN'
 * @returns 格式化后的货币字符串
 */
export function formatCurrency(
  amount: number,
  currency: string = 'CNY',
  locale: string = 'zh-CN'
): string {
  const symbol = CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] || currency;
  
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    return formatter.format(amount);
  } catch (error) {
    // 如果Intl不支持该货币，回退到简单格式
    return `${symbol}${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

/**
 * 四舍五入到两位小数
 * @param num 数字
 * @returns 两位小数的数字
 */
export function roundToTwoDecimal(num: number): number {
  return Math.round(num * 100) / 100;
}

/**
 * 四舍五入到指定小数位
 * @param num 数字
 * @param decimals 小数位数，默认2
 * @returns 舍入后的数字
 */
export function roundToDecimal(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * 评估套利机会等级
 * @param profitMargin 利润率
 * @returns 套利等级：'high' | 'medium' | 'low' | 'none'
 */
export function assessArbitrageLevel(profitMargin: number): 'high' | 'medium' | 'low' | 'none' {
  if (profitMargin >= HIGH_PROFIT_THRESHOLD) {
    return 'high';
  } else if (profitMargin >= MEDIUM_PROFIT_THRESHOLD) {
    return 'medium';
  } else if (profitMargin >= LOW_PROFIT_THRESHOLD) {
    return 'low';
  } else {
    return 'none';
  }
}

/**
 * 计算套利评估分数（0-100）
 * @param profitMargin 利润率
 * @param priceDiffPercent 价差百分比
 * @param riskFactors 风险因素数量
 * @param marketDemand 市场需求评分（0-1）
 * @returns 综合评分
 */
export function calculateArbitrageScore(
  profitMargin: number,
  priceDiffPercent: number,
  riskFactors: RiskFactor[] = [],
  marketDemand: number = 0.5
): number {
  // 标准化输入
  const normalizedProfitMargin = Math.min(Math.max(profitMargin, 0), 1);
  const normalizedPriceDiff = Math.min(Math.max(priceDiffPercent / 100, 0), 1);
  const normalizedMarketDemand = Math.min(Math.max(marketDemand, 0), 1);
  
  // 计算风险惩罚
  const highRiskCount = riskFactors.filter(r => r.severity === 'high').length;
  const mediumRiskCount = riskFactors.filter(r => r.severity === 'medium').length;
  const riskPenalty = (highRiskCount * 0.2) + (mediumRiskCount * 0.1);
  
  // 加权计算
  let score = 0;
  score += normalizedPriceDiff * ARBITRAGE_ASSESSMENT_WEIGHTS.PRICE_DIFFERENCE * 100;
  score += normalizedProfitMargin * ARBITRAGE_ASSESSMENT_WEIGHTS.PROFIT_MARGIN * 100;
  score += normalizedMarketDemand * ARBITRAGE_ASSESSMENT_WEIGHTS.MARKET_DEMAND * 100;
  score += (1 - riskPenalty) * ARBITRAGE_ASSESSMENT_WEIGHTS.RISK_LEVEL * 100;
  
  // 应用风险惩罚
  score = Math.max(0, score - (riskPenalty * 20));
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * 判断是否显示为套利机会
 * @param profitMargin 利润率
 * @param priceDiffPercent 价差百分比
 * @returns 是否显示
 */
export function shouldDisplayAsArbitrageOpportunity(
  profitMargin: number,
  priceDiffPercent: number
): boolean {
  return (
    profitMargin >= MIN_PROFIT_MARGIN_THRESHOLD &&
    priceDiffPercent >= MIN_PRICE_DIFF_PERCENTAGE * 100
  );
}