"use client";

import { useState, useCallback } from "react";
import type { ProductFilters } from "@/types";

export function useFilters(initial?: Partial<ProductFilters>) {
  const [filters, setFilters] = useState<ProductFilters>({
    page: 1,
    pageSize: 12,
    sort: "newest",
    ...initial,
  });

  const updateFilter = useCallback(
    (key: keyof ProductFilters, value: string | number | undefined) => {
      setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters({ page: 1, pageSize: 12, sort: "newest" });
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  return { filters, updateFilter, resetFilters, setPage };
}
