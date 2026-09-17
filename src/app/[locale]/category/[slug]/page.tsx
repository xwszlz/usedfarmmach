import type { Metadata } from "next";
import { cache } from "react";
import CategoryClientPage from "./CategoryClient";
import { getHreflangLanguages } from "@/components/seo/hreflang-head";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";
import { toSlug } from "@/lib/slug";
import type { Category, InternationalPrice, Product, ProductImage } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const revalidate = 600;

/**
 * 国际比价行：InternationalPrice 的 createdAt/updatedAt/lastVerified 是 Prisma DateTime，
 * 直连取数时是真 Date 实例，必须与 Product 一样在服务端边界序列化为 ISO 字符串，
 * 否则会以 Date 实例穿过 RSC 边界传给 Client Component（sourceDate 在 schema 里本就是 String）。
 */
type SerializedInternationalPrice = Omit<
  InternationalPrice,
  "createdAt" | "updatedAt" | "lastVerified"
> & {
  createdAt: string;
  updatedAt: string;
  lastVerified: string | null;
};

/** 品类页产品：字段与 /api/categories?slug= 的返回保持一致，但 Date 在服务端边界序列化为 ISO 字符串 */
type CategoryPageProduct = Omit<
  Product,
  "createdAt" | "updatedAt" | "brand" | "category" | "images" | "seller" | "videos" | "internationalPrices"
> & {
  createdAt: string;
  updatedAt: string;
  brand: Product["brand"];
  category: Category;
  images: ProductImage[];
  /** 与 /api/categories 一致只取 1 条（按 sourceDate desc） */
  internationalPrices: SerializedInternationalPrice[];
};

/** 品类子栏目：带 slug 与在售数，供 CategoryClient 渲染内链 */
export interface CategoryWithSlug extends Category {
  slug: string;
  productCount: number;
  nameRu?: string | null;
  nameEs?: string | null;
  namePt?: string | null;
  nameAr?: string | null;
  nameFr?: string | null;
  nameHi?: string | null;
  viewCount?: number;
}

/** 品类页数据：服务端直连 Prisma 取数后交给客户端组件（不含任何 Date 实例） */
export interface CategoryPageData {
  /** nameRu/nameEs/… 是 CategoryClient 多语回退要用到的列，需显式声明才能穿过 RSC 边界 */
  category: CategoryWithSlug;
  children: CategoryWithSlug[];
  products: CategoryPageProduct[];
}

/**
 * 服务端直连 Prisma 取数（不再 HTTP 自请求 /api/categories，避免构建期依赖线上域名）。
 * 用 React cache() 去重：generateMetadata 与页面 body 中的两次调用只查一次库。
 *
 * 语义与 /api/categories?slug= 完全一致：Category 表无 slug 字段 → 全表扫描按 toSlug(nameEn) 反查；
 * 在售过滤 status === "active"；图片经 getImageUrl() 在服务端转换；priceCny desc，无分页；
 * 子分类由已取回的 allCategories 内存过滤，不额外查库。
 */
