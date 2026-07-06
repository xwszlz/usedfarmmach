import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import CompareClient from "./CompareClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("expo", locale, "/expo/compare");
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Fetch all new-machine items with brand info
  const items = await prisma.showcaseItem.findMany({
    where: { status: "published", itemType: "new" },
    select: {
      id: true,
      model: true,
      deviceType: true,
      brand: true,
      brandId: true,
      msrpCny: true,
      msrpUsd: true,
      machineTier: true,
      launchYear: true,
      isChineseMade: true,
      isFeatured: true,
      isNewLaunch: true,
      hotScore: true,
      descriptionZh: true,
      brandRel: {
        select: {
          id: true,
          nameZh: true,
          nameEn: true,
          brandTier: true,
          isChineseBrand: true,
          establishedYear: true,
          originCountry: true,
        },
      },
    },
    orderBy: [{ hotScore: "desc" }],
  });

  // Group by deviceType
  const categories: { category: string; items: typeof items }[] = [];
  const categoryMap = new Map<string, typeof items>();

  items.forEach((item) => {
    const cat = item.deviceType || "其他";
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }
    categoryMap.get(cat)!.push(item);
  });

  categoryMap.forEach((catItems, cat) => {
    categories.push({ category: cat, items: catItems });
  });

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "农机博览会" : "EXPO", url: `${BASE_URL}/${locale}/expo` },
          {
            name: locale === "zh" ? "品类对比厅" : "Comparison Hall",
            url: `${BASE_URL}/${locale}/expo/compare`,
          },
        ]}
      />
      <CompareClient categories={JSON.parse(JSON.stringify(categories))} locale={locale} />
    </>
  );
}
