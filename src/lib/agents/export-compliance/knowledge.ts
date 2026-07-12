/**
 * #10 出口合规 Agent — 知识库
 *
 * 包含三大知识库：
 *   1. 品牌知识产权备案（商标/专利/出口限制）
 *   2. 目标国认证要求（EAC/CE/INMETRO/SASO...）
 *   3. 出口成本链参数（运费/关税/杂费）
 */

// ═══════════════════════════════════════════
// 1. 品牌知识产权备案
// ═══════════════════════════════════════════

export interface BrandIPRecord {
  brandId: string;
  brandName: string;
  /** 商标注册国（ISO 3166-1 alpha-2） */
  trademarkCountries: string[];
  /** 核心专利覆盖区域 */
  patentRegions: string[];
  /** 出口限制提示 */
  exportRestrictions: {
    targetCountry: string;
    restriction: string;
    severity: "none" | "caution" | "restricted";
  }[];
  /** 品牌归属集团 */
  parentCompany: string;
  /** 是否可安全出口到目标国 */
  safeExportCountries: string[];
}

export const BRAND_IP_REGISTRY: BrandIPRecord[] = [
  {
    brandId: "john-deere",
    brandName: "John Deere (约翰迪尔)",
    trademarkCountries: ["US", "CN", "DE", "FR", "BR", "RU", "IN", "AU", "KZ", "ZA"],
    patentRegions: ["US", "EU", "CN", "BR"],
    parentCompany: "Deere & Company (NYSE: DE)",
    safeExportCountries: ["KZ", "RU", "UZ", "BR", "AR", "SA", "AE", "EG", "NG", "ZA", "IN", "MX", "AU", "TR"],
    exportRestrictions: [
      { targetCountry: "RU", restriction: "美制品牌受西方对俄制裁影响，二手设备出口需确认OFAC合规", severity: "caution" },
      { targetCountry: "BY", restriction: "白俄罗斯受制裁，美制品牌出口受限", severity: "restricted" },
      { targetCountry: "IR", restriction: "伊朗受全面制裁，禁止出口", severity: "restricted" },
    ],
  },
  {
    brandId: "claas",
    brandName: "CLAAS (克拉斯)",
    trademarkCountries: ["DE", "FR", "US", "CN", "RU", "BR", "KZ", "IN", "TR"],
    patentRegions: ["EU", "US", "CN"],
    parentCompany: "CLAAS KGaA mbH (德国家族企业)",
    safeExportCountries: ["KZ", "RU", "UZ", "BR", "AR", "SA", "AE", "EG", "NG", "ZA", "IN", "MX", "AU", "TR"],
    exportRestrictions: [
      { targetCountry: "RU", restriction: "德国品牌，二手设备对俄出口需确认EU制裁清单（第833/2014号条例修订）", severity: "caution" },
    ],
  },
  {
    brandId: "case-ih",
    brandName: "Case IH (凯斯)",
    trademarkCountries: ["US", "CN", "DE", "FR", "BR", "RU", "KZ", "IN", "ZA"],
    patentRegions: ["US", "EU", "CN"],
    parentCompany: "CNH Industrial (NYSE: CNH)",
    safeExportCountries: ["KZ", "RU", "UZ", "BR", "AR", "SA", "AE", "EG", "NG", "ZA", "IN", "MX", "AU", "TR"],
    exportRestrictions: [
      { targetCountry: "RU", restriction: "美制品牌受西方对俄制裁影响，需确认OFAC合规", severity: "caution" },
      { targetCountry: "BY", restriction: "白俄罗斯受制裁，出口受限", severity: "restricted" },
    ],
  },
  {
    brandId: "new-holland",
    brandName: "New Holland (纽荷兰)",
    trademarkCountries: ["US", "CN", "DE", "FR", "BR", "RU", "KZ", "IN", "ZA"],
    patentRegions: ["US", "EU", "CN"],
    parentCompany: "CNH Industrial (NYSE: CNH)",
    safeExportCountries: ["KZ", "RU", "UZ", "BR", "AR", "SA", "AE", "EG", "NG", "ZA", "IN", "MX", "AU", "TR"],
    exportRestrictions: [
      { targetCountry: "RU", restriction: "美制品牌受西方对俄制裁影响，需确认OFAC合规", severity: "caution" },
    ],
  },
  {
    brandId: "massey-ferguson",
    brandName: "Massey Ferguson (麦赛福格森)",
    trademarkCountries: ["US", "CN", "GB", "FR", "BR", "RU", "KZ", "IN", "ZA"],
    patentRegions: ["EU", "US", "CN"],
    parentCompany: "AGCO Corporation (NYSE: AGCO)",
    safeExportCountries: ["KZ", "RU", "UZ", "BR", "AR", "SA", "AE", "EG", "NG", "ZA", "IN", "MX", "AU", "TR"],
    exportRestrictions: [
      { targetCountry: "RU", restriction: "美资品牌（AGCO总部美国），需确认OFAC合规", severity: "caution" },
    ],
  },
  {
    brandId: "mtz",
    brandName: "MTZ / Belarus (明斯克)",
    trademarkCountries: ["BY", "RU", "KZ", "CN", "UZ"],
    patentRegions: ["RU", "BY"],
    parentCompany: "Minskiy Traktornyy Zavod (白俄罗斯国营)",
    safeExportCountries: ["KZ", "RU", "UZ", "CN", "KG", "AM", "AZ", "TM", "TJ", "IR"],
    exportRestrictions: [
      { targetCountry: "EU", restriction: "白俄罗斯品牌受EU制裁（条例765/2006），禁止进口至欧盟", severity: "restricted" },
      { targetCountry: "US", restriction: "白俄罗斯品牌受美国制裁，禁止进口", severity: "restricted" },
    ],
  },
  {
    brandId: "kubota",
    brandName: "Kubota (久保田)",
    trademarkCountries: ["JP", "US", "CN", "TH", "IN", "BR", "FR", "DE", "RU", "KZ"],
    patentRegions: ["JP", "US", "CN", "EU"],
    parentCompany: "Kubota Corporation (TYO: 6026)",
    safeExportCountries: ["KZ", "RU", "UZ", "BR", "AR", "SA", "AE", "EG", "NG", "ZA", "IN", "MX", "AU", "TR"],
    exportRestrictions: [
      { targetCountry: "RU", restriction: "日本品牌，需确认日本对俄制裁清单（外汇法第69条修正）", severity: "caution" },
    ],
  },
  {
    brandId: "krone",
    brandName: "Krone (科罗尼)",
    trademarkCountries: ["DE", "FR", "US", "CN", "RU", "KZ", "BR"],
    patentRegions: ["EU", "US"],
    parentCompany: "Maschinenfabrik Bernard Krone GmbH (德国家族企业)",
    safeExportCountries: ["KZ", "RU", "UZ", "BR", "AR", "SA", "AE", "EG", "NG", "ZA", "IN", "MX", "AU", "TR"],
    exportRestrictions: [
      { targetCountry: "RU", restriction: "德国品牌，需确认EU制裁清单", severity: "caution" },
    ],
  },
  {
    brandId: "mchale",
    brandName: "McHale (麦克海尔)",
    trademarkCountries: ["IE", "GB", "DE", "FR", "US", "CN", "RU", "KZ"],
    patentRegions: ["EU", "US"],
    parentCompany: "McHale Farm Machinery Ltd. (爱尔兰家族企业)",
    safeExportCountries: ["KZ", "RU", "UZ", "BR", "AR", "SA", "AE", "EG", "NG", "ZA", "IN", "MX", "AU", "TR"],
    exportRestrictions: [
      { targetCountry: "RU", restriction: "爱尔兰品牌（EU成员），需确认EU制裁清单", severity: "caution" },
    ],
  },
];

