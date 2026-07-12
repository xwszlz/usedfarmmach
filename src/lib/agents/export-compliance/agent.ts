/**
 * #10 出口合规 Agent — 核心引擎
 *
 * 五大职责：
 *   1. 品牌知识产权备案核查
 *   2. 目标国认证要求匹配
 *   3. 出口全链条成本计算
 *   4. 报关单据模板生成
 *   5. 与AI估值系统联动，推荐最优出口目标国
 */
import { prisma } from "@/lib/db";
import {
  type ExportComplianceInput,
  type ExportComplianceResult,
  type ExportComplianceStatus,
  type IPCheckResult,
  type CertMatchResult,
  type CostBreakdown,
  type DocumentTemplate,
  type ValuationLinkResult,
} from "./types";
import {
  BRAND_IP_REGISTRY,
  CERTIFICATION_REGISTRY,
  HS_CODE_MAP,
  DEFAULT_COST_PARAMS,
  getBrandIP,
  getCertificationReq,
  getHsCode,
  type BrandIPRecord,
  type CertificationRequirement,
} from "./knowledge";

export const AGENT_NAME = "export-compliance";
export const AGENT_VERSION = "0.1.0";

// ── 品牌名称 → brandId 映射 ──

const NAME_TO_BRAND_ID: Record<string, string> = {
  "john deere": "john-deere",
  "迪尔": "john-deere",
  "约翰迪尔": "john-deere",
  "claas": "claas",
  "克拉斯": "claas",
  "case ih": "case-ih",
  "case-ih": "case-ih",
  "凯斯": "case-ih",
  "new holland": "new-holland",
  "纽荷兰": "new-holland",
  "massey ferguson": "massey-ferguson",
  "麦赛福格森": "massey-ferguson",
  "mtz": "mtz",
  "belarus": "mtz",
  "明斯克": "mtz",
  "kubota": "kubota",
  "久保田": "kubota",
  "krone": "krone",
  "科罗尼": "krone",
  "mchale": "mchale",
  "麦克海尔": "mchale",
};

function resolveBrandId(input: ExportComplianceInput): string | null {
  if (input.brandId) return input.brandId;
  if (input.brandName) {
    const key = input.brandName.trim().toLowerCase();
    return NAME_TO_BRAND_ID[key] || NAME_TO_BRAND_ID[input.brandName.trim()] || null;
  }
  return null;
}

// ── 品类推断（从型号名猜品类） ──

function inferCategory(modelName?: string, categoryId?: string): string {
  if (categoryId) {
    const cat = categoryId.toLowerCase();
    if (cat.includes("tractor")) return "拖拉机";
    if (cat.includes("harvest") || cat.includes("combine")) return "收割机";
    if (cat.includes("baler")) return "打捆机";
    if (cat.includes("seeder") || cat.includes("plant")) return "播种机";
    if (cat.includes("till")) return "旋耕机";
    if (cat.includes("silage") || cat.includes("chopper")) return "青贮机";
  }
  if (modelName) {
    const m = modelName.toLowerCase();
    if (/jaguar|收割|harvest|combine/.test(m)) return "收割机";
    if (/baler|pack|捆|bb\d|big\s*pack/.test(m)) return "打捆机";
    if (/tractor|拖拉|trac/.test(m)) return "拖拉机";
    if (/seeder|plant|播种/.test(m)) return "播种机";
    if (/silage|chopper|青贮/.test(m)) return "青贮机";
  }
  return "农机配件";
}

// ═══════════════════════════════════════════
// 功能 1：品牌知识产权备案核查
// ═══════════════════════════════════════════

