"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, RotateCcw, Search } from "lucide-react";
import type { ProductFilters as Filters } from "@/types";

interface ProductFiltersProps {
  filters: Filters;
  brands: SelectOption[];
  categories: SelectOption[];
  locations: SelectOption[];
  onFilterChange: (key: keyof Filters, value: string | number | undefined) => void;
  onReset: () => void;
}

export function ProductFilters({
  filters,
  brands,
  categories,
  locations,
  onFilterChange,
  onReset,
}: ProductFiltersProps) {
  const t = useTranslations("products.filters");
  const [searchInput, setSearchInput] = useState(filters.query || "");

  // 防抖搜索
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange("query", searchInput.trim() || undefined);
  }, [searchInput, onFilterChange]);

  const yearOptions: SelectOption[] = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 2000; y--) {
    yearOptions.push({ value: String(y), label: String(y) });
  }

  const sortOptions: SelectOption[] = [
    { value: "rank", label: "📊 日报排名" },
    { value: "newest", label: t("sortNewest") },
    { value: "priceLow", label: t("sortPriceLow") },
    { value: "priceHigh", label: t("sortPriceHigh") },
    { value: "yearNew", label: t("sortYearNew") },
    { value: "hoursLow", label: t("sortHoursLow") },
  ];

  const conditionOptions: SelectOption[] = [
    { value: "excellent", label: t("allConditions") === "全部成色" ? "优秀" : "Excellent" },
    { value: "good", label: t("allConditions") === "全部成色" ? "良好" : "Good" },
    { value: "fair", label: t("allConditions") === "全部成色" ? "一般" : "Fair" },
    { value: "poor", label: t("allConditions") === "全部成色" ? "较差" : "Poor" },
  ];

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      {/* 万能搜索框 */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索品牌、型号、品类、地区..."
          className="w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-green-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-200"
        />
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              onFilterChange("query", undefined);
            }}
            className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
        >
          搜索
        </button>
      </form>

      {/* 筛选器 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <SlidersHorizontal className="h-4 w-4" />
          {t("filter") || "筛选"}
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="mr-1 h-3 w-3" />
          {t("reset")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Select
          options={brands}
          placeholder={t("allBrands")}
          value={filters.brand || ""}
          onChange={(e) =>
            onFilterChange("brand", e.target.value || undefined)
          }
        />
        <Select
          options={categories}
          placeholder={t("allCategories")}
          value={filters.category || ""}
          onChange={(e) =>
            onFilterChange("category", e.target.value || undefined)
          }
        />
        <Select
          options={yearOptions}
          placeholder={t("yearRange")}
          value={filters.yearMin ? String(filters.yearMin) : ""}
          onChange={(e) =>
            onFilterChange(
              "yearMin",
              e.target.value ? Number(e.target.value) : undefined
            )
          }
        />
        <Select
          options={locations}
          placeholder={t("allLocations")}
          value={filters.location || ""}
          onChange={(e) =>
            onFilterChange("location", e.target.value || undefined)
          }
        />
        <Select
          options={sortOptions}
          value={filters.sort || "rank"}
          onChange={(e) => onFilterChange("sort", e.target.value)}
        />
      </div>
    </div>
  );
}
