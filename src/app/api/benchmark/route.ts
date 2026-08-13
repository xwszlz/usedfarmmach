import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/benchmark
 * 一站式读取三张表，供 /benchmark 看板展示：
 *  1) BrandBenchmark   —— 全球品牌×机型×源站基准价指数（与库存解耦）
 *  2) InternationalPrice(+Product) —— 跨境套利匹配（按 品牌/型号/年份 绑定国内库存）
 *  3) RawListing(domestic_*) —— 国内卖方采集挂牌（爬虫跑通后才有数据）
 */
export async function GET() {
  try {
    const [benchmark, arbitrage, domestic, domesticCount] = await Promise.all([
      prisma.brandBenchmark.findMany({
        where: { isActive: true },
        orderBy: [{ sourceSite: "asc" }, { brand: "asc" }, { model: "asc" }],
        take: 300,
      }),
      prisma.internationalPrice.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        include: { product: { include: { brand: true } } },
      }),
      prisma.rawListing.findMany({
        where: { source: { startsWith: "domestic_" } },
        orderBy: { scrapedAt: "desc" },
        take: 60,
        select: {
          id: true,
          brandName: true,
          modelName: true,
          year: true,
          priceCny: true,
          currency: true,
          location: true,
          source: true,
          sourceUrl: true,
          scrapedAt: true,
          reviewedAt: true,
        },
      }),
      prisma.rawListing.count({ where: { source: { startsWith: "domestic_" } } }),
    ]);

    const sampleTotal = benchmark.reduce((s, b) => s + (b.sampleSize || 0), 0);
    const freshCount = benchmark.filter((b) => {
      if (!b.lastVerified) return false;
      const days = (Date.now() - new Date(b.lastVerified).getTime()) / 86400000;
      return days <= 2;
    }).length;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        benchmarkCount: benchmark.length,
        freshCount,
        arbitrageCount: arbitrage.length,
        sampleTotal,
        domesticCount,
      },
      benchmark,
      arbitrage,
      domestic,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "query failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
