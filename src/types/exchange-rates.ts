/**
 * 汇率相关TypeScript类型定义
 * 包含汇率数据、API响应、服务配置等所有相关类型
 */

/**
 * 货币代码类型
 */
export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'RUB' | 'INR' | 'BRL' | 'MXN' | 'KRW' | 'TRY' | 'ZAR';

/**
 * 汇率数据
 */
export interface ExchangeRate {
  id: string;                     // 唯一标识
  baseCurrency: CurrencyCode;     // 基础货币（通常为CNY）
  targetCurrency: CurrencyCode;   // 目标货币
  rate: number;                   // 汇率值 (1 baseCurrency = rate targetCurrency)
  inverseRate: number;            // 反向汇率 (1 targetCurrency = inverseRate baseCurrency)
  source: string;                 // 数据来源
  lastUpdated: string;            // 最后更新时间（ISO格式）
  effectiveDate: string;          // 汇率生效日期（ISO格式）
  
  // 元数据
  confidence: number;             // 数据置信度(0-1)
  isLive: boolean;                // 是否为实时汇率
  isHistorical: boolean;          // 是否为历史汇率
  isInterpolated: boolean;        // 是否为插值数据
  
  // 统计信息
  bid?: number;                   // 买入价
  ask?: number;                   // 卖出价
  mid?: number;                   // 中间价
  spread?: number;                // 点差
  
  // 趋势信息
  change?: number;                // 变化量
  changePercent?: number;         // 变化百分比
  previousRate?: number;          // 前一日汇率
  volatility?: number;            // 波动率
}

/**
 * 汇率API响应（通用格式）
 */
export interface ExchangeRateApiResponse {
  success: boolean;
  timestamp?: number;             // Unix时间戳
  base?: CurrencyCode;           // 基础货币
  date?: string;                 // 日期（YYYY-MM-DD）
  rates: Record<CurrencyCode, number>; // 汇率映射
  error?: {
    code: string;
    message: string;
  };
}

/**
 * ExchangeRate-API.com 响应格式
 */
export interface ExchangeRateApiComResponse extends ExchangeRateApiResponse {
  result: string;                // "success" 或 "error"
  documentation?: string;
  terms_of_use?: string;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  time_next_update_unix?: number;
  time_next_update_utc?: string;
}

/**
 * Frankfurter.app 响应格式
 */
export interface FrankfurterResponse extends ExchangeRateApiResponse {
  amount?: number;
  start_date?: string;
  end_date?: string;
  historical?: boolean;
}

/**
 * 汇率转换请求
 */
export interface CurrencyConversionRequest {
  amount: number;                // 金额
  from: CurrencyCode;           // 源货币
  to: CurrencyCode;             // 目标货币
  date?: string;                // 日期（YYYY-MM-DD），默认最新
  precision?: number;           // 小数精度，默认2
  includeBreakdown?: boolean;   // 是否包含成本分解
  includeMetadata?: boolean;    // 是否包含元数据
}

/**
 * 汇率转换响应
 */
export interface CurrencyConversionResponse {
  amount: number;                // 原始金额
  convertedAmount: number;       // 转换后金额
  from: CurrencyCode;           // 源货币
  to: CurrencyCode;             // 目标货币
  rate: number;                 // 汇率
  inverseRate: number;          // 反向汇率
  date: string;                 // 汇率日期
  
  // 成本分解
  breakdown?: {
    baseAmount: number;          // 基础金额
    margin?: number;             // 汇差/手续费
    fees?: number;              // 其他费用
    totalCost: number;          // 总成本
    effectiveRate: number;      // 实际汇率（含成本）
  };
  
  // 元数据
  metadata?: {
    source: string;             // 数据来源
    confidence: number;         // 置信度
    freshness: 'fresh' | 'stale' | 'outdated'; // 新鲜度
    cached: boolean;            // 是否来自缓存
    cacheAge?: number;          // 缓存年龄（秒）
  };
  
  // 警告/信息
  warnings?: string[];
  info?: string[];
}

/**
 * 汇率历史数据点
 */
export interface ExchangeRateHistoryPoint {
  date: string;                  // 日期（ISO格式）
  rate: number;                  // 汇率
  open?: number;                 // 开盘价
  high?: number;                 // 最高价
  low?: number;                  // 最低价
  close?: number;                // 收盘价
  volume?: number;               // 交易量
  change?: number;               // 变化量
  changePercent?: number;        // 变化百分比
}

/**
 * 汇率历史响应
 */
export interface ExchangeRateHistoryResponse {
  success: boolean;
  data?: {
    base: CurrencyCode;
    target: CurrencyCode;
    history: ExchangeRateHistoryPoint[];
    summary: ExchangeRateHistorySummary;
  };
  error?: string;
}

/**
 * 汇率历史摘要
 */
export interface ExchangeRateHistorySummary {
  startDate: string;
  endDate: string;
  dataPoints: number;
  averageRate: number;
  minRate: number;
  maxRate: number;
  volatility: number;
  trend: 'up' | 'down' | 'stable';
  trendStrength: number;
}

/**
 * 汇率更新请求
 */
export interface ExchangeRateUpdateRequest {
  currencies?: CurrencyCode[];   // 要更新的货币对，默认全部
  forceUpdate?: boolean;         // 强制更新，忽略缓存
  source?: 'primary' | 'fallback' | 'all'; // 数据源
  notifyOnComplete?: boolean;   // 完成后通知
}

