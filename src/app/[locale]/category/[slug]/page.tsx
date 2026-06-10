"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProductGrid } from "@/components/product/product-grid";
import { ArrowLeft, Wheat, ChevronRight } from "lucide-react";
import type { Product, Category as CategoryType } from "@/types";

interface CategoryWithSlug extends CategoryType {
  slug: string;
  productCount: number;
  nameRu?: string;
}

interface CategoryPageData {
  category: CategoryWithSlug;
  children: CategoryWithSlug[];
  products: Product[];
}

export default function CategoryPage() {
  const t = useTranslations("categoryPage");
  const locale = useLocale();
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<CategoryPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCategory() {
      try {
        const res = await fetch(`/api/categories?slug=${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Category not found");
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    fetchCategory();
  }, [slug]);

  const categoryName = data?.category
    ? locale === "zh"
      ? data.category.nameZh
      : locale === "ru" && (data.category as any).nameRu
        ? (data.category as any).nameRu
        : data.category.nameEn
    : "";

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="h-4 w-96 rounded bg-gray-200" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 rounded-lg bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <Wheat className="mx-auto h-16 w-16 text-gray-300" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">
          {t("notFound")}
        </h2>
        <Link
          href={`/${locale}/products`}
          className="mt-4 inline-flex items-center text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("backToProducts")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/${locale}`} className="hover:text-primary-600">
          {t("home")}
        </Link>
        <span>/</span>
        <Link href={`/${locale}/products`} className="hover:text-primary-600">
          {t("products")}
        </Link>
        <span>/</span>
        <span className="text-gray-900">{categoryName}</span>
      </nav>

      {/* Category Header */}
      <div className="mb-8 rounded-xl bg-gradient-to-r from-accent-600 to-accent-700 p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-white/20 p-4 backdrop-blur-sm">
            <Wheat className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{categoryName}</h1>
            <p className="mt-1 text-accent-100">
              {t("productCount", { count: data.category.productCount })}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-categories */}
      {data.children && data.children.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("subCategories")}</h2>
          <div className="flex flex-wrap gap-3">
            {data.children.map(child => {
              const childName = locale === "zh"
                ? child.nameZh
                : locale === "ru" && (child as any).nameRu
                  ? (child as any).nameRu
                  : child.nameEn;
              return (
                <Link
                  key={child.id}
                  href={`/${locale}/category/${child.slug}`}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
                >
                  {childName}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Products */}
      {data.products.length > 0 ? (
        <ProductGrid products={data.products} locale={locale} />
      ) : (
        <div className="py-16 text-center text-gray-500">
          {t("noProducts")}
        </div>
      )}
    </div>
  );
}
