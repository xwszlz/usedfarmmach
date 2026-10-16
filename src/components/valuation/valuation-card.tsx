"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Sparkles, Calculator, ThumbsUp, AlertTriangle, Shield, FileText, BarChart3 } from "lucide-react";
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
  startVal: string;
  idleDesc: string;
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
    reportHint: "深度估值报告含市场对比、趋势分析、购买建议",
    loading: "估值计算中...",
    error: "估值失败",
    retry: "重试",
    free: "按量计费",
    startVal: "开始AI估值",
    idleDesc: "点「开始AI估值」后约需 15–20 秒（豆包视觉分析 + 866 万条真实补贴成交数据）",
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
    reportHint: "Full report with market comparison, trends & buying advice",
    loading: "Calculating...",
    error: "Failed",
    retry: "Retry",
    free: "Pay-per-use",
    startVal: "Start AI Valuation",
    idleDesc: "Takes ~15-20s after you press Start (Doubao vision + 8.66M subsidy records)",
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
    reportHint: "Полный отчёт с анализом рынка",
    loading: "Расчёт...",
    error: "Ошибка",
    retry: "Повтор",
    free: "По запросу",
    startVal: "Оценить",
    idleDesc: "Доубао + 8.66 млн записей субсидий, по токенам",
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
  /** 深度分析结构化结果（P3 联动），存在时结果区追加技术参数表 + 六维车况评分 */
  deepAnalysis?: Record<string, any> | null;
}

export function ValuationCard({ productId, productName, locale, autoLoad = false, deepAnalysis }: ValuationCardProps) {
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  // 估值请求通常需要 15-20 秒；用已等待秒数给用户明确反馈，避免误判为按钮失灵
  const [elapsed, setElapsed] = useState(0);
  const l = LABELS[locale] || LABELS.zh;
  const zh = locale === "zh";
  const da = deepAnalysis ?? undefined;

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

  // loading 期间每秒 tick 一次；卸载或结束时清理
  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  if (loading) {
    // 线上实测单次估值 15-22 秒：豆包视觉识别图片 + 视频分析 + 估值引擎。
    // 原先这里只有一个转圈，用户干等十几秒没有任何变化，会以为按钮失灵。
    const stage =
      elapsed < 6
        ? "正在识别设备图片与视频…"
        : elapsed < 12
          ? "正在结合 866 万条补贴成交数据计算…"
          : "正在生成估值区间与置信度…";
    return (
      <Card className="border-purple-200 bg-purple-50/30">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex items-center gap-2 text-purple-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
            <span className="text-sm">{l.loading}</span>
          </div>
          <p className="text-xs text-purple-600">{stage}</p>
          <p className="text-xs text-gray-500">
            已等待 {elapsed} 秒 · 全程约需 15–20 秒，请勿关闭或离开页面
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!result && !error) {
    return (
      <Card className="border-purple-200 bg-purple-50/30">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <Sparkles className="h-7 w-7 text-purple-500" />
          <div>
            <div className="text-sm font-medium text-gray-700">{l.title}</div>
            <p className="mt-1 text-xs text-gray-500">{l.idleDesc}</p>
          </div>
          <button
            onClick={fetchValuation}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Calculator className="h-4 w-4" />
            {l.startVal}
          </button>
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

        {/* 深度分析回灌：技术参数表 + 六维车况评分（与估值中心一致，P3 联动） */}
        {da && (da.engineType || da.driveSystem || da.netWeight || da.mainConfig || da.overallLength) && (
          <div className="mt-3 border-t border-purple-100 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-800">{zh ? "技术参数" : "Technical Specs"}</h4>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {da.engineType && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "发动机型号" : "Engine"}</span>
                  <span className="font-medium text-gray-800">{da.engineType}</span>
                </div>
              )}
              {da.driveSystem && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "驱动方式" : "Drive"}</span>
                  <span className="font-medium text-gray-800">{da.driveSystem}</span>
                </div>
              )}
              {da.netWeight && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "整机重量" : "Weight"}</span>
                  <span className="font-medium text-gray-800">{da.netWeight} kg</span>
                </div>
              )}
              {da.mainConfig && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "主要配置" : "Config"}</span>
                  <span className="font-medium text-gray-800">{da.mainConfig}</span>
                </div>
              )}
              {da.overallLength && da.overallWidth && (
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">{zh ? "外形尺寸" : "Dimensions"}</span>
                  <span className="font-medium text-gray-800">{da.overallLength}x{da.overallWidth}{da.overallHeight ? `x${da.overallHeight}` : ""} mm</span>
                </div>
              )}
            </div>
          </div>
        )}

        {da?.conditionScores && (
          <div className="mt-3 border-t border-purple-100 pt-3">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <h4 className="text-sm font-semibold text-gray-800">{zh ? "设备现状评估（六维度）" : "Condition Assessment"}</h4>
            </div>
            <div className="space-y-2">
              {[
                { key: "exterior", label: zh ? "外观漆面" : "Exterior" },
                { key: "rust", label: zh ? "锈蚀程度" : "Rust" },
                { key: "tires", label: zh ? "轮胎/履带" : "Tires" },
                { key: "cabin", label: zh ? "驾驶室/操作台" : "Cabin" },
                { key: "hydraulic", label: zh ? "液压渗漏" : "Hydraulic" },
                { key: "overall", label: zh ? "整体印象" : "Overall" },
              ].map(({ key, label }) => {
                const score = da!.conditionScores[key];
                if (score === undefined || score === null) return null;
                const pct = (Number(score) / 10) * 100;
                const color = Number(score) >= 8 ? "#10b981" : Number(score) >= 6 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-gray-600">{label}</span>
                    <div className="h-2 flex-1 rounded-full bg-gray-100">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="w-10 text-right text-xs font-bold" style={{ color }}>{score}/10</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
