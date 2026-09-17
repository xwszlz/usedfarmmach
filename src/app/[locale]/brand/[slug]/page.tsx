import type { Metadata } from "next";
import { cache } from "react";
import BrandClientPage from "./BrandClient";
import { getHreflangLanguages } from "@/components/seo/hreflang-head";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";
import { toSlug } from "@/lib/slug";
import type { Brand as BrandType, Category, Product, ProductImage } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const revalidate = 600;

/** 品牌页产品：字段与 /api/brands?slug= 的返回保持一致，但 Date 在服务端边界序列化为 ISO 字符串 */
type BrandPageProduct = Omit<Product, "createdAt" | "updatedAt" | "brand" | "category" | "images" | "seller"> & {
  createdAt: string;
  updatedAt: string;
  brand: BrandType;
  category: Category;
  images: ProductImage[];
};

/** 品牌页数据：服务端直连 Prisma 取数后交给客户端组件（不含任何 Date 实例） */
export interface BrandPageData {
  /** nameRu/nameEs/… 是 BrandClient 多语回退要用到的列，需显式声明才能穿过 RSC 边界 */
  brand: BrandType & {
    slug: string;
    productCount: number;
    nameRu?: string | null;
    nameEs?: string | null;
    namePt?: string | null;
    nameAr?: string | null;
    nameFr?: string | null;
    nameHi?: string | null;
  };
  products: BrandPageProduct[];
}

/**
 * 服务端直连 Prisma 取数（不再 HTTP 自请求 /api/brands，避免构建期依赖线上域名）。
 * 用 React cache() 去重：generateMetadata 与页面 body 中的两次调用只查一次库。
 *
 * 语义与 /api/brands?slug= 完全一致：Brand 表无 slug 字段 → 全表扫描按 toSlug(nameEn) 反查；
 * 在售过滤 status === "active"；图片经 getImageUrl() 在服务端转换；priceCny desc，无分页。
 */
export const getBrandData = cache(
  async (slug: string): Promise<BrandPageData | null> => {
    try {
      const allBrands = await prisma.brand.findMany();
      const brand = allBrands.find((b) => toSlug(b.nameEn) === slug);

      if (!brand) return null;

      const products = await prisma.product.findMany({
        where: { brandId: brand.id, status: "active" },
        include: {
          brand: true,
          category: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
        },
        orderBy: { priceCny: "desc" },
      });

      const serializedProducts: BrandPageProduct[] = products.map((p) => ({
        ...p,
        condition: p.condition as Product["condition"],
        status: p.status as Product["status"],
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        images: (p.images || []).map((img) => ({ ...img, url: getImageUrl(img.url) })),
      }));

      return {
        brand: {
          ...brand,
          slug: toSlug(brand.nameEn),
          productCount: products.length,
        },
        products: serializedProducts,
      };
    } catch {
      return null;
    }
  }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const data = await getBrandData(slug);

  if (!data?.brand) {
    return { title: "品牌未找到" };
  }

  const brandName =
    locale === "zh"
      ? data.brand.nameZh
      : locale === "ru" && data.brand.nameRu
        ? data.brand.nameRu
        : data.brand.nameEn;

  const titleMap: Record<string, string> = {
    zh: `${brandName}二手农机_${brandName}设备价格_品牌馆_神雕农机`,
    en: `${brandName} Used Farm Machinery | ${brandName} Equipment & Prices | AgriTrade`,
    ru: `${brandName} Подержанная сельхозтехника | Цены | AgriTrade`,
    es: `${brandName} Maquinaria Agrícola Usada | Precios | AgriTrade`,
    pt: `${brandName} Máquinas Agrícolas Usadas | Preços | AgriTrade`,
    ar: `${brandName} آلات زراعية مستعملة | الأسعار | AgriTrade`,
    fr: `${brandName} Machines Agricoles d'Occasion | Prix | AgriTrade`,
    hi: `${brandName} प्रयुक्त कृषि मशीनरी | मूल्य | AgriTrade`,
  };

  const descMap: Record<string, string> = {
    zh: `浏览${brandName}二手农机设备：${data.brand.productCount || ''}台在售。神雕农机全球平台，AI智能估价，跨境价格对比，真实套利分析。`,
    en: `Browse ${brandName} used farm machinery: ${data.brand.productCount || ''} units available. AgriTrade — AI valuation, cross-border price comparison & arbitrage analysis.`,
    ru: `Просмотр подержанной техники ${brandName}: ${data.brand.productCount || ''} ед. в наличии. AgriTrade — AI оценка, сравнение цен и арбитражный анализ.`,
    es: `Explore maquinaria agrícola usada ${brandName}: ${data.brand.productCount || ''} unidades. AgriTrade — valoración IA y análisis de arbitraje.`,
    pt: `Explore máquinas agrícolas usadas ${brandName}: ${data.brand.productCount || ''} unidades. AgriTrade — avaliação IA e análise de arbitragem.`,
    ar: `تصفح آلات ${brandName} الزراعية المستعملة: ${data.brand.productCount || ''} وحدة متاحة. AgriTrade — تقييم بالذكاء الاصطناعي وتحليل المراجحة.`,
    fr: `Parcourez les machines agricoles d'occasion ${brandName}: ${data.brand.productCount || ''} unités. AgriTrade — évaluation IA et analyse d'arbitrage.`,
    hi: `${brandName} प्रयुक्त कृषि मशीनरी ब्राउज़ करें: ${data.brand.productCount || ''} उपलब्ध। AgriTrade — AI मूल्यांकन और आर्बिट्राज विश्लेषण।`,
  };

  return {
    title: titleMap[locale] || titleMap["en"],
    description: descMap[locale] || descMap["en"],
    alternates: {
      canonical: `${BASE_URL}/${locale}/brand/${slug}`,
      languages: getHreflangLanguages(`/brand/${slug}`),
    },
    openGraph: {
      title: titleMap[locale] || titleMap["en"],
      description: descMap[locale] || descMap["en"],
      type: "website",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const data = await getBrandData(slug);

  const brandName = data?.brand
    ? locale === "zh"
      ? data.brand.nameZh
      : locale === "ru" && data.brand.nameRu
        ? data.brand.nameRu
        : data.brand.nameEn
    : "";

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "设备市场" : "Products", url: `${BASE_URL}/${locale}/products` },
          { name: brandName, url: `${BASE_URL}/${locale}/brand/${slug}` },
        ]}
      />
      <BrandClientPage
        initialLocale={locale}
        initialSlug={slug}
        initialData={data ?? undefined}
      />
    </>
  );
}
