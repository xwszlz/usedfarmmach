"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Scale,
  Tractor,
  Wheat,
  Sprout,
  Layers,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface CompareItem {
  id: string;
  model: string;
  deviceType: string;
  brand: string;
  brandId: string | null;
  msrpCny: number | null;
  msrpUsd: number | null;
  machineTier: string | null;
  launchYear: number | null;
  isChineseMade: boolean;
  isFeatured: boolean;
  isNewLaunch: boolean;
  hotScore: number;
  descriptionZh: string | null;
  brandRel: {
    id: string;
    nameZh: string;
    nameEn: string;
    brandTier: string | null;
    isChineseBrand: boolean;
    establishedYear: number | null;
    originCountry: string;
  } | null;
}

interface Category {
  category: string;
  items: CompareItem[];
}

const categoryIcons: Record<string, typeof Tractor> = {
  拖拉机: Tractor,
  收割机: Wheat,
  收获机械: Wheat,
  玉米收获机: Wheat,
  牧草机械: Sprout,
  播种: Sprout,
  旱作播种机: Sprout,
  植保无人机: Layers,
  综合农机: Layers,
};

export default function CompareClient({
  categories,
  locale,
}: {
  categories: Category[];
  locale: string;
}) {
  const isZh = locale === "zh";
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0]?.category || "拖拉机"
  );

  const currentCategory = useMemo(
    () => categories.find((c) => c.category === selectedCategory) || categories[0],
    [categories, selectedCategory]
  );

  // Split items into Chinese and International
  const chineseItems = currentCategory?.items.filter((i) => i.isChineseMade) || [];
  const intlItems = currentCategory?.items.filter((i) => !i.isChineseMade) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-900 py-16 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 h-48 w-48 rounded-full bg-cyan-300 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-blue-400 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/30 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <Scale className="h-4 w-4" />
            {isZh ? "品类对比厅 · 功能厅" : "Comparison Hall · Function Hall"}
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            {isZh ? "中国制造 vs 国际标杆" : "Chinese vs Global Benchmark"}
          </h1>
          <p className="max-w-2xl text-lg text-blue-100">
            {isZh
              ? "同品类中外品牌横向参数对比——价格、马力、性能、技术差距一目了然。理性决策，选择最适合的农机。"
              : "Side-by-side comparison of Chinese and international brands by category — price, power, performance, and technology gaps at a glance."}
          </p>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.category] || Layers;
            return (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  selectedCategory === cat.category
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.category}
                <span className="ml-1 text-xs opacity-70">({cat.items.length})</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {currentCategory && (
          <>
            <div className="mb-8 flex items-center gap-3">
              <ArrowLeftRight className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                {currentCategory.category}
                {isZh ? " 对比" : " Comparison"}
              </h2>
            </div>

            {/* Side-by-side layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Chinese Brands */}
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-2xl">🇨🇳</span>
                  <h3 className="text-lg font-bold text-red-700">
                    {isZh ? "中国品牌" : "Chinese Brands"}
                  </h3>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {chineseItems.length} {isZh ? "款" : "models"}
                  </span>
                </div>
                <div className="space-y-3">
                  {chineseItems.map((item) => (
                    <CompareCard key={item.id} item={item} locale={locale} side="china" />
                  ))}
                  {chineseItems.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                      {isZh ? "暂无中国品牌展品" : "No Chinese models"}
                    </div>
                  )}
                </div>
              </div>

              {/* International Brands */}
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-2xl">🌍</span>
                  <h3 className="text-lg font-bold text-amber-700">
                    {isZh ? "国际标杆" : "International"}
                  </h3>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {intlItems.length} {isZh ? "款" : "models"}
                  </span>
                </div>
                <div className="space-y-3">
                  {intlItems.map((item) => (
                    <CompareCard key={item.id} item={item} locale={locale} side="global" />
                  ))}
                  {intlItems.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                      {isZh ? "暂无国际品牌展品" : "No international models"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Price comparison summary */}
            {chineseItems.length > 0 && intlItems.length > 0 && (
              <div className="mt-8 rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
                <h4 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                  <Scale className="h-5 w-5 text-blue-600" />
                  {isZh ? "价格对比摘要" : "Price Comparison Summary"}
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {(() => {
                    const cnAvg =
                      chineseItems
                        .filter((i) => i.msrpUsd)
                        .reduce((sum, i, _, arr) => sum + (i.msrpUsd || 0) / arr.length, 0) || 0;
                    const intlAvg =
                      intlItems
                        .filter((i) => i.msrpUsd)
                        .reduce((sum, i, _, arr) => sum + (i.msrpUsd || 0) / arr.length, 0) || 0;
                    const ratio = cnAvg > 0 && intlAvg > 0 ? (cnAvg / intlAvg) * 100 : 0;

                    return (
                      <>
                        <div className="rounded-lg bg-white p-4 shadow-sm">
                          <div className="text-xs text-gray-500">
                            {isZh ? "中国品牌均价" : "Chinese Avg Price"}
                          </div>
                          <div className="text-xl font-bold text-red-600">
                            ${cnAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div className="rounded-lg bg-white p-4 shadow-sm">
                          <div className="text-xs text-gray-500">
                            {isZh ? "国际品牌均价" : "International Avg Price"}
                          </div>
                          <div className="text-xl font-bold text-amber-600">
                            ${intlAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div className="rounded-lg bg-white p-4 shadow-sm">
                          <div className="text-xs text-gray-500">
                            {isZh ? "价格比" : "Price Ratio"}
                          </div>
                          <div className="text-xl font-bold text-blue-600">
                            {ratio > 0 ? `${ratio.toFixed(0)}%` : "—"}
                          </div>
                          {ratio > 0 && ratio < 100 && (
                            <div className="text-xs text-green-600">
                              {isZh
                                ? `中国品牌便宜${(100 - ratio).toFixed(0)}%`
                                : `${(100 - ratio).toFixed(0)}% cheaper`}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 py-12">
        <div className="mx-auto max-w-4xl px-4 text-center text-white sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold">
            {isZh ? "找到最适合的农机" : "Find the Right Machinery"}
          </h2>
          <p className="mb-6 text-blue-100">
            {isZh
              ? "中国品牌解决'买得到、买得起、修得好'，国际品牌解决'极致性能、超大马力'——按需选择。"
              : "Chinese brands solve affordability and availability; international brands deliver peak performance — choose what fits your needs."}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={`/${locale}/expo/china-brands`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-red-600 transition hover:bg-red-50"
            >
              🇨🇳 {isZh ? "中国品牌馆" : "China Pavilion"}
            </Link>
            <Link
              href={`/${locale}/expo/global-brands`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-amber-600 transition hover:bg-amber-50"
            >
              🌍 {isZh ? "国际标杆馆" : "Global Pavilion"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function CompareCard({ item, locale, side }: { item: CompareItem; locale: string; side: string }) {
  const isZh = locale === "zh";
  const borderColor = side === "china" ? "border-red-200" : "border-amber-200";
  const bgColor = side === "china" ? "bg-red-50/50" : "bg-amber-50/50";

  return (
    <Link
      href={`/${locale}/expo/showroom/${item.id}`}
      className={`block rounded-lg border ${borderColor} ${bgColor} p-4 transition hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-bold text-gray-900">{item.brand}</span>
            {item.brandRel?.brandTier === "flagship" && (
              <span className="text-xs">⭐</span>
            )}
          </div>
          <h4 className="mb-2 font-semibold text-gray-800">{item.model}</h4>
          {item.descriptionZh && (
            <p className="line-clamp-1 text-xs text-gray-500">{item.descriptionZh}</p>
          )}
        </div>
        <div className="text-right">
          {item.msrpUsd && (
            <div className="text-sm font-bold text-gray-900">
              ${item.msrpUsd.toLocaleString()}
            </div>
          )}
          {item.msrpCny && (
            <div className="text-xs text-gray-500">¥{item.msrpCny.toLocaleString()}</div>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {item.launchYear && (
          <span className="rounded bg-white px-2 py-0.5 text-gray-600">
            {item.launchYear}
          </span>
        )}
        {item.machineTier && (
          <span className="rounded bg-white px-2 py-0.5 text-gray-600">
            {item.machineTier === "flagship"
              ? isZh ? "旗舰" : "Flagship"
              : item.machineTier === "high"
              ? isZh ? "高端" : "High"
              : item.machineTier === "mid"
              ? isZh ? "中端" : "Mid"
              : isZh ? "标准" : "Standard"}
          </span>
        )}
        {item.isNewLaunch && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">NEW</span>
        )}
      </div>
    </Link>
  );
}
