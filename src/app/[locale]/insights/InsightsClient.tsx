"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";

interface SummaryData {
  totalProducts: number;
  newProductsInPeriod: number;
  soldProducts: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalInquiries: number;
  pendingInquiries: number;
}

interface CategoryItem {
  categoryId: string;
  name: string;
  nameEn: string;
  count: number;
  avgPrice: number;
}

interface BrandItem {
  brandId: string;
  name: string;
  nameEn: string;
  originCountry: string;
  count: number;
  avgPrice: number;
}

interface RegionItem {
  region: string;
  count: number;
}

interface PriceRangeItem {
  label: string;
  count: number;
}

interface TrendItem {
  date: string;
  count: number;
}

interface YearItem {
  year: number;
  count: number;
  avgPrice: number;
}

interface ArbitrageItem {
  productId: string;
  modelName: string;
  brand: string;
  year: number;
  domesticPrice: number;
  foreignPrice: number;
  priceDiff: number;
  priceDiffPercent: number;
  profitMargin: number | null;
}

interface PriceIndexItem {
  date: string;
  indexValue: number;
  avgPriceCny: number;
  sampleCount: number;
  monthOverMonth?: number | null;
  yearOverYear?: number | null;
}

interface InsightsData {
  summary: SummaryData;
  categoryDistribution: CategoryItem[];
  brandDistribution: BrandItem[];
  regionDistribution: RegionItem[];
  priceRangeDistribution: PriceRangeItem[];
  listingTrend: TrendItem[];
  yearDistribution: YearItem[];
  topArbitrage: ArbitrageItem[];
  inquiryStats: Record<string, number>;
  period: string;
}

const PERIOD_OPTIONS = [
  { value: "7d", labelZh: "近7天", labelEn: "7 Days" },
  { value: "30d", labelZh: "近30天", labelEn: "30 Days" },
  { value: "90d", labelZh: "近90天", labelEn: "90 Days" },
  { value: "1y", labelZh: "近1年", labelEn: "1 Year" },
];

