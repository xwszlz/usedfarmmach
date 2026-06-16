import type { Metadata } from "next";
import BrandClientPage from "./BrandClient";
import { getHreflangLanguages } from "@/components/seo/hreflang-head";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const revalidate = 600;

async function getBrandData(slug: string) {
  try {
    const apiUrl = `${BASE_URL}/api/brands?slug=${encodeURIComponent(slug)}`;
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
      <BrandClientPage initialLocale={locale} initialSlug={slug} />
    </>
  );
}