function checkBrandIP(
  brandId: string,
  targetCountries: string[]
): IPCheckResult | null {
  const record = getBrandIP(brandId);
  if (!record) return null;

  // 国家代码 → 名称映射（常用）
  const COUNTRY_NAMES: Record<string, string> = {
    KZ: "哈萨克斯坦", RU: "俄罗斯", UZ: "乌兹别克斯坦", BY: "白俄罗斯",
    BR: "巴西", AR: "阿根廷", SA: "沙特阿拉伯", AE: "阿联酋",
    EG: "埃及", NG: "尼日利亚", ZA: "南非", IN: "印度",
    MX: "墨西哥", AU: "澳大利亚", TR: "土耳其", IR: "伊朗",
    US: "美国", DE: "德国", FR: "法国", GB: "英国", CN: "中国",
    EU: "欧盟",
  };

  const exportSafety = targetCountries.map((cc) => {
    const restriction = record.exportRestrictions.find((r) => r.targetCountry === cc);
    const isSafe = record.safeExportCountries.includes(cc) &&
      (!restriction || restriction.severity !== "restricted");
    return {
      countryCode: cc,
      countryName: COUNTRY_NAMES[cc] || cc,
      isSafe,
      severity: restriction?.severity || "none",
      restriction: restriction?.restriction || null,
    };
  });

  return {
    brandId: record.brandId,
    brandName: record.brandName,
    parentCompany: record.parentCompany,
    trademarkCountries: record.trademarkCountries,
    patentRegions: record.patentRegions,
    exportSafety,
  };
}

// ═══════════════════════════════════════════
// 功能 2：目标国认证要求匹配
// ═══════════════════════════════════════════

function matchCertifications(
  targetCountries: string[]
): CertMatchResult[] {
  const results: CertMatchResult[] = [];
  for (const cc of targetCountries) {
    const cert = getCertificationReq(cc);
    if (cert) {
      results.push({
        countryCode: cert.countryCode,
        countryName: cert.countryName,
        certificationName: cert.certificationName,
        certificationCode: cert.certificationCode,
        authority: cert.authority,
        estimatedCost: cert.estimatedCost,
        estimatedDays: cert.estimatedDays,
        notes: cert.notes,
      });
    }
  }
  return results;
}

// ═══════════════════════════════════════════
// 功能 3：出口全链条成本计算
// ═══════════════════════════════════════════

function calculateCost(
  purchasePriceCny: number,
  targetCountries: string[],
  hsCode: string,
  category: string,
  exportRefundPct: number,
  usdRate: number
): CostBreakdown[] {
  const results: CostBreakdown[] = [];

  // 固定成本（与目标国无关）
  const inspectionFee = DEFAULT_COST_PARAMS.inspectionFee;
  const cratingFee = DEFAULT_COST_PARAMS.cratingFeeBase;
  const domesticTrucking = DEFAULT_COST_PARAMS.domesticTruckingPerKm * DEFAULT_COST_PARAMS.defaultDistanceToPortKm;
  const customsDeclaration = DEFAULT_COST_PARAMS.customsDeclarationFee;
  const portThc = DEFAULT_COST_PARAMS.portThcFee;
  const documentationFee = DEFAULT_COST_PARAMS.documentationFee;
  const insuranceCny = Math.round(purchasePriceCny * DEFAULT_COST_PARAMS.insuranceRate);
  const exportTaxRefund = Math.round(purchasePriceCny * (exportRefundPct / 100));

  for (const cc of targetCountries) {
    const cert = getCertificationReq(cc);
    if (!cert) continue;

    // 关税 = (采购价 + 运费 + 保险) × 关税率
    const cifCny = purchasePriceCny + cert.oceanFreightCny + insuranceCny;
    const importDuty = Math.round(cifCny * (cert.importDutyPct / 100));
    // 增值税 = (CIF + 关税) × 增值税率
    const vat = Math.round((cifCny + importDuty) * (cert.vatPct / 100));

    const totalLandedCostCny =
      purchasePriceCny +
      inspectionFee +
      cratingFee +
      domesticTrucking +
      customsDeclaration +
      portThc +
      documentationFee +
      insuranceCny +
      cert.oceanFreightCny +
      cert.destinationPortFeesCny +
      cert.customsBrokerFeeCny +
      cert.estimatedCost +
      importDuty +
      vat -
      exportTaxRefund;

    const totalLandedCostUsd = Math.round(totalLandedCostCny / usdRate);

    const costItems = [
      { label: "商品采购价", amountCny: purchasePriceCny, isRefund: false },
      { label: "商检费", amountCny: inspectionFee, isRefund: false },
      { label: "木箱包装", amountCny: cratingFee, isRefund: false },
      { label: "国内运输到港", amountCny: domesticTrucking, isRefund: false },
      { label: "报关费", amountCny: customsDeclaration, isRefund: false },
      { label: "港口THC", amountCny: portThc, isRefund: false },
      { label: "单证费", amountCny: documentationFee, isRefund: false },
      { label: "保险费", amountCny: insuranceCny, isRefund: false },
      { label: `海运费（→${cert.countryName}）`, amountCny: cert.oceanFreightCny, isRefund: false },
      { label: "目的港杂费", amountCny: cert.destinationPortFeesCny, isRefund: false },
      { label: "清关代理费", amountCny: cert.customsBrokerFeeCny, isRefund: false },
      { label: `${cert.certificationName}`, amountCny: cert.estimatedCost, isRefund: false },
      { label: `关税（${cert.importDutyPct}%）`, amountCny: importDuty, isRefund: false },
      { label: `增值税（${cert.vatPct}%）`, amountCny: vat, isRefund: false },
      { label: `出口退税（${exportRefundPct}%）`, amountCny: -exportTaxRefund, isRefund: true },
    ];

    results.push({
      countryCode: cc,
      countryName: cert.countryName,
      purchasePriceCny,
      inspectionFeeCny: inspectionFee,
      cratingFeeCny: cratingFee,
      domesticTruckingCny: domesticTrucking,
      customsDeclarationCny: customsDeclaration,
      portThcCny: portThc,
      documentationFeeCny: documentationFee,
      insuranceCny,
      oceanFreightCny: cert.oceanFreightCny,
      destinationPortFeesCny: cert.destinationPortFeesCny,
      customsBrokerFeeCny: cert.customsBrokerFeeCny,
      certificationFeeCny: cert.estimatedCost,
      importDutyCny: importDuty,
      vatCny: vat,
      exportTaxRefundCny: exportTaxRefund,
      totalLandedCostCny,
      totalLandedCostUsd,
      costItems,
    });
  }

  return results;
}

