/**
 * AI估值引擎 — 品牌系数与基准价格
 * 数据来源：神雕库存表 + Agroline/e-farm/TractorHouse 国际价格
 */

// 品牌价值系数（基于国际市场认可度）
export const BRAND_COEFFICIENTS: Record<string, number> = {
  "克拉斯": 0.95,
  "CLAAS": 0.95,
  "克罗尼": 0.93,
  "Krone": 0.93,
  "约翰迪尔": 0.90,
  "John Deere": 0.90,
  "纽荷兰": 0.85,
  "New Holland": 0.85,
  "凯斯": 0.83,
  "Case IH": 0.83,
  "芬特": 0.88,
  "Fendt": 0.88,
  "麦赛弗格森": 0.80,
  "Massey Ferguson": 0.80,
  "库恩": 0.82,
  "Kuhn": 0.82,
  "格立莫": 0.78,
  "Grimme": 0.78,
  "奥库": 0.72,
  "Orkel": 0.72,
  "康斯凯尔": 0.70,
  "Kongskilde": 0.70,
  "格兰": 0.75,
  "Arcusin": 0.65,
  "东方红": 0.60,
  "Dongfanghong": 0.60,
  "牧神": 0.55,
  "Mushen": 0.55,
  "德翔": 0.50,
  "Dexiang": 0.50,
  "盈嘉": 0.50,
  "Yingjia": 0.50,
  "迈科农机": 0.55,
};

// 默认品牌系数
export const DEFAULT_BRAND_COEFFICIENT = 0.70;

// 品类基准新机价格（万元人民币）
export const CATEGORY_BASE_PRICES: Record<string, number> = {
  "青储机": 250,
  "打捆机": 120,
  "割草机": 60,
  "裹包机": 30,
  "捡石机": 20,
  "搂草机": 35,
  "收获机": 80,
  "拖拉机": 100,
  "播种机": 40,
  "码垛机": 25,
  "捡拾台": 15,
  "割台": 15,
  "茎穗兼收机": 50,
};

// 成色系数
export const CONDITION_FACTORS: Record<string, number> = {
  "excellent": 1.05,
  "good": 1.00,
  "fair": 0.90,
  "poor": 0.75,
};

// 折旧率（分年段）
export const DEPRECIATION_TABLE = [
  { maxYear: 3, rate: 0.10 },   // 0-3年: 每年折10%
  { maxYear: 7, rate: 0.08 },   // 4-7年: 每年折8%
  { maxYear: 12, rate: 0.06 },  // 8-12年: 每年折6%
  { maxYear: 999, rate: 0.04 }, // 13年+: 每年折4%
];

// 工时参数
export const HOURS_PARAMS = {
  expectedAnnualHours: 500,   // 年均预期工时
  maxWearPenalty: 0.15,       // 最大工时磨损惩罚 15%
  lowHoursBonus: 0.05,        // 低工时奖励 5%
};

// 市场修正系数范围
export const MARKET_FACTOR_RANGE = {
  min: 0.70,  // 最低70%
  max: 1.30,  // 最高130%
};

// 残值底线
export const MIN_RESIDUAL_RATIO = 0.10; // 不低于新机价格10%
