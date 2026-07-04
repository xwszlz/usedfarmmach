"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductFilters } from "@/components/product/product-filters";
import { Pagination } from "@/components/ui/pagination";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { BuyerMatchCard } from "@/components/buyer/buyer-match-card";
import type { Product, ProductFilters as Filters, PaginatedResponse } from "@/types";

interface Props {
  initialProducts?: Product[];
  initialTotal?: number;
  initialTotalPages?: number;
  initialBrands?: { value: string; label: string }[];
  initialCategories?: { value: string; label: string }[];
  initialLocations?: { value: string; label: string }[];
}

export default function ProductsClient({
  initialProducts = [],
  initialTotal = 0,
  initialTotalPages = 0,
  initialBrands = [],
  initialCategories = [],
  initialLocations = [],
}: Props) {
  const t = useTranslations("products");
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(initialProducts.length === 0);
  const [filters, setFilters] = useState<Filters>({
    page: 1,
    pageSize: 12,
    sort: "rank",
  });
  const [seoHydrated, setSeoHydrated] = useState(initialProducts.length > 0);

  const [brands, setBrands] = useState<{ value: string; label: string }[]>(initialBrands);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>(initialCategories);
  const [locations, setLocations] = useState<{ value: string; label: string }[]>(initialLocations);

  // Only fetch filter options if not provided from SSR
  useEffect(() => {
    if (initialBrands.length > 0 || initialCategories.length > 0) return;

    async function fetchFilterOptions() {
      try {
        const res = await fetch("/api/products/filters");
        const json = await res.json();
        if (json.success) {
          const getLabel = (item: { labelZh: string; labelEn: string; labelRu?: string }) => {
            if (locale === "en") return item.labelEn;
            if (locale === "ru" && item.labelRu) return item.labelRu;
            return item.labelZh;
          };
          setBrands(json.data.brands.map((b: any) => ({ value: b.value, label: getLabel(b) })));
          setCategories(json.data.categories.map((c: any) => ({ value: c.value, label: getLabel(c) })));
          setLocations(json.data.locations.map((l: any) => ({ value: l.value, label: getLabel(l) })));
        }
      } catch (e) {
        console.error("Failed to fetch filter options:", e);
      }
    }
    fetchFilterOptions();
  }, [locale, initialBrands.length, initialCategories.length]);

  const fetchProducts = useCallback(async () => {
    // Skip first render if we have SSR data with default filters
    if (seoHydrated && filters.page === 1 && filters.sort === "rank"
      && !filters.query && !filters.brand && !filters.category
      && !filters.location && !filters.condition) {
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.query) params.set("query", filters.query);
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
  }, [filters, seoHydrated]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleFilterChange(
    key: keyof Filters,
    value: string | number | undefined
  ) {
    setSeoHydrated(false);
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleReset() {
    setSeoHydrated(false);
    setFilters({ page: 1, pageSize: 12, sort: "rank" });
  }

  function handlePageChange(page: number) {
    setSeoHydrated(false);
    setFilters((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-gray-500">{t("subtitle")}</p>
      </div>

      {/* Buyer Match Card */}
      <BuyerMatchCard locale={locale} />

      <ProductFilters
        filters={filters}
        brands={brands}
        categories={categories}
        locations={locations}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      <div className="mt-6 mb-4 text-sm text-gray-500">
        {t("total", { count: total })}
      </div>

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
