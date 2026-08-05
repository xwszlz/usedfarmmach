"use client";

import { useState, useCallback } from "react";
import type { Product, ProductFilters, PaginatedResponse } from "@/types";

export function useProducts(initialFilters?: ProductFilters) {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductFilters>(
    initialFilters || { page: 1, pageSize: 12, sort: "newest" }
  );

  const fetchProducts = useCallback(async (overrideFilters?: ProductFilters) => {
    setLoading(true);
    setError(null);
    const f = overrideFilters || filters;

    try {
      const params = new URLSearchParams();
      if (f.brand) params.set("brand", f.brand);
      if (f.category) params.set("category", f.category);
      if (f.yearMin) params.set("yearMin", String(f.yearMin));
      if (f.yearMax) params.set("yearMax", String(f.yearMax));
      if (f.priceMin) params.set("priceMin", String(f.priceMin));
      if (f.priceMax) params.set("priceMax", String(f.priceMax));
      if (f.location) params.set("location", f.location);
      if (f.condition) params.set("condition", f.condition);
      if (f.page) params.set("page", String(f.page));
      if (f.pageSize) params.set("pageSize", String(f.pageSize));
      if (f.sort) params.set("sort", f.sort);

      const res = await fetch(`/api/products?${params.toString()}`);
      const result = await res.json();

      if (result.success) {
        const data = result.data as PaginatedResponse<Product>;
        setProducts(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setError(result.error || "Failed to fetch products");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  function updateFilters(newFilters: Partial<ProductFilters>) {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }

  function setPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  return {
    products,
    total,
    totalPages,
    loading,
    error,
    filters,
    fetchProducts,
    updateFilters,
    setPage,
  };
}
