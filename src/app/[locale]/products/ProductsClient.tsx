"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductFilters } from "@/components/product/product-filters";
import { Pagination } from "@/components/ui/pagination";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import type { Product, ProductFilters as Filters, PaginatedResponse } from "@/types";

export default function ProductsClient() {
  const t = useTranslations("products");
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    page: 1,
    pageSize: 12,
    sort: "rank",
  });

  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
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
  }, [locale]);

  const fetchProducts = useCallback(async () => {
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
    setFilters({ page: 1, pageSize: 12, sort: "rank" });
  }

  function handlePageChange(page: number) {
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
