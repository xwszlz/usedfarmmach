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
  // === 进口 P0/P1 补齐（Phase B）===
  "Amazone": 1.15, "阿玛松": 1.15,        // 德系播种+自走植保双龙头
  "Horsch": 1.15, "霍尔希": 1.15, "豪斯": 1.15,  // 免耕播种全球标杆
  "Väderstad": 1.15, "维德斯塔": 1.15, "Vaderstad": 1.15, // 瑞典精量/免耕标杆
  "McHale": 1.15, "麦克海尔": 1.15,        // 圆捆机全球龙头
  "Lamborghini": 1.10, "兰博基尼": 1.10,   // SDF高端子品牌
  "Pöttinger": 1.10, "波廷格": 1.10, "Pottinger": 1.10, // 奥系青贮/打捆全能
  "Deutz-Fahr": 1.05, "道依茨法尔": 1.05,  // SDF旗舰
  "Yanmar": 0.95, "洋马": 0.95,            // 日系紧凑型
  "SAME": 1.00, "萨美": 1.00,              // SDF走量子品牌
  "Hardi": 1.00, "哈迪": 1.00,             // 丹麦植保中坚
  "Mahindra": 0.88, "马恒达": 0.88,        // 印度经济型出口霸主
  // === 进口 P2 长尾补齐 ===
  "Zetor": 0.90, "泽特": 0.90,             // 捷克实用型拖拉机
  "MTZ": 0.85, "明斯克": 0.85,              // 白俄罗斯经济型（全球保有量极大）
  "Rostselmash": 0.88,                     // 俄系收割机龙头（"罗斯特"与国产青储机 0.45 撞名，仅挂英文键）
  "Sampo": 0.95,                           // 芬兰（AGCO 旗下）
  "Jacto": 0.85, "雅克托": 0.85,           // 巴西植保机械
  "Iseki": 0.90, "井关": 0.90,             // 日本紧凑型
  "Mitsubishi": 0.90, "三菱": 0.90,        // 日本
  "BCS": 0.90,                             // 意大利专业拖拉机
  "Goldoni": 0.92, "戈尔多尼": 0.92,       // 意大利特种高端
  "Vermeer": 0.95, "弗米尔": 0.95,         // 美国特色机械
  "Valtra": 1.10, "维尔特拉": 1.10,        // AGCO 高端（页面下拉早有、引擎缺失）
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
  // === 国产小农机头部品牌（Phase A P0 补齐）===
  "农哈哈机": 0.80,
  "巨隆科技": 0.80,
  "双天机械": 1.02,
  "日照市立": 0.81,
  "圣和农业": 0.84,
  "鑫源农机": 1.02,
  "深圳市大": 1.02,
  "沃富机械": 0.90,
  "宗申通用": 1.02,
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
  // 必须置于"收获机"之前：否则"花生收获机"被子串匹配吞掉拿到40万（收获机级），
  // 而花生收获机新机实际仅5-15万，取中低端8万
  "花生收获机": 8,
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
  // 必须置于"三花犁"之前：否则通用"犁"被子串匹配吞掉拿到8万（三花犁级），
  // 通用铧式犁中低端取5万
  "犁": 5,
  "三花犁": 8,
  "施肥机": 10,
  "喷洒机": 12,
  "挖掘机": 40,
  "装载机": 30,
  "配件": 3,                     // 降低：零配件
  "跑车": 20,
  // === Phase B 新增品类 ===
  "免耕播种机": 70,     // Horsch/Väderstad/Amazone 新机60-120万
  "自走式植保机": 60,   // Amazone Pantera/Hardi 新机40-80万
  // === 2026-10-15 品类键补齐 ===
  // (a) 估值页国产下拉 15 品类：此前 10 个在 CATEGORY_BASE_PRICES / CATEGORY_MAPPING /
  //     SUBSIDY_CATEGORY_PRICES 中全部无键，无马力机器一律落 800,000 默认价
  // (b) Category 表 canonical 名（prisma/master-data/category.json）与估值表名对齐，
  //     修复 resolve-category 归一后新品估值落空
  "插秧机": 10,          // 进口高速插秧机（久保田/洋马）中低端新机
  "旋耕机": 4,           // 进口旋耕机中低端新机
  "穴播机": 4,
  "条播机": 3,           // Category 表 canonical 名（code=seed_drill）
  "秸秆粉碎还田机": 6,
  "微型耕耘机": 2,       // 与微耕机同级（步行式微耕新机1-3万）
  "微耕机": 2,
  "田园管理机": 2,       // 步行式园艺管理机新机1-3万
  "饲料粉碎机": 1,
  "辅助驾驶系统设备": 5, // 北斗/迪尔自动驾驶系统中低端新机3-10万
  "谷物联合收割机": 60,  // Category 表 canonical 名（code=combine）；进口联合收割机中低端
  "青贮饲料收获机": 100, // Category 表 canonical 名（code=forage_harvester），与"青储机"同价
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

