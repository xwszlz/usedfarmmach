import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import PartDetailClient, { type PartDetailData } from "@/components/parts/PartDetailClient";
import type { PartCardData } from "@/components/parts/PartCard";
import { getPartById, getRelatedParts } from "@/lib/parts-catalog";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;

  try {
    const part = await getPartById(id);
    if (!part) return {};

    const name = locale === "zh" ? part.nameZh : (part.nameEn || part.nameZh);
    const desc =
      locale === "zh"
        ? part.descriptionZh || `${part.brand} ${name} - OEM: ${part.oemNumber || "N/A"}`
        : part.descriptionEn || `${part.brand} ${name} - OEM: ${part.oemNumber || "N/A"}`;

    return {
      title: `${name} | ${part.brand} | ${part.oemNumber || ""}`,
      description: desc,
      openGraph: {
        title: name,
        description: desc,
        images: part.images.length > 0 ? [{ url: part.images[0] }] : undefined,
      },
    };
  } catch {
    return {};
  }
}

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const part = await getPartById(id);

  if (!part) {
    notFound();
  }

  // Get related parts from the same component group
  let relatedParts: PartCardData[] = [];
  try {
    const related = await getRelatedParts(
      part.componentGroupId,
      part.id,
      4
    );
    relatedParts = related;
  } catch (e) {
    console.error("Failed to fetch related parts:", e);
  }

  const partData: PartDetailData = {
    ...part,
    specs: part.specs as Record<string, string> | null,
  };

  const name = locale === "zh" ? part.nameZh : (part.nameEn || part.nameZh);
  const mtName = locale === "zh" ? part.machineType.nameZh : part.machineType.nameEn;
  const ssName = locale === "zh" ? part.subSystem.nameZh : part.subSystem.nameEn;
  const cgName = locale === "zh" ? part.componentGroup.nameZh : part.componentGroup.nameEn;

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "配件专区" : "Parts", url: `${BASE_URL}/${locale}/parts` },
          { name: mtName, url: `${BASE_URL}/${locale}/parts` },
          { name: cgName, url: `${BASE_URL}/${locale}/parts` },
          { name, url: `${BASE_URL}/${locale}/parts/${id}` },
        ]}
      />
      <PartDetailClient part={partData} relatedParts={relatedParts} locale={locale} />
    </>
  );
}
