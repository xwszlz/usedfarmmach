import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { HeroSection } from "@/components/home/hero-section";
import { HotEquipment } from "@/components/home/hot-equipment";
import { ArbitrageShowcase } from "@/components/home/arbitrage-showcase";
import { Testimonials } from "@/components/home/testimonials";
import type { Product } from "@/types";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 首页只展示4个热门设备（有实拍图的核心产品）
  const priorityIds = [
    "cmpdknl8s00e511kwiy4tzjax", // 东洋 Beet Harvester (2018)
    "cmpdknk4s008111kw3zr8aimf", // 克拉斯 5300RC (2022)
    "cmpdknkb2009911kwv7u98vpe", // 克罗尼 1290XC (2014)
    "cmpdknkif009v11kw0dcmfq5q", // 克罗尼 CF155XC (有实拍图)
  ];

  const rawProducts = await prisma.product.findMany({
    where: { id: { in: priorityIds }, status: "active" },
    include: {
      brand: true,
      category: true,
      images: { where: { isPrimary: true }, take: 1 },
      seller: { select: { id: true, companyName: true, country: true } },
    },
  });

  const hotProducts = rawProducts.map((p) => ({
    ...p,
    condition: p.condition as Product["condition"],
    status: p.status as Product["status"],
  })) as Product[];

  return (
    <div>
      <HeroSection locale={locale} />
      <HotEquipment products={hotProducts} locale={locale} />
      <ArbitrageShowcase />
      <Testimonials locale={locale} />
    </div>
  );
}
