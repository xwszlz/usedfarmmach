import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { HeroSection } from "@/components/home/hero-section";
import { DailyReportSection } from "@/components/home/daily-report-section";
import { HotEquipment } from "@/components/home/hot-equipment";
import { ArbitrageShowcase } from "@/components/home/arbitrage-showcase";
import { Testimonials } from "@/components/home/testimonials";
import { DAILY_REPORT_RANKING } from "@/config/daily-report-ranking";
import type { Product } from "@/types";

export const dynamic = "force-dynamic";

const baseInclude = {
  brand: true,
  category: true,
  images: { orderBy: { sortOrder: "asc" as const } },
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
      <HeroSection locale={locale} topProduct={topProduct} topReportData={topReportData} />
      <DailyReportSection locale={locale} />
      <HotEquipment products={hotProducts} locale={locale} />
      <ArbitrageShowcase />
      <Testimonials locale={locale} />
    </div>
  );
}
