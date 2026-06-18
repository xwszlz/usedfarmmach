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

// 折旧率（分年段）— 农机价值保持优于汽车
export const DEPRECIATION_TABLE = [
  { maxYear: 3, rate: 0.05 },   // 0-3年: 每年折4%
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