// ═══════════════════════════════════════════
// 2. 目标国认证要求
// ═══════════════════════════════════════════

export interface CertificationRequirement {
  countryCode: string;
  countryName: string;
  certificationName: string;
  certificationCode: string;
  /** 认证预估费用（人民币） */
  estimatedCost: number;
  /** 预估周期（工作日） */
  estimatedDays: number;
  /** 认证机构 */
  authority: string;
  /** 农机HS编码对应的特殊要求 */
  notes: string;
  /** 关税税率（%） */
  importDutyPct: number;
  /** 增值税率（%） */
  vatPct: number;
  /** 海运基准费用（人民币，20尺柜） */
  oceanFreightCny: number;
  /** 目的港杂费（人民币） */
  destinationPortFeesCny: number;
  /** 清关代理费（人民币） */
  customsBrokerFeeCny: number;
}

export const CERTIFICATION_REGISTRY: CertificationRequirement[] = [
  {
    countryCode: "KZ",
    countryName: "哈萨克斯坦",
    certificationName: "EAC 欧亚经济联盟认证",
    certificationCode: "EAC (TR CU)",
    estimatedCost: 15000,
    estimatedDays: 15,
    authority: "Eurasian Economic Commission / 哈萨克斯坦标准化与计量局",
    notes: "拖拉机(8701)、收割机(8433)、打捆机(8432)均需EAC认证。二手农机需提供使用年限证明（不超过10年）。",
    importDutyPct: 5,
    vatPct: 12,
    oceanFreightCny: 18000,
    destinationPortFeesCny: 3000,
    customsBrokerFeeCny: 2000,
  },
  {
    countryCode: "RU",
    countryName: "俄罗斯",
    certificationName: "EAC 欧亚经济联盟认证",
    certificationCode: "EAC (TR CU)",
    estimatedCost: 18000,
    estimatedDays: 20,
    authority: "Rosakkreditatsiya / EAEU Technical Regulations",
    notes: "所有农机需EAC认证。受制裁影响，美/德/日品牌二手设备需额外确认OFAC/EU合规。部分品牌可能无法清关。",
    importDutyPct: 5,
    vatPct: 20,
    oceanFreightCny: 22000,
    destinationPortFeesCny: 4000,
    customsBrokerFeeCny: 2500,
  },
  {
    countryCode: "UZ",
    countryName: "乌兹别克斯坦",
    certificationName: "UzStandard 乌兹别克斯坦国家标准认证",
    certificationCode: "UzDST",
    estimatedCost: 12000,
    estimatedDays: 15,
    authority: "Uzbekstandard 认证中心",
    notes: "可接受EAC认证或单独办理UzDST认证。二手农机进口需提前申请进口许可。",
    importDutyPct: 5,
    vatPct: 12,
    oceanFreightCny: 20000,
    destinationPortFeesCny: 3500,
    customsBrokerFeeCny: 2000,
  },
  {
    countryCode: "BR",
    countryName: "巴西",
    certificationName: "INMETRO 巴西国家计量标准化认证",
    certificationCode: "INMETRO",
    estimatedCost: 25000,
    estimatedDays: 30,
    authority: "INMETRO (Instituto Nacional de Metrologia)",
    notes: "拖拉机需INMETRO认证 + IBAMA环保认证。进口二手农机需获得巴西农业部进口许可（AGR/MP）。关税较高。",
    importDutyPct: 14,
    vatPct: 18,
    oceanFreightCny: 35000,
    destinationPortFeesCny: 5000,
    customsBrokerFeeCny: 3500,
  },
  {
    countryCode: "AR",
    countryName: "阿根廷",
    certificationName: "IRAM 阿根廷标准认证",
    certificationCode: "IRAM",
    estimatedCost: 18000,
    estimatedDays: 25,
    authority: "IRAM (Instituto Argentino de Normalización)",
    notes: "需IRAM安全认证 + SIRSE农药残留检测（如适用）。二手农机进口有年限限制（不超过15年）。",
    importDutyPct: 12,
    vatPct: 21,
    oceanFreightCny: 32000,
    destinationPortFeesCny: 4500,
    customsBrokerFeeCny: 3000,
  },
  {
    countryCode: "SA",
    countryName: "沙特阿拉伯",
    certificationName: "SABER 沙特产品安全认证",
    certificationCode: "SABER / SASO",
    estimatedCost: 20000,
    estimatedDays: 20,
    authority: "SASO (Saudi Standards, Metrology and Quality Org)",
    notes: "通过SABER平台在线申请。需指定沙特本地代理商作为担保人。农机无特殊年限要求。",
    importDutyPct: 5,
    vatPct: 15,
    oceanFreightCny: 15000,
    destinationPortFeesCny: 3000,
    customsBrokerFeeCny: 2500,
  },
  {
    countryCode: "AE",
    countryName: "阿联酋",
    certificationName: "ECAS 阿联酋合格评定系统",
    certificationCode: "ECAS",
    estimatedCost: 15000,
    estimatedDays: 15,
    authority: "ESMA (Emirates Authority for Standardization & Metrology)",
    notes: "ECAS认证或GCC认证。迪拜为中东转口枢纽，可通过Jebel Ali Free Zone转口至非洲。",
    importDutyPct: 5,
    vatPct: 5,
    oceanFreightCny: 14000,
    destinationPortFeesCny: 2500,
    customsBrokerFeeCny: 2000,
  },
  {
    countryCode: "EG",
    countryName: "埃及",
    certificationName: "EOS 埃及标准组织认证 + GOEIC 注册",
    certificationCode: "EOS / GOEIC",
    estimatedCost: 16000,
    estimatedDays: 25,
    authority: "Egyptian Organization for Standardization (EOS)",
    notes: "需GOEIC在线注册（进口商办理）+ EOS安全认证。埃及外汇管制严格，建议信用证结算。",
    importDutyPct: 10,
    vatPct: 14,
    oceanFreightCny: 18000,
    destinationPortFeesCny: 3500,
    customsBrokerFeeCny: 2500,
  },
  {
    countryCode: "NG",
    countryName: "尼日利亚",
    certificationName: "SON 尼日利亚标准组织认证",
    certificationCode: "SONCAP",
    estimatedCost: 14000,
    estimatedDays: 20,
    authority: "Standards Organisation of Nigeria (SON)",
    notes: "SONCAP认证分三阶段：Product Test → Pre-shipment Verification → Certification。需指定尼日利亚进口商。",
    importDutyPct: 10,
    vatPct: 7.5,
    oceanFreightCny: 25000,
    destinationPortFeesCny: 4000,
    customsBrokerFeeCny: 3000,
  },
  {
    countryCode: "ZA",
    countryName: "南非",
    certificationName: "SABS 南非标准局认证",
    certificationCode: "SABS / NRCS",
    estimatedCost: 17000,
    estimatedDays: 20,
    authority: "South African Bureau of Standards (SABS)",
    notes: "需SABS安全认证 + NRCS强制规范。二手农机需提供原产国使用证明及年限报告。",
    importDutyPct: 8,
    vatPct: 15,
    oceanFreightCny: 22000,
    destinationPortFeesCny: 3500,
    customsBrokerFeeCny: 2500,
  },
  {
    countryCode: "IN",
    countryName: "印度",
    certificationName: "BIS 印度标准局认证",
    certificationCode: "BIS / ISI",
    estimatedCost: 22000,
    estimatedDays: 30,
    authority: "Bureau of Indian Standards (BIS)",
    notes: "拖拉机需BIS强制认证（IS标准）。二手农机进口需DGFT许可，年限限制不超过5年。",
    importDutyPct: 15,
    vatPct: 18,
    oceanFreightCny: 12000,
    destinationPortFeesCny: 3000,
    customsBrokerFeeCny: 2500,
  },
  {
    countryCode: "MX",
    countryName: "墨西哥",
    certificationName: "NOM 墨西哥官方标准认证",
    certificationCode: "NOM",
    estimatedCost: 16000,
    estimatedDays: 20,
    authority: "DGN (Dirección General de Normas)",
    notes: "NOM强制认证 + NOM-050标签要求。可通过美墨加协定(USMCA)享受关税优惠。",
    importDutyPct: 10,
    vatPct: 16,
    oceanFreightCny: 16000,
    destinationPortFeesCny: 3000,
    customsBrokerFeeCny: 2500,
  },
  {
    countryCode: "AU",
    countryName: "澳大利亚",
    certificationName: "RCM 澳新法规合规标识",
    certificationCode: "RCM",
    estimatedCost: 18000,
    estimatedDays: 20,
    authority: "ACMA (Australian Communications and Media Authority)",
    notes: "RCM标识 + DAFF生物安全检查（需清洁无土壤/植物残留）。二手农机需熏蒸证明。",
    importDutyPct: 5,
    vatPct: 10,
    oceanFreightCny: 30000,
    destinationPortFeesCny: 4500,
    customsBrokerFeeCny: 3000,
  },
  {
    countryCode: "TR",
    countryName: "土耳其",
    certificationName: "CE 欧盟合格声明 + TSE 土耳其标准认证",
    certificationCode: "CE / TSE",
    estimatedCost: 14000,
    estimatedDays: 15,
    authority: "TSE (Turkish Standards Institution)",
    notes: "接受CE认证或办理TSE认证。关税同盟下部分产品免关税，但农机不在免税清单。",
    importDutyPct: 8,
    vatPct: 20,
    oceanFreightCny: 16000,
    destinationPortFeesCny: 3000,
    customsBrokerFeeCny: 2000,
  },
];

