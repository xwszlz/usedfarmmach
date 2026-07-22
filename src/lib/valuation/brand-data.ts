/**
 * AI估值引擎 — 品牌系数与基准价格
 * 数据来源：神雕库存表 + Agroline/e-farm/TractorHouse 国际价格
 */

// 品牌价值系数（>1.0 = 溢价品牌，<1.0 = 折价品牌）
export const BRAND_COEFFICIENTS: Record<string, number> = {
  // === 进口高端品牌 ===
  "克拉斯": 1.30,
  "CLAAS": 1.30,
  "克罗尼": 1.25,
  "Krone": 1.25,
  "约翰迪尔": 1.20,
  "John Deere": 1.20,
  "迪尔7250": 1.20,                        // 约翰迪尔子型号
  "芬特": 1.15,
  "Fendt": 1.15,
  "奥库": 1.15,       // 从0.85调到1.15，荷兰高端裹包机品牌（DENS-X全新150万+）
  "Orkel": 1.15,
  "纽荷兰": 1.10,
  "New Holland": 1.10,
  "凯斯": 1.10,
  "Case IH": 1.10,
  "曼尼通": 1.10,     // 法国伸缩臂叉车品牌
  "Manitou": 1.10,
  "麦赛弗格森": 1.05,
  "Massey Ferguson": 1.05,
  "库恩": 1.00,
  "Kuhn": 1.00,
  "进口": 1.00,       // 通用进口标签，按1.0处理
  "德国": 0.90,       // 通用德国标签
  "久保田": 0.90,     // 日系知名品牌 Kubota
  "格立莫": 0.95,
  "Grimme": 0.95,
  "格兰": 0.90,
  "法兰信": 0.90,                         // 法兰信伸缩臂
  // === 进口中端品牌 ===
  "东洋": 0.80,       // 日系
  "康斯凯尔": 0.80,
  "Kongskilde": 0.80,
  "Arcusin": 0.75,
  "arcusln": 0.75,                        // Arcusin变体
  "IDASS": 0.70,      // 未知品牌
  "马赛": 0.70,       // 未知品牌
  // === 国产品牌 ===
  "东方红": 0.65,
  "Dongfanghong": 0.65,
  "牧神": 0.60,
  "Mushen": 0.60,
  "牧农": 0.45,       // 国产青储机/打包机品牌（注意：DB中品牌名是"牧农"不是"牧神"）
  "迈科农机": 0.55,
  "德翔": 0.50,
  "Dexiang": 0.50,
  "盈嘉": 0.50,
  "Yingjia": 0.50,
  "都麦": 0.50,       // 国产割台
  "中联重科": 0.50,   // 国产收割机
  "罗斯特": 0.45,
  "RSM": 0.45,        // 国产青储机
  "中农机": 0.45,     // 国产收获机
  "金轮": 0.45,       // 国产伸缩臂
  "艾美特": 0.45,     // 国产甜菜机
  "奥贝斯": 0.45,     // 国产割台
  "冠军": 0.45,       // 国产割台
  "常发": 0.45,       // 国产茎穗双收
  "华夏": 0.45,       // 国产拖拉机
  "明宇": 0.45,       // 国产
  "美迪": 0.40,       // 国产青储机
  "迪马战狼": 0.40,   // 国产茎穗双收
  "雷沃": 0.50,       // 国产 (Lovol)
  "东风": 0.50,       // 国产
  "沃得": 0.50,       // 国产 (World)
  "谷王": 0.50,       // 国产
  "凯 斯": 1.10,      // DB中"凯斯"有空格的变体
  "废铁": 0.30,       // 最低
};

// 默认品牌系数
export const DEFAULT_BRAND_COEFFICIENT = 0.85;

