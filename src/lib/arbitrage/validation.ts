/**
 * 套利数据验证函数
 */
import type {
  ArbitrageCalculatorParams,
  ArbitrageResult,
  ExchangeRate,
  ValidationResult,
} from '../../types/index';
import { SUPPORTED_CURRENCIES } from '../../config/exchange-rates';
import { PRICE_DATA_MAX_AGE_DAYS, EXCHANGE_RATE_MAX_AGE_HOURS } from './formulas';

/**
 * 验证套利计算参数
 * @param params 套利计算参数
 * @returns 验证结果
 */
export function validateArbitrageParams(
  params: ArbitrageCalculatorParams
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查必填字段
  if (!params.productId) {
    errors.push('产品ID不能为空');
  }

  // 检查价格有效性
  if (params.domesticPrice !== undefined && params.domesticPrice <= 0) {
    errors.push('国内价格必须大于0');
  }

  if (params.foreignPrice !== undefined && params.foreignPrice <= 0) {
    errors.push('国外价格必须大于0');
  }

  // 检查货币代码
  if (params.foreignCurrency && !isValidCurrencyCode(params.foreignCurrency)) {
    errors.push(`不支持的货币代码: ${params.foreignCurrency}`);
  }

  // 检查百分比参数
  if (params.shippingCostPercentage !== undefined && 
      (params.shippingCostPercentage < 0 || params.shippingCostPercentage > 1)) {
    errors.push('运输成本百分比必须在0到1之间');
  }

  if (params.importTaxRate !== undefined && 
      (params.importTaxRate < 0 || params.importTaxRate > 1)) {
    errors.push('进口关税率必须在0到1之间');
  }

  if (params.insuranceRate !== undefined && 
      (params.insuranceRate < 0 || params.insuranceRate > 1)) {
    errors.push('保险费率必须在0到1之间');
  }

  // 检查数量
  if (params.quantity !== undefined && params.quantity <= 0) {
    errors.push('数量必须大于0');
  }

  // 检查汇率
  if (params.exchangeRate !== undefined && params.exchangeRate <= 0) {
    errors.push('汇率必须大于0');
  }

  // 警告检查
  if (params.shippingCostPercentage !== undefined && params.shippingCostPercentage > 0.15) {
    warnings.push('运输成本占比较高，可能影响利润率');
  }

  if (params.importTaxRate !== undefined && params.importTaxRate > 0.1) {
    warnings.push('进口关税率较高，可能影响利润率');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证汇率数据
 * @param rate 汇率数据
 * @returns 是否有效
 */
export function validateExchangeRate(rate: ExchangeRate): boolean {
  if (!rate) {
    return false;
  }

  // 检查必填字段
  if (!rate.baseCurrency || !rate.targetCurrency || !rate.rate || !rate.effectiveDate) {
    return false;
  }

  // 检查货币代码
  if (!isValidCurrencyCode(rate.baseCurrency) || !isValidCurrencyCode(rate.targetCurrency)) {
    return false;
  }

  // 检查汇率值范围
  if (rate.rate <= 0 || rate.rate > 10000) {
    return false;
  }

  // 检查生效日期
  const effectiveDate = new Date(rate.effectiveDate);
  if (isNaN(effectiveDate.getTime())) {
    return false;
  }

  // 检查最后更新时间
  const lastUpdated = new Date(rate.lastUpdated);
  if (isNaN(lastUpdated.getTime())) {
    return false;
  }

  // 检查数据新鲜度（是否超过最大有效期）
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
  if (hoursSinceUpdate > EXCHANGE_RATE_MAX_AGE_HOURS) {
    return false;
  }

  return true;
}

/**
 * 验证价格数据
 * @param price 国际价格数据
 * @returns 验证结果
 */
export function validatePriceData(price: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!price) {
    errors.push('价格数据不能为空');
    return { isValid: false, errors, warnings };
  }

  // 检查必填字段
  if (!price.productId) {
    errors.push('产品ID不能为空');
  }

  if (price.priceForeignCny === undefined || price.priceForeignCny === null) {
    errors.push('国外价格(CNY)不能为空');
  } else if (price.priceForeignCny <= 0) {
    errors.push('国外价格(CNY)必须大于0');
  }

  // 检查货币代码
  if (price.currency && !isValidCurrencyCode(price.currency)) {
    errors.push(`不支持的货币代码: ${price.currency}`);
  }

  // 检查数据源
  if (!price.source) {
    warnings.push('价格数据源未指定，置信度可能较低');
  }

  // 检查数据新鲜度
  if (price.sourceDate) {
    const sourceDate = new Date(price.sourceDate);
    const now = new Date();
    const daysSinceSource = (now.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (isNaN(sourceDate.getTime())) {
      warnings.push('数据日期格式无效');
    } else if (daysSinceSource > PRICE_DATA_MAX_AGE_DAYS) {
      warnings.push(`价格数据已过期 ${Math.round(daysSinceSource)} 天`);
    }
  }

  // 检查置信度分数
  if (price.confidenceScore !== undefined) {
    if (price.confidenceScore < 0 || price.confidenceScore > 1) {
      errors.push('置信度分数必须在0到1之间');
    } else if (price.confidenceScore < 0.3) {
      warnings.push('价格数据置信度较低，建议谨慎使用');
    }
  }

  // 检查是否活跃
  if (price.isActive === false) {
    warnings.push('价格数据已被标记为非活跃状态');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证套利计算结果
 * @param result 套利计算结果
 * @returns 验证结果
 */
export function validateArbitrageResult(result: ArbitrageResult): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!result) {
    errors.push('计算结果不能为空');
    return { isValid: false, errors, warnings };
  }

  // 检查价格数据
  if (result.domesticPrice <= 0) {
    errors.push('国内价格必须大于0');
  }

  if (result.foreignPriceCny <= 0) {
    errors.push('国外价格(CNY)必须大于0');
  }

  // 检查成本数据
  const costs = result.costs;
  if (costs.shipping < 0) errors.push('运输成本不能为负数');
  if (costs.importTax < 0) errors.push('进口关税不能为负数');
  if (costs.insurance < 0) errors.push('保险费用不能为负数');
  if (costs.other < 0) errors.push('其他成本不能为负数');
  if (costs.totalAdditional < 0) errors.push('总附加成本不能为负数');

  // 检查利润数据
  const profit = result.profit;
  if (profit.grossMargin < -100 || profit.grossMargin > 1000) {
    warnings.push('毛利率数值异常，请检查输入数据');
  }

  if (profit.netMargin < -100 || profit.netMargin > 1000) {
    warnings.push('净利率数值异常，请检查输入数据');
  }

  // 检查评估数据
  const assessment = result.assessment;
  if (assessment.score < 0 || assessment.score > 100) {
    errors.push('套利评分必须在0到100之间');
  }

  if (!['high', 'medium', 'low', 'none'].includes(assessment.level)) {
    errors.push(`无效的套利等级: ${assessment.level}`);
  }

  // 检查数据源信息
  if (!result.sources.lastUpdated) {
    warnings.push('数据更新时间未记录');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 检查货币代码是否有效
 * @param currency 货币代码
 * @returns 是否有效
 */
export function isValidCurrencyCode(currency: string): boolean {
  return SUPPORTED_CURRENCIES.includes(currency as any);
}

/**
 * 验证数字范围
 * @param value 数值
 * @param min 最小值
 * @param max 最大值
 * @param fieldName 字段名称
 * @returns 验证结果
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationResult {
  const errors: string[] = [];
  
  if (value < min) {
    errors.push(`${fieldName}不能小于${min}`);
  }
  
  if (value > max) {
    errors.push(`${fieldName}不能大于${max}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * 验证百分比值（0-100）
 * @param value 百分比值
 * @param fieldName 字段名称
 * @returns 验证结果
 */
export function validatePercentage(
  value: number,
  fieldName: string
): ValidationResult {
  return validateNumberRange(value, 0, 100, fieldName);
}

/**
 * 验证价格值
 * @param value 价格值
 * @param fieldName 字段名称
 * @returns 验证结果
 */
export function validatePrice(
  value: number,
  fieldName: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (value < 0) {
    errors.push(`${fieldName}不能为负数`);
  }
  
  if (value === 0) {
    errors.push(`${fieldName}不能为0`);
  }
  
  if (value > 100000000) { // 1亿CNY
    warnings.push(`${fieldName}异常高，请确认输入正确`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// 重新导出ValidationResult类型
export type { ValidationResult } from '../../types/index';