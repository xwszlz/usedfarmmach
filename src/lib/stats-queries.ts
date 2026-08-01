/**
 * 后台浏览量看板查询封装（product_view_stats）。
 * 提供：总览读取、栏目排行、视频合并排行。所有查询均为只读、O(1)/低开销。
 */

import { prisma } from "@/lib/db";
import type {
  CategoryRank,
  Overview,
  VideoRank,
  VideoRankingFilter,
} from "@/types/stats";

/** 多语言栏目名回退 */
function categoryNameOf(c: {
  nameZh: string;
  nameEn: string;
  nameRu?: string | null;
  nameEs?: string | null;
  namePt?: string | null;
  nameAr?: string | null;
  nameFr?: string | null;
  nameHi?: string | null;
}): string {
  return c.nameZh || c.nameEn || "";
}

/**
 * 网站总览：O(1) 读取 SiteStat 全局行（'global'）。
 * 若行尚未存在（迁移/埋点未触发），返回全 0。
 */
export async function getOverview(): Promise<Overview> {
  const stat = await prisma.siteStat.findUnique({ where: { id: "global" } });
  if (!stat) {
    return {
      totalPageViews: 0,
      totalProductViews: 0,
      totalCategoryViews: 0,
      totalVideoPlays: 0,
    };
  }
  return {
    totalPageViews: stat.totalPageViews,
    totalProductViews: stat.totalProductViews,
    totalCategoryViews: stat.totalCategoryViews,
    totalVideoPlays: stat.totalVideoPlays,
  };
}

/**
 * 栏目排行：按 viewCount 降序取 Top 10，并计算占栏目总浏览量的占比。
 * @param sellerId 传入时（卖家视角）按自有 product 的 category 聚合，仅含该卖家的栏目浏览贡献。
 */
export async function getCategoryRanking(sellerId?: string): Promise<CategoryRank[]> {
  // 卖家视角：按自有 product 的 category 聚合 viewCount
  if (sellerId) {
    const products = await prisma.product.findMany({
      where: { sellerId },
      select: {
        categoryId: true,
        viewCount: true,
        category: { select: { nameZh: true, nameEn: true } },
      },
    });
    const map = new Map<string, { name: string; viewCount: number }>();
    for (const p of products) {
      const cur =
        map.get(p.categoryId) ?? {
          name: categoryNameOf(p.category),
          viewCount: 0,
        };
      cur.viewCount += p.viewCount;
      map.set(p.categoryId, cur);
    }
    const arr: CategoryRank[] = [...map.entries()]
      .map(([id, v]) => ({ id, name: v.name, viewCount: v.viewCount, ratio: 0 }))
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10);
    const total = arr.reduce((s, c) => s + c.viewCount, 0) || 1;
    return arr.map((c) => ({
      ...c,
      ratio: Math.round((c.viewCount / total) * 1000) / 10,
    }));
  }

  // 全站视角：直接读 Category.viewCount
  const categories = await prisma.category.findMany({
    orderBy: { viewCount: "desc" },
    take: 10,
    select: {
      id: true,
      nameZh: true,
      nameEn: true,
      nameRu: true,
      nameEs: true,
      namePt: true,
      nameAr: true,
      nameFr: true,
      nameHi: true,
      viewCount: true,
    },
  });
  const total = categories.reduce((s, c) => s + c.viewCount, 0) || 1;
  return categories.map((c) => ({
    id: c.id,
    name: categoryNameOf(c),
    viewCount: c.viewCount,
    ratio: Math.round((c.viewCount / total) * 1000) / 10,
  }));
}

/**
 * 视频排行：ProductVideo 与 FieldVideo 合并，按 playCount 降序取 Top 20。
 * @param type   'all' 合并 / 'product' 仅产品视频 / 'field' 仅地头展视频
 * @param sellerId 传入时（卖家视角）过滤：productVideo 按 product.sellerId；fieldVideo 按 booth.merchantId
 */
export async function getVideoRanking(
  type: VideoRankingFilter,
  sellerId?: string
): Promise<VideoRank[]> {
  const productVideos: VideoRank[] = [];
  const fieldVideos: VideoRank[] = [];

  if (type !== "field") {
    const where = sellerId ? { product: { sellerId } } : {};
    const pvs = await prisma.productVideo.findMany({
      where,
      orderBy: { playCount: "desc" },
      select: { id: true, title: true, playCount: true },
      take: 50,
    });
    productVideos.push(
      ...pvs.map((v) => ({
        id: v.id,
        title: v.title || "产品视频",
        type: "product" as const,
        playCount: v.playCount,
      }))
    );
  }

  if (type !== "product") {
    const where = sellerId ? { booth: { merchantId: sellerId } } : {};
    const fvs = await prisma.fieldVideo.findMany({
      where,
      orderBy: { playCount: "desc" },
      select: { id: true, title: true, playCount: true },
      take: 50,
    });
    fieldVideos.push(
      ...fvs.map((v) => ({
        id: v.id,
        title: v.title || "地头展视频",
        type: "field" as const,
        playCount: v.playCount,
      }))
    );
  }

  return [...productVideos, ...fieldVideos]
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 20);
}
