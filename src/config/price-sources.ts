/**
 * 价格数据源配置
 * 包含外部价格数据源的API端点、爬虫配置和更新策略
 */

/**
 * 数据源类型定义
 */
export const DATA_SOURCE_TYPES = {
  API: 'api',
  SCRAPER: 'scraper',
  MANUAL: 'manual',
  IMPORT: 'import',
} as const;

/**
 * 数据源优先级（1为最高优先级）
 */
export const DATA_SOURCE_PRIORITY = {
  agroline: 1,
  tractorhouse: 2,
  efarm: 3,
  manual: 4,
  report: 5,
} as const;

/**
 * 数据源置信度评分（0.0-1.0）
 */
export const DATA_SOURCE_CONFIDENCE = {
  agroline: 0.9,
  tractorhouse: 0.85,
  efarm: 0.8,
  manual: 0.95, // 手动输入数据置信度高
  report: 0.7,  // 报告数据可能有一定延迟
};

/**
 * 主要外部数据源配置
 */

// Agroline.de (德国农机平台)
export const AGROLINE_CONFIG = {
  id: 'agroline',
  name: 'Agroline',
  nameZh: 'Agroline德国农机平台',
  type: DATA_SOURCE_TYPES.SCRAPER,
  country: 'DE',
  currency: 'EUR',
  
  // API/爬虫配置
  endpoints: {
    search: 'https://www.agroline.de/search',
    productDetail: 'https://www.agroline.de/used-machinery/{id}',
    api: 'https://api.agroline.de/v1/products', // 假设的API端点
  },
  
  // 请求配置
  requestConfig: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 10000, // 10秒超时
    retries: 3,
    retryDelay: 1000,
  },
  
  // 爬虫选择器配置
  selectors: {
    productList: '.product-list .product-item',
    productTitle: '.product-title',
    productPrice: '.price',
    productYear: '.year',
    productLocation: '.location',
    productLink: 'a.product-link',
    pagination: '.pagination',
  },
  
  // 数据解析配置
  parsingRules: {
    priceRegex: /[\d.,]+/,
    yearRegex: /\b(19|20)\d{2}\b/,
    modelRegex: /([A-Za-z]+)\s+(\d+)/i,
  },
  
  // 更新策略
  updateStrategy: {
    frequency: 'daily', // 每日更新
    schedule: '0 3 * * *', // 每天凌晨3点（UTC）
    incremental: true, // 增量更新
    batchSize: 100, // 批量大小
  },
  
  // 数据验证
  validation: {
    minPrice: 1000, // 最小价格（EUR）
    maxPrice: 1000000, // 最大价格（EUR）
    requiredFields: ['title', 'price', 'year'],
  },
};

// TractorHouse.com (美国农机平台)
export const TRACTORHOUSE_CONFIG = {
  id: 'tractorhouse',
  name: 'TractorHouse',
  nameZh: 'TractorHouse美国农机平台',
  type: DATA_SOURCE_TYPES.SCRAPER,
  country: 'US',
  currency: 'USD',
  
  // API/爬虫配置
  endpoints: {
    search: 'https://www.tractorhouse.com/listings/for-sale',
    productDetail: 'https://www.tractorhouse.com/listings/farm-equipment/for-sale/{id}',
    api: 'https://www.tractorhouse.com/api/listings', // 假设的API端点
  },
  
  // 请求配置
  requestConfig: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000, // 15秒超时
    retries: 2,
    retryDelay: 2000,
  },
  
  // 爬虫选择器配置
  selectors: {
    productList: '.listings .listing',
    productTitle: '.listing-title',
    productPrice: '.listing-price',
    productYear: '.listing-year',
    productHours: '.listing-hours',
    productLocation: '.listing-location',
    productLink: 'a.listing-link',
  },
  
  // 数据解析配置
  parsingRules: {
    priceRegex: /\$[\d,]+/,
    yearRegex: /\b(19|20)\d{2}\b/,
    hoursRegex: /(\d+)\s*hrs?/i,
  },
  
  // 更新策略
  updateStrategy: {
    frequency: '3days', // 每3天更新
    schedule: '0 4 */3 * *', // 每3天凌晨4点（UTC）
    incremental: true,
    batchSize: 50,
  },
  
  // 数据验证
  validation: {
    minPrice: 5000, // 最小价格（USD）
    maxPrice: 500000, // 最大价格（USD）
    requiredFields: ['title', 'price', 'year'],
  },
};

