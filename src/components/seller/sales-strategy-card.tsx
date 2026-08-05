"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Globe, DollarSign, Target, Zap, BarChart3, Info, ChevronDown, ChevronUp } from "lucide-react";

interface SalesStrategyCardProps {
  brand: string;
  category: string;
  modelName?: string;
  year?: number;
  priceCny?: number;
  condition?: string;
  workingHours?: number;
  location?: string;
}

interface StrategyData {
  marketOverview: {
    categoryAvgPrice: number;
    categoryMinPrice: number;
    categoryMaxPrice: number;
    similarCount: number;
    yourPriceRank: string;
    pricePercentile: number;
  };
  internationalPrices: {
    platform: string;
    matchingModels: Array<{
      model: string;
      year: number | null;
      priceForeign: string;
      priceCny: string;
      hours: string;
      location: string;
    }>;
    arbitrageWindow: string;
  } | null;
  forexAndExport: {
    eurCny: number;
    eurRub: number;
    usdCny: number;
    trend: string;
    bestExportMarket: string;
    portSuggestion: string;
  };
  recommendedMarkets: Array<{
    market: string;
    reason: string;
    priority: string;
    strategyType: string;
  }>;
  intelligence: Array<{
    title: string;
    content: string;
    impact: string;
    priority: string;
  }>;
  pricingAdvice: {
    suggestion: string;
    confidence: number;
  };
  upcomingEvent: {
    name: string;
    countdown: string;
    advice: string;
  } | null;
  dataDate: string;
}

const rankColors: Record<string, string> = {
  "偏低": "bg-green-100 text-green-700",
  "适中": "bg-blue-100 text-blue-700",
  "偏高": "bg-orange-100 text-orange-700",
};

export default function SalesStrategyCard({
  brand, category, modelName, year, priceCny, condition, workingHours, location,
}: SalesStrategyCardProps) {
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const fetchStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sales-strategy/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand, category, modelName, year,
          priceCny: priceCny ? Number(priceCny) : undefined,
          condition, workingHours, location,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "获取策略建议失败");
      }
    } catch {
      setError("网络错误，无法获取策略建议");
    } finally {
      setLoading(false);
    }
  }, [brand, category, modelName, year, priceCny, condition, workingHours, location]);

  useEffect(() => {
    if (brand && category) {
      const timer = setTimeout(() => fetchStrategy(), 500); // 防抖
      return () => clearTimeout(timer);
    }
  }, [fetchStrategy, brand, category]);

  if (!brand || !category) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white p-5 shadow-sm">
      {/* 标题栏 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-bold text-gray-900">销售策略参考</h3>
          {data && (
            <span className="text-xs text-gray-400">数据更新: {data.dataDate}</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          正在获取市场数据...
        </div>
      )}

      {error && (
        <div className="py-4 text-sm text-gray-400">
          <Info className="mr-1 inline h-4 w-4" />
          {error}
        </div>
      )}

      {data && expanded && !loading && (
        <div className="space-y-4">
          {/* 1. 同品类行情 */}
          <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-700">同品类行情</span>
            </div>
            {data.marketOverview.similarCount > 0 ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">平台同品类: {data.marketOverview.similarCount}台</span>
                  <span className="text-gray-500">均价: {data.marketOverview.categoryAvgPrice}万</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">区间: {data.marketOverview.categoryMinPrice}-{data.marketOverview.categoryMaxPrice}万</span>
                  {priceCny && (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${rankColors[data.marketOverview.yourPriceRank] || "bg-gray-100 text-gray-600"}`}>
                      {data.marketOverview.yourPriceRank}
                    </span>
                  )}
                </div>
                {priceCny && (
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${data.marketOverview.pricePercentile}%` }}
                    />
                  </div>
                )}
                {priceCny && (
                  <p className="text-xs text-gray-400">{data.marketOverview.pricePercentile}%分位</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">暂无同品类数据</p>
            )}
          </div>

          {/* 2. 国际市场参考 */}
          {data.internationalPrices && data.internationalPrices.matchingModels.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-gray-700">国际市场参考 ({data.internationalPrices.platform})</span>
              </div>
              <div className="space-y-1 text-sm">
                {data.internationalPrices.matchingModels.slice(0, 3).map((m, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{m.model} {m.year}款 {m.hours}</span>
                    <span className="font-medium text-gray-900">{m.priceForeign} ({m.priceCny})</span>
                  </div>
                ))}
                {data.internationalPrices.arbitrageWindow !== "暂无足够数据计算" && (
                  <p className="pt-1 text-xs font-medium text-green-600">
                    {data.internationalPrices.arbitrageWindow}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 3. 汇率窗口 */}
          <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">汇率与出口</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">EUR/CNY {data.forexAndExport.eurCny}</span>
                <span className="text-gray-500">EUR/RUB {data.forexAndExport.eurRub}</span>
              </div>
              <p className="text-xs font-medium text-orange-600">
                {data.forexAndExport.bestExportMarket}
              </p>
              {data.forexAndExport.portSuggestion && (
                <p className="text-xs text-gray-400">
                  建议港口: {data.forexAndExport.portSuggestion}
                </p>
              )}
            </div>
          </div>

          {/* 4. 推荐目标市场 */}
          {data.recommendedMarkets.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-gray-700">推荐目标市场</span>
              </div>
              <div className="space-y-1.5">
                {data.recommendedMarkets.map((m, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{m.priority} {m.market}</span>
                    </div>
                    <p className="text-xs text-gray-500">{m.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. 定价建议 */}
          <div className="rounded-lg border border-blue-300 bg-blue-50/50 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">定价建议</span>
            </div>
            <p className="text-sm text-gray-700">{data.pricingAdvice.suggestion}</p>
            <p className="mt-1 text-xs text-gray-400">置信度 {Math.round(data.pricingAdvice.confidence * 100)}%</p>
          </div>

          {/* 6. 即时事件 */}
          {data.upcomingEvent && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-semibold text-gray-700">{data.upcomingEvent.name}</span>
              </div>
              <p className="text-sm text-orange-700">{data.upcomingEvent.countdown}</p>
              <p className="text-xs text-gray-500">{data.upcomingEvent.advice}</p>
            </div>
          )}

          {/* 7. 市场情报 */}
          {data.intelligence.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-700">市场情报</span>
              </div>
              <ul className="space-y-1 text-xs text-gray-600">
                {data.intelligence.map((intel, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className={`flex-shrink-0 rounded px-1 text-[10px] font-medium ${intel.priority === "高" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                      {intel.priority}
                    </span>
                    <span>{intel.title}: {intel.content.substring(0, 80)}{intel.content.length > 80 ? "..." : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 底部说明 */}
          <p className="text-center text-xs text-gray-400">
            数据来源: 神雕农机每日自动化系统 · 每日07:00更新
          </p>
        </div>
      )}
    </div>
  );
}
