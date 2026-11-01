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
import { ArbitrageShowcase } from "@/components/home/arbitrage-showcase";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, ItemListStructuredData } from "@/components/seo/structured-data";
import { getImageUrl } from "@/lib/image-url";
import {
  HOME_CARD_COUNT,
  HOME_PRODUCT_ORDER_BY,
  HOME_PRODUCT_TAKE,
  pickHomeCards,
} from "@/lib/home/hot-products";
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
  // 给前端的首图 404 降级留候选：取 5 张（去重后仍能剩 3 张，部分产品 sortOrder 1/2、
  // 2/3 是同一 URL），product-card 会依次降级。
  // 二级键 id 必填：全库有 116 组 (productId, sortOrder) 并列，
  // 缺二级键时 ISR 每次重生成可能换到另一批候选，表现为「刷新一次图就变」。
  images: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }], take: 5 },
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
 *
 * 排序完全动态（老板 2026-11-01 拍板）：viewCount DESC → createdAt DESC → id DESC，
 * 不接时间衰减、不随机轮换、不接 promotedUntil。详见 src/lib/home/hot-products.ts。
 *
 * 首页没有头条位（HeroSection 在 aadeb32 已从首页移除），四卡片就是浏览量前 4 台，
 * take 与卡片数相等，不跳过头名。
 */
async function fetchHomeProducts() {
  try {
    const rows = await prisma.product.findMany({
      where: {
        status: "active",
        images: { some: {} }, // 硬门槛：至少 1 张图，杜绝空图卡
      },
      include: baseInclude,
      orderBy: [...HOME_PRODUCT_ORDER_BY],
      take: HOME_PRODUCT_TAKE,
    });

    const toProduct = (p: any) => ({
      ...p,
      condition: p.condition as Product["condition"],
      status: p.status as Product["status"],
    }) as Product;

    const rankedProducts = rows.map(toProduct);
    const hotProducts = pickHomeCards(rankedProducts);

    return { hotProducts, rankedProducts, error: null };
  } catch (err) {
    console.error("[HomePage] 产品数据查询失败（返回空数据以避免 500）:", err);
    // 返回空数据而不是抛出异常，防止 ISR 缓存错误响应
    return { hotProducts: [], rankedProducts: [], error: String(err) };
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
  const { hotProducts, rankedProducts } = await fetchHomeProducts();
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
        items={[...rankedProducts.slice(0, HOME_CARD_COUNT)].filter(Boolean).map((p: any) => ({
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