export default function InsightsClient() {
  const t = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState<InsightsData | null>(null);
  const [priceIndex, setPriceIndex] = useState<PriceIndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [insightsRes, indexRes] = await Promise.all([
        fetch(`/api/market-insights?period=${period}`),
        fetch(`/api/price-index?type=overall&limit=12`),
      ]);

      if (insightsRes.ok) {
        const json = await insightsRes.json();
        if (json.success) setData(json.data);
      }
      if (indexRes.ok) {
        const json = await indexRes.json();
        if (json.success) setPriceIndex(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch insights:", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isZh = locale === "zh";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">{isZh ? "暂无数据" : "No data available"}</p>
      </div>
    );
  }

  const maxCategoryCount = Math.max(...data.categoryDistribution.map((c) => c.count), 1);
  const maxBrandCount = Math.max(...data.brandDistribution.map((b) => b.count), 1);
  const maxPriceRangeCount = Math.max(...data.priceRangeDistribution.map((p) => p.count), 1);
  const maxTrendCount = Math.max(...data.listingTrend.map((t) => t.count), 1);
  const maxIndexValue = Math.max(...priceIndex.map((p) => p.indexValue), 100);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isZh ? "数据洞察中心" : "Market Insights Center"}
          </h1>
          <p className="text-gray-500 mt-1">
            {isZh
              ? "实时掌握农机市场动态，数据驱动决策"
              : "Real-time farm machinery market data for data-driven decisions"}
          </p>
        </div>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isZh ? opt.labelZh : opt.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={isZh ? "在售设备" : "Active Listings"}
          value={data.summary.totalProducts.toLocaleString()}
          subValue={`+${data.summary.newProductsInPeriod} ${isZh ? "本期新增" : "new this period"}`}
          color="blue"
        />
        <StatCard
          label={isZh ? "平均价格" : "Avg Price"}
          value={`¥${(data.summary.avgPrice / 10000).toFixed(2)}${isZh ? "万" : "k"}`}
          subValue={isZh ? `¥${data.summary.minPrice / 10000}~${data.summary.maxPrice / 10000}万` : `Range: ¥${(data.summary.minPrice / 10000).toFixed(1)}k~${(data.summary.maxPrice / 10000).toFixed(1)}k`}
          color="green"
        />
        <StatCard
          label={isZh ? "已售设备" : "Sold Equipment"}
          value={data.summary.soldProducts.toLocaleString()}
          subValue={isZh ? "累计成交" : "Total sold"}
          color="purple"
        />
        <StatCard
          label={isZh ? "询价总数" : "Total Inquiries"}
          value={data.summary.totalInquiries.toLocaleString()}
          subValue={`${data.summary.pendingInquiries} ${isZh ? "待处理" : "pending"}`}
          color="orange"
        />
      </div>

      {/* Price Index */}
      {priceIndex.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isZh ? "价格指数走势" : "Price Index Trend"}
            <span className="ml-2 text-sm font-normal text-gray-500">
              {isZh ? "（基准日 2026-01-01 = 100）" : "(Base: Jan 2026 = 100)"}
            </span>
          </h2>
          <div className="flex items-end gap-2 h-48">
            {priceIndex.map((item, idx) => {
              const height = (item.indexValue / maxIndexValue) * 100;
              const isUp = item.indexValue >= 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-xs font-medium text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.indexValue.toFixed(1)}
                  </span>
                  <div
                    className={`w-full rounded-t transition-all hover:opacity-80 ${
                      isUp ? "bg-red-400" : "bg-green-400"
                    }`}
                    style={{ height: `${Math.max(height, 5)}%` }}
                  />
                  <span className="text-xs text-gray-400">
                    {new Date(item.date).toLocaleDateString(isZh ? "zh-CN" : "en-US", {
                      month: "short",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
          {priceIndex.length > 0 && priceIndex[priceIndex.length - 1].monthOverMonth !== null && (
            <div className="mt-4 flex gap-6 text-sm">
              <span className="text-gray-500">
                {isZh ? "环比" : "MoM"}:{" "}
                <span className={priceIndex[priceIndex.length - 1].monthOverMonth! >= 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                  {priceIndex[priceIndex.length - 1].monthOverMonth! >= 0 ? "+" : ""}
                  {priceIndex[priceIndex.length - 1].monthOverMonth}%
                </span>
              </span>
              {priceIndex[priceIndex.length - 1].yearOverYear !== null && (
                <span className="text-gray-500">
                  {isZh ? "同比" : "YoY"}:{" "}
                  <span className={priceIndex[priceIndex.length - 1].yearOverYear! >= 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                    {priceIndex[priceIndex.length - 1].yearOverYear! >= 0 ? "+" : ""}
                    {priceIndex[priceIndex.length - 1].yearOverYear}%
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Listing Trend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isZh ? "上架趋势" : "Listing Trend"}
        </h2>
        <div className="flex items-end gap-1 h-40">
          {data.listingTrend.map((item, idx) => {
            const height = (item.count / maxTrendCount) * 100;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center group">
                <div
                  className="w-full rounded-t bg-blue-400 hover:bg-blue-500 transition-colors cursor-pointer"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${item.date}: ${item.count}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column: Categories + Brands */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isZh ? "品类分布 TOP 10" : "Category Distribution TOP 10"}
          </h2>
          <div className="space-y-2">
            {data.categoryDistribution.map((cat, idx) => (
              <div key={cat.categoryId} className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-6">#{idx + 1}</span>
                <span className="text-sm font-medium text-gray-700 w-24 truncate">
                  {isZh ? cat.name : cat.nameEn}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(cat.count / maxCategoryCount) * 100}%` }}
                  >
                    <span className="text-xs text-white font-medium">{cat.count}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-20 text-right">
                  ¥{(cat.avgPrice / 10000).toFixed(1)}{isZh ? "万" : "k"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Brand Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isZh ? "品牌热度 TOP 10" : "Brand Popularity TOP 10"}
          </h2>
          <div className="space-y-2">
            {data.brandDistribution.map((brand, idx) => (
              <div key={brand.brandId} className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-6">#{idx + 1}</span>
                <span className="text-sm font-medium text-gray-700 w-28 truncate">
                  {isZh ? brand.name : brand.nameEn}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(brand.count / maxBrandCount) * 100}%` }}
                  >
                    <span className="text-xs text-white font-medium">{brand.count}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-20 text-right">
                  ¥{(brand.avgPrice / 10000).toFixed(1)}{isZh ? "万" : "k"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Price Range Distribution */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isZh ? "价格区间分布" : "Price Range Distribution"}
        </h2>
        <div className="flex items-end gap-4 h-40">
          {data.priceRangeDistribution.map((range, idx) => {
            const height = (range.count / maxPriceRangeCount) * 100;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{range.count}</span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-orange-400 to-orange-500"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
                <span className="text-xs text-gray-500">{range.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Region Distribution */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isZh ? "区域分布 TOP 10" : "Regional Distribution TOP 10"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {data.regionDistribution.map((region, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
            >
              <span className="text-xs text-gray-400">#{idx + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 truncate">{region.region}</p>
                <p className="text-xs text-gray-400">{region.count} {isZh ? "台" : "units"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Year Distribution */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isZh ? "年份分布" : "Year Distribution"}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">{isZh ? "年份" : "Year"}</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">{isZh ? "数量" : "Count"}</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">{isZh ? "均价" : "Avg Price"}</th>
              </tr>
            </thead>
            <tbody>
              {data.yearDistribution.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-700">{item.year}</td>
                  <td className="py-2 px-3 text-right text-gray-600">{item.count}</td>
                  <td className="py-2 px-3 text-right text-gray-600">
                    ¥{(item.avgPrice / 10000).toFixed(2)}{isZh ? "万" : "k"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Arbitrage */}
      {data.topArbitrage.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isZh ? "套利榜单 TOP 10" : "Arbitrage Ranking TOP 10"}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">{isZh ? "设备" : "Equipment"}</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">{isZh ? "国内价" : "Domestic"}</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">{isZh ? "国外价" : "Foreign"}</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">{isZh ? "价差%" : "Diff%"}</th>
                </tr>
              </thead>
              <tbody>
                {data.topArbitrage.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-400">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <span className="font-medium text-gray-700">{item.brand} {item.modelName}</span>
                      <span className="text-gray-400 ml-2">{item.year}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      ¥{(item.domesticPrice / 10000).toFixed(1)}{isZh ? "万" : "k"}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      ¥{(item.foreignPrice / 10000).toFixed(1)}{isZh ? "万" : "k"}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-semibold ${item.priceDiffPercent > 30 ? "text-red-600" : "text-orange-600"}`}>
                        +{item.priceDiffPercent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  color,
}: {
  label: string;
  value: string;
  subValue: string;
  color: "blue" | "green" | "purple" | "orange";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs opacity-60 mt-1">{subValue}</p>
    </div>
  );
}
