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
import { ExpoBanner } from "@/components/home/expo-banner";
import { ArbitrageShowcase } from "@/components/home/arbitrage-showcase";
import { DAILY_REPORT_RANKING } from "@/config/daily-report-ranking";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, ItemListStructuredData } from "@/components/seo/structured-data";
import { getImageUrl } from "@/lib/image-url";
import type { Product } from "@/types";

export const revalidate = 300;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

/**
 * 首页 H1 文案。
 * 背景：首页此前**没有任何 H1**（实测 .com/.cn 各语种 h1=0、h2=11），属于结构性 SEO 缺失。
 * 文案对齐首页 <title> 的核心词（"used farm machinery trading platform" / "二手农机交易平台"），
 * 而不是展会口号 —— 因为 .com 上 expo-banner 的主标题位渲染的是口号
 * （GLOBAL_NARRATIVE: "One global stage — CIAME 2026"），无品牌无关键词，
 * 不适合作为站点首页的 H1。
 * 其余 6 语（es/pt/ar/fr/hi）沿用英文，与站内既有回落策略一致（见 expo-banner.tsx 注释）。
 */
const HOME_H1: Record<string, string> = {
  zh: "二手农机交易平台",
  en: "Global Used Farm Machinery Trading Platform",
  ru: "Глобальная платформа торговли подержанной сельхозтехникой",
};
const HOME_H1_SUB: Record<string, string> = {
  zh: "跨境农机出口 · AI 智能估价 · 一站式物流",
  en: "Cross-border export · AI valuation · One-stop logistics",
  ru: "Трансграничный экспорт · AI-оценка · Логистика под ключ",
};

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

interface LatestArticle {
  slug: string;
  titleZh: string;
  titleEn: string | null;
  titleRu: string | null;
  category: string | null;
  publishedAt: Date | null;
}

async function fetchLatestArticles(limit: number = 3): Promise<LatestArticle[]> {
  try {
    const articles = await prisma.article.findMany({
      where: { status: "published", isPinned: false },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        slug: true,
        titleZh: true,
        titleEn: true,
        titleRu: true,
        category: true,
        publishedAt: true,
      },
    });
    return articles;
  } catch (err) {
    console.error("[HomePage] 文章查询失败:", err);
    return [];
  }
}

const baseInclude = {
  brand: true,
  category: true,
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  internationalPrices: { orderBy: { sourceDate: "desc" as const }, take: 1 },
  seller: { select: { id: true, companyName: true, country: true } },
  // 关联活跃询价
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

/**
 * 安全查询首页展会三馆展品数（与 Showroom 页口径一致，避免首页/展厅数字矛盾）。
 * 复用 Showroom 的 showcaseItem.count 逻辑；DB 失败时返回 null，由展示组件降级。
 */
async function fetchExpoPavilionCounts() {
  try {
    const [globalLeader, industryPillar, risingSpecialty] = await Promise.all([
      prisma.showcaseItem.count({
        where: { status: "published", itemType: "new", booth: { pavilion: "global_leader" } },
      }),
      prisma.showcaseItem.count({
        where: { status: "published", itemType: "new", booth: { pavilion: "industry_pillar" } },
      }),
      prisma.showcaseItem.count({
        where: { status: "published", itemType: "new", booth: { pavilion: "rising_specialty" } },
      }),
    ]);
    return { globalLeader, industryPillar, risingSpecialty };
  } catch (err) {
    console.error("[HomePage] 展会馆展品数查询失败（返回空以避免 500）:", err);
    return null;
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
  const initialArticles = await fetchLatestArticles(3);
  const expoCounts = await fetchExpoPavilionCounts();


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
      <ExpoBanner locale={locale} />

      {/* 首页 H1（此前缺失）：可见、服务端渲染，文案对齐 <title> 关键词 */}
      <section className="bg-white pt-8 pb-2">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {HOME_H1[locale] || HOME_H1.en}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {HOME_H1_SUB[locale] || HOME_H1_SUB.en}
          </p>
        </div>
      </section>

      <RecruitmentBanner locale={locale} />
      <HotEquipment products={hotProducts} locale={locale} />
      <DailyReportSection locale={locale} initialArticles={initialArticles} />
      <ExpoEntrance locale={locale} counts={expoCounts} />
      <PartsEntrance locale={locale} />
      <ServicesEntrance locale={locale} />
      <CTASection locale={locale} />
      <EngineerCertSection locale={locale} />
      <ResearchHubEntry locale={locale} />
      <TrustBadges locale={locale} />
    </div>
  );
}
