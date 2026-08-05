import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { getImageUrl } from "@/lib/image-url";
import ShowcaseDetail from "./ShowcaseDetail";
import { notFound } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const item = await prisma.showcaseItem.findUnique({
    where: { id },
    include: { booth: { select: { name: true, hall: true } }, brandRel: { select: { nameZh: true, nameEn: true, brandTier: true } } },
  });
  if (!item) return generatePageMetadata("expo", locale, "/expo/showroom");

  const title = `${item.brand || ""} ${item.model || ""}`.trim() || item.deviceType;
  const isNew = item.itemType === "new";
  const priceText = isNew
    ? (item.msrpCny ? `¥${item.msrpCny.toLocaleString()}` : item.msrpUsd ? `$${item.msrpUsd.toLocaleString()}` : "询价")
    : (item.price ? `¥${item.price.toLocaleString()}` : "询价");

  const description =
    locale === "zh"
      ? `${title} - ${item.launchYear || item.year || ""} | ${item.machineTier || ""} | 厂商指导价 ${priceText} | 永不落幕的农机世界展会线上展厅`
      : `${title} - ${item.launchYear || item.year || ""} | ${item.machineTier || ""} | MSRP ${priceText} | Always-On Global Farm Machinery Expo`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: item.images?.[0] ? [{ url: getImageUrl(item.images[0]) }] : undefined,
    },
  };
}

export default async function ShowcaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const item = await prisma.showcaseItem.findUnique({
    where: { id },
    include: {
      booth: { select: { id: true, name: true, hall: true, pavilion: true, tier: true } },
      brandRel: {
        select: {
          id: true,
          nameZh: true,
          nameEn: true,
          isChineseBrand: true,
          brandTier: true,
          expoLogoUrl: true,
          expoStory: true,
          officialWebsite: true,
          establishedYear: true,
          exportVolume: true,
        },
      },
    },
  });

  if (!item || item.status !== "published") {
    notFound();
  }

  // Increment view count (fire and forget)
  prisma.showcaseItem
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  // Parse specs
  let specs: Record<string, any> = {};
  try {
    if (item.specs) specs = JSON.parse(item.specs);
  } catch {}

  const serialized = {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    images: item.images.map((url) => getImageUrl(url)),
    videos: item.videos.map((url) => getImageUrl(url)),
    specs,
  };

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "农机博览会" : "EXPO", url: `${BASE_URL}/${locale}/expo` },
          { name: locale === "zh" ? "线上展厅" : "Showroom", url: `${BASE_URL}/${locale}/expo/showroom` },
          {
            name: `${item.brand || ""} ${item.model || ""}`.trim() || item.deviceType,
            url: `${BASE_URL}/${locale}/expo/showroom/${item.id}`,
          },
        ]}
      />
      <ShowcaseDetail item={serialized} locale={locale} />
    </>
  );
}
