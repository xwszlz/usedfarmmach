import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { RecruitmentBanner } from "@/components/home/recruitment-banner";
import { PartsEntrance } from "@/components/home/parts-entrance";
import { ServicesEntrance } from "@/components/home/services-entrance";
import { EngineerCertSection } from "@/components/home/engineer-cert-section";
import { ExpoEntrance } from "@/components/home/expo-entrance";
import { HotEquipment } from "@/components/home/hot-equipment";
import { ResearchHubEntry } from "@/components/home/research-hub-entry";
import { DailyReportSection } from "@/components/home/daily-report-section";
import { TrustBadges } from "@/components/home/trust-badges";
import { CTASection } from "@/components/home/cta-section";
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
  // 关联活跃议价
  auctions: {
    where: { status: "active" },
    select: { id: true, totalBids: true },
    take: 1,
  },
};

/**
 * 安全查询首页产品数据，带容错降级。
 * Vercel Serverless 环境下可能出现冷启动超时或瞬时连接失败，
 * 此函数确保即使 DB 查询失败也不会导致整页 500（避免 ISR 缓存中毒）。
 */
async function fetchHomeProducts() {
  try {
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

    const topProduct = rankedProducts[0] ? toProduct(rankedProducts[0]) : null;
    const hotProducts = rankedProducts.slice(1, 5).map(toProduct);

    return { topProduct, hotProducts, rankedProducts, error: null };
  } catch (err) {
    console.error("[HomePage] 产品数据查询失败（返回空数据以避免 500）:", err);
    // 返回空数据而不是抛出异常，防止 ISR 缓存错误响应
    return { topProduct: null, hotProducts: [], rankedProducts: [], error: String(err) };
  }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 安全获取产品数据（带容错）
  const { topProduct, hotProducts, rankedProducts } = await fetchHomeProducts();
  const topReportData = DAILY_REPORT_RANKING[0];

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

      {/* 10 屏组装 */}
      <RecruitmentBanner locale={locale} />
      <HotEquipment products={hotProducts} locale={locale} />
      <DailyReportSection locale={locale} />
      <ExpoEntrance locale={locale} />
      <PartsEntrance locale={locale} />
      <ServicesEntrance locale={locale} />
      <CTASection locale={locale} />
      <EngineerCertSection locale={locale} />
      <ResearchHubEntry locale={locale} />
      <TrustBadges locale={locale} />
    </div>
  );
}