// 品类基准新机价格（万元人民币）
// 注意：品类默认价应取该品类的**中低端**水平，高端型号通过MODEL_BASE_PRICES覆盖
export const CATEGORY_BASE_PRICES: Record<string, number> = {
  // === 已有品类（保守默认，高端型号由MODEL_BASE_PRICES覆盖）===
  "青储机": 100,     // 降低：原250万是CLAAS Jaguar级别，国产青储机仅15-30万
  "打捆机": 40,      // 降低：原120万是大圆捆级别，多数DB产品是小方捆/国产打包机
  "小方捆": 20,      // NH 5070/570, Case IH 等小方捆
  "大方捆": 80,      // NH 1290/870, CLAAS 5300RC, Krone 1290 等大方捆
  "圆捆机": 100,     // CLAAS Rollant, Krone 圆捆机
  "割草机": 40,      // 降低：原60万
  "裹包机": 30,      // 国产小裹包机基准，进口大型通过MODEL_BASE_PRICES覆盖
  "捡石机": 15,      // 降低：原20万
  "搂草机": 20,      // 降低：原35万
  "收获机": 40,      // 降低：原80万
  "拖拉机": 50,      // 降低：原100万
  "播种机": 30,      // 降低：原40万
  "码垛机": 20,      // 降低：原25万
  "捡拾台": 10,
  "割台": 10,
  "茎穗兼收机": 30,  // 降低：原50万
  // === 新增品类（根据数据库实际品类）===
  "单收": 6,                     // 降低：玉米单收机，国产小型
  "打包机": 25,                  // 降低：圆捆打包缠膜一体机
  "甜菜机": 20,                  // 降低：甜菜收获机
  "伸缩臂夹包机": 20,            // 降低：伸缩臂叉车
  "茎穗双收": 12,                // 降低：茎穗双收机，国产
  "风吸玉米脱粒机": 10,          // 降低：国产小型
  "自走式多功能牧草叉车": 25,    // 降低
  "粪污泵": 8,
  "三花犁": 8,
  "施肥机": 10,
  "喷洒机": 12,
  "挖掘机": 40,
  "装载机": 30,
  "配件": 3,                     // 降低：零配件
  "跑车": 20,
};