// e-farm.com (欧洲农机平台)
export const EFARM_CONFIG = {
  id: 'efarm',
  name: 'e-farm',
  nameZh: 'e-farm欧洲农机平台',
  type: DATA_SOURCE_TYPES.SCRAPER,
  country: 'EU',
  currency: 'EUR',
  
  // API/爬虫配置
  endpoints: {
    search: 'https://www.e-farm.com/en/search',
    productDetail: 'https://www.e-farm.com/en/used-agricultural-machinery/{id}',
    api: 'https://api.e-farm.com/v1/machines',
  },
  
  // 请求配置
  requestConfig: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
    timeout: 12000, // 12秒超时
    retries: 3,
    retryDelay: 1500,
  },
  
  // 爬虫选择器配置
  selectors: {
    productList: '.machine-list .machine-item',
    productTitle: '.machine-title',
    productPrice: '.machine-price',
    productYear: '.machine-year',
    productHours: '.machine-hours',
    productLocation: '.machine-location',
    productLink: 'a.machine-link',
  },
  
  // 数据解析配置
  parsingRules: {
    priceRegex: /[\d.,]+\s*€/,
    yearRegex: /\b(19|20)\d{2}\b/,
    hoursRegex: /(\d+)\s*h/i,
  },
  
  // 更新策略
  updateStrategy: {
    frequency: 'weekly', // 每周更新
    schedule: '0 5 * * 1', // 每周一凌晨5点（UTC）
    incremental: true,
    batchSize: 30,
  },
  
  // 数据验证
  validation: {
    minPrice: 2000, // 最小价格（EUR）
    maxPrice: 300000, // 最大价格（EUR）
    requiredFields: ['title', 'price', 'year'],
  },
};

/**
 * 本地数据源配置
 */

// 神雕日报数据导入
export const SHENDIAO_REPORT_CONFIG = {
  id: 'shendiao_report',
  name: '神雕日报',
  nameZh: '神雕日报套利报告',
  type: DATA_SOURCE_TYPES.IMPORT,
  country: 'CN',
  currency: 'CNY',
  
  // 文件配置
  fileConfig: {
    formats: ['json', 'csv', 'xlsx'],
    directory: './data/reports',
    pattern: '套利报告_*.{json,csv,xlsx}',
    encoding: 'utf-8',
  },
  
  // 解析配置
  parsingConfig: {
    dateFormat: 'YYYY-MM-DD',
    priceField: '价格',
    currencyField: '货币',
    productField: '产品型号',
    brandField: '品牌',
    yearField: '年份',
  },
  
  // 更新策略
  updateStrategy: {
    frequency: 'onChange', // 文件变化时更新
    watchInterval: 300, // 5分钟检查一次
    manualTrigger: true, // 支持手动触发
  },
  
  // 数据验证
  validation: {
    minPrice: 10000,
    maxPrice: 5000000,
    requiredFields: ['产品型号', '价格', '货币'],
  },
};

// 手动输入数据源
export const MANUAL_INPUT_CONFIG = {
  id: 'manual',
  name: 'Manual Input',
  nameZh: '手动输入',
  type: DATA_SOURCE_TYPES.MANUAL,
  country: 'MULTI',
  currency: 'MULTI',
  
  // 输入配置
  inputConfig: {
    allowedCurrencies: ['CNY', 'USD', 'EUR'],
    pricePrecision: 2,
    dateFormat: 'YYYY-MM-DD',
    notesMaxLength: 500,
  },
  
  // 验证规则
  validation: {
    requireSourceUrl: false,
    requireVerification: false,
    maxAgeDays: 30,
  },
  
  // 权限控制
  permissions: {
    canAdd: ['admin', 'editor'],
    canEdit: ['admin', 'editor'],
    canDelete: ['admin'],
  },
};

/**
 * 全局价格数据配置
 */
export const PRICE_DATA_CONFIG = {
  // 数据合并策略
  mergeStrategy: {
    priorityBased: true, // 基于优先级合并
    confidenceWeighted: true, // 置信度加权平均
    conflictResolution: 'highest_confidence', // 冲突解决策略：最高置信度
  },
  
  // 数据清理策略
  cleanupStrategy: {
    deleteExpiredAfterDays: 90, // 过期数据保留90天后删除
    archiveInactiveAfterDays: 30, // 非活跃数据30天后归档
    compressHistoricalData: true, // 压缩历史数据
  },
  
  // 监控配置
  monitoring: {
    trackSourceHealth: true,
    trackDataFreshness: true,
    trackUpdateSuccessRate: true,
    alertOnSourceFailure: true,
  },
  
  // 性能配置
  performance: {
    cacheResults: true,
    cacheTtl: 3600, // 1小时
    precomputeAggregates: true, // 预计算聚合数据
    batchProcessingSize: 1000, // 批处理大小
  },
};

/**
 * 所有数据源映射
 */
export const PRICE_SOURCES = {
  agroline: AGROLINE_CONFIG,
  tractorhouse: TRACTORHOUSE_CONFIG,
  efarm: EFARM_CONFIG,
  shendiao_report: SHENDIAO_REPORT_CONFIG,
  manual: MANUAL_INPUT_CONFIG,
};

export default {
  DATA_SOURCE_TYPES,
  DATA_SOURCE_PRIORITY,
  DATA_SOURCE_CONFIDENCE,
  AGROLINE_CONFIG,
  TRACTORHOUSE_CONFIG,
  EFARM_CONFIG,
  SHENDIAO_REPORT_CONFIG,
  MANUAL_INPUT_CONFIG,
  PRICE_DATA_CONFIG,
  PRICE_SOURCES,
};