// ============================================================
// Phase 1 估值升级参数（反超豆包免费报告）
// 设计目标：折旧从「机龄主导」升级为「工时主导」、新车锚定「补贴后到手价」、
//          增补买卖渠道四档折算与发动机品牌溢价。
// ============================================================

/**
 * 工时折旧曲线（累计残值率）
 * 设计依据：农机经济寿命约 10000-15000 小时。
 *   0-3000h：快速折旧（新机前段价值跌落最快）
 *   3000-8000h：匀速折旧
 *   >10000h：残值走平（接近机具底线）
 * 当提供真实工时即以此曲线作为主折旧因子，机龄仅作下限兜底，
 * 避免「机龄折旧」与「工时折旧」重复相乘导致过度贬值。
 *
 * [2026-10-14 专家校准重标定] 原曲线整体衰减过慢，较专家样本高估 45%~60%，
 * 且缺少专家强调的「新车转二手一次性购置折价 20-25%」（原 0h=1.00 完全无折价）。
 * 现按「专家纯曲线锚点」口径重标定：即剥离加装件溢价与发动机溢价后的纯折旧残值，
 * 校准样本 DOUBAO-TTQ2004-20261014（天拖TTQ2004，补贴后到手价 18.5万）。
 *   锚点  800h → 专家 0.607，本曲线 0.617（+1.6%）
 *   锚点 1600h → 专家 0.512，本曲线 0.527（+2.9%）
 *   锚点 2850h → 专家 0.431，本曲线 0.434（+0.8%）
 * 注：本曲线只描述「工时→纯折旧」，不含区域/补贴退坡/成色等因子；
 *     端到端估值仍可能因上述其他因子与专家结论存在偏差，属预期内、另行校准。
 */
export const HOURS_DEPRECIATION_CURVE: { maxHours: number; residual: number }[] = [
  { maxHours: 0,     residual: 0.79 },  // 购置折价约21%（专家口径 20-25%）
  { maxHours: 500,   residual: 0.665 },
  { maxHours: 1000,  residual: 0.585 },
  { maxHours: 2000,  residual: 0.488 },
  { maxHours: 3000,  residual: 0.425 },
  { maxHours: 5000,  residual: 0.360 },
  { maxHours: 8000,  residual: 0.300 },
  { maxHours: 10000, residual: 0.270 },
  { maxHours: 12000, residual: 0.245 },
  { maxHours: 15000, residual: 0.215 },
  { maxHours: 20000, residual: 0.180 },
];

/**
 * 国产农机「补贴后到手价」折算比率（指导价 × 比率 = 用户实际支付）
 * 数据来源：典型中央补贴比例（拖拉机 20-30%、收获机 15-25%）
 * 仅用于轨道B1（马力回归=指导价类比），使新机锚定价与豆包「到手价」口径一致，
 * 避免将裸指导价直接作为基准价导致二手机估值整体虚高。
 */
export const DOMESTIC_SUBSIDY_TO_HAND: Record<string, number> = {
  "拖拉机": 0.74,
  "轮式拖拉机": 0.74,
  "青储机": 0.80,
  "青贮饲料收获机": 0.80, // Category 表 canonical 名，与"青储机"同口径
  "收割机": 0.82,
  "打捆机": 0.85,
  "default": 0.82,
};

/**
 * 买卖渠道系数（成交价相对市场零售挂牌价的折算）
 * retail=零售挂牌价；dealer=经销商收购（折价）；consignment=寄售委托；auction=拍卖成交（最低）
 * 用于给出「同一台机在不同流通渠道」的差异化报价，对齐豆包渠道折价逻辑。
 */
export const TRADE_CHANNEL_FACTORS: Record<string, number> = {
  "retail": 1.00,        // 零售挂牌价
  "dealer": 0.88,        // 经销商/商贩收购价（专家隐含 0.861，偏差 +2.2%）
  // 寄售：专家口径为「接近公允零售价，仅扣 3-5% 服务费」→ 0.95~0.97，取中 0.96。
  // 原 0.85 等于额外多砍 15%，属过度折价，2026-10-14 按专家样本校准上调。
  "consignment": 0.96,   // 寄售委托价（扣服务费后）
  "auction": 0.80,       // 拍卖成交价（专家隐含 0.785，偏差 +1.9%）
  "default": 1.00,
};

/**
 * 发动机品牌溢价系数（动力总成品牌影响整机保值）
 * 潍柴/玉柴等头部动力品牌在二手市场有 3-6% 的保值加成。
 */
