/**
 * 套利相关TypeScript类型定义
 * 包含套利计算、价格数据、汇率、榜单等所有相关类型
 */

// 从exchange-rates导入共享类型
import type { CurrencyCode, CurrencyConversionRequest, CurrencyConversionResponse } from './exchange-rates';

/**
 * 套利计算请求参数
 */
export interface ArbitrageCalculatorParams {
  productId: string;                 // 产品ID
  domesticPrice?: number;            // 国内价格(CNY) - 可选，默认用数据库值
  foreignPrice?: number;             // 国外价格(原货币) - 可选，默认用最新国际价
  foreignCurrency?: CurrencyCode;    // 国外货币 - 可选，默认用记录货币
  shippingCost?: number;             // 运输成本(CNY)
  shippingCostPercentage?: number;   // 运输成本占设备价格百分比（替代shippingCost）
  importTaxRate?: number;            // 进口关税率(%)
  insuranceRate?: number;            // 保险费率(%)
  otherCosts?: number;               // 其他成本(CNY)
  exchangeRate?: number;             // 汇率 - 可选，默认用最新汇率
  quantity?: number;                 // 数量
  includeAnalysis?: boolean;         // 是否包含详细分析
}

/**
 * 套利计算结果
 */
export interface ArbitrageResult {
  // 基本信息
  productInfo: ProductBasicInfo;
  
  // 价格信息
  domesticPrice: number;            // 国内价格(CNY)
  foreignPrice: number;             // 国外价格(原货币)
  foreignPriceCny: number;          // 国外价格(CNY)
  priceDifference: number;          // 价差(CNY) = foreignPriceCny - domesticPrice
  priceDiffPercent: number;         // 价差百分比(%)
  
  // 成本分解
  costs: CostBreakdown;
  
  // 利润分析
  profit: ProfitAnalysis;
  
  // 套利等级评估
  assessment: ArbitrageAssessment;
  
  // 数据源信息
  sources: DataSourceInfo;
  
  // 计算元数据
  metadata: CalculationMetadata;
}

/**
 * 产品基本信息
 */
export interface ProductBasicInfo {
  id: string;
  name: string;
  nameZh: string;
  brand: string;
  brandZh: string;
  model: string;
  year: number;
  category: string;
  workingHours?: number;
  condition?: string;
  location?: string;
  productUrl: string;
  imageUrl?: string;
}

/**
 * 成本分解
 */
export interface CostBreakdown {
  shipping: number;                // 运输成本
  importTax: number;               // 进口关税
  insurance: number;               // 保险费用
  other: number;                   // 其他成本
  totalAdditional: number;         // 总附加成本
  
  // 明细（可选）
  details?: {
    shippingBreakdown?: ShippingBreakdown;
    taxBreakdown?: TaxBreakdown;
    insuranceBreakdown?: InsuranceBreakdown;
  };
}

/**
 * 运输成本分解
 */
export interface ShippingBreakdown {
  oceanFreight: number;           // 海运费用
  inlandTransport: number;        // 内陆运输
  portCharges: number;            // 港口费用
  customsClearance: number;       // 清关费用
  documentation: number;          // 文件费用
  total: number;
}

/**
 * 关税分解
 */
export interface TaxBreakdown {
  importDuty: number;             // 进口关税
  vat: number;                    // 增值税
  exciseTax: number;              // 消费税
  otherTaxes: number;             // 其他税费
  total: number;
}

/**
 * 保险分解
 */
export interface InsuranceBreakdown {
  marineInsurance: number;        // 海运保险
  transitInsurance: number;       // 运输保险
  liabilityInsurance: number;     // 责任保险
  otherInsurance: number;         // 其他保险
  total: number;
}

/**
 * 利润分析
 */
export interface ProfitAnalysis {
  grossProfit: number;            // 毛利润 = 价差 - 总附加成本
  grossMargin: number;            // 毛利率(%)
  netProfit: number;              // 净利润（考虑交易成本等）
  netMargin: number;              // 净利率(%)
  breakEvenPrice: number;         // 盈亏平衡价
  roi: number;                    // 投资回报率(%)
  paybackPeriod?: number;         // 回本周期（月）
  