// ═══════════════════════════════════════════
// 3. HS编码映射（农机→海关编码）
// ═══════════════════════════════════════════

export interface HsCodeMapping {
  category: string;
  hsCode: string;
  description: string;
  cnExportTaxRefundPct: number; // 出口退税税率
}

export const HS_CODE_MAP: HsCodeMapping[] = [
  { category: "拖拉机", hsCode: "8701.10", description: "轮式拖拉机（手扶式除外）", cnExportTaxRefundPct: 13 },
  { category: "履带拖拉机", hsCode: "8701.30", description: "履带式拖拉机", cnExportTaxRefundPct: 13 },
  { category: "收割机", hsCode: "8433.51", description: "联合收割机", cnExportTaxRefundPct: 13 },
  { category: "打捆机", hsCode: "8432.41", description: "捡拾压捆机", cnExportTaxRefundPct: 13 },
  { category: "方捆机", hsCode: "8432.41.00", description: "方草捆压捆机", cnExportTaxRefundPct: 13 },
  { category: "圆捆机", hsCode: "8432.41.10", description: "圆草捆压捆机", cnExportTaxRefundPct: 13 },
  { category: "播种机", hsCode: "8432.31", description: "播种机/种植机", cnExportTaxRefundPct: 13 },
  { category: "旋耕机", hsCode: "8432.21", description: "旋耕机/中耕机", cnExportTaxRefundPct: 13 },
  { category: "青贮机", hsCode: "8436.10", description: "青贮饲料收获机", cnExportTaxRefundPct: 13 },
  { category: "农机配件", hsCode: "8432.90", description: "农机零部件", cnExportTaxRefundPct: 9 },
];

