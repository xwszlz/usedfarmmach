"use client";

import { useState } from "react";
import { Loader2, Calculator, Sparkles } from "lucide-react";
import ValuationReportSection, {
  type ValuationReportMeta,
  type ValuationReportResult,
  type DeepAnalysisStructured,
} from "@/components/valuation/valuation-report-section";
import type { ValuationResult } from "@/lib/valuation/formulas";

interface ProductValuationReportProps {
  productId: string;
  locale?: string;
  isChineseBrand?: boolean;
  brand?: string;
  category?: string;
  modelName?: string;
  modelYear?: number;
  ageYears?: number;
  horsepower?: number;
  hours?: number;
  region?: string;
  condition?: string;
  sellerPrice?: number | null;
  /** P3 联动：深度分析结构化结果回灌估值报告（技术参数 + 六维车况评分） */
  deepAnalysis?: Record<string, any> | null;
}

/** 由 ValuationResult 的顶层因子拼出可读公式（API 响应不直接返回 formula 字段） */
function buildFormula(r: ValuationResult, zh: boolean): string {
  const f = (n: number | undefined | null) =>
    n === undefined || n === null || Number.isNaN(Number(n)) ? "?" : Number(n).toFixed(2);
  const factors = [
    `新机基准价 ¥${Math.round(r.basePrice || 0)}`,
    `年份折旧 ${f(r.yearFactor)}`,
    `工时因子 ${f(r.hoursFactor)}`,
    `成色因子 ${f(r.conditionFactor)}`,
    `市场因子 ${f(r.marketFactor)}`,
    `品牌系数 ${f(r.brandFactor)}`,
  ];
  return `${zh ? "估值" : "Estimate"} = ${factors.join(" × ")} = ¥${Math.round(r.estimatedValue || 0)}`;
}

export default function ProductValuationReport({
  productId,
  locale = "zh",
  isChineseBrand = false,
  brand,
  category,
  modelName,
  modelYear,
  ageYears,
  horsepower,
  hours,
  region,
  condition,
  sellerPrice,
  deepAnalysis,
}: ProductValuationReportProps) {
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const zh = locale === "zh";

  // 游客（未登录）走 GET 模糊区间结果：响应字段是 {priceMid,priceLow,priceHigh,confidence,details:null}
  // 与登录态的 ValuationResult 字段不同，这里做兼容映射，避免估值卡崩坏。
  const fetchValuation = async () => {
    setStarted(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/valuation?productId=${encodeURIComponent(productId)}`);
      const data = await res.json();
      if (data.success) {
        const raw = data.data as any;
        const mapped: ValuationResult = {
          ...(raw as ValuationResult),
          estimatedValue: raw.estimatedValue ?? raw.priceMid ?? 0,
          confidenceScore: raw.confidenceScore ?? raw.confidence ?? 0.7,
          details: Array.isArray(raw.details) ? raw.details : [],
        };
        setResult(mapped);
      } else {
        setError(data.error || (zh ? "估值失败" : "Valuation failed"));
      }
    } catch {
      setError(zh ? "估值失败，请稍后重试" : "Network error, please retry");
    } finally {
      setLoading(false);
    }
  };

  if (!started || (!result && !loading && !error)) {
    return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-6 text-center">
        <Calculator className="mx-auto h-7 w-7 text-indigo-500" />
        <div className="mt-2 text-sm font-medium text-gray-700">
          {zh ? "AI 估值报告" : "AI Valuation Report"}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {zh ? "基于豆包视觉分析 + 866万条真实补贴交易" : "Doubao vision + 8.66M subsidy records"}
        </p>
        <button
          onClick={fetchValuation}
          className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Sparkles className="h-4 w-4" />
          {zh ? "生成估值报告" : "Generate Report"}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/40 py-8 text-indigo-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{zh ? "估值计算中..." : "Calculating..."}</span>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/40 px-4 py-4">
        <span className="text-sm text-red-600">{error || (zh ? "估值失败" : "Failed")}</span>
        <button onClick={fetchValuation} className="text-xs text-indigo-600 underline">
          {zh ? "重试" : "Retry"}
        </button>
      </div>
    );
  }

  const computedAge = ageYears ?? (modelYear ? new Date().getFullYear() - modelYear : undefined);

  const meta: ValuationReportMeta = {
    brand: brand || "",
    category: category || "",
    modelName: modelName || undefined,
    modelYear: modelYear,
    ageYears: computedAge,
    horsepower: horsepower,
    hours: hours,
    region: region || "",
    condition: condition || undefined,
    emission: undefined,
    newBasePrice: undefined,
    sellerPrice: sellerPrice ?? null,
    isChineseBrand,
  };

  const reportResult: ValuationReportResult = {
    value: result.estimatedValue,
    confidence: Math.round((result.confidenceScore ?? 0) * 100),
    breakdown: (result.details || []).map((d) => ({
      label: d.label,
      value:
        d.impact === "positive"
          ? zh
            ? "↑ 加分"
            : "↑ Plus"
          : d.impact === "negative"
          ? zh
            ? "↓ 减分"
            : "↓ Minus"
          : zh
          ? "— 中性"
          : "— Neutral",
      detail: d.description,
    })),
    formula: buildFormula(result, zh),
    warnings: [],
    channelPrices: result.channelPrices,
  };

  return (
    <ValuationReportSection
      channel={isChineseBrand ? "domestic" : "international"}
      meta={meta}
      result={reportResult}
      intelligence={null}
      deepAnalysis={deepAnalysis ? (deepAnalysis as unknown as DeepAnalysisStructured) : null}
      locale={locale}
    />
  );
}