  // 敏感性分析
  sensitivity?: SensitivityAnalysis;
}

/**
 * 敏感性分析
 */
export interface SensitivityAnalysis {
  priceSensitivity: Array<{
    priceChange: number;          // 价格变化百分比
    profitChange: number;         // 利润变化百分比
  }>;
  costSensitivity: Array<{
    costChange: number;           // 成本变化百分比
    profitChange: number;         // 利润变化百分比
  }>;
  exchangeRateSensitivity: Array<{
    rateChange: number;           // 汇率变化百分比
    profitChange: number;         // 利润变化百分比
  }>;
}

/**
 * 套利等级评估
 */
export interface ArbitrageAssessment {
  level: 'high' | 'medium' | 'low' | 'none';  // 套利等级
  score: number;                              // 套利评分(0-100)
  opportunity: string;                        // 机会描述
  riskFactors: RiskFactor[];                  // 风险因素
  recommendations: string[];                  // 建议
  confidence: number;                         // 评估置信度(0-1)
}

/**
 * 风险因素
 */
export interface RiskFactor {
  type: 'price' | 'currency' | 'logistics' | 'regulatory' | 'market';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

/**
 * 数据源信息
 */
export interface DataSourceInfo {
  domesticPriceSource: string;    // 国内价格来源
  foreignPriceSource: string;     // 国外价格来源
  exchangeRateSource: string;     // 汇率来源
  lastUpdated: string;            // 数据更新时间（ISO格式）
  dataFreshness: 'fresh' | 'stale' | 'outdated'; // 数据新鲜度
  confidenceScore: number;        // 数据置信度(0-1)
}

/**
 * 计算元数据
 */
export interface CalculationMetadata {
  calculatedAt: string;           // 计算时间（ISO格式）
  calculationId?: string;         // 计算ID（用于跟踪）
  version: string;                // 计算引擎版本
  assumptions: string[];          // 计算假设
  limitations: string[];          // 计算限制
}

/**
 * 套利榜单项
 */
export interface ArbitrageTopItem {
  rank: number;                   // 排名
  productId: string;              // 产品ID
  productName: string;            // 产品名称
  brandName: string;              // 品牌名称
  year: number;                   // 年份
  
  // 价格信息
  domesticPrice: number;          // 国内价格(CNY)
  foreignPrice: number;           // 国外价格(CNY)
  priceDiff: number;              // 价差(CNY)
  priceDiffPercent: number;       // 价差百分比(%)
  
  // 套利评估
  arbitrageLevel: 'high' | 'medium' | 'low';
  opportunityScore: number;       // 机会评分(0-100)
  
  // 成本利润信息
  totalCosts?: number;            // 总成本
  estimatedProfit?: number;       // 预估利润
  profitMargin?: number;          // 利润率(%)
  
  // 链接
  productUrl: string;             // 产品详情页链接
  foreignSourceUrl?: string;      // 国外价格来源链接
  