// ═══════════════════════════════════════════
// 4. 出口成本链默认参数
// ═══════════════════════════════════════════

export const DEFAULT_COST_PARAMS = {
  /** 商检费（人民币） */
  inspectionFee: 3500,
  /** 木箱包装费（人民币，基准） */
  cratingFeeBase: 3000,
  /** 国内运输到港费（人民币/公里，基准） */
  domesticTruckingPerKm: 8,
  /** 默认起运港到上海港距离（公里，石家庄基准） */
  defaultDistanceToPortKm: 950,
  /** 报关费（人民币） */
  customsDeclarationFee: 1500,
  /** 港口THC费用（人民币） */
  portThcFee: 2000,
  /** 单证费（人民币） */
  documentationFee: 800,
  /** 保险费率（货值×） */
  insuranceRate: 0.003,
  /** 汇率（可被运行时覆盖） */
  usdToCny: 7.24,
  /** eurToCny */
  eurToCny: 7.91,
};

// ═══════════════════════════════════════════
// 5. 查询辅助函数
// ═══════════════════════════════════════════

export function getBrandIP(brandId: string): BrandIPRecord | null {
  return BRAND_IP_REGISTRY.find((b) => b.brandId === brandId) || null;
}

export function getCertificationReq(countryCode: string): CertificationRequirement | null {
  return CERTIFICATION_REGISTRY.find((c) => c.countryCode === countryCode) || null;
}

export function getHsCode(category: string): HsCodeMapping | null {
  const cat = category.toLowerCase();
  const found =
    HS_CODE_MAP.find((h) => cat.includes(h.category)) ||
    HS_CODE_MAP.find((h) => h.category === "农机配件"); // fallback
  return found || null;
}
