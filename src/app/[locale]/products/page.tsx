"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductFilters } from "@/components/product/product-filters";
import { Pagination } from "@/components/ui/pagination";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import type { Product, ProductFilters as Filters, PaginatedResponse } from "@/types";

export default function ProductsPage() {
  const t = useTranslations("products");
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    page: 1,
    pageSize: 12,
    sort: "newest",
  });

  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([]);

  // Fetch filter options
  useEffect(() => {
    async function fetchOptions() {
      try {
        const res = await fetch("/api/products?pageSize=1");
        // We'll use the seed data for brands/categories
        // In production, these would come from dedicated API endpoints
      } catch (e) {
        // fallback - empty options
      }

      // Hardcoded for MVP - in production fetch from API
      setBrands([
        { value: "john-deere", label: locale === "zh" ? "约翰迪尔" : locale === "ru" ? "John Deere" : "John Deere" },
        { value: "kubota", label: locale === "zh" ? "久保田" : locale === "ru" ? "Kubota" : "Kubota" },
        { value: "case-ih", label: locale === "zh" ? "凯斯" : locale === "ru" ? "Case IH" : "Case IH" },
        { value: "new-holland", label: locale === "zh" ? "纽荷兰" : locale === "ru" ? "New Holland" : "New Holland" },
        { value: "lovol", label: locale === "zh" ? "雷沃" : locale === "ru" ? "Lovol" : "Lovol" },
        { value: "dongfeng", label: locale === "zh" ? "东风" : locale === "ru" ? "Dongfeng" : "Dongfeng" },
      ]);
      setCategories([
        { value: "tractor", label: locale === "zh" ? "拖拉机" : locale === "ru" ? "Трактор" : "Tractor" },
        { value: "combine", label: locale === "zh" ? "收割机" : locale === "ru" ? "Комбайн" : "Combine Harvester" },
        { value: "planter", label: locale === "zh" ? "播种机" : locale === "ru" ? "Сеялка" : "Planter" },
        { value: "sprayer", label: locale === "zh" ? "喷洒机" : locale === "ru" ? "Опрыскиватель" : "Sprayer" },
        { value: "baler", label: locale === "zh" ? "打捆机" : locale === "ru" ? "Пресс-подборщик" : "Baler" },
        { value: "excavator", label: locale === "zh" ? "挖掘机" : locale === "ru" ? "Экскаватор" : "Excavator" },
      ]);
      setLocations([
        { value: "山东", label: locale === "zh" ? "山东" : locale === "ru" ? "Шаньдун" : "Shandong" },
        { value: "河南", label: locale === "zh" ? "河南" : locale === "ru" ? "Хэнань" : "Henan" },
        { value: "河北", label: locale === "zh" ? "河北" : locale === "ru" ? "Хэбэй" : "Hebei" },
        { value: "黑龙江", label: locale === "zh" ? "黑龙江" : locale === "ru" ? "Хэйлунцзян" : "Heilongjiang" },
        { value: "江苏", label: locale === "zh" ? "江苏" : locale === "ru" ? "Цзянсу" : "Jiangsu" },
      ]);
    }
    fetchOptions();
  }, [locale]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.brand) params.set("brand", filters.brand);
      if (filters.category) params.set("category", filters.category);
      if (filters.yearMin) params.set("yearMin", String(filters.yearMin));
      if (filters.yearMax) params.set("yearMax", String(filters.yearMax));
      if (filters.priceMin) params.set("priceMin", String(filters.priceMin));
      if (filters.priceMax) params.set("priceMax", String(filters.priceMax));
      if (filters.location) params.set("location", filters.location);
      if (filters.condition) params.set("condition", filters.condition);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
      if (filters.sort) params.set("sort", filters.sort);

      const res = await fetch(`/api/products?${params.toString()}`);
      const result = await res.json();

      if (result.success) {
        const data = result.data as PaginatedResponse<Product>;
        setProducts(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (e) {
      console.error("Failed to fetch products:", e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleFilterChange(
    key: keyof Filters,
    value: string | number | undefined
  ) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleReset() {
    setFilters({ page: 1, pageSize: 12, sort: "newest" });
  }

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-gray-500">{t("subtitle")}</p>
      </div>

      {/* Filters */}
      <ProductFilters
        filters={filters}
        brands={brands}
        categories={categories}
        locations={locations}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Results count */}
      <div className="mt-6 mb-4 text-sm text-gray-500">
        {t("total", { count: total })}
      </div>

      {/* Products */}
      {loading ? (
        <ProductGridSkeleton />
      ) : (
        <>
          <ProductGrid products={products} locale={locale} />
          <div className="mt-8 flex justify-center">
            <Pagination
              currentPage={filters.page || 1}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
