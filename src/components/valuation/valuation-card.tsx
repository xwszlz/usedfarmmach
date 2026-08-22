"use client";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Sparkles, ThumbsUp, AlertTriangle, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatValuationMoney } from "@/lib/valuation/formulas";
import type { ValuationResult } from "@/lib/valuation/formulas";
import { DeepReportSection } from "./deep-report-section";
import { useTr } from "@/lib/i18n-tr";
function getLABELS(tr: (s: string) => string): Record<string, {
    title: string;
    aiValue: string;
    sellerPrice: string;
    diffLabel: string;
    confidence: string;
    range: string;
    details: string;
    viewReport: string;
    reportHint: string;
    loading: string;
    error: string;
    retry: string;
    free: string;
    badge: string;
    deal: string;
    overpriced: string;
}> {
  return {
    zh: {
        title: tr("AI 智能估值"),
        aiValue: "AI\u4F30\u503C",
        sellerPrice: "\u5356\u5BB6\u62A5\u4EF7",
        diffLabel: "\u4EF7\u5DEE",
        confidence: "\u7F6E\u4FE1\u5EA6",
        range: "\u5408\u7406\u533A\u95F4",
        details: "\u4F30\u503C\u8BE6\u60C5",
        viewReport: "\u6DF1\u5EA6\u62A5\u544A",
        reportHint: "\u6DF1\u5EA6\u4F30\u503C\u62A5\u544A\u542B\u5E02\u573A\u5BF9\u6BD4\u3001\u8D8B\u52BF\u5206\u6790\u3001\u8D2D\u4E70\u5EFA\u8BAE\uFF08\u00A59-29\uFF09",
        loading: "\u4F30\u503C\u8BA1\u7B97\u4E2D...",
        error: "\u4F30\u503C\u5931\u8D25",
        retry: "\u91CD\u8BD5",
        free: "\u514D\u8D39",
        badge: "AI\u4F30\u503C",
        deal: "\u8D85\u503C\uFF01",
        overpriced: "\u504F\u8D35",
    },
    en: {
        title: "AI Valuation",
        aiValue: "AI Estimate",
        sellerPrice: "Seller Price",
        diffLabel: "Diff",
        confidence: "Confidence",
        range: "Price Range",
        details: "Details",
        viewReport: "Deep Report",
        reportHint: "Full report with market comparison, trends & buying advice (\u00A59-29)",
        loading: "Calculating...",
        error: "Failed",
        retry: "Retry",
        free: "Free",
        badge: "AI",
        deal: "Great Deal!",
        overpriced: "Overpriced",
    },
    ru: {
        title: "AI \u041E\u0446\u0435\u043D\u043A\u0430",
        aiValue: "\u041E\u0446\u0435\u043D\u043A\u0430 AI",
        sellerPrice: "\u0426\u0435\u043D\u0430 \u043F\u0440\u043E\u0434\u0430\u0432\u0446\u0430",
        diffLabel: "\u0420\u0430\u0437\u043D\u0438\u0446\u0430",
        confidence: "\u0422\u043E\u0447\u043D\u043E\u0441\u0442\u044C",
        range: "\u0414\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
        details: "\u0414\u0435\u0442\u0430\u043B\u0438",
        viewReport: "\u041E\u0442\u0447\u0451\u0442",
        reportHint: "\u041F\u043E\u043B\u043D\u044B\u0439 \u043E\u0442\u0447\u0451\u0442 \u0441 \u0430\u043D\u0430\u043B\u0438\u0437\u043E\u043C \u0440\u044B\u043D\u043A\u0430 (\u00A59-29)",
        loading: "\u0420\u0430\u0441\u0447\u0451\u0442...",
        error: "\u041E\u0448\u0438\u0431\u043A\u0430",
        retry: "\u041F\u043E\u0432\u0442\u043E\u0440",
        free: "\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E",
        badge: "AI",
        deal: "\u0412\u044B\u0433\u043E\u0434\u043D\u043E!",
        overpriced: "\u0414\u043E\u0440\u043E\u0433\u043E",
    },
};
}
interface ValuationCardProps {
    productId: string;
    productName?: string;
    locale: string;
    autoLoad?: boolean;
}
export function ValuationCard({ productId, productName, locale, autoLoad = true }: ValuationCardProps) {
  const tr = useTr();
        const [result, setResult] = useState<ValuationResult | null>(null);
    const [loading, setLoading] = useState(autoLoad);
    const [error, setError] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const l = getLABELS(tr)[locale] || getLABELS(tr).zh;
    const fetchValuation = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/valuation?productId=${productId}`);
            const data = await res.json();
            if (data.success) {
                setResult(data.data);
            }
            else {
                setError(data.error || l.error);
            }
        }
        catch {
            setError(l.error);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (autoLoad)
            fetchValuation();
    }, [productId]);
    if (loading) {
        return (<Card className="border-purple-200 bg-purple-50/30">
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-purple-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600"/>
            <span className="text-sm">{l.loading}</span>
          </div>
        </CardContent>
      </Card>);
    }
    if (error || !result) {
        return (<Card className="border-red-200 bg-red-50/30">
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-red-600">{error || l.error}</span>
          <button onClick={fetchValuation} className="text-xs text-purple-600 underline">{l.retry}</button>
        </CardContent>
      </Card>);
    }
    const impactIcon = (impact: string) => {
        if (impact === "positive")
            return <span className="text-green-500">↑</span>;
        if (impact === "negative")
            return <span className="text-red-400">↓</span>;
        return <span className="text-gray-300">—</span>;
    };
    return (<Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-white">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-purple-500"/>
          {l.title}
          <span className="ml-auto rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600">
            {l.badge} · {l.free}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 核心估值结果 */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-purple-50 p-3">
            <div className="text-[10px] text-gray-500">{l.aiValue}</div>
            <div className="text-lg font-bold text-purple-700">{formatValuationMoney(result.estimatedValue)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-[10px] text-gray-500">{result.sellerPrice ? l.sellerPrice : l.range}</div>
            {result.sellerPrice ? (<div className="text-lg font-bold text-gray-700">{formatValuationMoney(result.sellerPrice)}</div>) : (<div className="text-xs text-gray-600">{formatValuationMoney(result.priceRange.low)}~{formatValuationMoney(result.priceRange.high)}</div>)}
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <div className="text-[10px] text-gray-500">{l.confidence}</div>
            <div className="text-lg font-bold text-green-600">{Math.round(result.confidenceScore * 100)}%</div>
          </div>
        </div>

        {/* 买卖分析条 */}
        {result.isGoodDeal !== undefined && (<div className={`mt-3 flex items-center gap-2 rounded-lg p-2.5 text-sm font-medium ${result.isGoodDeal ? "bg-green-100 text-green-800" : result.priceDiffPercent !== undefined && result.priceDiffPercent < 0 ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>
            {result.isGoodDeal ? <ThumbsUp className="h-4 w-4"/> : <AlertTriangle className="h-4 w-4"/>}
            {result.analysis}
          </div>)}

        {/* 估值详情（可展开） */}
        <button onClick={() => setShowDetails(!showDetails)} className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-purple-600 hover:text-purple-700">
          {showDetails ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
          {l.details}
        </button>

        {showDetails && (<div className="mt-3 space-y-2 border-t pt-3">
            {result.details.map((d, i) => (<div key={i} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  {impactIcon(d.impact)}
                  <span className="font-medium text-gray-700">{d.label}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{d.value}</div>
                  {d.description && <div className="text-[10px] text-gray-400">{d.description}</div>}
                </div>
              </div>))}
          </div>)}

        {/* 深度报告入口 — 内嵌展开三档选择+支付+生成 */}
        <DeepReportSection productId={productId} productName={productName} valuationResult={result} locale={locale}/>
      </CardContent>
    </Card>);
}