export const ENGINE_BRAND_PREMIUM: Record<string, number> = {
  "潍柴": 1.06, "WEICHAI": 1.06,
  "玉柴": 1.04, "YUCHAI": 1.04,
  "上柴": 1.03, "上汽": 1.03,
  "锡柴": 1.03, "FAW": 1.03,
  "道依茨": 1.05, "DEUTZ": 1.05,
  "康明斯": 1.05, "Cummins": 1.05,
  "珀金斯": 1.04, "Perkins": 1.04,
  "default": 1.00,
};

/** 获取发动机品牌溢价系数（模糊匹配） */
export function getEngineBrandPremium(engineBrand?: string): number {
  if (!engineBrand) return 1.0;
  if (ENGINE_BRAND_PREMIUM[engineBrand]) return ENGINE_BRAND_PREMIUM[engineBrand];
  for (const [key, val] of Object.entries(ENGINE_BRAND_PREMIUM)) {
    if (key === "default") continue;
    if (engineBrand.includes(key) || key.includes(engineBrand)) return val;
  }
  return 1.0;
}

// ============================================================
// 分品类折旧参数（2026-10-14 专家校准 + ASABE/ORNL 权威系数）
// ============================================================

/**
 * 品类年工时基准 A（h/年）。
 * null = 该品类无发动机小时表（无动力配套农具/附件），不接受工时输入。
 * 数据来源：中国实地调研（拖拉机 660、本地收割机 300、跨区 1000、播种 280、
 * 植保 250、旋耕 380）与平台进口青储机挂牌实测（344，n=15）。
 */
export const CATEGORY_ANNUAL_HOURS: Record<string, number | null> = {
  轮式拖拉机: 660,
  拖拉机: 660,
  青储机: 350,
  青贮饲料收获机: 350,
  收获机: 300,
  收割机: 300,
  谷物联合收割机: 300,
  玉米收割机: 500,
  玉米收获机: 500,
  水稻收割机: 500,
  插秧机: 250,
  播种机: 280,
  单粒精密播种机: 280,   // 类比播种机（同为播种作业机械）
  穴播机: 280,
  条播机: 280,
  花生收获机: 300,       // 类比收获机/收割机（收割作业强度）
  植保机: 250,
  割草机: 350,
  伸缩臂夹包机: 300,
  自走式多功能牧草叉车: 300,
  田园管理机: 200,       // 估算：步行式管理机果园/田园轻度使用（150-250h/年）
  // 无发动机小时表：无动力配套农具与附件
  旋耕机: null,
  打捆机: null,
  小方捆: null,
  大方捆: null,
  圆捆机: null,
  割台: null,
  捡拾台: null,
  裹包机: null,
  码垛机: null,
  打包机: null,
  搂草机: null,
  秸秆处理机: null,
  耕作机具: null,
  微耕机: null,
  微型耕耘机: null,      // 类比微耕机
  犁: null,              // 无动力配套农具
  秸秆粉碎还田机: null,  // 无自带动力，类比秸秆处理机
  饲料粉碎机: null,      // 类比饲料加工机
  辅助驾驶系统设备: null, // 电子设备，无发动机工时表
  饲料加工机: null,
  烘干机: null,
  灌溉设备: null,
  移栽机: null,
  default: 500,
};

/**
 * 逐品类 ASABE 残值系数 `RV = max(C1 − C2·√n − C3·√h, 0)²`
 *   n = 机龄（年）；h = 年均工时；c3 = null 表示该类别无工时项（ASABE 原文：
 *   only powered equipment has a coefficient on hours of annual use）。
 * 来源：ANSI ASABE D497-4-2003，经美国能源部 ORNL Pub11927 明文指定类别归属。
 *
 * ⚠️ 青储机/青贮饲料收获机 归 **Swathers & all other harvest equipment**，
 *    不是 Combines——用错会在 y10–y12 低估 33%~52%（青储机为平台第一大品类）。
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║ 🚫 用途声明：这是「参考模型」，**未接入估值主链路**，请勿直接调用。      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 * 主链路仍用 `DEPRECIATION_TABLE`(机龄) + `HOURS_DEPRECIATION_CURVE`(工时)，
 * 本表只允许出现在校准报告的「外部模型参考列」。三条不接入的理由：
 *  (a) 公式里的 h 是**年均工时**而非累计工时（ORNL Pub11927 Eq 2-4），因此
 *      C3·√h 在整机寿命内是恒定项——ASABE 对单机工时差异只有约 ±5pp 的敏感度，
 *      它撑不起「按工时定价」这条主链路（同一机龄不同工时几乎给出同一个残值）。
 *  (b) 绝对水平不可信：各品类 C1² 跨度 0.545~1.281，联合收割机 C1²=1.281
 *      （>100%，即 0 年机残值高于新机价），不能直接当残值率用。
 *  (c) 即使把 C1² 归一化到 1.0 再代入唯一专家样本（天拖 TTQ2004，4 年 / 1600h），
 *      仍与专家锚点差约 −23%，未通过专家校验。
 * 参数表本身保留，供后续按品类标定 / 交叉验证时引用。
 */
