"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Factory,
  Tractor,
  Wheat,
  Sprout,
  Drone,
  Layers,
  ExternalLink,
  ChevronRight,
  Star,
  Award,
  CheckCircle2,
} from "lucide-react";

interface Brand {
  id: string;
  nameZh: string;
  nameEn: string;
  brandTier: string;
  expoSlug: string;
  expoLogoUrl: string | null;
  coreCategory: string;
  establishedYear: number | null;
  exportVolume: string;
  expoStory: string;
  officialWebsite: string | null;
}

interface ShowcaseItem {
  id: string;
  model: string;
  deviceType: string;
  brand: string;
  brandId: string | null;
  msrpCny: number | null;
  msrpUsd: number | null;
  machineTier: string | null;
  launchYear: number | null;
  isNewLaunch: boolean;
  isFeatured: boolean;
  hotScore: number;
  description: string;
  descriptionZh: string | null;
  coverImage: string | null;
  brandRel: {
    id: string;
    nameZh: string;
    nameEn: string;
    brandTier: string | null;
    establishedYear: number | null;
    exportVolume: string | null;
  } | null;
}

interface CategoryCount {
  category: string;
  count: number;
}

interface TierCounts {
  flagship: number;
  premium: number;
  standard: number;
}

const tierConfig: Record<
  string,
  { label: string; labelEn: string; color: string; icon: typeof Award }
> = {
  flagship: {
    label: "旗舰品牌",
    labelEn: "Flagship",
    color: "from-red-500 to-rose-600",
    icon: Award,
  },
  premium: {
    label: "核心品牌",
    labelEn: "Premium",
    color: "from-purple-500 to-indigo-600",
    icon: Star,
  },
  standard: {
    label: "精选品牌",
    labelEn: "Selected",
    color: "from-blue-500 to-cyan-600",
    icon: Factory,
  },
};

const categoryIcons: Record<string, typeof Tractor> = {
  拖拉机: Tractor,
  收割机: Wheat,
  收获机械: Wheat,
  玉米收获机: Wheat,
  牧草机械: Sprout,
  播种: Sprout,
  植保无人机: Drone,
  综合农机: Layers,
};

