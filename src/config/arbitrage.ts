/**
 * 套利功能配置
 * 包含套利计算相关的默认参数、阈值和配置项
 */

/**
 * 默认套利计算参数
 * 这些参数在用户未提供时使用
 */
export const DEFAULT_ARBITRAGE_PARAMS = {
  // 成本参数（占设备价格百分比，除非另有说明）
  shippingCostPercentage: 0.10,      // 运输成本占设备价格10%
  importTaxRate: 0.08,               // 进口关税8%
  insuranceRate: 0.02,               // 保险费2%
  otherCostsFixed: 50000,            // 其他固定杂费5万CNY
  
  // 利润阈值
  minProfitMargin: 0.15,             // 最小利润率15%才显示为套利机会
  highProfitThreshold: 0.30,         // 高利润阈值30%
  mediumProfitThreshold: 0.20,       // 中等利润阈值20%
  lowProfitThreshold: 0.10,          // 低利润阈值10%
  
  // 价格差异阈值
  minPriceDiffPercentage: 0.15,      // 最小价差百分比15%
  
  // 评估权重（用于计算综合评分）
  assessmentWeights: {
    priceDifference: 0.40,           // 价差权重40%
    profitMargin: 0.35,              // 利润率权重35%
    marketDemand: 0.15,              // 市场需求权重15%
    riskLevel: 0.10,                 // 风险等级权重10%
  },
  
  // 风险因素配置
  riskFactors: {
    highShippingCostThreshold: 0.15, // 运输成本超过15%为高风险
    highTaxRateThreshold: 0.10,      // 关税超过10%为高风险
    priceVolatilityThreshold: 0.05,  // 价格波动超过5%为高风险
  },
};

/**
 * 套利等级评估配置
 */
export const ARBITRAGE_ASSESSMENT = {
  levels: {
    high: {
      minScore: 80,
      label: 'high',
      color: '#10B981', // 绿色
      description: '高套利机会 - 利润可观，风险较低',
    },
    medium: {
      minScore: 60,
      maxScore: 79,
      label: 'medium',
      color: '#F59E0B', // 黄色
      description: '中等套利机会 - 利润一般，需仔细评估',
    },
    low: {
      minScore: 40,
      maxScore: 59,
      label: 'low',
      color: '#EF4444', // 红色
      description: '低套利机会 - 利润微薄或风险较高',
    },
    none: {
      maxScore: 39,
      label: 'none',
      color: '#6B7280', // 灰色
      description: '无套利机会 - 不推荐',
    },
  },
  
  // 评分范围
  maxScore: 100,
  minScore: 0,
};

/**
 * 套利计算器UI配置
 */
export const CALCULATOR_CONFIG = {
  // 输入范围限制
  inputLimits: {
    priceMin: 0,
    priceMax: 100000000, // 1亿CNY
    percentageMin: 0,
    percentageMax: 100,
    quantityMin: 1,
    quantityMax: 100,
  },
  
  // 步进值
  stepValues: {
    price: 1000,
    percentage: 0.01,
    quantity: 1,
  },
  
  // 货币符号
  currencySymbols: {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    GBP: '£',
    RUB: '₽',
  },
  
  // 默认货币
  defaultCurrency: 'CNY' as const,
};

/**
 * 缓存配置
 */
export const CACHE_CONFIG = {
  // 套利结果缓存时间（秒）
  arbitrageResultTtl: 3600, // 1小时
  
  // 榜单缓存时间（秒）
  topListTtl: 7200, // 2小时
  
  // 汇率缓存时间（秒）
  exchangeRateTtl: 86400, // 24小时
};

/**
 * 功能开关配置
 */
export const FEATURE_FLAGS = {
  enableArbitrageCalculator: true,
  enableTopArbitrageList: true,
  enablePriceTrends: true,
  enableRealTimeUpdates: false, // 暂时关闭实时更新，使用定时任务
  enableEmailAlerts: false,     // 暂时关闭邮件提醒
};

/**
 * 数据验证配置
 */
export const VALIDATION_CONFIG = {
  // 价格数据有效期（天）
  priceDataMaxAge: 30,
  
  // 汇率数据有效期（小时）
  exchangeRateMaxAge: 24,
  
  // 最小置信度分数
  minConfidenceScore: 0.3,
  
  // 数据源优先级
  dataSourcePriority: {
    agroline: 1,
    tractorhouse: 2,
    efarm: 3,
    manual: 4,
    report: 5,
  },
};

export default {
  DEFAULT_ARBITRAGE_PARAMS,
  ARBITRAGE_ASSESSMENT,
  CALCULATOR_CONFIG,
  CACHE_CONFIG,
  FEATURE_FLAGS,
  VALIDATION_CONFIG,
};