const getCategoryData = cache(
  async (slug: string): Promise<CategoryPageData | null> => {
    try {
      const allCategories = await prisma.category.findMany();
      const category = allCategories.find((c) => toSlug(c.nameEn) === slug);

      if (!category) return null;

      const products = await prisma.product.findMany({
        where: { categoryId: category.id, status: "active" },
        include: {
          brand: true,
          category: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
        },
        orderBy: { priceCny: "desc" },
      });

      const serializedProducts: CategoryPageProduct[] = products.map((p) => ({
        ...p,
        condition: p.condition as Product["condition"],
        status: p.status as Product["status"],
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        images: (p.images || []).map((img) => ({ ...img, url: getImageUrl(img.url) })),
        internationalPrices: (p.internationalPrices || []).map((ip) => ({
          ...ip,
          createdAt: ip.createdAt.toISOString(),
          updatedAt: ip.updatedAt.toISOString(),
          lastVerified: ip.lastVerified ? ip.lastVerified.toISOString() : null,
        })),
      }));

      const children: CategoryWithSlug[] = allCategories
        .filter((c) => c.parentId === category.id)
        .map((c) => ({ ...c, slug: toSlug(c.nameEn), productCount: 0 }));

      return {
        category: {
          ...category,
          slug: toSlug(category.nameEn),
          productCount: products.length,
        },
        children,
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
  const data = await getCategoryData(slug);

  if (!data?.category) {
    return { title: "品类未找到" };
  }

  const categoryName =
    locale === "zh"
      ? data.category.nameZh
      : locale === "ru" && data.category.nameRu
        ? data.category.nameRu
        : data.category.nameEn;

  const titleMap: Record<string, string> = {
    zh: `二手${categoryName}_${categoryName}设备价格_品类专区_神雕农机`,
    en: `Used ${categoryName} Equipment | ${categoryName} Prices & Specs | AgriTrade`,
    ru: `Подержанные ${categoryName} | Цены и характеристики | AgriTrade`,
    es: `${categoryName} Usados | Precios y Especificaciones | AgriTrade`,
    pt: `${categoryName} Usados | Preços e Especificações | AgriTrade`,
    ar: `${categoryName} مستعملة | الأسعار والمواصفات | AgriTrade`,
    fr: `${categoryName} d'Occasion | Prix et Spécifications | AgriTrade`,
    hi: `प्रयुक्त ${categoryName} | मूल्य और विशिष्टताएं | AgriTrade`,
  };

  const descMap: Record<string, string> = {
    zh: `浏览二手${categoryName}设备：${data.category.productCount || ''}台在售。神雕农机全球平台，支持品牌/年份/价格筛选，每日更新跨境套利数据。`,
    en: `Browse used ${categoryName}: ${data.category.productCount || ''} units available. AgriTrade — filter by brand, year & price. Daily arbitrage data updates.`,
    ru: `Просмотр подержанных ${categoryName}: ${data.category.productCount || ''} ед. в наличии. AgriTrade — фильтр по бренду, году и цене. Ежедневные обновления.`,
    es: `Explore ${categoryName} usados: ${data.category.productCount || ''} unidades. AgriTrade — filtre por marca, año y precio. Datos de arbitraje actualizados a diario.`,
    pt: `Explore ${categoryName} usados: ${data.category.productCount || ''} unidades. AgriTrade — filtre por marca, ano e preço. Dados de arbitragem atualizados diariamente.`,
    ar: `تصفح ${categoryName} المستعملة: ${data.category.productCount || ''} وحدة متاحة. AgriTrade — تصفية حسب العلامة التجارية والسنة والسعر. تحديثات يومية.`,
    fr: `Parcourez les ${categoryName} d'occasion: ${data.category.productCount || ''} unités. AgriTrade — filtrez par marque, année et prix. Données d'arbitrage mises à jour quotidiennement.`,
    hi: `प्रयुक्त ${categoryName} ब्राउज़ करें: ${data.category.productCount || ''} उपलब्ध। AgriTrade — ब्रांड, वर्ष और कीमत के अनुसार फ़िल्टर करें। दैनिक आर्बिट्राज डेटा अपडेट।`,
  };

  return {
    title: titleMap[locale] || titleMap["en"],
    description: descMap[locale] || descMap["en"],
    alternates: {
      canonical: `${BASE_URL}/${locale}/category/${slug}`,
      languages: getHreflangLanguages(`/category/${slug}`),
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

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const data = await getCategoryData(slug);

  const categoryName = data?.category
    ? locale === "zh"
      ? data.category.nameZh
      : locale === "ru" && data.category.nameRu
        ? data.category.nameRu
        : data.category.nameEn
    : "";

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "设备市场" : "Products", url: `${BASE_URL}/${locale}/products` },
          { name: categoryName, url: `${BASE_URL}/${locale}/category/${slug}` },
        ]}
      />
      <CategoryClientPage
        initialLocale={locale}
        initialSlug={slug}
        initialData={data ?? undefined}
      />
    </>
  );
}
