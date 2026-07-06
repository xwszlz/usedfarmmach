import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, ItemListStructuredData } from "@/components/seo/structured-data";
import { getImageUrl } from "@/lib/image-url";
import ShowroomClient from "./ShowroomClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("expo", locale, "/expo/showroom");
}

export default async function ShowroomPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Fetch all published new-machine showcase items with booth + brand info
  const [rawItems, total] = await Promise.all([
    prisma.showcaseItem.findMany({
      where: { status: "published", itemType: "new" },
      orderBy: [{ hotScore: "desc" }, { sortIndex: "asc" }, { createdAt: "desc" }],
      take: 24,
      include: {
        booth: {
          select: { id: true, name: true, hall: true, pavilion: true, tier: true },
        },
        brandRel: {
          select: {
            id: true,
            nameZh: true,
            nameEn: true,
            isChineseBrand: true,
            brandTier: true,
            expoLogoUrl: true,
            expoStory: true,
            establishedYear: true,
            exportVolume: true,
          },
        },
      },
    }),
    prisma.showcaseItem.count({ where: { status: "published", itemType: "new" } }),
  ]);

  // Fetch halls for filter (from published booths)
  const booths = await prisma.booth.findMany({
    where: { status: "published" },
    select: { id: true, name: true, hall: true, pavilion: true, tier: true },
    orderBy: { sortIndex: "asc" },
  });

  // Fetch booths with counts for map view
  const mapBooths = await prisma.booth.findMany({
    where: { status: { in: ["published", "configured"] } },
    select: {
      id: true,
      name: true,
      hall: true,
      pavilion: true,
      tier: true,
      template: true,
      status: true,
      merchant: { select: { username: true, companyName: true } },
      _count: { select: { showcaseItems: true } },
    },
    orderBy: { sortIndex: "asc" },
  });

  // Fetch brands from showcase items
  const brandSet = new Set<string>();
  rawItems.forEach((item) => {
    if (item.brand) brandSet.add(item.brand);
  });
  // Also get all brands from all published new items
  const allBrands = await prisma.showcaseItem.findMany({
    where: { status: "published", itemType: "new", brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
  });

  // Pavilion counts for tab badges
  const [chinaCount, globalCount] = await Promise.all([
    prisma.showcaseItem.count({
      where: { status: "published", itemType: "new", booth: { pavilion: "china" } },
    }),
    prisma.showcaseItem.count({
      where: { status: "published", itemType: "new", booth: { pavilion: "global" } },
    }),
  ]);

  // Serialize for client
  const items = rawItems.map((item: any) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    coverImage: item.images?.[0] ? getImageUrl(item.images[0]) : null,
  }));

  // Build ItemList structured data
  const listItems = items.map((item: any) => ({
    id: item.id,
    name: `${item.brand || ""} ${item.model || ""}`.trim() || item.deviceType,
    url: `${BASE_URL}/${locale}/expo/showroom/${item.id}`,
    imageUrl: item.coverImage || undefined,
    priceCny: item.msrpCny || item.price || 0,
    brand: item.brand || "",
  }));

  const hallLabels: Record<string, { zh: string; en: string; ru: string }> = {
    tractor: { zh: "拖拉机馆", en: "Tractor Hall", ru: "Тракторный зал" },
    harvester: { zh: "收获机械馆", en: "Harvester Hall", ru: "Зал комбайнов" },
    planter: { zh: "播种种植馆", en: "Planter Hall", ru: "Посевной зал" },
    sprayer: { zh: "植保机械馆", en: "Sprayer Hall", ru: "Опрыскиватель зал" },
    forage: { zh: "牧草机械馆", en: "Forage Hall", ru: "Кормовой зал" },
    material: { zh: "物料搬运馆", en: "Material Hall", ru: "Материал зал" },
    comprehensive: { zh: "综合机械馆", en: "Comprehensive Hall", ru: "Комплексный зал" },
  };

  const halls = booths.map((b) => ({
    value: b.hall,
    label:
      locale === "zh"
        ? hallLabels[b.hall]?.zh || b.hall
        : locale === "ru"
          ? hallLabels[b.hall]?.ru || b.hall
          : hallLabels[b.hall]?.en || b.hall,
  }));

  const brands = allBrands
    .filter((b: any) => b.brand)
    .map((b: any) => ({ value: b.brand, label: b.brand }))
    .sort((a: any, b: any) => a.label.localeCompare(b.label));

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "农机博览会" : "EXPO", url: `${BASE_URL}/${locale}/expo` },
          {
            name: locale === "zh" ? "线上展厅" : "Showroom",
            url: `${BASE_URL}/${locale}/expo/showroom`,
          },
        ]}
      />
      <ItemListStructuredData
        locale={locale}
        items={listItems}
        listName={
          locale === "zh"
            ? "中国农机·走向世界 · 线上展厅"
            : "Chinese Farm Machinery Goes Global · Online Showroom"
        }
      />
      <ShowroomClient
        initialItems={items}
        initialTotal={total}
        initialHalls={halls}
        initialBrands={brands}
        mapBooths={JSON.parse(JSON.stringify(mapBooths))}
        locale={locale}
        chinaCount={chinaCount}
        globalCount={globalCount}
      />
    </>
  );
}