export const CATEGORY_ASABE_PARAMS: Record<string, { c1: number; c2: number; c3: number | null }> = {
  轮式拖拉机: { c1: 0.9756, c2: 0.1187, c3: 0.0019 },
  拖拉机: { c1: 0.9756, c2: 0.1187, c3: 0.0019 },
  其他拖拉机: { c1: 0.9421, c2: 0.0997, c3: 0.0008 },
  手扶拖拉机: { c1: 0.9809, c2: 0.0934, c3: 0.0058 },
  收获机: { c1: 1.1318, c2: 0.1645, c3: 0.0079 },
  收割机: { c1: 1.1318, c2: 0.1645, c3: 0.0079 },
  玉米收割机: { c1: 1.1318, c2: 0.1645, c3: 0.0079 },
  玉米收获机: { c1: 1.1318, c2: 0.1645, c3: 0.0079 },
  水稻收割机: { c1: 1.1318, c2: 0.1645, c3: 0.0079 },
  // ★ 青储机 = Swathers，不是 Combines
  青储机: { c1: 0.7911, c2: 0.0913, c3: null },
  青贮饲料收获机: { c1: 0.7911, c2: 0.0913, c3: null },
  茎穗双收: { c1: 0.7911, c2: 0.0913, c3: null },
  茎穗兼收机: { c1: 0.7911, c2: 0.0913, c3: null },
  甜菜机: { c1: 0.7911, c2: 0.0913, c3: null },
  搂草机: { c1: 0.7911, c2: 0.0913, c3: null },
  打捆机: { c1: 0.8521, c2: 0.1014, c3: null },
  小方捆: { c1: 0.8521, c2: 0.1014, c3: null },
  大方捆: { c1: 0.8521, c2: 0.1014, c3: null },
  圆捆机: { c1: 0.8521, c2: 0.1014, c3: null },
  裹包机: { c1: 0.8521, c2: 0.1014, c3: null },
  打包机: { c1: 0.8521, c2: 0.1014, c3: null },
  播种机: { c1: 0.8826, c2: 0.0778, c3: null },
  割草机: { c1: 0.7557, c2: 0.0672, c3: null },
  旋耕机: { c1: 0.891, c2: 0.11, c3: null },
  耕作机具: { c1: 0.891, c2: 0.11, c3: null },
  秸秆处理机: { c1: 0.891, c2: 0.11, c3: null },
  捡石机: { c1: 0.891, c2: 0.11, c3: null },
  插秧机: { c1: 0.8826, c2: 0.0778, c3: null },
  移栽机: { c1: 0.8826, c2: 0.0778, c3: null },
  植保机: { c1: 0.9427, c2: 0.1111, c3: null },
  施肥机: { c1: 0.9427, c2: 0.1111, c3: null },
  伸缩臂夹包机: { c1: 0.7858, c2: 0.0629, c3: 0.0033 },
  自走式多功能牧草叉车: { c1: 0.7858, c2: 0.0629, c3: 0.0033 },
  码垛机: { c1: 0.9427, c2: 0.1111, c3: null },
  // 附件：取主机系数，无工时项
  割台: { c1: 0.7911, c2: 0.0913, c3: null },
  捡拾台: { c1: 0.7911, c2: 0.0913, c3: null },
  default: { c1: 0.9427, c2: 0.1111, c3: null },
};

/**
 * [已弃用] 原 ASABE 机龄曲线品类白名单。
 * y9+ 切换现由 `isAsabeAgeEnabled(category)` 基于 `CATEGORY_ASABE_PARAMS` 是否存在
 * 非 default 专属系数来判定，新增 ASABE 系数即自动纳入，无需维护此白名单。
 * 保留空数组仅为兼容可能的历史引用，不再参与主链路判定。
 */
export const CATEGORY_ASABE_ENABLED: string[] = [];

/**
 * 四段机龄表的残值率（单一真源）。
 * `formulas.ts` 的 calcYearFactor 与校准库的机龄锚点对比共用此实现，
 * 避免两处各写一份导致口径漂移。逻辑与 DEPRECIATION_TABLE 严格对应：
 *   0-3 年 7%/yr、4-7 年 8%/yr、8-12 年 7%/yr、13 年+ 5%/yr，最后夹到 MIN_RESIDUAL_RATIO。
 */
