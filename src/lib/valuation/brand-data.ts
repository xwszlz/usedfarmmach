/**
 * AI估值引擎 — 品牌系数与基准价格
 * 数据来源：神雕库存表 + Agroline/e-farm/TractorHouse 国际价格
 */

// 品牌价值系数（>1.0 = 溢价品牌，<1.0 = 折价品牌）
export const BRAND_COEFFICIENTS: Record<string, number> = {
  "克拉斯": 1.30,
  "CLAAS": 1.30,
  "克罗尼": 1.25,
  "Krone": 1.25,
  "约翰迪尔": 1.20,
  "John Deere": 1.20,
  "纽荷兰": 1.10,
  "New Holland": 1.10,
  "凯斯": 1.10,
  "Case IH": 1.10,
  "芬特": 1.15,
  "Fendt": 1.15,
  "麦赛弗格森": 1.05,
  "Massey Ferguson": 1.05,
  "库恩": 1.00,
  "Kuhn": 1.00,
  "格立莫": 0.95,
  "Grimme": 0.95,
  "奥库": 0.85,
  "Orkel": 0.85,
  "康斯凯尔": 0.80,
  "Kongskilde": 0.80,
  "格兰": 0.90,
  "Arcusin": 0.75,
  "东方红": 0.65,
  "Dongfanghong": 0.65,
  "牧神": 0.60,
  "Mushen": 0.60,
  "德翔": 0.50,
  "Dexiang": 0.50,
  "盈嘉": 0.50,
  "Yingjia": 0.50,
  "迈科农机": 0.55,
};

// 默认品牌系数
export const DEFAULT_BRAND_COEFFICIENT = 0.85;

// 品类基准新机价格（万元人民币）
export const CATEGORY_BASE_PRICES: Record<string, number> = {
  "青储机": 250,
  "打捆机": 120,   // 默认（大圆捆级别），实际由子品类/型号覆盖
  "小方捆": 20,    // NH 5070/570, Case IH 等小方捆
  "大方捆": 80,    // NH 1290/870, CLAAS 5300RC, Krone 1290 等大方捆
  "圆捆机": 120,   // CLAAS Rollant, Krone 圆捆机
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

// 型号基准价格映射表（万元人民币）
// 用于根据 modelName 精确定位基准价，优先级高于品类匹配
export const MODEL_BASE_PRICES: Record<string, { category: string; basePrice: number }> = {
  // 小方捆
  "5070": { category: "小方捆", basePrice: 20 },
  "570": { category: "小方捆", basePrice: 22 },
  "9YDB": { category: "小方捆", basePrice: 8 },
  "9YY": { category: "小方捆", basePrice: 10 },
  // 大方捆
  "870": { category: "大方捆", basePrice: 65 },
  "1270": { category: "大方捆", basePrice: 70 },
  "1290": { category: "大方捆", basePrice: 75 },
  "5300RC": { category: "大方捆", basePrice: 80 },
  "890": { category: "大方捆", basePrice: 70 },
  "CF155": { category: "大方捆", basePrice: 75 },
  "1290XC": { category: "大方捆", basePrice: 75 },
  "9YG": { category: "大方捆", basePrice: 35 },
  // 圆捆机
  "Rollant": { category: "圆捆机", basePrice: 120 },
  "RP": { category: "圆捆机", basePrice: 110 },
};

// 成色系数
export const CONDITION_FACTORS: Record<string, number> = {
  "excellent": 1.05,
  "good": 1.00,
  "fair": 0.90,
  "poor": 0.75,
};

// 折旧率（分年段）— 农机价值保持优于汽车
export const DEPRECIATION_TABLE = [
  { maxYear: 3, rate: 0.05 },   // 0-3年: 每年折5%
  { maxYear: 7, rate: 0.06 },   // 4-7年: 每年折6%
  { maxYear: 12, rate: 0.05 },  // 8-12年: 每年折5%
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
