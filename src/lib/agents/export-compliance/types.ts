/**
 * #10 出口合规 Agent — 类型定义
 *
 * 定义 Agent 的输入、输出、内部数据契约。
 */

import { z } from "zod";

// ==================== 输入 ====================

/** Agent 输入参数 schema */
export const ExportComplianceInputSchema = z.object({
  /** 产品 ID（站内 Product），如果提供则自动拉取品牌/型号/价格 */
  productId: z.string().optional(),
  /** 手动指定品牌 ID */
  brandId: z.string().optional(),
  /** 手动指定品牌名称（中文或英文） */
  brandName: z.string().optional(),
  /** 手动指定型号 */
  modelName: z.string().optional(),
  /** 手动指定采购价（人民币，元） */
  purchasePriceCny: z.number().optional(),
  /** 手动指定年份 */
  year: z.number().int().optional(),
  /** 手动指定品类别名（拖拉机/收割机/打捆机等），用于HS编码匹配 */
  category: z.string().optional(),
  /** 目标国列表（ISO 3166-1 alpha-2），不传则对所有支持国家分析 */
  targetCountries: z.array(z.string()).optional(),
  /** 是否仅输出报告（不写 DB） */
  dryRun: z.boolean().default(false),
});

export type ExportComplianceInput = z.infer<typeof ExportComplianceInputSchema>;

// ==================== 知识库查询结果 ====================

/** 品牌知识产权核查结果 */
export interface IPCheckResult {
  brandId: string;
  brandName: string;
  parentCompany: string;
  trademarkCountries: string[];
  patentRegions: string[];
  /** 目标国 → 是否可安全出口 */
  exportSafety: {
    countryCode: string;
    countryName: string;
    isSafe: boolean;
    severity: "none" | "caution" | "restricted";
    restriction: string | null;
  }[];
}

/** 认证要求匹配结果 */
export interface CertMatchResult {
  countryCode: string;
  countryName: string;
  certificationName: string;
  certificationCode: string;
  authority: string;
  estimatedCost: number;
  estimatedDays: number;
  notes: string;
}

/** 出口成本计算明细 */
export interface CostBreakdown {
  countryCode: string;
  countryName: string;
  /** 采购价 */
  purchasePriceCny: number;
  /** 商检费 */
  inspectionFeeCny: number;
  /** 包装木箱费 */
  cratingFeeCny: number;
  /** 国内运输到港费 */
  domesticTruckingCny: number;
  /** 报关费 */
  customsDeclarationCny: number;
  /** 港口THC */
  portThcCny: number;
  /** 单证费 */
  documentationFeeCny: number;
  /** 保险费 */
  insuranceCny: number;
  /** 海运费 */
  oceanFreightCny: number;
  /** 目的港杂费 */
  destinationPortFeesCny: number;
  /** 清关代理费 */
  customsBrokerFeeCny: number;
  /** 认证费 */
  certificationFeeCny: number;
  /** 关税 */
  importDutyCny: number;
  /** 增值税 */
  vatCny: number;
  /** 出口退税（负数=抵减成本） */
  exportTaxRefundCny: number;
  /** 到岸总成本 */
  totalLandedCostCny: number;
  /** 到岸总成本（美元） */
  totalLandedCostUsd: number;
  /** 成本明细标签（用于UI展示） */
  costItems: Array<{ label: string; amountCny: number; isRefund: boolean }>;
}

/** 报关单据模板 */
export interface DocumentTemplate {
  documentType: string;
  documentName: string;
  templateFields: string[];
  /** HTML模板内容 */
  htmlTemplate: string;
  notes: string;
}

/** 估值联动推荐 */
export interface ValuationLinkResult {
  /** 该产品最近估值 */
  latestValuation: {
    id: string;
    estimatedPriceCny: number;
    estimatedPriceUsd: number;
    confidenceScore: number;
    factors: string | null;
  } | null;
  /** 各目标国利润分析 */
  countryProfit: Array<{
    countryCode: string;
    countryName: string;
    /** 国际市场参考价（人民币） */
    intlMarketPriceCny: number | null;
    /** 到岸总成本 */
    landedCostCny: number;
    /** 预估售价（当地市场） */
    estimatedSellingPriceCny: number;
    /** 毛利润 */
    grossProfitCny: number;
    /** 毛利率 */
    grossMarginPct: number;
    /** 推荐等级 */
    recommendation: "strong" | "moderate" | "weak" | "not_recommended";
    /** 推荐理由 */
    reason: string;
  }>;
  /** 最优推荐 */
  bestChoice: {
    countryCode: string;
    countryName: string;
    reason: string;
  };
}

// ==================== 输出 ====================

/** Agent 总体执行结果 */
export interface ExportComplianceResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** 输入信息回显 */
  input: {
    brandId?: string;
    brandName?: string;
    modelName?: string;
    productId?: string;
    purchasePriceCny?: number;
    year?: number;
    category?: string;
    hsCode?: string;
  };
  /** 1. 品牌知识产权核查 */
  ipCheck: IPCheckResult | null;
  /** 2. 目标国认证要求 */
  certificationMatch: CertMatchResult[];
  /** 3. 出口成本计算 */
  costBreakdown: CostBreakdown[];
  /** 4. 报关单据模板 */
  documentTemplates: DocumentTemplate[];
  /** 5. 估值联动推荐 */
  valuationLink: ValuationLinkResult | null;
  /** Agent 内部日志 */
  log: string[];
  /** 异常信息 */
  error?: string;
}

/** GET /api/agents/export-compliance 状态查询 */
export interface ExportComplianceStatus {
  ok: boolean;
  agentName: "export-compliance";
  version: string;
  supportedCountries: string[];
  supportedBrands: string[];
  hsCodes: { code: string; description: string }[];
}
