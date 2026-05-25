/**
 * 套利计算公式常量
 * 与src/config/arbitrage.ts中的默认参数保持一致
 */

/**
 * 默认运输成本占设备价格百分比
 */
export const DEFAULT_SHIPPING_RATE = 0.10;

/**
 * 默认进口关税率
 */
export const DEFAULT_IMPORT_TAX_RATE = 0.08;

/**
 * 默认保险费率
 */
export const DEFAULT_INSURANCE_RATE = 0.02;

/**
 * 默认其他固定成本（CNY）
 */
export const DEFAULT_OTHER_COSTS = 50000;

/**
 * 最小利润率阈值（低于此值不显示为套利机会）
 */
export const MIN_PROFIT_MARGIN_THRESHOLD = 0.15;

/**
 * 高利润阈值（利润率 > 30%）
 */
export const HIGH_PROFIT_THRESHOLD = 0.30;

/**
 * 中等利润阈值（利润率 20-30%）
 */
export const MEDIUM_PROFIT_THRESHOLD = 0.20;

/**
 * 低利润阈值（利润率 10-20%）
 */
export const LOW_PROFIT_THRESHOLD = 0.10;

/**
 * 最小价差百分比阈值
 */
export const MIN_PRICE_DIFF_PERCENTAGE = 0.15;

/**
 * 套利评估权重
 */
export const ARBITRAGE_ASSESSMENT_WEIGHTS = {
  PRICE_DIFFERENCE: 0.40,
  PROFIT_MARGIN: 0.35,
  MARKET_DEMAND: 0.15,
  RISK_LEVEL: 0.10,
} as const;

/**
 * 风险因素阈值
 */
export const RISK_FACTOR_THRESHOLDS = {
  HIGH_SHIPPING_COST: 0.15,      // 运输成本超过15%为高风险
  HIGH_TAX_RATE: 0.10,           // 关税超过10%为高风险
  HIGH_PRICE_VOLATILITY: 0.05,   // 价格波动超过5%为高风险
} as const;

/**
 * 汇率缓存时间（秒）
 */
export const EXCHANGE_RATE_CACHE_TTL = 86400; // 24小时

/**
 * 套利结果缓存时间（秒）
 */
export const ARBITRAGE_RESULT_CACHE_TTL = 3600; // 1小时

/**
 * 榜单缓存时间（秒）
 */
export const TOP_LIST_CACHE_TTL = 7200; // 2小时

/**
 * 价格数据最大有效期（天）
 */
export const PRICE_DATA_MAX_AGE_DAYS = 30;

/**
 * 汇率数据最大有效期（小时）
 */
export const EXCHANGE_RATE_MAX_AGE_HOURS = 24;

/**
 * 货币符号映射
 */
export const CURRENCY_SYMBOLS = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  RUB: '₽',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  INR: '₹',
  BRL: 'R$',
  MXN: 'MX$',
  KRW: '₩',
  TRY: '₺',
  ZAR: 'R',
} as const;