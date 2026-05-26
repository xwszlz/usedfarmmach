import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { HeroSection } from "@/components/home/hero-section";
import { HotEquipment } from "@/components/home/hot-equipment";
import { ArbitrageShowcase } from "@/components/home/arbitrage-showcase";
import { Testimonials } from "@/components/home/testimonials";
import type { Product } from "@/types";

export const dynamic = "force-dynamic";

/**
 * 跨境套利日报 TOP10 产品排名（2026-05-26）
 * 数据来源：神雕日报/2026-05-26_跨境套利日报.md
 * #1 = 日报TOP1 展示在Hero区，#2~#10 = 热门设备栏目
 */
const DAILY_REPORT_RANKING = [
  // 第一梯队：超高套利（毛利 >100万）
  { id: "cmpfohy08000tkrh5vaaw12nd", rank: 1, model: "克拉斯 Jaguar 970（欧版/有户口）", price: 1630000, foreignPriceDesc: "EUR320K~391K", profit: "120万+", margin: "73.6%" },
  { id: "cmpdknitp001v11kwskpdqx6s", rank: 2, model: "克拉斯 Jaguar 980（美版/有户口）", price: 1430000, foreignPriceDesc: "EUR190K~461K", profit: "105万+", margin: "73.5%" },
  { id: "cmpdknix7002h11kwupfm486g", rank: 3, model: "克拉斯 Jaguar 980（2015款）", price: 1300000, foreignPriceDesc: "EUR190K~220K", profit: "95万+", margin: "73.1%" },
  // 第二梯队：高套利（毛利 50~100万）
  { id: "cmpdknk4s008111kw3zr8aimf", rank: 4, model: "克拉斯 5300RC（2022款/全新）", price: 950000, foreignPriceDesc: "EUR25万+", profit: "85万+", margin: "89.5%" },
  { id: "cmpfohxzt000pkrh533z2mf2z", rank: 5, model: "克拉斯 Jaguar 850（2020款/准新机）", price: 1190000, foreignPriceDesc: "EUR25万+", profit: "82万+", margin: "68.9%" },
  { id: "cmpfohy1v0017krh50mw2yvr6", rank: 6, model: "麦赛弗格森 MF 3404（2022款）", price: 1050000, foreignPriceDesc: "EUR13万+", profit: "50万+", margin: "47.6%" },
  // 第三梯队：稳健套利（毛利 20~50万）
  { id: "cmpfohy0n000xkrh5d14tvnqy", rank: 7, model: "纽荷兰 FR450（一口价爆款）", price: 215000, foreignPriceDesc: "EUR4万+", profit: "10万+", margin: "45%+" },
  { id: "cmpfohxzd000lkrh5fiowud3v", rank: 8, model: "约翰迪尔 JD 8400", price: 680000, foreignPriceDesc: "EUR11万+", profit: "28万+", margin: "41.4%" },
  { id: "cmpdknjh6004x11kwkz5gvrbo", rank: 9, model: "纽荷兰 9080", price: 690000, foreignPriceDesc: "EUR11万+", profit: "29万+", margin: "42.3%" },
  { id: "cmpfohxxe0003krh59h6galr2", rank: 10, model: "克罗尼 BigM 420", price: 490000, foreignPriceDesc: "EUR8万+", profit: "31万+", margin: "64.2%" },
];

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

  // #2~#10: 热门设备
  const hotProducts = rankedProducts.slice(1).map(toProduct);

  return (
    <div>
      <HeroSection locale={locale} topProduct={topProduct} topReportData={topReportData} />
      <HotEquipment products={hotProducts} locale={locale} />
      <ArbitrageShowcase />
      <Testimonials locale={locale} />
    </div>
  );
}