export function calcAgeTableResidual(ageYears: number, category?: string): number {
  if (ageYears <= 0) return 1.0;

  // y9+（机龄 > TRACTOR_EXPERT_AGE_MAX_YEAR）启用 ASABE 残值曲线替代机龄表外推，
  // 修复高龄机（y10+）残值崩塌至 MIN_RESIDUAL_RATIO 的问题。
  // 仅对「拥有专属 ASABE 系数」的品类生效（按 CATEGORY_ASABE_PARAMS 是否存在非 default 项判定）。
  if (ageYears > TRACTOR_EXPERT_AGE_MAX_YEAR && isAsabeAgeEnabled(category)) {
    return calcAsabeResidual(getCategoryAsabeParams(category), ageYears, null);
  }

  let remaining = 1.0;
  let yearsLeft = Math.min(ageYears, DEPRECIATION_TABLE[0].maxYear);
  remaining -= yearsLeft * DEPRECIATION_TABLE[0].rate;

  if (ageYears > DEPRECIATION_TABLE[0].maxYear) {
    const start = DEPRECIATION_TABLE[0].maxYear;
    const span = DEPRECIATION_TABLE[1].maxYear - DEPRECIATION_TABLE[0].maxYear;
    yearsLeft = Math.min(ageYears - start, span);
    remaining -= yearsLeft * DEPRECIATION_TABLE[1].rate;
  }
  if (ageYears > DEPRECIATION_TABLE[1].maxYear) {
    const start = DEPRECIATION_TABLE[1].maxYear;
    const span = DEPRECIATION_TABLE[2].maxYear - DEPRECIATION_TABLE[1].maxYear;
    yearsLeft = Math.min(ageYears - start, span);
    remaining -= yearsLeft * DEPRECIATION_TABLE[2].rate;
  }
  if (ageYears > DEPRECIATION_TABLE[2].maxYear) {
    yearsLeft = ageYears - DEPRECIATION_TABLE[2].maxYear;
    remaining -= yearsLeft * DEPRECIATION_TABLE[3].rate;
  }

  return Math.max(remaining, MIN_RESIDUAL_RATIO);
}

/**
 * 轮式拖拉机机龄表的专家锚点保护上限（年）。
 * 轮式拖拉机是唯一拥有外部专家基准（豆包 TTQ2004 报告）的品类：
 * y1–y8 沿用已用专家样本标定的现行 `DEPRECIATION_TABLE`，y9+ 才切到 ASABE。
 * 这样既保住端到端验证（10.14万 vs 专家 10.45万，−2.95%），又修掉 y10+ 的高龄机崩塌。
 */
export const TRACTOR_EXPERT_AGE_MAX_YEAR = 8;

/**
 * 品类是否启用「y9+ 切 ASABE 机龄曲线」。
 * 判定依据：该品类在 `CATEGORY_ASABE_PARAMS` 中是否存在专属系数（非 `default` 兜底）。
 * 这样新增 ASABE 系数即自动纳入 y9+ 切换，无需另行维护白名单，且与校准库共用同一真源。
 */
export function isAsabeAgeEnabled(category?: string): boolean {
  if (!category) return false;
  if (category in CATEGORY_ASABE_PARAMS) return category !== "default";
  for (const key of Object.keys(CATEGORY_ASABE_PARAMS)) {
    if (key === "default") continue;
    if (category.includes(key) || key.includes(category)) return true;
  }
  return false;
}

/** 模糊匹配取品类年工时基准（null 表示不接受工时输入） */
export function getCategoryAnnualHours(category?: string): number | null {
  if (!category) return CATEGORY_ANNUAL_HOURS.default;
  if (category in CATEGORY_ANNUAL_HOURS) return CATEGORY_ANNUAL_HOURS[category];
  for (const key of Object.keys(CATEGORY_ANNUAL_HOURS)) {
    if (key === "default") continue;
    if (category.includes(key) || key.includes(category)) return CATEGORY_ANNUAL_HOURS[key];
  }
  return CATEGORY_ANNUAL_HOURS.default;
}

/** 模糊匹配取品类 ASABE 系数 */
export function getCategoryAsabeParams(
  category?: string
): { c1: number; c2: number; c3: number | null } {
  if (!category) return CATEGORY_ASABE_PARAMS.default;
  if (category in CATEGORY_ASABE_PARAMS) return CATEGORY_ASABE_PARAMS[category];
  for (const key of Object.keys(CATEGORY_ASABE_PARAMS)) {
    if (key === "default") continue;
    if (category.includes(key) || key.includes(category)) return CATEGORY_ASABE_PARAMS[key];
  }
  return CATEGORY_ASABE_PARAMS.default;
}

/**
 * ASABE 残值计算（带护栏）。
 * 内层必须 >= 0，否则平方项会让残值反弹、模型反向（"越残旧越值钱"）。
 * 结果再夹到 [MIN_RESIDUAL_RATIO, 1]。
 */
