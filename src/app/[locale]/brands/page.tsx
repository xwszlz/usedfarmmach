import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";
import { toSlug } from "@/lib/slug";
import { getHreflangLanguages } from "@/components/seo/hreflang-head";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import BrandsClient from "./BrandsClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const titleMap: Record<string, string> = {
    zh: "二手农机品牌大全_全球与中国主流品牌馆_神雕农机",
    en: "Used Farm Machinery Brands | Global & Chinese Brand Hall | AgriTrade",
    ru: "Бренды подержанной сельхозтехники | AgriTrade",
    es: "Marcas de maquinaria agrícola usada | AgriTrade",
    pt: "Marcas de máquinas agrícolas usadas | AgriTrade",
    ar: "علامات الآلات الزراعية المستعملة | AgriTrade",
    fr: "Marques de machines agricoles d'occasion | AgriTrade",
    hi: "प्रयुक्त कृषि मशीनरी ब्रांड | AgriTrade",
  };

  const descMap: Record<string, string> = {
    zh: "汇集约翰迪尔、克拉斯、凯斯、纽荷兰、久保田、中国一拖等全球与中国主流二手农机品牌，按品牌浏览在售设备、价格与 AI 智能估价。",
    en: "Browse John Deere, CLAAS, Case IH, New Holland, Kubota, YTO and more — global & Chinese used farm machinery brands, their listings, prices and AI valuations.",
    ru: "John Deere, CLAAS, Case IH, New Holland, Kubota, YTO и другие — бренды подержанной техники, их объявления и цены.",
    es: "John Deere, CLAAS, Case IH, New Holland, Kubota, YTO y más — marcas de maquinaria usada y sus listados.",
    pt: "John Deere, CLAAS, Case IH, New Holland, Kubota, YTO e mais — marcas de máquinas usadas e seus anúncios.",
    ar: "John Deere وCLAAS وCase IH وNew Holland وKubota وYTO وغيرها — علامات الآلات المستعملة وقوائمها.",
    fr: "John Deere, CLAAS, Case IH, New Holland, Kubota, YTO et plus — marques de machines d'occasion et leurs annonces.",
    hi: "John Deere, CLAAS, Case IH, New Holland, Kubota, YTO और अधिक — ब्रांड, उनकी सूचियाँ और मूल्य।",
  };

  return {
    title: titleMap[locale] || titleMap["en"],
    description: descMap[locale] || descMap["en"],
    alternates: {
      canonical: `${BASE_URL}/${locale}/brands`,
      languages: getHreflangLanguages(`/brands`),
    },
    robots: { index: true, follow: true },
  };
}

export default async function BrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 列出全部品牌（含暂无在售的），与老板决策一致：覆盖平台品牌阵容。
  // productCount 用 status='active' 口径，与 brand/[slug] 详情页一致。
  const raw = await prisma.brand.findMany({
    orderBy: { nameEn: "asc" },
    select: {
      id: true,
      nameZh: true,
      nameEn: true,
      code: true,
      originCountry: true,
      isChineseBrand: true,
      expoLogoUrl: true,
      brandTier: true,
      officialWebsite: true,
      establishedYear: true,
      _count: { select: { products: { where: { status: "active" } } } },
    },
  });

  const brands = raw.map((b) => ({
    id: b.id,
    nameZh: b.nameZh,
    nameEn: b.nameEn,
    code: b.code,
    slug: toSlug(b.nameEn),
    originCountry: b.originCountry,
    isChineseBrand: b.isChineseBrand,
    logoUrl: b.expoLogoUrl ? getImageUrl(b.expoLogoUrl) : null,
    brandTier: b.brandTier,
    officialWebsite: b.officialWebsite,
    establishedYear: b.establishedYear,
    productCount: b._count.products,
  }));

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          {
            name: locale === "zh" ? "品牌馆" : "Brands",
            url: `${BASE_URL}/${locale}/brands`,
          },
        ]}
      />
      <BrandsClient initialBrands={brands} locale={locale} />
    </>
  );
}