  // 元数据
  lastCalculated: string;         // 最后计算时间
  cacheExpiresAt?: string;        // 缓存过期时间
}

/**
 * 套利榜单响应
 */
export interface TopArbitrageResponse {
  success: boolean;
  data?: {
    generatedAt: string;          // 生成时间
    products: ArbitrageTopItem[];
    summary: TopArbitrageSummary;
    filters?: TopArbitrageFilters;
  };
  error?: string;
  code?: string;
  timestamp: string;
}

/**
 * 套利榜单摘要
 */
export interface TopArbitrageSummary {
  totalProducts: number;          // 总产品数
  averagePriceDiff: number;       // 平均价差%
  maxPriceDiff: number;           // 最大价差%
  minPriceDiff: number;           // 最小价差%
  highOpportunityCount: number;   // 高机会数量
  mediumOpportunityCount: number; // 中等机会数量
  lowOpportunityCount: number;    // 低机会数量
  totalEstimatedProfit?: number;  // 总预估利润
  averageProfitMargin?: number;   // 平均利润率
}

/**
 * 套利榜单筛选条件
 */
export interface TopArbitrageFilters {
  limit?: number;                 // 返回数量
  minPriceDiff?: number;          // 最小价差%
  sortBy?: 'priceDiff' | 'profitMargin' | 'totalSaving'; // 排序字段
  includeDetails?: boolean;       // 是否包含详细信息
  brand?: string;                 // 品牌筛选
  category?: string;              // 品类筛选
  yearMin?: number;               // 最小年份
  yearMax?: number;               // 最大年份
}

/**
 * 价格趋势数据点
 */
export interface PriceTrendDataPoint {
  date: string;                   // 日期（ISO格式）
  domesticPrice: number;          // 国内价格
  foreignPrice: number;           // 国外价格
  foreignPriceCny: number;        // 国外价格(CNY)
  priceDiff: number;              // 价差
  priceDiffPercent: number;       // 价差百分比
  exchangeRate?: number;          // 汇率
  volume?: number;                // 交易量/关注度
  source?: string;                // 数据来源
}

/**
 * 价格趋势响应
 */
export interface PriceTrendResponse {
  success: boolean;
  data?: {
    productInfo: ProductBasicInfo;
    trends: PriceTrendDataPoint[];
    summary: PriceTrendSummary;
    timeframe: Timeframe;
  };
  error?: string;
}

/**
 * 价格趋势摘要
 */
export interface PriceTrendSummary {
  currentPriceDiff: number;
  averagePriceDiff: number;
  maxPriceDiff: number;
  minPriceDiff: number;
  volatility: number;             // 波动率
  trendDirection: 'up' | 'down' | 'stable'; // 趋势方向
  trendStrength: number;          // 趋势强度(0-1)
  bestBuyTime?: string;           // 最佳购买时间
}

/**
 * 时间范围
 */
export interface Timeframe {
  start: string;
  end: string;
  interval: 'day' | 'week' | 'month' | 'quarter' | 'year';
  dataPoints: number;
}

/**
 * 套利计算错误类型
 */
export interface ArbitrageError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
  suggestion?: string;
}

/**
 * 套利预警配置
 */
export interface ArbitrageAlertConfig {
  enabled: boolean;
  priceDiffThreshold: number;     // 价差阈值(%)
  profitMarginThreshold: number;  // 利润率阈值(%)
  notificationMethods: Array<'email' | 'push' | 'sms'>;
  frequency: 'realtime' | 'daily' | 'weekly';
  recipients: string[];
}

/**
 * 套利机会扫描结果
 */
export interface ArbitrageScanResult {
  scanId: string;
  scannedAt: string;
  totalProductsScanned: number;
  opportunitiesFound: number;
  highOpportunities: number;
  mediumOpportunities: number;
  lowOpportunities: number;
  averagePriceDiff: number;
  estimatedTotalProfit: number;
  topOpportunities: ArbitrageTopItem[];
  scanDuration: number;           // 扫描耗时(毫秒)
  status: 'completed' | 'partial' | 'failed';
  errors?: ArbitrageError[];
}



/**
 * 验证结果
 */
export interface ValidationResult {
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

/**
 * 场景变体（用于多场景模拟）
 */
export interface ScenarioVariation {
  name: string;
  description?: string;
  parameters: Partial<ArbitrageCalculatorParams>;
  baseValue?: number; // 基准值，用于比较
}

/**
 * 场景模拟结果
 */
export interface ScenarioResult {
  scenarioName: string;
  description?: string;
  parameters: Partial<ArbitrageCalculatorParams>;
  result: ArbitrageResult;
  comparison: {
    difference: number;
    percentage: number;
    assessment: string;
  };
}

/**
 * 套利计算引擎配置
 */
export interface ArbitrageEngineConfig {
  version: string;
  formulas: {
    priceDifference: string;
    costBreakdown: string;
    profitCalculation: string;
  };
  assumptions: Record<string, unknown>;
  limits: {
    maxProductsPerScan: number;
    maxHistoricalDays: number;
    maxRecursionDepth: number;
  };
}

