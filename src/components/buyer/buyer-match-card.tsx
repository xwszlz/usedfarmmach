"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { 
  Search, Loader2, ChevronDown, ChevronUp, 
  MapPin, TrendingDown, Video, CheckCircle2, Lightbulb 
} from "lucide-react";

interface MatchedProduct {
  id: string;
  brandName: string;
  modelName: string;
  year: number;
  workingHours: number | null;
  condition: string;
  priceWan: number;
  categoryName: string;
  location: string;
  imageUrl: string | null;
  hasVideo: boolean;
  sellerName: string | null;
  matchScore: number;
  matchReasons: string[];
}

interface MatchResult {
  recommendations: MatchedProduct[];
  marketInsight: {
    avgPriceWan: number;
    minPriceWan: number;
    maxPriceWan: number;
    totalAvailable: number;
    priceTrend: string;
  };
  purchaseAdvice: string;
  recommendedCategories: string[];
  farmSizeHMatch: string;
  dataDate: string;
}

const CROP_OPTIONS = [
  "小麦", "玉米", "水稻", "牧草", "甘蔗", "大豆", 
  "马铃薯", "甜菜", "棉花", "油菜", "燕麦", "苜蓿", 
  "高粱", "青贮玉米",
];

const FARM_SIZE_OPTIONS = [
  "小户(<100亩)",
  "中型(100-500亩)",
  "大户(500-2000亩)",
  "大型(>2000亩)",
];

const MACHINE_TYPES = [
  "青储机", "收割机", "打捆机", "拖拉机", "割草机", 
  "搂草机", "裹包机", "播种机", "收获机", "捡拾台",
];

export function BuyerMatchCard({ locale }: { locale: string }) {
  const t = useTranslations("products");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState("");

  const [cropType, setCropType] = useState("");
  const [farmSize, setFarmSize] = useState("");
  const [machineType, setMachineType] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");

  async function handleMatch() {
    if (!cropType) {
      setError(locale === "zh" ? "请选择作物类型" : "Please select crop type");
      return;
    }
    if (!farmSize) {
      setError(locale === "zh" ? "请选择农场规模" : "Please select farm size");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/buyer-match/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropType,
          farmSize,
          machineType: machineType || undefined,
          budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
          budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
      } else {
        setError(json.error || "匹配失败");
      }
    } catch {
      setError(locale === "zh" ? "网络错误，请重试" : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setCropType("");
    setFarmSize("");
    setMachineType("");
    setBudgetMin("");
    setBudgetMax("");
    setResult(null);
    setError("");
  }

  const isZh = locale === "zh";

  return (
    <div className="mb-6 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Search className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-gray-900">
              {isZh ? "买家需求匹配" : "Buyer Match"}
            </h3>
            <p className="text-xs text-gray-500">
              {isZh 
                ? "输入作物+规模+预算，智能推荐最合适的农机" 
                : "Enter crop + size + budget, get smart recommendations"}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
      </button>

      {/* Form */}
      {expanded && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {/* Crop Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {isZh ? "作物类型 *" : "Crop Type *"}
              </label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{isZh ? "请选择" : "Select"}</option>
                {CROP_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Farm Size */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {isZh ? "农场规模 *" : "Farm Size *"}
              </label>
              <select
                value={farmSize}
                onChange={(e) => setFarmSize(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{isZh ? "请选择" : "Select"}</option>
                {FARM_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Machine Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {isZh ? "期望机型" : "Machine Type"}
              </label>
              <select
                value={machineType}
                onChange={(e) => setMachineType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{isZh ? "不限" : "Any"}</option>
                {MACHINE_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {isZh ? "预算（万元）" : "Budget (10k CNY)"}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder={isZh ? "最低" : "Min"}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  className="w-1/2 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder={isZh ? "最高" : "Max"}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="w-1/2 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleMatch}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {isZh ? "开始匹配" : "Match"}
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              {isZh ? "重置" : "Reset"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}

          {/* Results */}
          {result && (
            <div className="mt-4 space-y-4">
              {/* Purchase Advice */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 mb-1">
                      {isZh ? "采购建议" : "Purchase Advice"}
                    </p>
                    <p className="text-sm text-amber-800">{result.purchaseAdvice}</p>
                  </div>
                </div>
              </div>

              {/* Market Insight */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-xs text-gray-500">{isZh ? "均价" : "Avg Price"}</p>
                  <p className="text-lg font-bold text-gray-900">{result.marketInsight.avgPriceWan}<span className="text-xs ml-1">{isZh ? "万" : "0k"}</span></p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-xs text-gray-500">{isZh ? "最低价" : "Min"}</p>
                  <p className="text-lg font-bold text-green-600">{result.marketInsight.minPriceWan}<span className="text-xs ml-1">{isZh ? "万" : "0k"}</span></p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-xs text-gray-500">{isZh ? "最高价" : "Max"}</p>
                  <p className="text-lg font-bold text-red-500">{result.marketInsight.maxPriceWan}<span className="text-xs ml-1">{isZh ? "万" : "0k"}</span></p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-xs text-gray-500">{isZh ? "在售" : "Available"}</p>
                  <p className="text-lg font-bold text-blue-600">{result.marketInsight.totalAvailable}<span className="text-xs ml-1">{isZh ? "台" : "u"}</span></p>
                </div>
              </div>

              {/* Recommended Products */}
              {result.recommendations.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 text-sm">
                    {isZh ? `为您推荐 ${result.recommendations.length} 条匹配农机` : `${result.recommendations.length} Matches Found`}
                  </h4>
                  {result.recommendations.map((p, idx) => (
                    <Link
                      key={p.id}
                      href={`/${locale}/products/${p.id}`}
                      className="block rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:shadow-md transition-all"
                    >
                      <div className="flex gap-3">
                        {/* Image */}
                        <div className="h-20 w-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={`${p.brandName} ${p.modelName}`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-gray-300">
                              {p.brandName.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-900 truncate">
                                {p.brandName} {p.modelName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {p.year}{isZh ? "年" : ""} | {p.categoryName} | {p.location}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                p.matchScore >= 80 ? "bg-green-100 text-green-700" :
                                p.matchScore >= 60 ? "bg-blue-100 text-blue-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {isZh ? "匹配" : "Match"} {p.matchScore}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg font-bold text-blue-600">
                              {p.priceWan}<span className="text-xs ml-0.5">{isZh ? "万" : "0k CNY"}</span>
                            </span>
                            {p.hasVideo && (
                              <span className="flex items-center gap-0.5 text-xs text-purple-600">
                                <Video className="h-3 w-3" /> {isZh ? "有视频" : "Video"}
                              </span>
                            )}
                          </div>

                          {/* Match Reasons */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.matchReasons.slice(0, 3).map((r, i) => (
                              <span key={i} className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
                  <p className="text-gray-400">
                    {isZh ? "暂无匹配农机，建议调整筛选条件" : "No matches found, try adjusting filters"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