export function calcAsabeResidual(
  params: { c1: number; c2: number; c3: number | null },
  ageYears: number,
  annualHours: number | null
): number {
  const n = Math.max(ageYears, 0);
  const hoursTerm = params.c3 != null && annualHours ? params.c3 * Math.sqrt(Math.max(annualHours, 0)) : 0;
  const base = params.c1 - params.c2 * Math.sqrt(n) - hoursTerm;
  const rv = Math.pow(Math.max(base, 0), 2);
  return Math.min(Math.max(rv, MIN_RESIDUAL_RATIO), 1);
}

/** 获取买卖渠道折算系数（模糊匹配） */
export function getTradeChannelFactor(channel?: string): number {
  if (!channel) return TRADE_CHANNEL_FACTORS.default;
  if (TRADE_CHANNEL_FACTORS[channel]) return TRADE_CHANNEL_FACTORS[channel];
  for (const [key, val] of Object.entries(TRADE_CHANNEL_FACTORS)) {
    if (key === "default") continue;
    if (channel.includes(key) || key.includes(channel)) return val;
  }
  return TRADE_CHANNEL_FACTORS.default;
}

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
  // 天拖/铁牛（天津拖拉机厂，国产二线头部，弱于东方红/雷沃一线）
  "天拖铁牛":  { pricePerHP: 1200, intercept: -4000, r2: 0.55, avgHP: 160, avgPrice: 190000, sampleSize: 80 },
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
  // Category 表 canonical 名 → 补贴数据品类（2026-10-15 补齐）
  "青贮饲料收获机": "收割机",
  "谷物联合收割机": "收割机",
  "玉米收获机": "玉米收割机",
  "打捆机": "秸秆处理机",
  "播种机": "播种机",
  "单粒精密播种机": "播种机",
  "穴播机": "播种机",
  "条播机": "播种机",
  "犁": "耕作机具",
  "秸秆粉碎还田机": "秸秆处理机",
  "微型耕耘机": "微耕机",
  "饲料粉碎机": "饲料加工机",
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
  // === 国产小农机头部品牌（Phase A P0 补齐）===
  "农哈哈机":  0.80,   // 播种机头部，主销低价机型，溢价比0.664裁剪至下限
  "巨隆科技":  0.80,   // 旋耕机头部，溢价比0.699裁剪至下限
  "双天机械":  1.02,   // 旋耕机头部，溢价比1.174封顶
  "日照市立":  0.81,   // 微耕机头部，溢价比0.809
  "圣和农业":  0.84,   // 旋耕机头部，溢价比0.844
  "鑫源农机":  1.02,   // 微耕机头部，溢价比1.046封顶
  "深圳市大":  1.02,   // 植保机头部，溢价比1.124封顶
  "沃富机械":  0.90,   // 微耕机头部，溢价比0.897
  "宗申通用":  1.02,   // 微耕机头部，溢价比1.050封顶
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
  // === Phase A 补齐 5 省 ===
  "上海":      1.15,   // 样本少(112)，高价设备拉高，封顶
  "北京":      0.80,   // 样本少(268)，封底
  "天津":      1.15,   // 样本少(543)，封顶
  "海南":      1.15,   // 样本少(239)，封顶
  "青海":      0.91,   // 样本605，比值0.907
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
  // Phase A：将"有补贴数据支持"的认定范围从仅马力回归品牌，扩展到含品牌溢价表的国产品牌
  // （DOMESTIC_BRAND_PREMIUM 仅含国产品牌，不会误伤进口品牌）
  const hpBrands = Object.keys(DOMESTIC_HP_REGRESSION).filter(k => k !== "_default");
  const premiumBrands = Object.keys(DOMESTIC_BRAND_PREMIUM);
  const domesticBrands = [...hpBrands, ...premiumBrands];
  return domesticBrands.some(b => brand.includes(b) || b.includes(brand));
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

/**
 * 补贴数据库年度价格走势（真实历史数据）
 * 数据来源：520万条补贴数据库（2022-2025年，21省128文件）
 * 用于：深度分析报告中的国产农机价格走势柱状图
 */
export interface SubsidyYearDatum {
  year: number;
  avgPrice: number;     // 平均售价（元）
  avgSubsidy: number;   // 平均补贴（元）
  count: number;        // 样本量
}

