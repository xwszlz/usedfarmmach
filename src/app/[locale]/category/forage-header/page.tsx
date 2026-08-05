import type { Metadata } from "next";
import CategoryClientPage from "../[slug]/CategoryClient";
import { getHreflangLanguages } from "@/components/seo/hreflang-head";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
const SLUG = "forage-header";

export const revalidate = 600;

async function getCategoryData() {
  try {
    const apiUrl = `${BASE_URL}/api/categories?slug=${encodeURIComponent(SLUG)}`;
    const res = await fetch(apiUrl, { next: { revalidate: 300 } });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const data = await getCategoryData();
  const categoryName =
    locale === "zh"
      ? data?.category?.nameZh || "饲料割台"
      : locale === "ru" && data?.category?.nameRu
        ? data.category.nameRu
        : data?.category?.nameEn || "Forage Header";

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
    zh: `浏览二手${categoryName}设备：${data?.category?.productCount || ""}台在售。神雕农机全球平台，支持品牌/年份/价格筛选，每日更新跨境套利数据。`,
    en: `Browse used ${categoryName}: ${data?.category?.productCount || ""} units available. AgriTrade — filter by brand, year & price. Daily arbitrage data updates.`,
    ru: `Просмотр подержанных ${categoryName}: ${data?.category?.productCount || ""} ед. в наличии. AgriTrade — фильтр по бренду, году и цене. Ежедневные обновления.`,
    es: `Explore ${categoryName} usados: ${data?.category?.productCount || ""} unidades. AgriTrade — filtre por marca, año y precio. Datos de arbitraje actualizados a diario.`,
    pt: `Explore ${categoryName} usados: ${data?.category?.productCount || ""} unidades. AgriTrade — filtre por marca, ano e preço. Dados de arbitragem atualizados diariamente.`,
    ar: `تصفح ${categoryName} المستعملة: ${data?.category?.productCount || ""} وحدة متاحة. AgriTrade — تصفية حسب العلامة التجارية والسنة والسعر. تحديثات يومية.`,
    fr: `Parcourez les ${categoryName} d'occasion: ${data?.category?.productCount || ""} unités. AgriTrade — filtrez par marque, année et prix. Données d'arbitrage mises à jour quotidiennement.`,
    hi: `प्रयुक्त ${categoryName} ब्राउज़ करें: ${data?.category?.productCount || ""} उपलब्ध। AgriTrade — ब्रांड, वर्ष और कीमत के अनुसार फ़िल्टर करें। दैनिक आर्बिट्राज डेटा अपडेट।`,
  };

  return {
    title: titleMap[locale] || titleMap["en"],
    description: descMap[locale] || descMap["en"],
    alternates: {
      canonical: `${BASE_URL}/${locale}/category/${SLUG}`,
      languages: getHreflangLanguages(`/category/${SLUG}`),
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

export default async function ForageHeaderCategoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const data = await getCategoryData();

  const categoryName = data?.category
    ? locale === "zh"
      ? data.category.nameZh
      : locale === "ru" && (data.category as any).nameRu
        ? (data.category as any).nameRu
        : data.category.nameEn
    : "";

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "设备市场" : "Products", url: `${BASE_URL}/${locale}/products` },
          { name: categoryName, url: `${BASE_URL}/${locale}/category/${SLUG}` },
        ]}
      />
      <CategoryClientPage initialLocale={locale} initialSlug={SLUG} />
    </>
  );
}
