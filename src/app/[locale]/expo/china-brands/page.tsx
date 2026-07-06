import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { getImageUrl } from "@/lib/image-url";
import ChinaBrandsClient from "./ChinaBrandsClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("expo", locale, "/expo/china-brands");
}

export default async function ChinaBrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Fetch all Chinese brands with tier info
  const brands = await prisma.brand.findMany({
    where: { isChineseBrand: true, brandTier: { not: null } },
    select: {
      id: true,
      nameZh: true,
      nameEn: true,
      brandTier: true,
      expoSlug: true,
      expoLogoUrl: true,
      coreCategory: true,
      establishedYear: true,
      exportVolume: true,
      expoStory: true,
      officialWebsite: true,
      originCountry: true,
    },
    orderBy: [{ brandTier: "asc" }, { nameZh: "asc" }],
  });

  // Fetch Chinese showcase items (new machines)
  const items = await prisma.showcaseItem.findMany({
    where: {
      status: "published",
      itemType: "new",
      isChineseMade: true,
    },
    orderBy: [{ hotScore: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: {
      booth: {
        select: { id: true, name: true, hall: true, pavilion: true, tier: true },
      },
      brandRel: {
        select: {
          id: true,
          nameZh: true,
          nameEn: true,
          brandTier: true,
          expoLogoUrl: true,
          establishedYear: true,
          exportVolume: true,
        },
      },
    },
  });

  // Category counts
  const categoryCounts = await prisma.showcaseItem.groupBy({
    by: ["deviceType"],
    where: {
      status: "published",
      itemType: "new",
      isChineseMade: true,
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  // Serialize
  const serializedBrands = brands.map((b: any) => ({
    ...b,
    expoLogoUrl: b.expoLogoUrl ? getImageUrl(b.expoLogoUrl) : null,
  }));

  const serializedItems = items.map((item: any) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    coverImage: item.images?.[0] ? getImageUrl(item.images[0]) : null,
  }));

  const tierCounts = {
    flagship: brands.filter((b: any) => b.brandTier === "flagship").length,
    premium: brands.filter((b: any) => b.brandTier === "premium").length,
    standard: brands.filter((b: any) => b.brandTier === "standard").length,
  };

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "农机博览会" : "EXPO", url: `${BASE_URL}/${locale}/expo` },
          {
            name: locale === "zh" ? "中国品牌馆" : "China Pavilion",
            url: `${BASE_URL}/${locale}/expo/china-brands`,
          },
        ]}
      />
      <ChinaBrandsClient
        brands={serializedBrands}
        items={serializedItems}
        categoryCounts={categoryCounts.map((c: any) => ({
          category: c.deviceType,
          count: c._count.id,
        }))}
        tierCounts={tierCounts}
        locale={locale}
      />
    </>
  );
}
