"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Factory,
  Tractor,
  Wheat,
  Sprout,
  Plane,
  Layers,
  ExternalLink,
  ChevronRight,
  Star,
  Award,
  Crown,
  Globe,
  Calendar,
  ArrowUpRight,
  Filter,
  Tag,
  MapPin,
  Sparkles,
  TrendingUp,
} from "lucide-react";

interface Brand {
  id: string;
  nameZh: string;
  nameEn: string;
  brandTier: string;
  expoSlug: string;
  expoLogoUrl: string | null;
  coreCategory?: string;
  establishedYear: number | null;
  exportVolume: string;
  expoStory: string;
  officialWebsite: string | null;
  originCountry?: string;
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
  {
    label: string;
    labelEn: string;
    color: string;
    gradient: string;
    borderColor: string;
    bgColor: string;
    icon: typeof Award;
    badgeBg: string;
  }
> = {
  flagship: {
    label: "旗舰品牌",
    labelEn: "Flagship",
    color: "text-red-600",
    gradient: "from-red-600 to-rose-500",
    borderColor: "border-red-200",
    bgColor: "bg-red-50",
    icon: Crown,
    badgeBg: "bg-red-600",
  },
  premium: {
    label: "核心品牌",
    labelEn: "Premium",
    color: "text-amber-600",
    gradient: "from-amber-500 to-orange-400",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
    icon: Star,
    badgeBg: "bg-amber-500",
  },
  standard: {
    label: "精选品牌",
    labelEn: "Selected",
    color: "text-blue-600",
    gradient: "from-blue-500 to-cyan-400",
    borderColor: "border-blue-200",
    bgColor: "bg-blue-50",
    icon: Factory,
    badgeBg: "bg-blue-500",
  },
};

const categoryIcons: Record<string, typeof Tractor> = {
  拖拉机: Tractor,
  收割机: Wheat,
  收获机械: Wheat,
  玉米收获机: Wheat,
  牧草机械: Sprout,
  播种: Sprout,
  植保无人机: Plane,
  综合农机: Layers,
};

function StatCard({
  number,
  label,
  sub,
  icon: Icon,
  gradient,
}: {
  number: string;
  label: string;
  sub: string;
  icon: typeof Tractor;
  gradient: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/95 p-6 shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:shadow-xl">
      <div
        className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-2xl`}
      />
      <div className="relative">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
        <div className="text-3xl font-extrabold tracking-tight text-gray-900">
          {number}
        </div>
        <div className="mt-1 text-sm font-semibold text-gray-700">{label}</div>
        <div className="mt-1 text-xs text-gray-500">{sub}</div>
      </div>
    </div>
  );
}

function BrandCard({ brand, locale }: { brand: Brand; locale: string }) {
  const config = tierConfig[brand.brandTier] || tierConfig.standard;
  const Icon = config.icon;

  return (
    <Link
      href={`/${locale}/expo/booth/${brand.expoSlug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Top gradient bar */}
      <div
        className={`h-1.5 bg-gradient-to-r ${config.gradient} w-full`}
      />

      <div className="relative p-5">
        {/* Tier badge - floating */}
        <div
          className={`absolute right-4 top-4 flex items-center gap-1 rounded-full ${config.badgeBg} px-2.5 py-1 text-xs font-bold text-white shadow-sm`}
        >
          <Icon className="h-3 w-3" />
          {locale === "zh" ? config.label : config.labelEn}
        </div>

        {/* Brand Logo & Name */}
        <div className="mb-4 flex items-start gap-4">
          {brand.expoLogoUrl ? (
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 p-2 ring-1 ring-gray-100">
              <img
                src={brand.expoLogoUrl}
                alt={brand.nameZh}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} text-white shadow-md`}
            >
              <Factory className="h-8 w-8" />
            </div>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="truncate text-lg font-bold text-gray-900">
              {brand.nameZh}
            </h3>
            <p className="truncate text-sm font-medium text-gray-400">
              {brand.nameEn}
            </p>
          </div>
        </div>

        {/* Info tags */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {brand.establishedYear && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
              <Calendar className="h-3 w-3" />
              {brand.establishedYear}年创立
            </span>
          )}
          {brand.exportVolume && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              <Globe className="h-3 w-3" />
              {brand.exportVolume}
            </span>
          )}
        </div>

        {/* Story */}
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-gray-500">
          {brand.expoStory}
        </p>

        {/* CTA */}
        <div className="flex items-center justify-between border-t border-gray-50 pt-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 transition-colors group-hover:text-red-700">
            进入展位
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
          {brand.officialWebsite && (
            <a
              href={brand.officialWebsite}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-600"
            >
              <ExternalLink className="h-3 w-3" />
              官网
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}

function MachineCard({
  item,
  locale,
}: {
  item: ShowcaseItem;
  locale: string;
}) {
  const CatIcon = categoryIcons[item.deviceType] || Tractor;

  return (
    <Link
      href={`/${locale}/expo/showroom/${item.id}`}
      className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {item.coverImage ? (
          <img
            src={item.coverImage}
            alt={`${item.brand} ${item.model}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CatIcon className="h-14 w-14 text-gray-300" />
          </div>
        )}
        {item.isNewLaunch && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
            <Sparkles className="h-3 w-3" />
            NEW
          </span>
        )}
        {item.isFeatured && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
            <TrendingUp className="h-3 w-3" />
            热销
          </span>
        )}
        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{item.brand}</span>
          {item.brandRel?.brandTier === "flagship" && (
            <Crown className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>
        <h3 className="mb-2 text-base font-semibold text-gray-800">
          {item.model}
        </h3>
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
            <Tag className="h-3 w-3" />
            {item.deviceType}
          </span>
          {item.launchYear && (
            <span className="text-gray-400">{item.launchYear}款</span>
          )}
        </div>
        {(item.msrpCny || item.msrpUsd) && (
          <div className="mt-3 border-t border-gray-50 pt-3">
            {item.msrpCny && (
              <div className="text-lg font-extrabold text-red-600">
                ¥{item.msrpCny.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-gray-400">
                  起
                </span>
              </div>
            )}
            {item.msrpUsd && (
              <div className="text-xs text-gray-400">
                ${item.msrpUsd.toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-700 via-red-800 to-rose-900 pb-20 pt-16 text-white">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-yellow-300 blur-[100px]" />
          <div className="absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-red-400 blur-[100px]" />
        </div>
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 400 600">
            <path
              d="M200 100 Q300 150 350 250 Q400 350 300 450 Q200 550 100 450 Q0 350 50 250 Q100 150 200 100Z"
              fill="none"
              stroke="white"
              strokeWidth="0.5"
              opacity="0.3"
            />
            <circle cx="350" cy="200" r="80" fill="none" stroke="white" strokeWidth="0.3" opacity="0.2" />
            <circle cx="50" cy="400" r="60" fill="none" stroke="white" strokeWidth="0.3" opacity="0.2" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md">
            <span className="text-2xl">🇨🇳</span>
            <span>中国品牌馆 · 主馆</span>
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              70品牌
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            中国农机品牌
            <span className="block bg-gradient-to-r from-yellow-300 to-amber-200 bg-clip-text text-transparent">
              走向世界
            </span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-red-100">
            42个中国农机品牌，覆盖拖拉机、收割机、播种机、植保无人机全品类。2025年中国农机出口674亿元，同比增长32.3%——中国制造正在改变全球农业装备格局。
          </p>

          {/* Stats Cards */}
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6">
            <StatCard
              number={String(brands.length)}
              label="中国品牌"
              sub="旗舰·核心·精选"
              icon={Factory}
              gradient="from-red-500 to-rose-600"
            />
            <StatCard
              number="30+"
              label="旗舰机型"
              sub="最新技术前沿"
              icon={Tractor}
              gradient="from-amber-500 to-orange-600"
            />
            <StatCard
              number="6"
              label="品类全覆盖"
              sub="从田间到天空"
              icon={Layers}
              gradient="from-blue-500 to-cyan-600"
            />
            <StatCard
              number="674亿"
              label="年出口额"
              sub="2025年同比增长32.3%"
              icon={TrendingUp}
              gradient="from-green-500 to-emerald-600"
            />
          </div>
        </div>
      </section>

      {/* Filter Section */}
      <section className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          {/* Tier Filter */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="mr-2 flex items-center gap-1 text-sm font-medium text-gray-500">
              <Filter className="h-4 w-4" />
              品牌等级
            </span>
            <button
              onClick={() => setSelectedTier("all")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                selectedTier === "all"
                  ? "bg-red-600 text-white shadow-md shadow-red-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              全部 ({brands.length})
            </button>
            {(Object.keys(tierConfig) as string[]).map((tier) => {
              const config = tierConfig[tier];
              const count = tierCounts[tier as keyof TierCounts] || 0;
              return (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    selectedTier === tier
                      ? `bg-gradient-to-r ${config.gradient} text-white shadow-md`
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <config.icon className="h-3.5 w-3.5" />
                  {config.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 flex items-center gap-1 text-sm font-medium text-gray-500">
              <Tag className="h-4 w-4" />
              产品品类
            </span>
            <button
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              全部
            </button>
            {categoryCounts.map((c) => (
              <button
                key={c.category}
                onClick={() => setSelectedCategory(c.category)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                  selectedCategory === c.category
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
              >
                {c.category} ({c.count})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              品牌阵容
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              共 {filteredBrands.length} 个品牌
              {selectedTier !== "all" && (
                <span className="ml-1 text-red-600">
                  · {tierConfig[selectedTier].label}
                </span>
              )}
              {selectedCategory !== "all" && (
                <span className="ml-1 text-blue-600">
                  · {selectedCategory}
                </span>
              )}
            </p>
          </div>
          {(selectedTier !== "all" || selectedCategory !== "all") && (
            <button
              onClick={() => {
                setSelectedTier("all");
                setSelectedCategory("all");
              }}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-200"
            >
              清除筛选
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBrands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} locale={locale} />
          ))}
        </div>

        {filteredBrands.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Filter className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">暂无符合条件的品牌</p>
            <p className="text-sm">尝试调整筛选条件</p>
          </div>
        )}
      </section>

      {/* Featured Machines */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                旗舰机型展示
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                精选 {(selectedCategory === "all" ? items : filteredItems).length} 台热门机型
              </p>
            </div>
            <Link
              href={`/${locale}/expo/showroom`}
              className="inline-flex items-center gap-1 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              全部展厅
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(selectedCategory === "all" ? items : filteredItems)
              .slice(0, 16)
              .map((item) => (
                <MachineCard key={item.id} item={item} locale={locale} />
              ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-r from-red-600 to-rose-700 py-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute left-1/4 top-0 h-48 w-48 rounded-full bg-white blur-[80px]" />
          <div className="absolute right-1/4 bottom-0 h-64 w-64 rounded-full bg-yellow-300 blur-[80px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 text-center text-white sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            中国农机，全球机遇
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-red-100">
            从展示到成交，365天不间断。让您的中国农机品牌走向世界每一个田间。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`/${locale}/expo/showroom`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-red-600 shadow-lg transition hover:bg-red-50 hover:shadow-xl"
            >
              进入线上展厅
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/expo/global-brands`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              查看国际品牌
              <Globe className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
