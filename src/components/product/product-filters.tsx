"use client";

import { useTranslations } from "next-intl";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
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

  const yearOptions: SelectOption[] = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 2000; y--) {
    yearOptions.push({ value: String(y), label: String(y) });
  }

  const sortOptions: SelectOption[] = [
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <SlidersHorizontal className="h-4 w-4" />
          {t("sortBy") !== t("sortBy") ? t("filter") : "Filters"}
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
          value={filters.sort || "newest"}
          onChange={(e) => onFilterChange("sort", e.target.value)}
        />
      </div>
    </div>
  );
}
