"use client";

import { useState } from "react";
import { Loader2, Calculator, Sparkles } from "lucide-react";
import ValuationReportSection, {
  type ValuationReportMeta,
  type ValuationReportResult,
  type DeepAnalysisStructured,
  type ValuationNarrative,
  type ValuationVisualInfo,
} from "@/components/valuation/valuation-report-section";
import type { ValuationResult } from "@/lib/valuation/formulas";
import type { ValuationIntelligence } from "@/lib/valuation/intelligence";
import {
  describeValuationHttpError,
  readServerErrorMessage,
} from "@/components/valuation/valuation-api-error";

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

/**
 * 由已经拿到的 ValuationResult 因子推导风险提示（纯前端推导，不发任何新请求）。
 *
 * 为什么要有：估值页的 `generateWarnings()` 读的是表单输入，产品页拿不到表单，
 * 以前直接传 `warnings: []` ⇒ 产品页报告永远没有「风险提示」这一段，
 * 与估值页报告质量不一致。这里改成从估值结果的因子反向推导，口径同源（都用引擎算出的因子）。
 */
export function buildWarnings(r: ValuationResult, zh: boolean): string[] {
  const out: string[] = [];
  const conf = Number(r.confidenceScore ?? 0);
  if (conf > 0 && conf < 0.6) {
    out.push(
      zh
        ? `本次估值置信度偏低（${Math.round(conf * 100)}%），建议补充使用小时、成色照片后重新估值`
        : `Low confidence (${Math.round(conf * 100)}%). Add working hours and condition photos for a better estimate`
    );
  }
  const dep = Number(r.depreciationPercent ?? 0);
  if (dep >= 70) {
    out.push(
      zh
        ? `总折旧已达 ${Math.round(dep)}%，建议核对使用小时与成色，避免按「准新机」定价`
        : `Total depreciation is ${Math.round(dep)}%. Verify hours and condition before pricing`
    );
  }
  const cond = Number(r.conditionFactor ?? 1);
  if (cond > 0 && cond < 0.8) {
    out.push(
      zh
        ? `成色因子 ${cond.toFixed(2)}，车况对本次估值影响较大`
        : `Condition factor ${cond.toFixed(2)} — condition materially affects this estimate`
    );
  }
  const brand = Number(r.brandFactor ?? 1);
  if (brand > 0 && brand < 0.7) {
    out.push(
      zh
        ? `品牌保值系数 ${brand.toFixed(2)}（偏低），目标市场认可度有限，议价空间需留足`
        : `Brand retention ${brand.toFixed(2)} (low). Leave room for negotiation in the target market`
    );
  }
  const market = Number(r.marketFactor ?? 1);
  if (market > 0 && (market > 1.1 || market < 0.9)) {
    out.push(
      zh
        ? `市场修正因子 ${market.toFixed(2)}，区域价格水平与基准偏差较大`
        : `Market factor ${market.toFixed(2)} — regional prices deviate notably from the benchmark`
    );
  }
  // 工时缺失：引擎会把「工时残值」写成「无数据」，此时折旧只能按机龄估，误差最大
  const hoursMissing = (r.details || []).some(
    (d) => typeof d?.label === "string" && d.label.includes("工时残值") && typeof d.value === "string" && d.value.includes("无数据")
  );
  if (hoursMissing) {
    out.push(
      zh
        ? "未提供使用小时，折旧按机龄估算，误差较大（工时是二手农机最关键的定价变量）"
        : "No working hours provided — depreciation falls back to age, which is far less accurate"
    );
  }
  return out;
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
  const [intel, setIntel] = useState<ValuationIntelligence | null>(null);
  const [apiFormula, setApiFormula] = useState<string | null>(null);
  // 后端 data 里已经返回、但历史实现整包丢弃的字段（AI 结论 / 视觉成色 / 折旧拆解）。
  // 丢掉它们正是「产品页报告比估值页更简单」的根因之一，这里原样透传给报告组件。
  const [rich, setRich] = useState<Partial<ValuationReportResult>>({});
  const zh = locale === "zh";

  // 游客（未登录）走 GET 模糊区间结果：响应字段是 {priceMid,priceLow,priceHigh,confidence,details:null}
  // 与登录态的 ValuationResult 字段不同，这里做兼容映射，避免估值卡崩坏。
  const fetchValuation = async () => {
    setStarted(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/valuation?productId=${encodeURIComponent(productId)}`);
      // 非 2xx 一律显式报错：413/504/502 返回的是 HTML 错误页，直接 res.json() 会抛错
      // 并被下面的 catch 误报成「网络错误」，让人以为是网络问题而不是服务端拒绝。
      if (!res.ok) {
        const serverMsg = await readServerErrorMessage(res);
        setError(describeValuationHttpError(res.status, serverMsg));
        return;
      }
      const rawText = await res.text().catch(() => "");
      let data: { success?: boolean; error?: string; data?: unknown; intelligence?: unknown; formula?: string } | null = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }
      if (!data) {
        setError(zh ? "服务端返回了不可解析的响应，请重试" : "Unreadable response from server, please retry");
        return;
      }
      if (data.success) {
        const raw = data.data as any;
        const mapped: ValuationResult = {
          ...(raw as ValuationResult),
          estimatedValue: raw.estimatedValue ?? raw.priceMid ?? 0,
          confidenceScore: raw.confidenceScore ?? raw.confidence ?? 0.7,
          details: Array.isArray(raw.details) ? raw.details : [],
        };
        setResult(mapped);
        // 透传后端已返回的富字段（无则保持空对象，卡片自行不渲染）
        setRich({
          narrative: (raw.narrative ?? null) as ValuationNarrative | null,
          visual: (raw.visual ?? null) as ValuationVisualInfo | null,
          visualConditionScore: raw.visualConditionScore ?? null,
          visualConditionAnalysis: raw.visualConditionAnalysis ?? null,
          imageConfidence: raw.imageConfidence ?? null,
          usedV4Condition: raw.usedV4Condition === true,
          imageCount: typeof raw.imageCount === "number" ? raw.imageCount : undefined,
          videoCount: typeof raw.videoCount === "number" ? raw.videoCount : undefined,
          specDetails: Array.isArray(raw.specDetails) ? raw.specDetails : undefined,
          depreciationPercent:
            typeof raw.depreciationPercent === "number" ? raw.depreciationPercent : undefined,
          priceRange: raw.priceRange ?? undefined,
          basePrice: typeof raw.basePrice === "number" ? raw.basePrice : undefined,
        });
        setIntel((data as any).intelligence ?? null);
        setApiFormula((data as any).formula ?? null);
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
    // 修复（与估值页 ① 同一个病）：以前这里把 d.impact 的三态渲染成「↑ 加分 / ↓ 减分 / — 中性」
    // 当数值列显示，d.value 的真实数值（115% / 工时折旧 55% / 7.5/10分）整列丢失。
    // 该列本来就该是数值，所以取 d.value；为空才留空串，**不退回** impact 的定性文案。
    breakdown: (result.details || []).map((d) => ({
      label: d.label,
      value: d.value || "",
      detail: d.description,
    })),
    formula: apiFormula || buildFormula(result, zh),
    // 以前恒传 []，产品页报告永远没有风险提示；改为按引擎因子推导（口径与估值页同源）
    warnings: buildWarnings(result, zh),
    channelPrices: result.channelPrices,
    // 富字段（AI 结论 / 视觉成色 / 折旧拆解）：后端已返回，直接透传，不新增任何请求
    ...rich,
  };

  return (
    <ValuationReportSection
      channel={isChineseBrand ? "domestic" : "international"}
      meta={meta}
      result={reportResult}
      intelligence={intel}
      deepAnalysis={deepAnalysis ? (deepAnalysis as unknown as DeepAnalysisStructured) : null}
      locale={locale}
    />
  );
}
