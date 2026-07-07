"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Globe,
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
  Calendar,
  ArrowUpRight,
  Filter,
  Tag,
  MapPin,
  Sparkles,
  TrendingUp,
  Factory,
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
  originCountry: string;
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
    label: "国际旗舰",
    labelEn: "Flagship",
    color: "text-amber-600",
    gradient: "from-amber-500 to-orange-500",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
    icon: Crown,
    badgeBg: "bg-amber-600",
  },
  premium: {
    label: "国际核心",
    labelEn: "Premium",
    color: "text-purple-600",
    gradient: "from-purple-500 to-indigo-500",
    borderColor: "border-purple-200",
    bgColor: "bg-purple-50",
    icon: Star,
    badgeBg: "bg-purple-600",
  },
  standard: {
    label: "国际精选",
    labelEn: "Selected",
    color: "text-teal-600",
    gradient: "from-teal-500 to-cyan-500",
    borderColor: "border-teal-200",
    bgColor: "bg-teal-50",
    icon: Award,
    badgeBg: "bg-teal-600",
  },
};

const countryFlags: Record<string, string> = {
  USA: "🇺🇸",
  Germany: "🇩🇪",
  "Italy/USA": "🇮🇹",
  "Canada/USA": "🇨🇦",
  Japan: "🇯🇵",
  France: "🇫🇷",
  Norway: "🇳🇴",
  Denmark: "🇩🇰",
  Finland: "🇫🇮",
  Italy: "🇮🇹",
  Netherlands: "🇳🇱",
  Austria: "🇦🇹",
  Sweden: "🇸🇪",
  Brazil: "🇧🇷",
  Czech: "🇨🇿",
  Canada: "🇨🇦",
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
  const flag = countryFlags[brand.originCountry] || "🌍";
  const isZh = locale === "zh";

  return (
    <Link
      href={`/${locale}/expo/booth/${brand.expoSlug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Top gradient bar */}
      <div className={`h-1.5 bg-gradient-to-r ${config.gradient} w-full`} />

      <div className="relative p-5">
        {/* Tier badge - floating */}
        <div
          className={`absolute right-4 top-4 flex items-center gap-1 rounded-full ${config.badgeBg} px-2.5 py-1 text-xs font-bold text-white shadow-sm`}
        >
          <Icon className="h-3 w-3" />
          {isZh ? config.label : config.labelEn}
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
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} text-3xl shadow-md`}
            >
              {flag}
            </div>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="truncate text-lg font-bold text-gray-900">
              {brand.nameZh}
            </h3>
            <p className="truncate text-sm font-medium text-gray-400">
              {brand.nameEn}
            </p>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />
              {flag} {brand.originCountry}
            </div>
          </div>
        </div>

        {/* Info tags */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {brand.establishedYear && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
              <Calendar className="h-3 w-3" />
              {isZh ? "创立" : "Est."} {brand.establishedYear}
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
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 transition-colors group-hover:text-amber-700">
            {isZh ? "进入展位" : "Enter Booth"}
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
              {isZh ? "官网" : "Website"}
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
  const isZh = locale === "zh";

  return (
    <Link
      href={`/${locale}/expo/showroom/${item.id}`}
      className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50">
        {item.coverImage ? (
          <img
            src={item.coverImage}
            alt={`${item.brand} ${item.model}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CatIcon className="h-14 w-14 text-amber-200" />
          </div>
        )}
        {item.isNewLaunch && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
            <Sparkles className="h-3 w-3" />
            NEW
          </span>
        )}
        {item.isFeatured && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
            <TrendingUp className="h-3 w-3" />
            {isZh ? "热销" : "HOT"}
          </span>
        )}
        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{item.brand}</span>
          {item.brandRel?.brandTier === "flagship" && (
            <Crown className="h-3.5 w-3.5 text-amber-500" />
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
            <span className="text-gray-400">{item.launchYear}</span>
          )}
        </div>
        {(item.msrpCny || item.msrpUsd) && (
          <div className="mt-3 border-t border-gray-50 pt-3">
            {item.msrpUsd && (
              <div className="text-lg font-extrabold text-amber-700">
                ${item.msrpUsd.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-gray-400">
                  USD
                </span>
              </div>
            )}
            {item.msrpCny && (
              <div className="text-xs text-gray-400">
                ¥{item.msrpCny.toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function GlobalBrandsClient({
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
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-gray-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-800 to-amber-900 pb-20 pt-16 text-white">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-yellow-300 blur-[100px]" />
          <div className="absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-orange-400 blur-[100px]" />
        </div>
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 400 600">
            <circle cx="350" cy="200" r="80" fill="none" stroke="white" strokeWidth="0.3" opacity="0.2" />
            <circle cx="50" cy="400" r="60" fill="none" stroke="white" strokeWidth="0.3" opacity="0.2" />
            <path d="M200 50 L250 150 L350 180 L275 260 L300 370 L200 320 L100 370 L125 260 L50 180 L150 150 Z"
              fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md">
            <Globe className="h-4 w-4" />
            <span>{isZh ? "全球标杆馆 · 主馆" : "Global Pavilion · Main Hall"}</span>
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {brands.length} {isZh ? "品牌" : "Brands"}
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            {isZh ? "全球标杆" : "Global Benchmark"}
            <span className="block bg-gradient-to-r from-yellow-300 to-amber-200 bg-clip-text text-transparent">
              {isZh ? "农机品牌殿堂" : "Machinery Hall"}
            </span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-amber-100">
            {isZh
              ? "约翰迪尔、克拉斯、凯斯、纽荷兰、芬特、麦赛弗格森——全球农机行业的技术标杆与品质参照。汇聚全球顶尖品牌，建立国际最高标准。"
              : "John Deere, CLAAS, Case IH, New Holland, Fendt, Massey Ferguson — the world's leading agricultural machinery benchmarks. Discover international standards and cutting-edge technology."}
          </p>

          {/* Stats Cards */}
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6">
            <StatCard
              number={String(brands.length)}
              label={isZh ? "国际品牌" : "Global Brands"}
              sub={isZh ? "旗舰·核心·精选" : "Flagship · Premium · Selected"}
              icon={Globe}
              gradient="from-amber-500 to-orange-600"
            />
            <StatCard
              number={String(items.length)}
              label={isZh ? "标杆机型" : "Benchmark Models"}
              sub={isZh ? "最新技术前沿" : "Latest Technology"}
              icon={Tractor}
              gradient="from-purple-500 to-indigo-600"
            />
            <StatCard
              number="10+"
              label={isZh ? "覆盖国家" : "Countries"}
              sub={isZh ? "欧美日主要产区" : "Major markets"}
              icon={MapPin}
              gradient="from-blue-500 to-cyan-600"
            />
            <StatCard
              number="100+"
              label={isZh ? "行业年限" : "Years of Legacy"}
              sub={isZh ? "百年品牌传承" : "Heritage brands"}
              icon={Award}
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
              {isZh ? "品牌等级" : "Tier"}
            </span>
            <button
              onClick={() => setSelectedTier("all")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                selectedTier === "all"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isZh ? "全部" : "All"} ({brands.length})
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
                  {isZh ? config.label : config.labelEn} ({count})
                </button>
              );
            })}
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 flex items-center gap-1 text-sm font-medium text-gray-500">
              <Tag className="h-4 w-4" />
              {isZh ? "产品品类" : "Category"}
            </span>
            <button
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isZh ? "全部" : "All"}
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
              {isZh ? "品牌阵容" : "Brand Lineup"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isZh ? "共" : ""} {filteredBrands.length} {isZh ? "个品牌" : "brands"}
              {selectedTier !== "all" && (
                <span className="ml-1 text-amber-600">
                  · {isZh ? tierConfig[selectedTier].label : tierConfig[selectedTier].labelEn}
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
              {isZh ? "清除筛选" : "Clear"}
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
            <p className="text-lg font-medium">
              {isZh ? "暂无符合条件的品牌" : "No brands match your filters"}
            </p>
            <p className="text-sm">
              {isZh ? "尝试调整筛选条件" : "Try adjusting your filters"}
            </p>
          </div>
        )}
      </section>

      {/* Featured Machines */}
      <section className="bg-gradient-to-b from-amber-50/50 to-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isZh ? "标杆机型展示" : "Benchmark Models"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {isZh ? "精选" : "Showing"} {(selectedCategory === "all" ? items : filteredItems).length} {isZh ? "台热门机型" : "featured models"}
              </p>
            </div>
            <Link
              href={`/${locale}/expo/showroom`}
              className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
            >
              {isZh ? "全部展厅" : "All Showroom"}
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
      <section className="relative overflow-hidden bg-gradient-to-r from-amber-600 to-orange-700 py-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute left-1/4 top-0 h-48 w-48 rounded-full bg-white blur-[80px]" />
          <div className="absolute right-1/4 bottom-0 h-64 w-64 rounded-full bg-yellow-300 blur-[80px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 text-center text-white sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            {isZh ? "中国制造 vs 国际标杆" : "Chinese vs Global Benchmark"}
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-amber-100">
            {isZh
              ? "想知道中国品牌与国际标杆的差距有多大？进入品类对比厅，横向参数对比，理性决策。"
              : "Want to see how Chinese brands compare to global benchmarks? Visit the Comparison Hall for side-by-side specs."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`/${locale}/expo/compare`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-amber-600 shadow-lg transition hover:bg-amber-50 hover:shadow-xl"
            >
              {isZh ? "进入品类对比厅" : "Comparison Hall"}
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/expo/china-brands`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              {isZh ? "查看中国品牌" : "Chinese Brands"}
              <Factory className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