export const SUBSIDY_PRICE_HISTORY_BY_CATEGORY: Record<string, SubsidyYearDatum[]> = {
  "轮式拖拉机": [
    { year: 2022, avgPrice: 89744, avgSubsidy: 20535, count: 4660 },
    { year: 2023, avgPrice: 102368, avgSubsidy: 19286, count: 2480 },
    { year: 2024, avgPrice: 93576, avgSubsidy: 14746, count: 4151 },
    { year: 2025, avgPrice: 109505, avgSubsidy: 16284, count: 3442 },
  ],
  "收割机": [
    { year: 2022, avgPrice: 130420, avgSubsidy: 28605, count: 1635 },
    { year: 2023, avgPrice: 198249, avgSubsidy: 37382, count: 851 },
    { year: 2024, avgPrice: 130269, avgSubsidy: 24576, count: 1557 },
    { year: 2025, avgPrice: 145013, avgSubsidy: 28225, count: 1595 },
  ],
  "玉米收割机": [
    { year: 2022, avgPrice: 207913, avgSubsidy: 50435, count: 921 },
    { year: 2023, avgPrice: 230983, avgSubsidy: 50593, count: 456 },
    { year: 2024, avgPrice: 230212, avgSubsidy: 51540, count: 748 },
    { year: 2025, avgPrice: 244972, avgSubsidy: 50150, count: 571 },
  ],
  "旋耕机": [
    { year: 2022, avgPrice: 10529, avgSubsidy: 2339, count: 2954 },
    { year: 2023, avgPrice: 9701, avgSubsidy: 2046, count: 1700 },
    { year: 2024, avgPrice: 10066, avgSubsidy: 2021, count: 3614 },
    { year: 2025, avgPrice: 9346, avgSubsidy: 1799, count: 2515 },
  ],
  "播种机": [
    { year: 2022, avgPrice: 10819, avgSubsidy: 2472, count: 1547 },
    { year: 2023, avgPrice: 13361, avgSubsidy: 3163, count: 1566 },
    { year: 2024, avgPrice: 9673, avgSubsidy: 2159, count: 2589 },
    { year: 2025, avgPrice: 13842, avgSubsidy: 3209, count: 2213 },
  ],
  "插秧机": [
    { year: 2022, avgPrice: 43069, avgSubsidy: 14146, count: 665 },
    { year: 2023, avgPrice: 44702, avgSubsidy: 15283, count: 419 },
    { year: 2024, avgPrice: 52185, avgSubsidy: 17429, count: 621 },
    { year: 2025, avgPrice: 40813, avgSubsidy: 11581, count: 633 },
  ],
  "植保机": [
    { year: 2022, avgPrice: 44037, avgSubsidy: 10855, count: 311 },
    { year: 2023, avgPrice: 43606, avgSubsidy: 9734, count: 288 },
    { year: 2024, avgPrice: 41400, avgSubsidy: 10596, count: 428 },
    { year: 2025, avgPrice: 43332, avgSubsidy: 12900, count: 1197 },
  ],
  "微耕机": [
    { year: 2022, avgPrice: 2600, avgSubsidy: 670, count: 3989 },
    { year: 2023, avgPrice: 2454, avgSubsidy: 656, count: 3055 },
    { year: 2024, avgPrice: 2469, avgSubsidy: 674, count: 4634 },
    { year: 2025, avgPrice: 2696, avgSubsidy: 745, count: 7521 },
  ],
};

export const SUBSIDY_PRICE_HISTORY_BY_BRAND: Record<string, SubsidyYearDatum[]> = {
  "东方红": [
    { year: 2022, avgPrice: 102621, avgSubsidy: 20927, count: 1001 },
    { year: 2023, avgPrice: 119423, avgSubsidy: 19585, count: 469 },
    { year: 2024, avgPrice: 114983, avgSubsidy: 16065, count: 999 },
    { year: 2025, avgPrice: 136005, avgSubsidy: 21089, count: 661 },
  ],
  "潍柴雷沃": [
    { year: 2023, avgPrice: 149199, avgSubsidy: 26134, count: 317 },
    { year: 2024, avgPrice: 161493, avgSubsidy: 27222, count: 1296 },
    { year: 2025, avgPrice: 173419, avgSubsidy: 31717, count: 964 },
  ],
  "雷沃": [
    { year: 2022, avgPrice: 137630, avgSubsidy: 30336, count: 1302 },
    { year: 2023, avgPrice: 145553, avgSubsidy: 30154, count: 454 },
    { year: 2024, avgPrice: 149215, avgSubsidy: 26378, count: 162 },
    { year: 2025, avgPrice: 174874, avgSubsidy: 31465, count: 275 },
  ],
  "东风": [
    { year: 2022, avgPrice: 95050, avgSubsidy: 22109, count: 299 },
    { year: 2023, avgPrice: 101443, avgSubsidy: 21085, count: 154 },
    { year: 2024, avgPrice: 93831, avgSubsidy: 15854, count: 248 },
    { year: 2025, avgPrice: 98405, avgSubsidy: 13747, count: 211 },
  ],
  "沃得": [
    { year: 2022, avgPrice: 114865, avgSubsidy: 26626, count: 939 },
    { year: 2023, avgPrice: 188771, avgSubsidy: 36317, count: 498 },
    { year: 2024, avgPrice: 111908, avgSubsidy: 25077, count: 633 },
    { year: 2025, avgPrice: 136281, avgSubsidy: 29716, count: 678 },
  ],
  "常发": [
    { year: 2022, avgPrice: 97333, avgSubsidy: 24033, count: 201 },
    { year: 2023, avgPrice: 121887, avgSubsidy: 25888, count: 89 },
    { year: 2024, avgPrice: 105375, avgSubsidy: 17403, count: 199 },
    { year: 2025, avgPrice: 123881, avgSubsidy: 16066, count: 210 },
  ],
  "华夏": [
    { year: 2022, avgPrice: 67823, avgSubsidy: 18446, count: 156 },
    { year: 2023, avgPrice: 76129, avgSubsidy: 19623, count: 86 },
    { year: 2024, avgPrice: 58920, avgSubsidy: 11317, count: 186 },
    { year: 2025, avgPrice: 56898, avgSubsidy: 10008, count: 95 },
  ],
  "久保田": [
    { year: 2022, avgPrice: 102511, avgSubsidy: 18817, count: 197 },
    { year: 2023, avgPrice: 130270, avgSubsidy: 21405, count: 140 },
    { year: 2024, avgPrice: 132488, avgSubsidy: 22520, count: 171 },
    { year: 2025, avgPrice: 98560, avgSubsidy: 16951, count: 265 },
  ],
};

