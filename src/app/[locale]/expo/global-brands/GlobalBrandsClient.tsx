"use client";

import Link from "next/link";
import {
  Globe,
  ExternalLink,
  ChevronRight,
  Award,
  Star,
  Factory,
  Tractor,
  Wheat,
  Sprout,
  Layers,
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
  } | null;
}

const tierConfig: Record<string, { label: string; labelEn: string; color: string }> = {
  flagship: { label: "国际旗舰", labelEn: "Flagship", color: "from-amber-500 to-orange-600" },
  premium: { label: "国际核心", labelEn: "Premium", color: "from-purple-500 to-indigo-600" },
  standard: { label: "国际精选", labelEn: "Selected", color: "from-teal-500 to-cyan-600" },
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
};

const categoryIcons: Record<string, typeof Tractor> = {
  拖拉机: Tractor,
  收割机: Wheat,
  收获机械: Wheat,
  牧草: Sprout,
  播种: Sprout,
  综合: Layers,
};

export default function GlobalBrandsClient({
  brands,
  items,
  tierCounts,
  locale,
}: {
  brands: Brand[];
  items: ShowcaseItem[];
  tierCounts: { flagship: number; premium: number; standard: number };
  locale: string;
}) {
  const isZh = locale === "zh";

  const flagshipBrands = brands.filter((b) => b.brandTier === "flagship");
  const premiumBrands = brands.filter((b) => b.brandTier === "premium");
  const standardBrands = brands.filter((b) => b.brandTier === "standard");

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-800 to-amber-900 py-16 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 h-48 w-48 rounded-full bg-yellow-300 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-amber-400 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/30 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <Globe className="h-4 w-4" />
            {isZh ? "国际标杆馆 · 副馆" : "Global Pavilion · Reference Hall"}
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            {isZh ? "全球标杆品牌技术参照" : "Global Benchmark Brands"}
          </h1>
          <p className="max-w-2xl text-lg text-amber-100">
            {isZh
              ? "约翰迪尔、克拉斯、凯斯、纽荷兰、芬特、麦赛弗格森——全球农机行业的技术标杆与品质参照。了解国际最高标准，建立品质预期。"
              : "John Deere, CLAAS, Case IH, New Holland, Fendt, Massey Ferguson — the global benchmarks in farm machinery. Understand international standards and quality expectations."}
          </p>

          <div className="mt-8 flex flex-wrap gap-6">
            <div className="rounded-xl bg-white/10 px-6 py-3 backdrop-blur-sm">
              <div className="text-3xl font-bold">{brands.length}</div>
              <div className="text-sm text-amber-200">{isZh ? "国际品牌" : "Brands"}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-6 py-3 backdrop-blur-sm">
              <div className="text-3xl font-bold">{items.length}+</div>
              <div className="text-sm text-amber-200">{isZh ? "标杆机型" : "Models"}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-6 py-3 backdrop-blur-sm">
              <div className="text-3xl font-bold">{tierCounts.flagship}</div>
              <div className="text-sm text-amber-200">{isZh ? "国际旗舰" : "Flagship"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Flagship Brands - Large Cards */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          {isZh ? "国际旗舰品牌" : "International Flagship Brands"}
          <span className="ml-3 text-sm font-normal text-gray-500">({flagshipBrands.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {flagshipBrands.map((brand) => (
            <div
              key={brand.id}
              className="group relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-md transition-all hover:shadow-xl hover:border-amber-300"
            >
              <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-orange-500 px-4 py-1 text-xs font-bold text-white rounded-bl-xl">
                {isZh ? "国际旗舰" : "FLAGSHIP"}
              </div>

              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-3xl">
                  {countryFlags[brand.originCountry] || "🌍"}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{brand.nameZh}</h3>
                  <p className="text-sm text-gray-500">{brand.nameEn}</p>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-600">
                {brand.establishedYear && (
                  <span className="rounded bg-amber-50 px-2 py-0.5">
                    {isZh ? "创立" : "Est."} {brand.establishedYear}
                  </span>
                )}
                {brand.coreCategory && (
                  <span className="rounded bg-gray-50 px-2 py-0.5">{brand.coreCategory}</span>
                )}
              </div>

              <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-gray-600">
                {brand.expoStory}
              </p>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs text-gray-400">{brand.exportVolume}</span>
                {brand.officialWebsite && (
                  <a
                    href={brand.officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {isZh ? "官网" : "Website"}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Premium Brands */}
      {premiumBrands.length > 0 && (
        <section className="bg-gray-50 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">
              {isZh ? "国际核心品牌" : "International Premium Brands"}
              <span className="ml-3 text-sm font-normal text-gray-500">({premiumBrands.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {premiumBrands.map((brand) => (
                <div
                  key={brand.id}
                  className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-2xl">{countryFlags[brand.originCountry] || "🌍"}</span>
                    <div>
                      <h3 className="font-bold text-gray-900">{brand.nameZh}</h3>
                      <p className="text-xs text-gray-500">{brand.nameEn}</p>
                    </div>
                  </div>
                  {brand.establishedYear && (
                    <p className="mb-2 text-xs text-gray-500">
                      {isZh ? "创立" : "Founded"} {brand.establishedYear}{brand.coreCategory ? ` · ${brand.coreCategory}` : ""}
                    </p>
                  )}
                  <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">
                    {brand.expoStory}
                  </p>
                  {brand.officialWebsite && (
                    <a
                      href={brand.officialWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {isZh ? "官网" : "Website"}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* International Machines */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          {isZh ? "标杆机型展示" : "Benchmark Models"}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/${locale}/expo/showroom/${item.id}`}
              className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-lg"
            >
              <div className="relative h-40 bg-gradient-to-br from-amber-50 to-orange-50">
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt={`${item.brand} ${item.model}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    {(() => {
                      const CatIcon = categoryIcons[item.deviceType] || Tractor;
                      return <CatIcon className="h-12 w-12 text-amber-200" />;
                    })()}
                  </div>
                )}
                {item.isNewLaunch && (
                  <span className="absolute top-2 right-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                    NEW
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{item.brand}</span>
                  {item.brandRel?.brandTier === "flagship" && (
                    <Award className="h-3 w-3 text-amber-500" />
                  )}
                </div>
                <h3 className="mb-2 font-semibold text-gray-800">{item.model}</h3>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{item.deviceType}</span>
                  {item.launchYear && <span className="text-gray-400">{item.launchYear}</span>}
                </div>
                {(item.msrpCny || item.msrpUsd) && (
                  <div className="mt-2 border-t pt-2">
                    {item.msrpUsd && (
                      <div className="text-sm font-bold text-amber-700">
                        ${item.msrpUsd.toLocaleString()}
                      </div>
                    )}
                    {item.msrpCny && (
                      <div className="text-xs text-gray-500">
                        ¥{item.msrpCny.toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-amber-600 to-orange-700 py-12">
        <div className="mx-auto max-w-4xl px-4 text-center text-white sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold">
            {isZh ? "中国制造 vs 国际标杆" : "Chinese vs Global Benchmark"}
          </h2>
          <p className="mb-6 text-amber-100">
            {isZh
              ? "想知道中国品牌与国际标杆的差距有多大？进入品类对比厅，横向参数对比，理性决策。"
              : "Want to see how Chinese brands compare to global benchmarks? Visit the Comparison Hall for side-by-side specs."}
          </p>
          <Link
            href={`/${locale}/expo/compare`}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-amber-600 transition hover:bg-amber-50"
          >
            {isZh ? "进入品类对比厅" : "Comparison Hall"}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
