import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dedupeBrandBenchmark } from "@/lib/benchmark-dedupe";
import { requireRawListingAdmin } from "@/lib/raw-listing/admin-auth";
import { isCnSite, SITE } from "@/config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/benchmark
 * 一站式读取三张表，供 /benchmark 看板展示：
 *  1) BrandBenchmark   —— 全球品牌×机型×源站基准价指数（与库存解耦）
 *  2) InternationalPrice(+Product) —— 跨境套利匹配（按 品牌/型号/年份 绑定国内库存）
 *  3) RawListing(domestic_*) —— 国内卖方采集挂牌（爬虫跑通后才有数据）
 *
 * 🔒 P0 止血（合规）：
 *  - 鉴权：仅 admin / super_admin 可访问（与采集审核后台同口径，见 admin-auth.ts），
 *    避免跨境套利与境内挂牌等敏感数据对匿名/低权用户公开。
 *  - SITE 门控（数据不出境）：.cn 仅返境内源（domestic RawListing），.com 仅返国际源
 *    （InternationalPrice 跨境套利），防止境内卖方数据（含联系方式）经 .com 站出境。
 */
export async function GET(req: NextRequest) {
  // 鉴权：与管理后台受保护 API 同口径（requireRawListingAdmin = admin / super_admin）。
  const guard = await requireRawListingAdmin(req);
  if (!guard.ok) {
    return NextResponse.json(guard.body, { status: guard.status });
  }

  try {
    const [benchmarkRaw, arbitrage, domestic, domesticCount] = await Promise.all([
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
        take: 500,
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

    // 读层去重：吸收历史镜像残留的重复行（见 src/lib/benchmark-dedupe.ts）。
    // 不改 orderBy / 响应结构 / schema，仅对结果做幂等去重；Neon 本无重复 ⇒ no-op。
    const benchmark = dedupeBrandBenchmark(benchmarkRaw);

    const sampleTotal = benchmark.reduce((s, b) => s + (b.sampleSize || 0), 0);
    const freshCount = benchmark.filter((b) => {
      if (!b.lastVerified) return false;
      const days = (Date.now() - new Date(b.lastVerified).getTime()) / 86400000;
      return days <= 2;
    }).length;

    // —— ④ 境内 vs 全球基准价差（品牌级）——
    // 国内 RawListing（按 brandName 均价，元→万元）对照 BrandBenchmark（按 brandNameZh 均价，元→万元）。
    // 仅保留两边同时存在的品牌；diff>0 表示境内更低=出口套利机会。
    const domByBrand = new Map<string, { sum: number; n: number }>();
    for (const d of domestic) {
      if (typeof d.priceCny === "number") {
        const cur = domByBrand.get(d.brandName) || { sum: 0, n: 0 };
        cur.sum += d.priceCny;
        cur.n++;
        domByBrand.set(d.brandName, cur);
      }
    }
    const intlByBrand = new Map<string, { sum: number; n: number }>();
    for (const b of benchmark) {
      if (typeof b.priceCny === "number") {
        const key = b.brandNameZh || b.brand;
        const cur = intlByBrand.get(key) || { sum: 0, n: 0 };
        cur.sum += b.priceCny;
        cur.n++;
        intlByBrand.set(key, cur);
      }
    }
    const spread: Array<{
      brand: string;
      domesticAvgWan: number;
      intlAvgWan: number;
      spreadWan: number;
      pct: number;
      direction: "export" | "import";
      domesticCount: number;
      intlCount: number;
    }> = [];
    for (const [brand, dom] of domByBrand) {
      const intl = intlByBrand.get(brand);
      if (!intl || intl.n === 0) continue;
      const domWan = dom.sum / dom.n / 10000;
      const intlWan = intl.sum / intl.n / 10000;
      const diff = intlWan - domWan;
      const pct = domWan ? (diff / domWan) * 100 : 0;
      spread.push({
        brand,
        domesticAvgWan: Math.round(domWan * 10) / 10,
        intlAvgWan: Math.round(intlWan * 10) / 10,
        spreadWan: Math.round(diff * 10) / 10,
        pct: Math.round(pct * 10) / 10,
        direction: diff >= 0 ? "export" : "import",
        domesticCount: dom.n,
        intlCount: intl.n,
      });
    }
    spread.sort((a, b) => b.spreadWan - a.spreadWan);

    // —— SITE 门控（数据不出境）——
    // .cn 仅返境内源：跨境套利（InternationalPrice）属国际源，.cn 不返回；
    // .com 仅返国际源：境内挂牌（RawListing domestic_*，含卖方联系方式）属境内源，.com 不返回。
    const cn = isCnSite();
    const arbitrageOut = cn ? [] : arbitrage;
    const domesticOut = cn ? domestic : [];
    const domesticCountOut = cn ? domesticCount : 0;

    return NextResponse.json({
      ok: true,
      site: SITE,
      generatedAt: new Date().toISOString(),
      summary: {
        benchmarkCount: benchmark.length,
        freshCount,
        arbitrageCount: arbitrageOut.length,
        sampleTotal,
        domesticCount: domesticCountOut,
        spreadCount: spread.length,
      },
      benchmark,
      arbitrage: arbitrageOut,
      domestic: domesticOut,
      spread,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "query failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
