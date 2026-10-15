"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Globe,
  Factory,
  ChevronRight,
} from "lucide-react";

export interface BrandCardData {
  id: string;
  nameZh: string;
  nameEn: string;
  code: string | null;
  slug: string;
  originCountry: string;
  isChineseBrand: boolean;
  logoUrl: string | null;
  brandTier: string | null;
  officialWebsite: string | null;
  establishedYear: number | null;
  productCount: number;
}

const tierConfig: Record<
  string,
  { labelZh: string; labelEn: string; cls: string }
> = {
  flagship: { labelZh: "国际旗舰", labelEn: "Flagship", cls: "bg-amber-600" },
  premium: { labelZh: "国际核心", labelEn: "Premium", cls: "bg-purple-600" },
  standard: { labelZh: "国际精选", labelEn: "Selected", cls: "bg-teal-600" },
  showcase: { labelZh: "特色展示", labelEn: "Showcase", cls: "bg-violet-600" },
};

export default function BrandsClient({
  initialBrands,
  locale,
}: {
  initialBrands: BrandCardData[];
  locale: string;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "cn" | "intl">("all");
  const [sort, setSort] = useState<"name" | "count">("name");
  const isZh = locale === "zh";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = initialBrands.filter((b) => {
      if (scope === "cn" && !b.isChineseBrand) return false;
      if (scope === "intl" && b.isChineseBrand) return false;
      if (q) {
        const hay = `${b.nameZh} ${b.nameEn} ${b.code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "count") return b.productCount - a.productCount;
      const an = isZh ? a.nameZh : a.nameEn;
      const bn = isZh ? b.nameZh : b.nameEn;
      return an.localeCompare(bn, isZh ? "zh" : "en");
    });
  }, [initialBrands, query, scope, sort, isZh]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-800 to-emerald-900 pb-14 pt-12 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-emerald-300 blur-[90px]" />
          <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-teal-400 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-md">
            <Globe className="h-4 w-4" />
            <span>{isZh ? "全球品牌馆" : "Global Brand Hall"}</span>
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {initialBrands.length} {isZh ? "品牌" : "brands"}
            </span>
          </div>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            {isZh ? "二手农机品牌大全" : "Used Farm Machinery Brands"}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-emerald-100">
            {isZh
              ? "约翰迪尔、克拉斯、凯斯、纽荷兰、久保田、中国一拖……汇集全球与中国主流农机品牌，按品牌浏览在售二手设备与 AI 估价。"
              : "John Deere, CLAAS, Case IH, New Holland, Kubota, YTO… Browse the world's and China's leading farm machinery brands, their used equipment and AI valuations."}
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isZh ? "搜索品牌（中文 / 英文）" : "Search brands (Chinese / English)"}
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(
              [
                ["all", isZh ? "全部" : "All"],
                ["intl", isZh ? "国际品牌" : "International"],
                ["cn", isZh ? "中国品牌" : "Chinese"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setScope(key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                  scope === key
                    ? "bg-emerald-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSort(sort === "name" ? "count" : "name")}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-600 transition hover:border-emerald-400"
          >
            {sort === "name"
              ? isZh
                ? "按名称"
                : "By name"
              : isZh
                ? "按在售数"
                : "By listings"}
            <ChevronRight className="h-3.5 w-3.5 rotate-90" />
          </button>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="mb-6 text-sm text-gray-500">
          {isZh ? `共 ${filtered.length} 个品牌` : `${filtered.length} brands`}
        </p>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Search className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">
              {isZh ? "未找到匹配的品牌" : "No matching brands"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((b) => {
              const tier = b.brandTier ? tierConfig[b.brandTier] : null;
              const initial = (isZh ? b.nameZh : b.nameEn)
                .charAt(0)
                .toUpperCase();
              return (
                <Link
                  key={b.id}
                  href={`/${locale}/brand/${b.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl"
                >
                  <div className="relative flex items-center gap-3 p-4">
                    {b.logoUrl ? (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 p-1.5 ring-1 ring-gray-100">
                        <img
                          src={b.logoUrl}
                          alt={b.nameZh}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white">
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-gray-900">
                        {b.nameZh}
                      </h3>
                      <p className="truncate text-xs font-medium text-gray-400">
                        {b.nameEn}
                      </p>
                    </div>
                    {tier && (
                      <span
                        className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${tier.cls}`}
                      >
                        {isZh ? tier.labelZh : tier.labelEn}
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-gray-50 px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      {b.isChineseBrand ? (
                        <Factory className="h-3 w-3" />
                      ) : (
                        <Globe className="h-3 w-3" />
                      )}
                      {b.originCountry ||
                        (b.isChineseBrand
                          ? isZh
                            ? "中国"
                            : "China"
                          : isZh
                            ? "进口"
                            : "Imported")}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        b.productCount > 0
                          ? "text-emerald-600"
                          : "text-gray-300"
                      }`}
                    >
                      {b.productCount > 0
                        ? `${b.productCount} ${isZh ? "台在售" : "listed"}`
                        : isZh
                          ? "暂无在售"
                          : "—"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
