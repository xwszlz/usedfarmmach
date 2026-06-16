import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { HeroSection } from "@/components/home/hero-section";
import { DailyReportSection } from "@/components/home/daily-report-section";
import { HotEquipment } from "@/components/home/hot-equipment";
import { ArbitrageShowcase } from "@/components/home/arbitrage-showcase";
import { Testimonials } from "@/components/home/testimonials";
import { DAILY_REPORT_RANKING } from "@/config/daily-report-ranking";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, ItemListStructuredData } from "@/components/seo/structured-data";
import { getImageUrl } from "@/lib/image-url";
import type { Product } from "@/types";

export const revalidate = 300;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("home", locale, "", {
    openGraph: {
      images: [{ url: `${BASE_URL}/images/og.png`, width: 1200, height: 630 }],
    },
  });
}

const baseInclude = {
  brand: true,
  category: true,
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  internationalPrices: { orderBy: { sourceDate: "desc" as const }, take: 1 },
  seller: { select: { id: true, companyName: true, country: true } },
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 按日报排名顺序查询产品
  const allIds = DAILY_REPORT_RANKING.map((p) => p.id);
  const rawProducts = await prisma.product.findMany({
    where: { id: { in: allIds }, status: "active" },
    include: baseInclude,
  });

  // 按日报排名顺序重组
  const rankedProducts = allIds
    .map((id) => rawProducts.find((p) => p.id === id))
    .filter(Boolean);

  const toProduct = (p: any) => ({
    ...p,
    condition: p.condition as Product["condition"],
    status: p.status as Product["status"],
  }) as Product;

  // TOP1: 日报头条
  const topProduct = rankedProducts[0] ? toProduct(rankedProducts[0]) : null;
  const topReportData = DAILY_REPORT_RANKING[0];

  // #2~#5: 热门设备（首页展示4台）
  const hotProducts = rankedProducts.slice(1, 5).map(toProduct);

  return (
    <div>
      <BreadcrumbStructuredData
        locale={locale}
        items={[{ name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` }]}
      />
      <ItemListStructuredData
        locale={locale}
        listName={locale === "zh" ? "热门设备" : "Hot Equipment"}
        items={[...rankedProducts.slice(0, 5)].filter(Boolean).map((p: any) => ({
          id: p.id,
          name: (locale === "zh" ? p.brand?.nameZh : p.brand?.nameEn) + " " + p.modelName,
          url: `${BASE_URL}/${locale}/products/${p.id}`,
          imageUrl: p.images?.[0] ? getImageUrl(p.images[0].url) : undefined,
          priceCny: p.priceCny,
          brand: locale === "zh" ? p.brand?.nameZh : p.brand?.nameEn,
        }))}
      />
      <HeroSection locale={locale} topProduct={topProduct} topReportData={topReportData} heroCoverImage="/images/hero-claas-970-2017.jpg" />
      <DailyReportSection locale={locale} />
      <HotEquipment products={hotProducts} locale={locale} />
      <ArbitrageShowcase />
      <Testimonials locale={locale} />
    </div>
  );
}
