"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

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
  booth: { id: string; name: string; hall: string };
  coverImage: string | null;
  createdAt: string;
}

interface FilterOption {
  value: string;
  label: string;
}

export default function ShowroomClient({
  initialItems,
  initialTotal,
  initialHalls,
  initialBrands,
  locale,
}: {
  initialItems: ShowroomItem[];
  initialTotal: number;
  initialHalls: FilterOption[];
  initialBrands: FilterOption[];
  locale: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [selectedHall, setSelectedHall] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const t = (zh: string, en: string, ru?: string) => {
    if (locale === "zh") return zh;
    if (locale === "ru" && ru) return ru;
    return en;
  };

  const conditionLabels: Record<string, { zh: string; en: string; ru: string }> = {
    excellent: { zh: "优秀", en: "Excellent", ru: "Отличное" },
    good: { zh: "良好", en: "Good", ru: "Хорошее" },
    fair: { zh: "一般", en: "Fair", ru: "Удовлетворительное" },
    poor: { zh: "差", en: "Poor", ru: "Плохое" },
  };

  const getConditionLabel = (cond: string | null) => {
    if (!cond) return "";
    const c = conditionLabels[cond];
    if (!c) return cond;
    return t(c.zh, c.en, c.ru);
  };

  const getConditionColor = (cond: string | null) => {
    if (!cond) return "bg-gray-100 text-gray-600";
    switch (cond) {
      case "excellent":
        return "bg-green-100 text-green-700";
      case "good":
        return "bg-blue-100 text-blue-700";
      case "fair":
        return "bg-yellow-100 text-yellow-700";
      case "poor":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const formatPrice = (price: number | null, currency: string) => {
    if (!price) return t("询价", "Inquire", "По запросу");
    const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
    return `${symbol}${price.toLocaleString()}`;
  };

  const loadMore = useCallback(async () => {
    setLoading(true);
    const nextPage = page + 1;
    const params = new URLSearchParams({
      page: String(nextPage),
      limit: "24",
    });
    if (selectedHall) params.set("hall", selectedHall);
    if (selectedBrand) params.set("brand", selectedBrand);
    if (searchQuery) params.set("q", searchQuery);

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
  }, [page, selectedHall, selectedBrand, searchQuery]);

  const applyFilters = useCallback(async () => {
    setLoading(true);
    setPage(1);
    const params = new URLSearchParams({
      page: "1",
      limit: "24",
    });
    if (selectedHall) params.set("hall", selectedHall);
    if (selectedBrand) params.set("brand", selectedBrand);
    if (searchQuery) params.set("q", searchQuery);

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
  }, [selectedHall, selectedBrand, searchQuery]);

  const hasMore = items.length < total;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 to-white">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-amber-100 mb-3">
            <Link href={`/${locale}/expo`} className="hover:underline">
              {t("农机博览会", "EXPO", "Выставка")}
            </Link>
            <span>›</span>
            <span className="text-white">{t("线上展厅", "Showroom", "Шоурум")}</span>
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">
            {t("365天永不落幕的线上展厅", "365-Day Always-On Online Showroom", "Круглосуточный онлайн-шоурум")}
          </h1>
          <p className="mt-2 text-amber-100 text-lg">
            {t(
              `${total}台精选设备在线展示，全球买家随时参观`,
              `${total} selected machines on display, visit anytime worldwide`,
              `${total} единиц техники на онлайн-витрине`
            )}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder={t("搜索设备型号、品牌...", "Search model, brand...", "Поиск модели, бренда...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
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

            {/* Hall Filter */}
            <select
              value={selectedHall}
              onChange={(e) => {
                setSelectedHall(e.target.value);
                setTimeout(applyFilters, 100);
              }}
              className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white"
            >
              <option value="">{t("全部展馆", "All Halls", "Все залы")}</option>
              {initialHalls.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>

            {/* Brand Filter */}
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setTimeout(applyFilters, 100);
              }}
              className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white"
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
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
            >
              {t("筛选", "Filter", "Фильтр")}
            </button>

            <div className="ml-auto text-sm text-gray-500">
              {t(`共 ${total} 台`, `${total} items`, `${total} ед.`)}
            </div>
          </div>
        </div>
      </div>

      {/* Items Grid */}
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
                className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-amber-300"
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
                    {item.booth?.hall === "tractor"
                      ? t("拖拉机", "Tractor", "Трактор")
                      : item.booth?.hall === "harvester"
                        ? t("收获", "Harvester", "Комбайн")
                        : item.booth?.hall === "planter"
                          ? t("播种", "Planter", "Сеялка")
                          : item.booth?.hall === "sprayer"
                            ? t("植保", "Sprayer", "Опрыскив.")
                            : t("综合", "General", "Разное")}
                  </span>
                  {/* Condition Badge */}
                  {item.condition && (
                    <span
                      className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-xs font-medium ${getConditionColor(item.condition)}`}
                    >
                      {getConditionLabel(item.condition)}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                    {item.brand && <span className="font-medium text-gray-700">{item.brand}</span>}
                    {item.year && <span>· {item.year}</span>}
                  </div>
                  <h3 className="mb-2 line-clamp-1 font-semibold text-gray-900 group-hover:text-amber-700">
                    {item.model || item.deviceType}
                  </h3>

                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-500">
                    {item.workingHours != null && (
                      <span className="rounded bg-gray-100 px-2 py-0.5">
                        {t("工时", "Hours", "Часы")}: {item.workingHours.toLocaleString()}h
                      </span>
                    )}
                    <span className="rounded bg-gray-100 px-2 py-0.5">{item.deviceType}</span>
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-amber-700">
                        {formatPrice(item.price, item.currency)}
                      </span>
                      {item.price && (
                        <span className="ml-1 text-xs text-gray-400">
                          {item.currency === "CNY" ? t("人民币", "CNY", "RMB") : item.currency}
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
              className="rounded-lg border-2 border-amber-600 bg-white px-8 py-3 font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
            >
              {loading
                ? t("加载中...", "Loading...", "Загрузка...")
                : t("加载更多", "Load More", "Загрузить еще")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