// ═══════════════════════════════════════════
// 功能 4：报关单据模板生成
// ═══════════════════════════════════════════

function generateDocumentTemplates(
  brandName: string,
  modelName: string,
  year: number | undefined,
  hsCode: string,
  purchasePriceCny: number,
  purchasePriceUsd: number,
  targetCountryName: string,
  sellerName: string
): DocumentTemplate[] {
  const today = new Date().toISOString().slice(0, 10);
  const invoiceNo = `INV-${today.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  return [
    {
      documentType: "commercial_invoice",
      documentName: "商业发票 (Commercial Invoice)",
      templateFields: ["发票编号", "日期", "卖方", "买方", "品名", "HS编码", "数量", "单价", "总金额", "贸易术语", "原产国", "支付方式"],
      htmlTemplate: `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%">
<tr><th colspan="4" style="font-size:18px">商业发票 / COMMERCIAL INVOICE</th></tr>
<tr><td>发票编号</td><td>${invoiceNo}</td><td>日期</td><td>${today}</td></tr>
<tr><td>卖方 (Shipper)</td><td colspan="3">${sellerName}</td></tr>
<tr><td>买方 (Consignee)</td><td colspan="3">[买方公司名称及地址 - ${targetCountryName}]</td></tr>
<tr><td>品名</td><td>${brandName} ${modelName}</td><td>HS编码</td><td>${hsCode}</td></tr>
<tr><td>年份</td><td>${year || "-"}</td><td>原产国</td><td>China (CN)</td></tr>
<tr><td>数量</td><td>1 unit</td><td>单价 (USD)</td><td>$${purchasePriceUsd.toFixed(2)}</td></tr>
<tr><td>总金额 (USD)</td><td colspan="3"><strong>$${purchasePriceUsd.toFixed(2)}</strong></td></tr>
<tr><td>贸易术语</td><td colspan="3">CIF ${targetCountryName} Port (Incoterms 2020)</td></tr>
<tr><td>支付方式</td><td colspan="3">T/T 30% 预付, 70% 见提单复印件付款</td></tr>
</table>`,
      notes: "买卖双方签字盖章。用于清关和付款。",
    },
    {
      documentType: "packing_list",
      documentName: "装箱单 (Packing List)",
      templateFields: ["编号", "日期", "品名", "包装方式", "毛重", "净重", "体积", "唛头"],
      htmlTemplate: `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%">
<tr><th colspan="4" style="font-size:18px">装箱单 / PACKING LIST</th></tr>
<tr><td>编号</td><td>${invoiceNo}-PL</td><td>日期</td><td>${today}</td></tr>
<tr><td>品名</td><td colspan="3">${brandName} ${modelName}</td></tr>
<tr><td>包装方式</td><td>木箱（ISPM-15处理）</td><td>件数</td><td>1</td></tr>
<tr><td>毛重 (GW)</td><td>约 8,500 kg</td><td>净重 (NW)</td><td>约 8,000 kg</td></tr>
<tr><td>体积 (CBM)</td><td colspan="3">约 30 CBM</td></tr>
<tr><td>唛头</td><td colspan="3">SD-${invoiceNo}</td></tr>
</table>`,
      notes: "需与实际货物一致，木箱须有ISPM-15熏蒸标识。",
    },
    {
      documentType: "bill_of_lading",
      documentName: "提单模板 (Bill of Lading)",
      templateFields: ["发货人", "收货人", "通知人", "船名/航次", "装货港", "卸货港", "货物描述", "集装箱号", "铅封号"],
      htmlTemplate: `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%">
<tr><th colspan="4" style="font-size:18px">海运提单 / BILL OF LADING (模板)</th></tr>
<tr><td>发货人 (Shipper)</td><td colspan="3">${sellerName}</td></tr>
<tr><td>收货人 (Consignee)</td><td colspan="3">To Order of [Bank Name] / [买方公司]</td></tr>
<tr><td>通知人 (Notify)</td><td colspan="3">[买方公司名称及地址 - ${targetCountryName}]</td></tr>
<tr><td>装货港</td><td>Shanghai, China</td><td>卸货港</td><td>[目的港 - ${targetCountryName}]</td></tr>
<tr><td>货物描述</td><td colspan="3">${brandName} ${modelName} (${hsCode}), Used</td></tr>
<tr><td>集装箱号</td><td>[柜号]</td><td>铅封号</td><td>[封条号]</td></tr>
</table>`,
      notes: '由船公司/货代签发正本提单。收货人栏建议用"To Order of Bank"以配合信用证。',
    },
    {
      documentType: "certificate_of_origin",
      documentName: "原产地证明 (Certificate of Origin)",
      templateFields: ["发证机构", "出口商", "进口商", "货物描述", "HS编码", "原产国", "签署日期"],
      htmlTemplate: `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%">
<tr><th colspan="4" style="font-size:18px">原产地证明 / CERTIFICATE OF ORIGIN</th></tr>
<tr><td>发证机构</td><td colspan="3">中国国际贸易促进委员会 (CCPIT) / 海关总署</td></tr>
<tr><td>出口商</td><td colspan="3">${sellerName}</td></tr>
<tr><td>进口商</td><td colspan="3">[买方公司名称 - ${targetCountryName}]</td></tr>
<tr><td>货物描述</td><td colspan="3">${brandName} ${modelName}</td></tr>
<tr><td>HS编码</td><td>${hsCode}</td><td>原产国</td><td>China (CN)</td></tr>
<tr><td>签署日期</td><td colspan="3">${today}</td></tr>
</table>`,
      notes: "可申请一般原产地证(CO)或普惠制原产地证(FORM A)。部分目标国可享关税优惠。",
    },
    {
      documentType: "used_equipment_declaration",
      documentName: "旧机电产品进口声明",
      templateFields: ["产品名称", "品牌", "型号", "制造年份", "已使用年限", "现状描述", "技术状态", "环保评估"],
      htmlTemplate: `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%">
<tr><th colspan="4" style="font-size:18px">旧机电产品声明 / USED EQUIPMENT DECLARATION</th></tr>
<tr><td>产品名称</td><td colspan="3">${brandName} ${modelName}</td></tr>
<tr><td>品牌</td><td>${brandName}</td><td>型号</td><td>${modelName}</td></tr>
<tr><td>制造年份</td><td>${year || "-"}</td><td>已使用年限</td><td>${year ? new Date().getFullYear() - year : "-"} 年</td></tr>
<tr><td>现状描述</td><td colspan="3">设备运行正常，主要部件完整，外观有使用痕迹</td></tr>
<tr><td>技术状态</td><td colspan="3">经检测，发动机/液压系统/传动系统工作正常，符合出口标准</td></tr>
<tr><td>环保评估</td><td colspan="3">无泄漏、无有害物质残留，符合目的国环保要求</td></tr>
</table>`,
      notes: "二手农机出口必备声明。部分国家要求提供第三方检验报告。",
    },
  ];
}

// ═══════════════════════════════════════════
// 功能 5：与AI估值系统联动，推荐最优出口目标国
// ═══════════════════════════════════════════

async function linkValuation(
  brandId: string,
  modelName: string,
  year: number | undefined,
  purchasePriceCny: number,
  costBreakdowns: CostBreakdown[]
): Promise<ValuationLinkResult | null> {
  // 1. 查询该品牌+型号最近一次估值
  let latestValuation: ValuationLinkResult["latestValuation"] = null;
  try {
    const valuation = await prisma.valuation.findFirst({
      where: {
        brandId,
        modelName,
        ...(year ? { year } : {}),
      },
      // Valuation 表无 createdAt 字段，按 id 降序取最新
      orderBy: { id: "desc" },
    });
    if (valuation) {
      latestValuation = {
        id: valuation.id,
        estimatedPriceCny: valuation.estimatedPriceCny,
        estimatedPriceUsd: valuation.estimatedPriceUsd,
        confidenceScore: valuation.confidenceScore,
        factors: valuation.factors,
      };
    }
  } catch (e) {
    // Valuation 表可能为空或不存在，忽略
  }

  // 2. 查询国际价格参考（InternationalPrice）
  let intlPrices: Array<{ productId: string; priceForeignCny: number; country: string | null }> = [];
  try {
    // 通过 brandId 找到关联产品
    const products = await prisma.product.findMany({
      where: { brandId },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    if (productIds.length > 0) {
      intlPrices = await prisma.internationalPrice.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, priceForeignCny: true, country: true },
      });
    }
  } catch (e) {
    // 忽略
  }

  // 3. 计算各国利润
  const COUNTRY_NAMES: Record<string, string> = {
    KZ: "哈萨克斯坦", RU: "俄罗斯", UZ: "乌兹别克斯坦", BR: "巴西", AR: "阿根廷",
    SA: "沙特阿拉伯", AE: "阿联酋", EG: "埃及", NG: "尼日利亚", ZA: "南非",
    IN: "印度", MX: "墨西哥", AU: "澳大利亚", TR: "土耳其",
  };

  // 预估售价 = 采购价 × 品牌系数 × 国家系数
  // 这是一个简化模型——实际应结合国际市场价格
  const BRAND_PREMIUM: Record<string, number> = {
    "claas": 2.0,
    "john-deere": 1.8,
    "case-ih": 1.6,
    "new-holland": 1.5,
    "massey-ferguson": 1.4,
    "kubota": 1.7,
    "krone": 1.6,
    "mchale": 1.3,
    "mtz": 1.2,
  };
  const COUNTRY_DEMAND: Record<string, number> = {
    KZ: 1.5, RU: 1.4, UZ: 1.3, BR: 1.2, AR: 1.1,
    SA: 1.2, AE: 1.1, EG: 1.0, NG: 0.9, ZA: 1.0,
    IN: 1.1, MX: 1.0, AU: 1.3, TR: 1.2,
  };

  const brandPremium = BRAND_PREMIUM[brandId] || 1.4;

  const countryProfit = costBreakdowns.map((cb) => {
    const countryDemand = COUNTRY_DEMAND[cb.countryCode] || 1.0;
    // 预估售价 = 采购价 × 品牌系数 × 国家需求系数
    const estimatedSellingPriceCny = Math.round(purchasePriceCny * brandPremium * countryDemand);
    const grossProfitCny = estimatedSellingPriceCny - cb.totalLandedCostCny;
    const grossMarginPct = cb.totalLandedCostCny > 0
      ? Math.round((grossProfitCny / cb.totalLandedCostCny) * 1000) / 10
      : 0;

    // 查找国际价格参考
    const intlMatch = intlPrices.find(
      (ip) => ip.country === cb.countryCode
    );
    const intlMarketPriceCny = intlMatch?.priceForeignCny || null;

    let recommendation: "strong" | "moderate" | "weak" | "not_recommended";
    let reason: string;

    if (grossMarginPct >= 30) {
      recommendation = "strong";
      reason = `毛利率${grossMarginPct}%，利润空间充足。${cb.countryName}需求旺盛，认证周期${getCertificationReq(cb.countryCode)?.estimatedDays || "-"}天。`;
    } else if (grossMarginPct >= 15) {
      recommendation = "moderate";
      reason = `毛利率${grossMarginPct}%，有一定利润空间。注意认证费用和清关时间。`;
    } else if (grossMarginPct >= 0) {
      recommendation = "weak";
      reason = `毛利率仅${grossMarginPct}%，利润薄。建议寻找更低采购价或更高售价市场。`;
    } else {
      recommendation = "not_recommended";
      reason = `毛利率${grossMarginPct}%，亏损。不建议出口至${cb.countryName}。`;
    }

    return {
      countryCode: cb.countryCode,
      countryName: cb.countryName,
      intlMarketPriceCny,
      landedCostCny: cb.totalLandedCostCny,
      estimatedSellingPriceCny,
      grossProfitCny,
      grossMarginPct,
      recommendation,
      reason,
    };
  });

  // 排序：毛利率降序
  countryProfit.sort((a, b) => b.grossMarginPct - a.grossMarginPct);

  // 最优推荐
  const best = countryProfit.find((c) => c.recommendation === "strong") ||
    countryProfit.find((c) => c.recommendation === "moderate") ||
    countryProfit[0];

  const bestChoice = best
    ? {
        countryCode: best.countryCode,
        countryName: best.countryName,
        reason: best.reason,
      }
    : { countryCode: "", countryName: "暂无推荐", reason: "所有目标国均不盈利" };

  return {
    latestValuation,
    countryProfit,
    bestChoice,
  };
}

// ═══════════════════════════════════════════
// Agent 主体
// ═══════════════════════════════════════════

export class ExportComplianceAgent {
  private logs: string[] = [];

  private log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    this.logs.push(line);
    console.log(line);
  }

  async run(input: ExportComplianceInput): Promise<ExportComplianceResult> {
    const startedAt = new Date();
    this.logs = [];
    this.log(`🤖 ${AGENT_NAME}@${AGENT_VERSION} 启动`);

    // 默认所有支持的国家
    const targetCountries = input.targetCountries && input.targetCountries.length > 0
      ? input.targetCountries
      : CERTIFICATION_REGISTRY.map((c) => c.countryCode);

    this.log(`目标国: ${targetCountries.join(", ")}`);

    // ── 从数据库拉取产品信息（如果提供了 productId） ──
    let productId = input.productId;
    let brandId = input.brandId;
    let brandName = input.brandName;
    let modelName = input.modelName;
    let purchasePriceCny = input.purchasePriceCny;
    let year = input.year;
    let category = input.category;
    let categoryId: string | undefined;
    let sellerName = "石家庄神雕农机科技有限公司";

    if (productId) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: productId },
          include: {
            brand: true,
            seller: true,
          },
        });
        if (product) {
          brandId = brandId || product.brandId;
          brandName = brandName || product.brand?.nameZh || product.brand?.nameEn;
          modelName = modelName || product.modelName;
          purchasePriceCny = purchasePriceCny || product.priceCny;
          year = year || product.year;
          categoryId = product.categoryId;
          if (product.seller?.companyName) sellerName = product.seller.companyName;
          else if (product.seller?.username) sellerName = product.seller.username;
          this.log(`已从数据库获取产品: ${brandName} ${modelName} ¥${purchasePriceCny}`);
        }
      } catch (e) {
        this.log(`⚠️ 产品查询失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 如果没有 brandId，尝试从品牌名推断
    if (!brandId && brandName) {
      brandId = resolveBrandId(input) || undefined;
    }

    if (!brandId) {
      brandId = "unknown";
      brandName = brandName || "未知品牌";
    }

    // 推断品类和HS编码
    if (!category) {
      category = inferCategory(modelName, categoryId);
    }
    const hsMapping = getHsCode(category);
    const hsCode = hsMapping?.hsCode || "8432.90";
    const exportRefundPct = hsMapping?.cnExportTaxRefundPct || 9;

    this.log(`品牌: ${brandName} (ID: ${brandId})`);
    this.log(`型号: ${modelName || "-"}`);
    this.log(`品类: ${category} → HS: ${hsCode} (退税${exportRefundPct}%)`);
    this.log(`采购价: ¥${purchasePriceCny || 0}`);

    if (!purchasePriceCny || purchasePriceCny <= 0) {
      purchasePriceCny = 100000; // 默认10万
      this.log(`⚠️ 未提供采购价，使用默认值 ¥${purchasePriceCny}`);
    }

    const usdRate = DEFAULT_COST_PARAMS.usdToCny;
    const purchasePriceUsd = Math.round((purchasePriceCny / usdRate) * 100) / 100;

    // ── 1. 品牌知识产权核查 ──
    this.log(`▶ [1/5] 品牌知识产权核查...`);
    const ipCheck = checkBrandIP(brandId, targetCountries);
    if (ipCheck) {
      const safeCount = ipCheck.exportSafety.filter((s) => s.isSafe).length;
      const restrictedCount = ipCheck.exportSafety.filter((s) => s.severity === "restricted").length;
      this.log(`  ↳ ${ipCheck.brandName} (${ipCheck.parentCompany}) — 安全${safeCount}国, 限制${restrictedCount}国`);
    } else {
      this.log(`  ↳ 未找到 ${brandId} 的知识产权记录`);
    }

    // ── 2. 目标国认证匹配 ──
    this.log(`▶ [2/5] 目标国认证要求匹配...`);
    const certificationMatch = matchCertifications(targetCountries);
    this.log(`  ↳ 匹配到 ${certificationMatch.length} 个国家的认证要求`);

    // ── 3. 出口成本计算 ──
    this.log(`▶ [3/5] 出口全链条成本计算...`);
    const costBreakdown = calculateCost(
      purchasePriceCny,
      targetCountries,
      hsCode,
      category,
      exportRefundPct,
      usdRate
    );
    this.log(`  ↳ 已计算 ${costBreakdown.length} 个国家的到岸成本`);

    // ── 4. 报关单据模板 ──
    this.log(`▶ [4/5] 报关单据模板生成...`);
    const bestCountry = costBreakdown[0]?.countryName || "目标国";
    const documentTemplates = generateDocumentTemplates(
      brandName || "农机品牌",
      modelName || "型号",
      year,
      hsCode,
      purchasePriceCny,
      purchasePriceUsd,
      bestCountry,
      sellerName
    );
    this.log(`  ↳ 生成 ${documentTemplates.length} 份单据模板`);

    // ── 5. 估值联动推荐 ──
    this.log(`▶ [5/5] 与AI估值系统联动...`);
    let valuationLink: ValuationLinkResult | null = null;
    try {
      valuationLink = await linkValuation(
        brandId,
        modelName || "",
        year,
        purchasePriceCny,
        costBreakdown
      );
      if (valuationLink) {
        const strongCount = valuationLink.countryProfit.filter((c) => c.recommendation === "strong").length;
        this.log(`  ↳ 估值联动完成，最优推荐: ${valuationLink.bestChoice.countryName} (${valuationLink.bestChoice.reason.slice(0, 60)})`);
        this.log(`  ↳ 强推荐${strongCount}国`);
      }
    } catch (e) {
      this.log(`  ⚠️ 估值联动失败: ${e instanceof Error ? e.message : String(e)}`);
    }

    const finishedAt = new Date();
    this.log(`✅ 完成 ${finishedAt.getTime() - startedAt.getTime()}ms`);

    return {
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      input: {
        brandId,
        brandName,
        modelName,
        productId,
        purchasePriceCny,
        year,
        category,
        hsCode,
      },
      ipCheck,
      certificationMatch,
      costBreakdown,
      documentTemplates,
      valuationLink,
      log: this.logs,
    };
  }

  /**
   * 状态查询（不执行）
   */
  async getStatus(): Promise<ExportComplianceStatus> {
    return {
      ok: true,
      agentName: AGENT_NAME,
      version: AGENT_VERSION,
      supportedCountries: CERTIFICATION_REGISTRY.map((c) => c.countryCode),
      supportedBrands: BRAND_IP_REGISTRY.map((b) => b.brandId),
      hsCodes: HS_CODE_MAP.map((h) => ({ code: h.hsCode, description: h.description })),
    };
  }
}

// ==================== 单例 ====================

export const exportComplianceAgent = new ExportComplianceAgent();
