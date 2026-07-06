"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import ExhibitionMap from "@/components/expo/ExhibitionMap";

interface BrandRel {
  id: string;
  nameZh: string;
  nameEn: string;
  isChineseBrand: boolean;
  brandTier: string | null;
  expoLogoUrl: string | null;
  expoStory: string | null;
  establishedYear: number | null;
  exportVolume: string | null;
}

interface ShowroomItem {
  id: string;
  deviceType: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  workingHours: number | null;
  condition: string | null;
  price: number | null;
  currency: string;
  images: string[];
  videos: string[];
  description: string | null;
  status: string;
  viewCount: number;
  inquiryCount: number;
  booth: { id: string; name: string; hall: string; pavilion?: string; tier?: string };
  brandRel: BrandRel | null;
  itemType: string;
  country: string | null;
  isChineseMade: boolean | null;
  launchYear: number | null;
  machineTier: string | null;
  msrpUsd: number | null;
  msrpCny: number | null;
  priceRange: string | null;
  isFeatured: boolean;
  isNewLaunch: boolean;
  coverImage: string | null;
  createdAt: string;
}

interface FilterOption {
  value: string;
  label: string;
}

type PavilionTab = "all" | "china" | "global";

export default function ShowroomClient({
  initialItems,
  initialTotal,
  initialHalls,
  initialBrands,
  mapBooths,
  locale,
  chinaCount,
  globalCount,
}: {
  initialItems: ShowroomItem[];
  initialTotal: number;
  initialHalls: FilterOption[];
  initialBrands: FilterOption[];
  mapBooths: unknown[];
  locale: string;
  chinaCount: number;
  globalCount: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [activePavilion, setActivePavilion] = useState<PavilionTab>("all");
  const [selectedHall, setSelectedHall] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const t = (zh: string, en: string, ru?: string) => {
    if (locale === "zh") return zh;
    if (locale === "ru" && ru) return ru;
    return en;
  };

  const machineTierLabels: Record<string, { zh: string; en: string; ru: string }> = {
    flagship: { zh: "旗舰机型", en: "Flagship", ru: "Флагман" },
    premium: { zh: "高端机型", en: "Premium", ru: "Премиум" },
    standard: { zh: "标准机型", en: "Standard", ru: "Стандарт" },
    entry: { zh: "入门机型", en: "Entry", ru: "Базовый" },
  };

  const getMachineTierLabel = (tier: string | null) => {
    if (!tier) return "";
    const c = machineTierLabels[tier];
    if (!c) return tier;
    return t(c.zh, c.en, c.ru);
  };

  const getMachineTierColor = (tier: string | null) => {
    if (!tier) return "bg-gray-100 text-gray-600";
    switch (tier) {
      case "flagship":
        return "bg-red-100 text-red-700";
      case "premium":
        return "bg-purple-100 text-purple-700";
      case "standard":
        return "bg-blue-100 text-blue-700";
      case "entry":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getBrandTierBadge = (brandRel: BrandRel | null) => {
    if (!brandRel?.brandTier) return null;
    const tier = brandRel.brandTier;
    if (tier === "flagship") {
      return (
        <span className="rounded bg-gradient-to-r from-red-500 to-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {t("旗舰品牌", "Flagship Brand", "Флагман")}
        </span>
      );
    }
    if (tier === "premium") {
      return (
        <span className="rounded bg-gradient-to-r from-purple-500 to-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {t("核心品牌", "Core Brand", "Ядро")}
        </span>
      );
    }
    if (tier === "standard") {
      return (
        <span className="rounded bg-gradient-to-r from-blue-500 to-cyan-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {t("精选品牌", "Selected Brand", "Отбор")}
        </span>
      );
    }
    return null;
  };

  const formatPrice = (item: ShowroomItem) => {
    // For new machines, show MSRP
    if (item.itemType === "new") {
      if (item.msrpCny) {
        return `¥${item.msrpCny.toLocaleString()}`;
      }
      if (item.msrpUsd) {
        return `$${item.msrpUsd.toLocaleString()}`;
      }
      if (item.priceRange) {
        return item.priceRange;
      }
      return t("询价", "Inquire", "По запросу");
    }
    // For used machines, show price
    if (!item.price) return t("询价", "Inquire", "По запросу");
    const symbol = item.currency === "CNY" ? "¥" : item.currency === "USD" ? "$" : "";
    return `${symbol}${item.price.toLocaleString()}`;
  };

  const buildParams = (pavilion: PavilionTab, hall: string, brand: string, q: string, pageNum: number) => {
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: "24",
      itemType: "new",
    });
    if (pavilion !== "all") params.set("pavilion", pavilion);
    if (hall) params.set("hall", hall);
    if (brand) params.set("brand", brand);
    if (q) params.set("q", q);
    return params;
  };

  const loadMore = useCallback(async () => {
    setLoading(true);
    const nextPage = page + 1;
    const params = buildParams(activePavilion, selectedHall, selectedBrand, searchQuery, nextPage);

    try {
      const res = await fetch(`/api/expo/showroom?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => [...prev, ...data.items]);
        setTotal(data.total);
        setPage(nextPage);
      }
    } catch (e) {
      console.error("Failed to load more:", e);
    } finally {
      setLoading(false);
    }
  }, [page, activePavilion, selectedHall, selectedBrand, searchQuery]);

  const applyFilters = useCallback(async () => {
    setLoading(true);
    setPage(1);
    const params = buildParams(activePavilion, selectedHall, selectedBrand, searchQuery, 1);

    try {
      const res = await fetch(`/api/expo/showroom?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (e) {
      console.error("Failed to filter:", e);
    } finally {
      setLoading(false);
    }
  }, [activePavilion, selectedHall, selectedBrand, searchQuery]);

  const switchPavilion = useCallback(async (pavilion: PavilionTab) => {
    setActivePavilion(pavilion);
    setLoading(true);
    setPage(1);
    setSelectedHall("");
    setSelectedBrand("");
    const params = buildParams(pavilion, "", "", "", 1);

    try {
      const res = await fetch(`/api/expo/showroom?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (e) {
      console.error("Failed to switch pavilion:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const hasMore = items.length < total;

  const hallLabels: Record<string, { zh: string; en: string; ru: string }> = {
    tractor: { zh: "拖拉机", en: "Tractor", ru: "Трактор" },
    harvester: { zh: "收获", en: "Harvester", ru: "Комбайн" },
    planter: { zh: "播种", en: "Planter", ru: "Сеялка" },
    sprayer: { zh: "植保", en: "Sprayer", ru: "Опрыскив." },
    forage: { zh: "牧草", en: "Forage", ru: "Кормовой" },
    material: { zh: "搬运", en: "Material", ru: "Материал" },
    comprehensive: { zh: "综合", en: "General", ru: "Разное" },
  };

  const getHallLabel = (hall: string) => {
    const h = hallLabels[hall];
    return h ? t(h.zh, h.en, h.ru) : t("综合", "General", "Разное");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50/20 via-amber-50/20 to-white">
      {/* Header Banner - China Focus Theme */}
      <div className="relative overflow-hidden bg-gradient-to-r from-red-700 via-red-600 to-amber-600 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-yellow-300 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-32 w-32 rounded-full bg-red-300 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-red-100 mb-3">
            <Link href={`/${locale}/expo`} className="hover:underline">
              {t("农机博览会", "EXPO", "Выставка")}
            </Link>
            <span>›</span>
            <span className="text-white">{t("线上展厅", "Showroom", "Шоурум")}</span>
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl">
            {t(
              "中国农机 · 走向世界",
              "Chinese Farm Machinery Goes Global",
              "Китайская сельхозтехника — всему миру"
            )}
          </h1>
          <p className="mt-3 text-red-100 text-lg">
            {t(
              `${total}台中国精品农机在线展示 · 32+民族品牌 · 全球买家365天随时参观`,
              `${total} premium Chinese machines on display · 32+ national brands · 365-day access for global buyers`,
              `${total} китайских машин · 32+ брендов · доступ 365 дней`
            )}
          </p>
        </div>
      </div>

      {/* Pavilion Tabs */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur shadow-sm border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            <button
              onClick={() => switchPavilion("all")}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                activePavilion === "all"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t("全部展品", "All Items", "Все экспонаты")}
              <span className={`rounded-full px-1.5 text-xs ${activePavilion === "all" ? "bg-white/20" : "bg-gray-200"}`}>
                {total}
              </span>
            </button>
            <button
              onClick={() => switchPavilion("china")}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                activePavilion === "china"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="text-base">🇨🇳</span>
              {t("中国品牌馆", "China Pavilion", "Китайский зал")}
              <span className={`rounded-full px-1.5 text-xs ${activePavilion === "china" ? "bg-white/20" : "bg-gray-200"}`}>
                {chinaCount}
              </span>
            </button>
            <button
              onClick={() => switchPavilion("global")}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                activePavilion === "global"
                  ? "bg-amber-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="text-base">🌍</span>
              {t("国际标杆馆", "Global Pavilion", "Международный зал")}
              <span className={`rounded-full px-1.5 text-xs ${activePavilion === "global" ? "bg-white/20" : "bg-gray-200"}`}>
                {globalCount}
              </span>
            </button>

            {/* View Toggle */}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === "list" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {t("列表", "List", "Список")}
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === "map" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {t("地图", "Map", "Карта")}
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 py-2">
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder={t("搜索型号、品牌...", "Search model, brand...", "Поиск...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <select
              value={selectedHall}
              onChange={(e) => {
                setSelectedHall(e.target.value);
                setTimeout(applyFilters, 100);
              }}
              className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-white"
            >
              <option value="">{t("全部品类", "All Categories", "Все категории")}</option>
              {initialHalls.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>

            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setTimeout(applyFilters, 100);
              }}
              className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-white"
            >
              <option value="">{t("全部品牌", "All Brands", "Все бренды")}</option>
              {initialBrands.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>

            <button
              onClick={applyFilters}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              {t("筛选", "Filter", "Фильтр")}
            </button>

            <div className="ml-auto text-sm text-gray-500">
              {t(`共 ${total} 台`, `${total} items`, `${total} ед.`)}
            </div>
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === "map" && (
        <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8 pt-4">
          <ExhibitionMap booths={mapBooths as any} locale={locale} />
        </div>
      )}

      {/* Items Grid - only in list view */}
      {viewMode === "list" && (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {items.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">
                {t("暂无展品", "No items found", "Нет экспонатов")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/${locale}/expo/showroom/${item.id}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-red-300"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    {item.coverImage ? (
                      <Image
                        src={item.coverImage}
                        alt={`${item.brand || ""} ${item.model || ""}`.trim()}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Hall Badge */}
                    <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
                      {getHallLabel(item.booth?.hall || "")}
                    </span>
                    {/* New Launch Badge */}
                    {item.isNewLaunch && (
                      <span className="absolute right-2 top-2 rounded-md bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                        {t("新品", "NEW", "NEW")}
                      </span>
                    )}
                    {/* Machine Tier Badge (if not new launch) */}
                    {!item.isNewLaunch && item.machineTier && (
                      <span
                        className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-xs font-medium ${getMachineTierColor(item.machineTier)}`}
                      >
                        {getMachineTierLabel(item.machineTier)}
                      </span>
                    )}
                    {/* China Made Badge */}
                    {item.isChineseMade && (
                      <span className="absolute bottom-2 left-2 rounded-md bg-red-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                        🇨🇳 {t("中国制造", "Made in China", "Сделано в Китае")}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-4">
                    {/* Brand + Brand Tier */}
                    <div className="mb-1 flex items-center gap-1.5">
                      {item.brand && (
                        <span className="text-xs font-medium text-gray-700">{item.brand}</span>
                      )}
                      {getBrandTierBadge(item.brandRel)}
                    </div>

                    {/* Model Name */}
                    <h3 className="mb-2 line-clamp-1 font-semibold text-gray-900 group-hover:text-red-700">
                      {item.model || item.deviceType}
                    </h3>

                    {/* Tags */}
                    <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-gray-500">
                      {item.launchYear && (
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          {t("上市", "Launch", "Год")}: {item.launchYear}
                        </span>
                      )}
                      {item.country && (
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          {item.country}
                        </span>
                      )}
                      <span className="rounded bg-gray-100 px-2 py-0.5">{item.deviceType}</span>
                    </div>

                    {/* Price + Views */}
                    <div className="mt-auto flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-red-700">
                          {formatPrice(item)}
                        </span>
                        {item.msrpCny && (
                          <span className="ml-1 text-xs text-gray-400">
                            {t("厂商指导价", "MSRP", "Рекоменд. цена")}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {item.viewCount > 0 && `${item.viewCount} ${t("浏览", "views", "просм.")}`}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-lg border-2 border-red-600 bg-white px-8 py-3 font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {loading
                  ? t("加载中...", "Loading...", "Загрузка...")
                  : t("加载更多", "Load More", "Загрузить еще")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
