/**
 * 开放API — 行业数据统计
 * GET /api/open/industry-data
 *
 * 需要 API Key: Authorization: Bearer sk_xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "../_middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const [totalProducts, activeProducts, totalBrands, totalCategories, totalSellers] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: "active" } }),
      prisma.brand.count(),
      prisma.category.count(),
      prisma.user.count({ where: { role: "seller" } }),
    ]);

    // 品类分布
    const categoryDistribution = await prisma.product.groupBy({
      by: ["categoryId"],
      where: { status: "active" },
      _count: { _all: true },
      orderBy: { _count: { categoryId: "desc" } },
      take: 10,
    });

    // 品牌分布
    const brandDistribution = await prisma.product.groupBy({
      by: ["brandId"],
      where: { status: "active" },
      _count: { _all: true },
      orderBy: { _count: { brandId: "desc" } },
      take: 10,
    });

    // 区域分布
    const regionDistribution = await prisma.product.groupBy({
      by: ["location"],
      where: { status: "active" },
      _count: { _all: true },
      orderBy: { _count: { location: "desc" } },
      take: 10,
    });

    // 价格区间
    const priceStats = await prisma.product.aggregate({
      where: { status: "active" },
      _min: { priceCny: true },
      _max: { priceCny: true },
      _avg: { priceCny: true },
    });

    // 年份分布
    const yearDistribution = await prisma.product.groupBy({
      by: ["year"],
      where: { status: "active" },
      _count: { _all: true },
      orderBy: { year: "desc" },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalProducts,
          activeProducts,
          totalBrands,
          totalCategories,
          totalSellers,
        },
        distribution: {
          byCategory: categoryDistribution,
          byBrand: brandDistribution,
          byRegion: regionDistribution,
          byYear: yearDistribution,
        },
        priceStats: {
          min: priceStats._min.priceCny,
          max: priceStats._max.priceCny,
          avg: Math.round((priceStats._avg.priceCny || 0) * 100) / 100,
        },
      },
      meta: {
        apiVersion: "v1",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Open API industry-data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
