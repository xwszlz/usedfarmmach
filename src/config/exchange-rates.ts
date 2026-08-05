/**
 * 汇率API配置
 * 包含汇率服务的配置项、API端点和缓存设置
 */

/**
 * 支持的货币代码
 */
export const SUPPORTED_CURRENCIES = [
  'CNY', // 人民币（基础货币）
  'USD', // 美元
  'EUR', // 欧元
  'GBP', // 英镑
  'JPY', // 日元
  'AUD', // 澳元
  'CAD', // 加元
  'CHF', // 瑞士法郎
  'RUB', // 俄罗斯卢布
  'INR', // 印度卢比
  'BRL', // 巴西雷亚尔
  'MXN', // 墨西哥比索
  'KRW', // 韩元
  'TRY', // 土耳其里拉
  'ZAR', // 南非兰特
] as const;

/**
 * 货币信息映射
 */
export const CURRENCY_INFO: Record<string, { symbol: string; name: string; nameZh: string }> = {
  CNY: { symbol: '¥', name: 'Chinese Yuan', nameZh: '人民币' },
  USD: { symbol: '$', name: 'US Dollar', nameZh: '美元' },
  EUR: { symbol: '€', name: 'Euro', nameZh: '欧元' },
  GBP: { symbol: '£', name: 'British Pound', nameZh: '英镑' },
  JPY: { symbol: '¥', name: 'Japanese Yen', nameZh: '日元' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', nameZh: '澳元' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', nameZh: '加元' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', nameZh: '瑞士法郎' },
  RUB: { symbol: '₽', name: 'Russian Ruble', nameZh: '俄罗斯卢布' },
  INR: { symbol: '₹', name: 'Indian Rupee', nameZh: '印度卢比' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', nameZh: '巴西雷亚尔' },
  MXN: { symbol: 'MX$', name: 'Mexican Peso', nameZh: '墨西哥比索' },
  KRW: { symbol: '₩', name: 'South Korean Won', nameZh: '韩元' },
  TRY: { symbol: '₺', name: 'Turkish Lira', nameZh: '土耳其里拉' },
  ZAR: { symbol: 'R', name: 'South African Rand', nameZh: '南非兰特' },
};

/**
 * 汇率API配置
 */
export const EXCHANGE_RATE_API = {
  // 主服务: exchangerate-api.com (免费层: 1500请求/月)
  primary: {
    name: 'exchangerate-api.com' as const,
    baseUrl: 'https://v6.exchangerate-api.com/v6',
    apiKey: process.env.EXCHANGE_RATE_API_KEY || '',
    endpoints: {
      latest: '/latest/CNY', // 基础货币为CNY
      pair: '/pair/CNY/{target}',
      historical: '/history/CNY/{date}', // YYYY-MM-DD格式
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'UsedFarmMach/1.0 (https://usedfarmmach.com)',
    },
    timeout: 5000, // 5秒超时
    rateLimit: {
      requestsPerMinute: 5,
    },
    retry: {
      attempts: 3,
      delay: 1000,
      backoff: true,
    },
  },
  
  // 备用服务: Frankfurter.app (免费、无限制)
  fallback: {
    name: 'Frankfurter.app' as const,
    baseUrl: 'https://api.frankfurter.app',
    apiKey: '', // 无需API密钥
    endpoints: {
      latest: '/latest?base=CNY',
      pair: '/latest?base=CNY&symbols={target}',
      historical: '/{date}?base=CNY', // YYYY-MM-DD格式
    },
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 3000, // 3秒超时
    rateLimit: {
      requestsPerMinute: 10,
    },
    retry: {
      attempts: 3,
      delay: 1000,
      backoff: true,
    },
  },
  
  // 本地缓存配置
  cache: {
    ttl: 86400, // 24小时（秒）
    maxEntries: 100, // 最大缓存条目数
    staleWhileRevalidate: 3600, // 重新验证时的过期宽限时间（秒）
  },
};

/**
 * 汇率更新策略配置
 */
export const UPDATE_STRATEGY = {
  // 定时任务配置
  cronSchedule: '0 2 * * *', // 每天凌晨2点更新（UTC时间）
  
  // 更新频率
  frequency: {
    baseUpdate: 'daily' as const, // 基础更新频率
    emergencyUpdate: 'manual' as const, // 紧急更新（手动触发）
    onDemandUpdate: true, // 是否支持按需更新
  },
  
  // 更新条件
  conditions: {
    maxAgeHours: 24, // 最大数据年龄（小时）
    minConfidence: 0.8, // 最小置信度
    retryAttempts: 3, // 重试次数
    retryDelayMs: 1000, // 重试延迟（毫秒）
  },
  
  // 失败降级策略
  fallbackStrategy: {
    enableCacheFallback: true, // 启用缓存回退
    enableStaticFallback: true, // 启用静态值回退
    staticRates: {
      CNY: 1,
      USD: 0.138, // 1 CNY = 0.138 USD (约7.25 CNY/USD)
      EUR: 0.127, // 1 CNY = 0.127 EUR (约7.87 CNY/EUR)
      GBP: 0.109, // 1 CNY = 0.109 GBP (约9.17 CNY/GBP)
      RUB: 12.5,  // 1 CNY = 12.5 RUB (约0.08 CNY/RUB)
    },
  },
};

/**
 * 汇率数据验证配置
 */
export const VALIDATION = {
  // 汇率值范围限制
  rateLimits: {
    min: 0.00001, // 最小汇率值
    max: 10000,   // 最大汇率值
  },
  
  // 波动率阈值（24小时内）
  volatilityThresholds: {
    warning: 0.05,  // 警告阈值：5%波动
    critical: 0.10, // 临界阈值：10%波动
    extreme: 0.20,  // 极端阈值：20%波动
  },
  
  // 数据质量检查
  qualityChecks: {
    checkFreshness: true, // 检查数据新鲜度
    checkVolatility: true, // 检查波动率
    checkSourceConsistency: true, // 检查数据源一致性
    checkArbitrage: true, // 检查套利机会
  },
};

/**
 * 监控和日志配置
 */
export const MONITORING = {
  // 日志级别
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info' as const,
  
  // 监控指标
  metrics: {
    trackApiResponseTime: true,
    trackCacheHitRate: true,
    trackUpdateSuccessRate: true,
    trackErrorRates: true,
  },
  
  // 告警阈值
  alerts: {
    apiErrorRateThreshold: 0.1, // API错误率超过10%触发告警
    cacheMissRateThreshold: 0.5, // 缓存命中率低于50%触发告警
    dataStalenessThreshold: 48, // 数据陈旧超过48小时触发告警
    volatilityAlertThreshold: 0.1, // 波动率超过10%触发告警
  },
};

export default {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  EXCHANGE_RATE_API,
  UPDATE_STRATEGY,
  VALIDATION,
  MONITORING,
};