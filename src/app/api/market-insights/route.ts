/**
 * 市场洞察中心 API
 *
 * GET /api/market-insights
 * 聚合平台数据返回可视化看板数据
 *
 * 查询参数：
 * - period: time range (7d, 30d, 90d, 1y) default 30d
 * - category: filter by category ID (optional)
 * - brand: filter by brand ID (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1小时缓存

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";
    const categoryFilter = searchParams.get("category") || undefined;
    const brandFilter = searchParams.get("brand") || undefined;

    // 计算时间范围
    const now = new Date();
    const periodDays: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "1y": 365,
    };
    const days = periodDays[period] || 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);

    // 1. 产品统计
    const whereClause: Record<string, unknown> = { status: "active" };
    if (categoryFilter) whereClause.categoryId = categoryFilter;
    if (brandFilter) whereClause.brandId = brandFilter;

    const totalProducts = await prisma.product.count({
      where: whereClause,
    });

    const newProductsInPeriod = await prisma.product.count({
      where: {
        ...whereClause,
        createdAt: { gte: startDate },
      },
    });

    const soldProducts = await prisma.product.count({
      where: { ...whereClause, status: "sold" },
    });

    // 2. 价格统计
    const priceStats = await prisma.product.aggregate({
      where: whereClause,
      _avg: { priceCny: true },
      _min: { priceCny: true },
      _max: { priceCny: true },
      _count: true,
    });

    // 3. 品类分布
    const categoryDistribution = await prisma.product.groupBy({
      by: ["categoryId"],
      where: { status: "active" },
      _count: true,
      _avg: { priceCny: true },
    });

    const categoryIds = categoryDistribution.map((c) => c.categoryId);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, nameZh: true, nameEn: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const categoryData = categoryDistribution
      .map((c) => ({
        categoryId: c.categoryId,
        name: categoryMap.get(c.categoryId)?.nameZh || "未知",
        nameEn: categoryMap.get(c.categoryId)?.nameEn || "Unknown",
        count: c._count,
        avgPrice: Math.round((c._avg.priceCny || 0) * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 4. 品牌热度
    const brandDistribution = await prisma.product.groupBy({
      by: ["brandId"],
      where: { status: "active" },
      _count: true,
      _avg: { priceCny: true },
    });

    const brandIds = brandDistribution.map((b) => b.brandId);
    const brands = await prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, nameZh: true, nameEn: true, originCountry: true },
    });

    const brandMap = new Map(brands.map((b) => [b.id, b]));
    const brandData = brandDistribution
      .map((b) => ({
        brandId: b.brandId,
        name: brandMap.get(b.brandId)?.nameZh || "未知",
        nameEn: brandMap.get(b.brandId)?.nameEn || "Unknown",
        originCountry: brandMap.get(b.brandId)?.originCountry || "",
        count: b._count,
        avgPrice: Math.round((b._avg.priceCny || 0) * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 5. 区域分布
    const regionDistribution = await prisma.product.groupBy({
      by: ["location"],
      where: { status: "active" },
      _count: true,
    });

    const regionData = regionDistribution
      .map((r) => ({
        region: r.location,
        count: r._count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 6. 价格区间分布
    const priceRanges = [
      { label: "0-3万", min: 0, max: 30000 },
      { label: "3-5万", min: 30000, max: 50000 },
      { label: "5-10万", min: 50000, max: 100000 },
      { label: "10-20万", min: 100000, max: 200000 },
      { label: "20-50万", min: 200000, max: 500000 },
      { label: "50万+", min: 500000, max: 99999999 },
    ];

    const priceRangeData = await Promise.all(
      priceRanges.map(async (range) => {
        const count = await prisma.product.count({
          where: {
            ...whereClause,
            priceCny: { gte: range.min, lt: range.max },
          },
        });
        return { label: range.label, count };
      })
    );

    // 7. 上架趋势（按天聚合）
    const trendDays = Math.min(days, 90);
    const trendData: { date: string; count: number }[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await prisma.product.count({
        where: {
          ...whereClause,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });

      trendData.push({
        date: dayStart.toISOString().slice(0, 10),
        count,
      });
    }

    // 8. 年份分布
    const yearDistribution = await prisma.product.groupBy({
      by: ["year"],
      where: { status: "active" },
      _count: true,
      _avg: { priceCny: true },
      orderBy: { year: "desc" },
      take: 15,
    });

    const yearData = yearDistribution.map((y) => ({
      year: y.year,
      count: y._count,
      avgPrice: Math.round((y._avg.priceCny || 0) * 100) / 100,
    }));

    // 9. 套利数据
    const arbitrageData = await prisma.arbitrageTopCache.findMany({
      where: { validUntil: { gte: now } },
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            brand: { select: { nameZh: true, nameEn: true } },
          },
        },
      },
      orderBy: { priceDiffPercent: "desc" },
      take: 10,
    });

    const topArbitrage = arbitrageData.map((a) => ({
      productId: a.productId,
      modelName: a.product.modelName,
      brand: a.product.brand.nameZh,
      year: a.product.year,
      domesticPrice: a.domesticPrice,
      foreignPrice: a.foreignPrice,
      priceDiff: a.priceDiff,
      priceDiffPercent: a.priceDiffPercent,
      profitMargin: a.profitMargin,
    }));

    // 10. 询价热度
    const inquiryStats = await prisma.inquiry.groupBy({
      by: ["status"],
      _count: true,
    });

    const inquiryData = inquiryStats.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        acc.total += item._count;
        return acc;
      },
      { total: 0 } as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalProducts,
          newProductsInPeriod,
          soldProducts,
          avgPrice: Math.round((priceStats._avg.priceCny || 0) * 100) / 100,
          minPrice: priceStats._min.priceCny || 0,
          maxPrice: priceStats._max.priceCny || 0,
          totalInquiries: inquiryData.total || 0,
          pendingInquiries: inquiryData.pending || 0,
        },
        categoryDistribution: categoryData,
        brandDistribution: brandData,
        regionDistribution: regionData,
        priceRangeDistribution: priceRangeData,
        listingTrend: trendData,
        yearDistribution: yearData,
        topArbitrage,
        inquiryStats: inquiryData,
        period,
      },
    });
  } catch (error) {
    console.error("Market insights error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch market insights" },
      { status: 500 }
    );
  }
}
