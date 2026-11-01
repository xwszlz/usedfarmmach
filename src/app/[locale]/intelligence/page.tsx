import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { prisma } from "@/lib/db";
import {
  DAILY_REPORT_RANKING,
  type DailyReportRankItem,
} from "@/config/daily-report-ranking";
import IntelligencePageClient from "./page-client";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

/**
 * 「套利榜单速览」存活条目过滤。
 *
 * 背景：DAILY_REPORT_RANKING 是写死的日报快照，部分产品 ID 已从产品表删除，
 * 客户端直接用 item.id 拼 `/{locale}/products/{id}` 会产出死链
 * （实测 12 条里 2 条点进去 404）。
 *
 * 做法：服务端先按 id + status="active" 查一次，只把存活条目按**原顺序**下传。
 * 查库异常时返回空数组，由客户端回退到静态榜单（与首页 revalidate 的降级策略一致，
 * 避免 DB 抖动导致整个区块消失）。
 */
async function getAliveRankingItems(): Promise<DailyReportRankItem[]> {
  try {
    const ids = DAILY_REPORT_RANKING.map((item) => item.id);
    if (ids.length === 0) return [];

    const alive = await prisma.product.findMany({
      where: { id: { in: ids }, status: "active" },
      select: { id: true },
    });
    const aliveIds = new Set(alive.map((p) => p.id));

    return DAILY_REPORT_RANKING.filter((item) => aliveIds.has(item.id));
  } catch (error) {
    console.error("Intelligence ranking alive-filter error:", error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("intelligence", locale, "/intelligence");
}

export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // 服务端滤掉已下架/已删除产品的榜单条目，避免「套利榜单速览」出现 404 死链
  const rankingItems = await getAliveRankingItems();

  return (
    <>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          { name: locale === "zh" ? "市场情报" : "Intelligence", url: `${BASE_URL}/${locale}/intelligence` },
        ]}
      />
      <IntelligencePageClient locale={locale} rankingItems={rankingItems} />
    </>
  );
}