// 型号基准价格映射表（万元人民币）
// 用于根据 modelName 精确定位基准价，优先级高于品类匹配
export const MODEL_BASE_PRICES: Record<string, { category: string; basePrice: number }> = {
  // === 小方捆 ===
  "5070": { category: "小方捆", basePrice: 20 },
  "570": { category: "小方捆", basePrice: 22 },
  "9YDB": { category: "小方捆", basePrice: 8 },
  "9YY": { category: "小方捆", basePrice: 10 },
  "65": { category: "小方捆", basePrice: 18 },           // 克拉斯65小方捆

  // === 大方捆 ===
  "870": { category: "大方捆", basePrice: 65 },
  "1270": { category: "大方捆", basePrice: 70 },
  "1290": { category: "大方捆", basePrice: 75 },
  "5300RC": { category: "大方捆", basePrice: 80 },
  "890": { category: "大方捆", basePrice: 70 },
  "CF155": { category: "大方捆", basePrice: 75 },
  "1290XC": { category: "大方捆", basePrice: 75 },
  "9YG": { category: "大方捆", basePrice: 35 },
  "LSB1290": { category: "大方捆", basePrice: 75 },      // 库恩LSB1290
  "350RC": { category: "打包机", basePrice: 50 },        // 克拉斯350RC打包机

  // === 圆捆机 ===
  "Rollant": { category: "圆捆机", basePrice: 120 },
  "RP": { category: "圆捆机", basePrice: 110 },

  // === 青储机 ===
  "970": { category: "青储机", basePrice: 280 },         // CLAAS Jaguar 970
  "980": { category: "青储机", basePrice: 350 },         // CLAAS Jaguar 980
  "900": { category: "青储机", basePrice: 200 },         // CLAAS 900
  "9080": { category: "青储机", basePrice: 200 },        // 纽荷兰9080
  "FR500": { category: "青储机", basePrice: 180 },       // 纽荷兰FR500
  "FR9040": { category: "青储机", basePrice: 250 },      // 纽荷兰FR9040
  "FR450": { category: "青储机", basePrice: 150 },       // 纽荷兰FR450
  "8400": { category: "青储机", basePrice: 220 },        // 约翰迪尔8400
  "6950": { category: "青储机", basePrice: 150 },        // 约翰迪尔6950
  "600": { category: "青储机", basePrice: 180 },         // 克罗尼600
  "big420": { category: "青储机", basePrice: 120 },      // 克罗尼big420
  "9QS": { category: "青储机", basePrice: 15 },          // 美迪9QS国产青储机
  "YT": { category: "青储机", basePrice: 12 },           // 牧农YT国产青储机
  "RSM": { category: "青储机", basePrice: 18 },          // 罗斯特RSM国产青储机
  "2003FX50": { category: "青储机", basePrice: 80 },     // 纽荷兰2003FX50
  "375": { category: "青储机", basePrice: 60 },          // 纽荷兰375
  "695": { category: "青储机", basePrice: 100 },         // 克拉斯695
  "7250": { category: "青储机", basePrice: 180 },        // 约翰迪尔7250青储机
  "850": { category: "青储机", basePrice: 120 },         // 克拉斯850青储机
  "9040": { category: "青储机", basePrice: 200 },        // 纽荷兰9040/FR500(9040)

  // === 裹包机 ===
  "DENS-X": { category: "裹包机", basePrice: 160 },      // 奥库DENS-X 高端裹包机
  "DENS": { category: "裹包机", basePrice: 130 },        // 奥库DENS
  "2000": { category: "裹包机", basePrice: 100 },        // 奥库2000

  // === 拖拉机 ===
  "3404": { category: "拖拉机", basePrice: 120 },        // 麦赛弗格森3404
  "6603": { category: "拖拉机", basePrice: 50 },         // 约翰迪尔6603（中大型拖拉机，非旗舰）
  "LX2004": { category: "拖拉机", basePrice: 30 },       // 东方红LX2004
  "1804": { category: "拖拉机", basePrice: 25 },         // 华夏1804
  "3300RC": { category: "拖拉机", basePrice: 90 },       // 克拉斯3300RC拖拉机

  // === 割草机 ===
  "GP21C": { category: "割草机", basePrice: 15 },        // 牧农GP21C

  // === 搂草机 ===
  "9GL": { category: "搂草机", basePrice: 12 },          // 迈科9GL搂草机

  // === 收获机 ===
  "1000": { category: "收获机", basePrice: 80 },         // 格立莫1000
  "4QSZ": { category: "收获机", basePrice: 18 },         // 中农机4QSZ

  // === 风吸玉米脱粒机 ===
  "SDCML": { category: "风吸玉米脱粒机", basePrice: 12 },// 牧农SDCML

  // === 割台 ===
  "6200": { category: "割台", basePrice: 20 },           // 都麦6200
  "390": { category: "割台", basePrice: 12 },            // 冠军390
  "445": { category: "割台", basePrice: 15 },            // 冠军445
  "360": { category: "割台", basePrice: 10 },            // 冠军360
  "4500": { category: "割台", basePrice: 18 },           // 冠军4500

  // === 捡拾台 ===
  "PU300": { category: "捡拾台", basePrice: 18 },        // 克拉斯PU300
  "300": { category: "捡拾台", basePrice: 15 },          // 克拉斯300捡拾台

  // === 码垛机 ===
  "FSX63": { category: "码垛机", basePrice: 30 },        // Arcusin FSX63

  // === 伸缩臂夹包机 ===
  "MLT-X735": { category: "伸缩臂夹包机", basePrice: 40 },// 曼尼通MLT-X735
  "4008": { category: "伸缩臂夹包机", basePrice: 20 },   // 金轮4008

  // === 茎穗双收/兼收 ===
  "4YZB": { category: "茎穗兼收机", basePrice: 15 },     // 牧神4YZB
  "4Y2": { category: "茎穗双收", basePrice: 10 },        // 迪马战狼4Y2
  "MH202": { category: "茎穗双收", basePrice: 12 },      // 牧农MH202

  // === 单收 ===
  "4YZP": { category: "单收", basePrice: 8 },            // 废铁4YZP单收

  // === 甜菜机 ===
  "AMTY": { category: "甜菜机", basePrice: 15 },         // 艾美特AMTY

  // === 打包机（圆捆打包缠膜）===
  "cf155xc": { category: "打包机", basePrice: 50 },      // 克罗尼CF155XC打包缠膜
  "GP21C018": { category: "打包机", basePrice: 15 },     // 牧农GP打包机

  // === 播种机 ===
  "法国精播机": { category: "播种机", basePrice: 35 },   // 库恩精播机
  "挪威条播机": { category: "播种机", basePrice: 30 },   // 格兰条播机

  // === 捡石机 ===
  "Kongskilde": { category: "捡石机", basePrice: 20 },   // 康斯凯尔捡石机

  // === 收割机 ===
  "TE90": { category: "收割机", basePrice: 20 },         // 中联重科TE90
};

// 成色系数
export const CONDITION_FACTORS: Record<string, number> = {
  "excellent": 1.05,
  "good": 1.00,
  "fair": 0.90,
  "poor": 0.75,
};

