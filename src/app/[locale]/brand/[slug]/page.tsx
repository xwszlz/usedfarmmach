"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProductGrid } from "@/components/product/product-grid";
import { ArrowLeft, Globe, Tractor } from "lucide-react";
import type { Product, Brand as BrandType } from "@/types";

interface BrandWithSlug extends BrandType {
  slug: string;
  productCount: number;
  nameRu?: string;
}

interface BrandPageData {
  brand: BrandWithSlug;
  products: Product[];
}

export default function BrandPage() {
  const t = useTranslations("brandPage");
  const locale = useLocale();
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<BrandPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBrand() {
      try {
        const res = await fetch(`/api/brands?slug=${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Brand not found");
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    fetchBrand();
  }, [slug]);

  const brandName = data?.brand
    ? locale === "zh"
      ? data.brand.nameZh
      : locale === "ru" && (data.brand as any).nameRu
        ? (data.brand as any).nameRu
        : data.brand.nameEn
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
        <Tractor className="mx-auto h-16 w-16 text-gray-300" />
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
        <span className="text-gray-900">{brandName}</span>
      </nav>

      {/* Brand Header */}
      <div className="mb-8 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-white/20 p-4 backdrop-blur-sm">
            <Globe className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{brandName}</h1>
            <p className="mt-1 text-primary-100">
              {data.brand.originCountry && (
                <span>{t("originCountry")}: {data.brand.originCountry} · </span>
              )}
              {t("productCount", { count: data.brand.productCount })}
            </p>
          </div>
        </div>
        {data.brand.isImported && (
          <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur-sm">
            ✅ {t("importedBrand")}
          </span>
        )}
      </div>

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