export default function ChinaBrandsClient({
  brands,
  items,
  categoryCounts,
  tierCounts,
  locale,
}: {
  brands: Brand[];
  items: ShowcaseItem[];
  categoryCounts: CategoryCount[];
  tierCounts: TierCounts;
  locale: string;
}) {
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const isZh = locale === "zh";

  const filteredBrands = useMemo(() => {
    return brands.filter((b) => {
      if (selectedTier !== "all" && b.brandTier !== selectedTier) return false;
      if (selectedCategory !== "all" && !b.coreCategory?.includes(selectedCategory))
        return false;
      return true;
    });
  }, [brands, selectedTier, selectedCategory]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return items;
    return items.filter((i) => i.deviceType?.includes(selectedCategory));
  }, [items, selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-700 via-red-800 to-rose-900 py-16 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 h-48 w-48 rounded-full bg-yellow-300 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-red-400 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-500/30 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <span className="text-2xl">🇨🇳</span>
            {isZh ? "中国品牌馆 · 主馆" : "China Pavilion · Main Hall"}
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            {isZh ? "中国农机品牌走向世界" : "Chinese Farm Machinery Goes Global"}
          </h1>
          <p className="max-w-2xl text-lg text-red-100">
            {isZh
              ? "42个中国农机品牌，覆盖拖拉机、收割机、播种机、植保无人机全品类。2025年中国农机出口674亿元，同比增长32.3%——中国制造正在改变全球农业装备格局。"
              : "42 Chinese agricultural machinery brands, covering tractors, harvesters, planters, and drones. China's farm machinery exports reached ¥67.4 billion in 2025, up 32.3% YoY."}
          </p>

          {/* Stats */}
          <div className="mt-8 flex flex-wrap gap-6">
            <div className="rounded-xl bg-white/10 px-6 py-3 backdrop-blur-sm">
              <div className="text-3xl font-bold">{brands.length}</div>
              <div className="text-sm text-red-200">{isZh ? "中国品牌" : "Brands"}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-6 py-3 backdrop-blur-sm">
              <div className="text-3xl font-bold">{items.length}+</div>
              <div className="text-sm text-red-200">{isZh ? "旗舰机型" : "Models"}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-6 py-3 backdrop-blur-sm">
              <div className="text-3xl font-bold">6</div>
              <div className="text-sm text-red-200">{isZh ? "品类全覆盖" : "Categories"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Tier Navigation */}
      <section className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => setSelectedTier("all")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
              selectedTier === "all"
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {isZh ? "全部品牌" : "All"} ({brands.length})
          </button>
          {(Object.keys(tierConfig) as string[]).map((tier) => {
            const config = tierConfig[tier];
            const count = tierCounts[tier as keyof TierCounts] || 0;
            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  selectedTier === tier
                    ? `bg-gradient-to-r ${config.color} text-white`
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {isZh ? config.label : config.labelEn} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* Category Filter */}
      <section className="border-b bg-gray-50">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          <span className="text-sm font-medium text-gray-500">
            {isZh ? "品类：" : "Category:"}
          </span>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`whitespace-nowrap rounded-lg px-3 py-1 text-sm transition ${
              selectedCategory === "all"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-blue-50"
            }`}
          >
            {isZh ? "全部" : "All"}
          </button>
          {categoryCounts.map((c) => (
            <button
              key={c.category}
              onClick={() => setSelectedCategory(c.category)}
              className={`whitespace-nowrap rounded-lg px-3 py-1 text-sm transition ${
                selectedCategory === c.category
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-blue-50"
              }`}
            >
              {c.category} ({c.count})
            </button>
          ))}
        </div>
      </section>

      {/* Brand Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          {isZh ? "品牌阵容" : "Brand Lineup"}
          <span className="ml-3 text-sm font-normal text-gray-500">
            ({filteredBrands.length} {isZh ? "个品牌" : "brands"})
          </span>
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBrands.map((brand) => {
            const config = tierConfig[brand.brandTier] || tierConfig.standard;
            const Icon = config.icon;
            return (
              <div
                key={brand.id}
                className="group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:border-red-200"
              >
                {/* Tier Badge */}
                <div
                  className={`absolute top-0 right-0 bg-gradient-to-l ${config.color} px-3 py-1 text-xs font-medium text-white rounded-bl-lg`}
                >
                  {isZh ? config.label : config.labelEn}
                </div>

                {/* Brand Logo / Name */}
                <div className="mb-3 flex items-center gap-3">
                  {brand.expoLogoUrl ? (
                    <img
                      src={brand.expoLogoUrl}
                      alt={brand.nameZh}
                      className="h-12 w-12 rounded-lg object-contain"
                    />
                  ) : (
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${config.color} text-white`}
                    >
                      <Factory className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-900">{brand.nameZh}</h3>
                    <p className="text-xs text-gray-500">{brand.nameEn}</p>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-1 text-xs text-gray-600">
                  {brand.establishedYear && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">
                        {isZh ? "创立" : "Est."}
                      </span>
                      <span className="font-medium">{brand.establishedYear}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">{isZh ? "出口" : "Export"}</span>
                    <span className="truncate">{brand.exportVolume}</span>
                  </div>
                </div>

                {/* Story excerpt */}
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-gray-500">
                  {brand.expoStory}
                </p>

                {brand.officialWebsite && (
                  <a
                    href={brand.officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {isZh ? "官网" : "Website"}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Featured Machines */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            {isZh ? "旗舰机型展示" : "Flagship Models"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.slice(0, 16).map((item) => (
              <Link
                key={item.id}
                href={`/${locale}/expo/showroom/${item.id}`}
                className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-lg"
              >
                {/* Image or placeholder */}
                <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200">
                  {item.coverImage ? (
                    <img
                      src={item.coverImage}
                      alt={`${item.brand} ${item.model}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      {(() => {
                        const CatIcon =
                          categoryIcons[item.deviceType] || Tractor;
                        return <CatIcon className="h-12 w-12 text-gray-300" />;
                      })()}
                    </div>
                  )}
                  {item.isNewLaunch && (
                    <span className="absolute top-2 right-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                      NEW
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{item.brand}</span>
                    {item.brandRel?.brandTier === "flagship" && (
                      <Award className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                  <h3 className="mb-2 font-semibold text-gray-800">{item.model}</h3>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{item.deviceType}</span>
                    {item.launchYear && (
                      <span className="text-gray-400">{item.launchYear}</span>
                    )}
                  </div>
                  {(item.msrpCny || item.msrpUsd) && (
                    <div className="mt-2 border-t pt-2">
                      {item.msrpCny && (
                        <div className="text-sm font-bold text-red-600">
                          ¥{item.msrpCny.toLocaleString()}
                        </div>
                      )}
                      {item.msrpUsd && (
                        <div className="text-xs text-gray-500">
                          ${item.msrpUsd.toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-red-600 to-rose-700 py-12">
        <div className="mx-auto max-w-4xl px-4 text-center text-white sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold">
            {isZh ? "中国农机，全球机遇" : "Chinese Machinery, Global Opportunities"}
          </h2>
          <p className="mb-6 text-red-100">
            {isZh
              ? "从展示到成交，365天不间断。让您的中国农机品牌走向世界每一个田间。"
              : "From display to deal, 365 days a year. Take your Chinese machinery brand to every field worldwide."}
          </p>
          <Link
            href={`/${locale}/expo/showroom`}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-red-600 transition hover:bg-red-50"
          >
            {isZh ? "进入线上展厅" : "Enter Showroom"}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