// 折旧率（分年段）— 基于520万条补贴数据按年份分组校准
export const DEPRECIATION_TABLE = [
  { maxYear: 3, rate: 0.07 },   // 0-3年: 每年折7%（原5%，补贴数据校准）
  { maxYear: 7, rate: 0.08 },   // 4-7年: 每年折8%（原6%，补贴数据校准）
  { maxYear: 12, rate: 0.07 },  // 8-12年: 每年折7%（原5%，补贴数据校准）
  { maxYear: 999, rate: 0.05 }, // 13年+: 每年折5%（原4%，补贴数据校准）
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

// ========================================
// 数据驱动参数（基于520万条补贴数据库回归分析）
// 更新日期：2026-07-22
// 数据源：21省128文件，2022-2025年，去重后520万条
// ========================================

/**
 * 国产农机马力-价格回归模型
 * 数据来源：520万条农机补贴数据库（2022-2025年）
 * 用于：当品牌为国产且有马力数据时，通过回归公式计算新机基准价
 * 公式：新机价格 = pricePerHP × 马力 + intercept
 */
export const DOMESTIC_HP_REGRESSION: Record<string, {
  pricePerHP: number;   // 每马力单价（元/HP）
  intercept: number;    // 回归截距（元）
  r2: number;           // 拟合优度
  avgHP: number;        // 平均马力
  avgPrice: number;     // 平均价格（元）
  sampleSize: number;   // 样本量
}> = {
  "东方红":    { pricePerHP: 1240, intercept: -12840, r2: 0.6453, avgHP: 104.0, avgPrice: 116120, sampleSize: 3128 },
  "潍柴雷沃":  { pricePerHP: 1449, intercept: -30047, r2: 0.8044, avgHP: 107.6, avgPrice: 125865, sampleSize: 1386 },
  "雷沃":      { pricePerHP: 1303, intercept: -21045, r2: 0.8567, avgHP: 106.1, avgPrice: 117205, sampleSize: 1242 },
  "东风":      { pricePerHP: 1139, intercept: -9979,  r2: 0.9299, avgHP: 94.6,  avgPrice: 97780,  sampleSize: 865 },
  "沃得":      { pricePerHP: 1050, intercept: -13286, r2: 0.9176, avgHP: 87.3,  avgPrice: 78379,  sampleSize: 858 },
  "常发":      { pricePerHP: 1245, intercept: -20442, r2: 0.9064, avgHP: 115.7, avgPrice: 123605, sampleSize: 613 },
  "华夏":      { pricePerHP: 927,  intercept: -12718, r2: 0.8659, avgHP: 82.8,  avgPrice: 64038,  sampleSize: 523 },
  "泰山":      { pricePerHP: 903,  intercept: -8748,  r2: 0.9032, avgHP: 61.7,  avgPrice: 46927,  sampleSize: 493 },
  "中联":      { pricePerHP: 1247, intercept: -21624, r2: 0.9267, avgHP: 113.3, avgPrice: 119661, sampleSize: 169 },
  // 通用回归（全品牌汇总，R2=0.5147）
  "_default":  { pricePerHP: 1414, intercept: -33848, r2: 0.5147, avgHP: 100,   avgPrice: 100000, sampleSize: 14733 },
};

/**
 * 补贴数据品类中位价（元）
 * 当无马力数据时，用品类中位价作为新机基准价
 */
export const SUBSIDY_CATEGORY_PRICES: Record<string, { median: number; avg: number; count: number }> = {
  "轮式拖拉机":   { median: 63000,  avg: 97070,  count: 770121 },
  "收割机":       { median: 145000, avg: 144918, count: 295126 },
  "玉米收割机":   { median: 216000, avg: 226392, count: 138230 },
  "微耕机":       { median: 2500,   avg: 2579,   count: 1007612 },
  "旋耕机":       { median: 7000,   avg: 9774,   count: 564803 },
  "播种机":       { median: 6500,   avg: 11773,  count: 410381 },
  "插秧机":       { median: 20500,  avg: 45585,  count: 120078 },
  "耕作机具":     { median: 9800,   avg: 16292,  count: 113179 },
  "植保机":       { median: 44000,  avg: 43299,  count: 110678 },
  "烘干机":       { median: 3400,   avg: 32045,  count: 68553 },
  "秸秆处理机":   { median: 6600,   avg: 6650,   count: 266996 },
  "饲料加工机":   { median: 4300,   avg: 15783,  count: 64282 },
  "灌溉设备":     { median: 28000,  avg: 29014,  count: 28890 },
  "水稻收割机":   { median: 118000, avg: 116396, count: 5221 },
  "移栽机":       { median: 17600,  avg: 29610,  count: 3047 },
  "其他拖拉机":   { median: 116000, avg: 116517, count: 4060 },
  "手扶拖拉机":   { median: 12500,  avg: 12839,  count: 253 },
};

/**
 * 网站品类名 → 补贴数据品类名 映射
 */
export const CATEGORY_MAPPING: Record<string, string> = {
  "拖拉机": "轮式拖拉机",
  "收获机": "收割机",
  "收割机": "收割机",
  "青储机": "收割机",
  "打捆机": "秸秆处理机",
  "播种机": "播种机",
  "旋耕机": "旋耕机",
  "植保机": "植保机",
  "插秧机": "插秧机",
  "烘干机": "烘干机",
};

/**
 * 国产品牌溢价系数（基于补贴数据回归）
 * 相对市场中位价的溢价/折价比率
 * 用于：无马力数据时的品牌修正
 */
export const DOMESTIC_BRAND_PREMIUM: Record<string, number> = {
  "东方红":    1.50,   // +50.1%
  "潍柴雷沃":  1.50,   // +50.8%
  "雷沃":      1.49,   // +48.9%
  "道依茨法尔": 1.50,   // +50.8%
  "中联":      1.44,   // +43.8%
  "中联重科":  1.44,
  "英轩":      1.32,   // +31.7%
  "常发":      1.27,   // +27.0%
  "东风":      1.19,   // +19.0%
  "沃得":      1.03,   // +2.5%
  "五征":      0.86,   // -14.4%
  "悍沃":      0.85,   // -15.4%
  "华夏":      0.68,   // -31.7%
  "泰山":      0.65,   // -34.9%
  "萨丁":      0.65,
  "潍坊鲁中":  0.65,
  "双力现代":  0.65,
  "万年红拖":  0.54,   // -46.0%
  "瑞得拖拉":  0.52,   // -47.6%
  "常力工贸":  0.56,   // -44.4%
  "力王农业":  0.58,   // -42.2%
};

/**
 * 地区价格修正系数
 * 数据来源：补贴数据21省份均价分析
 * 已收缩范围避免产品结构差异导致的扭曲
 */
export const REGIONAL_FACTORS: Record<string, number> = {
  "黑龙江":    1.08,
  "新疆":      1.12,
  "辽宁":      1.04,
  "北大荒":    1.06,
  "河北":      1.04,
  "河南":      1.00,
  "山东":      0.97,
  "江西":      0.97,
  "山西":      0.94,
  "甘肃":      0.92,
  "湖北":      0.90,
  "广西":      0.88,
  "广东":      0.86,
  "贵州":      0.80,
  "_default":  1.00,
};

/**
 * 补贴退坡趋势因子
 * 补贴减少 → 新机实际成本上升 → 二手机相对更有价值
 * 2022年基准1.0，之后逐年小幅上升
 */
export const SUBSIDY_TREND_FACTOR: Record<number, number> = {
  2022: 1.00,
  2023: 1.02,
  2024: 1.04,
  2025: 1.05,
};

/**
 * 判断品牌是否为有补贴数据支持的国产品牌
 */
export function isDomesticBrandSupported(brand: string): boolean {
  const supportedBrands = Object.keys(DOMESTIC_HP_REGRESSION).filter(k => k !== "_default");
  return supportedBrands.some(b => brand.includes(b) || b.includes(brand));
}

/**
 * 获取地区修正系数
 */
export function getRegionalFactor(location?: string): number {
  if (!location) return REGIONAL_FACTORS._default;
  for (const [region, factor] of Object.entries(REGIONAL_FACTORS)) {
    if (region === "_default") continue;
    if (location.includes(region) || region.includes(location)) return factor;
  }
  return REGIONAL_FACTORS._default;
}

/**
 * 获取补贴趋势因子
 */
export function getSubsidyTrendFactor(year: number): number {
  if (SUBSIDY_TREND_FACTOR[year]) return SUBSIDY_TREND_FACTOR[year];
  if (year <= 2022) return 1.00;
  // 2025年以后继续递减但放缓
  const lastYear = Math.max(...Object.keys(SUBSIDY_TREND_FACTOR).map(Number));
  if (year > lastYear) {
    const decline = Math.min((year - lastYear) * 0.01, 0.05);
    return SUBSIDY_TREND_FACTOR[lastYear] * (1 + decline);
  }
  return 1.00;
}