/**
 * 获取品牌或品类的补贴价格走势
 * 优先按品牌匹配，其次按品类映射
 */
export function getSubsidyPriceHistory(brand: string, category: string): SubsidyYearDatum[] {
  // 先尝试品牌精确匹配
  if (brand && SUBSIDY_PRICE_HISTORY_BY_BRAND[brand]) {
    return SUBSIDY_PRICE_HISTORY_BY_BRAND[brand];
  }
  // 模糊匹配品牌
  if (brand) {
    for (const [key, data] of Object.entries(SUBSIDY_PRICE_HISTORY_BY_BRAND)) {
      if (brand.includes(key) || key.includes(brand)) return data;
    }
  }
  // 品类映射
  const mappedCat = CATEGORY_MAPPING[category] || category;
  if (mappedCat && SUBSIDY_PRICE_HISTORY_BY_CATEGORY[mappedCat]) {
    return SUBSIDY_PRICE_HISTORY_BY_CATEGORY[mappedCat];
  }
  // 模糊匹配品类
  if (category) {
    for (const [key, data] of Object.entries(SUBSIDY_PRICE_HISTORY_BY_CATEGORY)) {
      if (category.includes(key) || key.includes(category)) return data;
    }
  }
  return [];
}

// ============================================================
// T04：主数据 code → 基准价映射（由 master-data 字典派生）
// 生成规则：
//   1) CATEGORY_BASE_PRICES_BY_CODE —— 对 category.json 的 display_name，复用与名路径
//      完全相同的「首个可匹配键」逻辑（插入顺序，key⊆display_name 或反之）映射到现有
//      CATEGORY_BASE_PRICES 数值。
//   2) MODEL_BASE_PRICES_BY_CODE —— 对 model.json 的 display_name，复刻 formulas.ts 的
//      型号匹配（长度降序→精确→子串+品类一致），命中则取该型号的基准价；否则用
//      CATEGORY_BASE_PRICES_BY_CODE[categoryCode] 兜底。
// 未映射到 code 的品类/机型在解析层返回 null，自动回退到名匹配路径，保证零回归。
// ============================================================

// 品类 code（category.json）→ 基准新机价（万元）
export const CATEGORY_BASE_PRICES_BY_CODE: Record<string, number> = {
  "baler": 40, "combine": 80, "corn_harvester": 30, "cotton_harvester": 80, "disc_harrow": 80,
  "forage_harvester": 100, "harvester": 40, "mower": 40, "planter": 30, "plow": 8, "rake": 20,
  "round_baler": 80, "square_baler": 20, "tractor": 50
};

// 机型 code（model.json）→ { 品类 code, 基准新机价（万元） }
export const MODEL_BASE_PRICES_BY_CODE: Record<string, { categoryCode: string; basePrice: number }> = {
  "claas_jaguar_870":    { categoryCode: "forage_harvester", basePrice: 65 },
  "claas_quadrant_5300": { categoryCode: "square_baler",     basePrice: 15 },
  "deere_8400":          { categoryCode: "tractor",          basePrice: 220 },
  "nh_fr9000":           { categoryCode: "forage_harvester", basePrice: 200 },
  "yto_lx1804":          { categoryCode: "tractor",          basePrice: 25 },
};
