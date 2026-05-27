"use client";

import { useState, useEffect } from "react";
import { TrendingUp, ChevronDown, ChevronUp, Sparkles, ThumbsUp, AlertTriangle, HelpCircle, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatValuationMoney } from "@/lib/valuation/formulas";
import type { ValuationResult } from "@/lib/valuation/formulas";

const LABELS: Record<string, {
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
}> = {
  zh: {
    title: "AI 智能估值",
    aiValue: "AI估值",
    sellerPrice: "卖家报价",
    diffLabel: "价差",
    confidence: "置信度",
    range: "合理区间",
    details: "估值详情",
    viewReport: "深度报告",
    reportHint: "深度估值报告含市场对比、趋势分析、购买建议（¥99-299）",
    loading: "估值计算中...",
    error: "估值失败",
    retry: "重试",
    free: "免费",
    badge: "AI估值",
    deal: "超值！",
    overpriced: "偏贵",
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
    reportHint: "Full report with market comparison, trends & buying advice ($99-299)",
    loading: "Calculating...",
    error: "Failed",
    retry: "Retry",
    free: "Free",
    badge: "AI",
    deal: "Great Deal!",
    overpriced: "Overpriced",
  },
  ru: {
    title: "AI Оценка",
    aiValue: "Оценка AI",
    sellerPrice: "Цена продавца",
    diffLabel: "Разница",
    confidence: "Точность",
    range: "Диапазон",
    details: "Детали",
    viewReport: "Отчёт",
    reportHint: "Полный отчёт с анализом рынка (¥99-299)",
    loading: "Расчёт...",
    error: "Ошибка",
    retry: "Повтор",
    free: "Бесплатно",
    badge: "AI",
    deal: "Выгодно!",
    overpriced: "Дорого",
  },
};

interface ValuationCardProps {
  productId: string;
  productName?: string;
  locale: string;
  autoLoad?: boolean;
}

export function ValuationCard({ productId, productName, locale, autoLoad = true }: ValuationCardProps) {
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const l = LABELS[locale] || LABELS.zh;

  const fetchValuation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/valuation?productId=${productId}`);
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || l.error);
      }
    } catch {
      setError(l.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) fetchValuation();
  }, [productId]);

  if (loading) {
    return (
      <Card className="border-purple-200 bg-purple-50/30">
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-purple-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
            <span className="text-sm">{l.loading}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !result) {
    return (
      <Card className="border-red-200 bg-red-50/30">
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-red-600">{error || l.error}</span>
          <button onClick={fetchValuation} className="text-xs text-purple-600 underline">{l.retry}</button>
        </CardContent>
      </Card>
    );
  }

  const impactIcon = (impact: string) => {
    if (impact === "positive") return <span className="text-green-500">↑</span>;
    if (impact === "negative") return <span className="text-red-400">↓</span>;
    return <span className="text-gray-300">—</span>;
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-white">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-purple-500" />
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
            {result.sellerPrice ? (
              <div className="text-lg font-bold text-gray-700">{formatValuationMoney(result.sellerPrice)}</div>
            ) : (
              <div className="text-xs text-gray-600">{formatValuationMoney(result.priceRange.low)}~{formatValuationMoney(result.priceRange.high)}</div>
            )}
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <div className="text-[10px] text-gray-500">{l.confidence}</div>
            <div className="text-lg font-bold text-green-600">{Math.round(result.confidenceScore * 100)}%</div>
          </div>
        </div>

        {/* 买卖分析条 */}
        {result.isGoodDeal !== undefined && (
          <div className={`mt-3 flex items-center gap-2 rounded-lg p-2.5 text-sm font-medium ${
            result.isGoodDeal ? "bg-green-100 text-green-800" : result.priceDiffPercent !== undefined && result.priceDiffPercent < 0 ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"
          }`}>
            {result.isGoodDeal ? <ThumbsUp className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {result.analysis}
          </div>
        )}

        {/* 估值详情（可展开） */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-purple-600 hover:text-purple-700"
        >
          {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {l.details}
        </button>

        {showDetails && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {result.details.map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  {impactIcon(d.impact)}
                  <span className="font-medium text-gray-700">{d.label}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{d.value}</div>
                  {d.description && <div className="text-[10px] text-gray-400">{d.description}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 深度报告入口 */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-purple-700">
            <Shield className="h-3.5 w-3.5" />
            <span>{l.reportHint}</span>
          </div>
          <button
            onClick={() => alert(locale === "zh" ? "深度报告功能即将上线" : "Deep report coming soon")}
            className="flex items-center gap-1 rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700"
          >
            {l.viewReport}
            <TrendingUp className="h-3 w-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