/**
 * 汇率更新响应
 */
export interface ExchangeRateUpdateResponse {
  success: boolean;
  data?: {
    updatedCount: number;        // 更新的汇率数量
    failedCount: number;         // 失败的更新数量
    sourcesUsed: string[];       // 使用的数据源
    startTime: string;           // 开始时间
    endTime: string;             // 结束时间
    duration: number;            // 耗时（毫秒）
    details: UpdateDetail[];     // 详情
  };
  error?: string;
  warnings?: string[];
}

/**
 * 更新详情
 */
export interface UpdateDetail {
  currencyPair: string;          // 货币对，如"CNY-USD"
  source: string;                // 数据源
  oldRate?: number;              // 旧汇率
  newRate?: number;              // 新汇率（可选）
  change?: number;               // 变化量
  changePercent?: number;        // 变化百分比
  success: boolean;              // 是否成功
  error?: string;                // 错误信息
  cached: boolean;               // 是否来自缓存
}

/**
 * 汇率监控指标
 */
export interface ExchangeRateMetrics {
  timestamp: string;             // 时间戳
  totalRates: number;            // 总汇率数量
  freshRates: number;            // 新鲜汇率数量（<24小时）
  staleRates: number;            // 陈旧汇率数量（24-48小时）
  outdatedRates: number;         // 过期汇率数量（>48小时）
  cacheHitRate: number;          // 缓存命中率
  apiSuccessRate: number;        // API成功率
  averageResponseTime: number;   // 平均响应时间（毫秒）
  errorsLast24h: number;         // 24小时内错误数
  lastSuccessfulUpdate: string;  // 最后成功更新时间
  uptime: number;                // 服务运行时间（小时）
}

/**
 * 汇率预警
 */
export interface ExchangeRateAlert {
  id: string;
  type: 'volatility' | 'threshold' | 'failure' | 'stale';
  severity: 'low' | 'medium' | 'high' | 'critical';
  currencyPair?: string;         // 货币对（可选）
  message: string;
  details: Record<string, unknown>;
  triggeredAt: string;
  resolvedAt?: string;
  status: 'active' | 'resolved' | 'acknowledged';
}

/**
 * 汇率服务配置
 */
export interface ExchangeRateServiceConfig {
  sources: {
    primary: ApiSourceConfig;
    fallback: ApiSourceConfig;
    cache: CacheConfig;
  };
  update: UpdateConfig;
  validation: ValidationConfig;
  monitoring: MonitoringConfig;
}

/**
 * API数据源配置
 */
export interface ApiSourceConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  endpoints: {
    latest: string;
    historical: string;
    pair: string;
  };
  headers: Record<string, string>;
  timeout: number;
  rateLimit: {
    requestsPerMinute: number;
    burstLimit?: number;
  };
  retry: {
    attempts: number;
    delay: number;
    backoff?: boolean;
  };
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  ttl: number;                   // 缓存时间（秒）
  maxEntries: number;            // 最大条目数
  staleWhileRevalidate: number;  // 重新验证时的过期宽限时间
  cleanupInterval: number;       // 清理间隔（秒）
  strategy: 'lru' | 'fifo' | 'ttl'; // 缓存策略
}

/**
 * 更新配置
 */
export interface UpdateConfig {
  schedule: string;              // Cron表达式
  frequency: 'realtime' | 'daily' | 'hourly' | 'manual';
  batchSize: number;             // 批处理大小
  onDemand: boolean;            // 是否支持按需更新
  onFailure: {
    retry: boolean;
    fallback: boolean;
    notify: boolean;
  };
}

/**
 * 验证配置
 */
export interface ValidationConfig {
  rateLimits: {
    min: number;
    max: number;
  };
  volatilityThresholds: {
    warning: number;
    critical: number;
    extreme: number;
  };
  freshnessThresholds: {
    warning: number;     // 警告阈值（小时）
    critical: number;    // 临界阈值（小时）
  };
  consistencyChecks: {
    crossSource: boolean;
    historical: boolean;
    triangular: boolean;
  };
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  enabled: boolean;
  metrics: {
    trackApiCalls: boolean;
    trackCachePerformance: boolean;
    trackErrorRates: boolean;
    trackDataQuality: boolean;
  };
  alerts: {
    enabled: boolean;
    channels: Array<'email' | 'slack' | 'webhook'>;
    thresholds: AlertThresholds;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    retention: number;           // 日志保留天数
  };
}

/**
 * 告警阈值
 */
export interface AlertThresholds {
  apiErrorRate: number;          // API错误率阈值（百分比）
  cacheMissRate: number;         // 缓存未命中率阈值
  dataStaleness: number;         // 数据陈旧阈值（小时）
  volatility: number;            // 波动率阈值（百分比）
  responseTime: number;          // 响应时间阈值（毫秒）
}

/**
 * 汇率服务状态
 */
export interface ExchangeRateServiceStatus {
  service: 'exchange-rate';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'maintenance';
  version: string;
  uptime: number;                // 运行时间（秒）
  lastCheck: string;             // 最后检查时间
  metrics: Partial<ExchangeRateMetrics>;
  activeAlerts: ExchangeRateAlert[];
  recentErrors: string[];
  configHash: string;            // 配置哈希（用于检测配置变更）
}

