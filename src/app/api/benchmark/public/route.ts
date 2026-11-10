import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SITE } from "@/config/site";

// .cn 构建期静态固化铁律：公开 GET 路由必须强制动态，否则空库快照会被烤进镜像。
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** 样本不足的品牌不公开，防止从聚合值反推单条挂牌 */
const MIN_SAMPLE = 5;

type BrandAgg = {
  brand: string;
  brandNameZh: string | null;
  pricesWan: number[];
  sampleSize: number;
  models: Set<string>;
  regions: Set<string>;
  sources: Set<string>;
  asOf: string | null;
};

/**
 * GET /api/benchmark/public —— 游客可读的「品牌级脱敏基准价摘要」
 *
 * 🔴 合规红线（不得放宽）：
 *  1) 只查 BrandBenchmark 一张表；绝不查 RawListing / InternationalPrice / Product。
 *     因此响应不可能包含卖家联系方式、单条挂牌、跨境套利配对或价差信号。
 *  2) 只返回品牌级聚合值（万元取整 + 计数），不含 id / sourceUrl / exchangeRate /
 *     confidenceScore / medianPrice / priceType，也不含逐机型明细。
 *  3) 原 /api/benchmark（requireRawListingAdmin + SITE 门控）保持一字不动。
 *  4) .cn 侧由 @/lib/db 的 SITE 感知 client 读境内库，不接任何境外端点；
 *     境内库若无 BrandBenchmark 数据则返回 available=false，绝不用假数填充。
 */
export async function GET() {
  try {
    const rows = await prisma.brandBenchmark.findMany({
      where: { isActive: true },
      select: {
        brand: true,
        brandNameZh: true,
        model: true,
        region: true,
        priceCny: true,
        sampleSize: true,
        sourceSite: true,
        sourceDate: true,
      },
      take: 300,
    });

    const byBrand = new Map<string, BrandAgg>();
    for (const r of rows) {
      const key = r.brand || "unknown";
      let e = byBrand.get(key);
      if (!e) {
        e = {
          brand: key,
          brandNameZh: r.brandNameZh ?? null,
          pricesWan: [],
          sampleSize: 0,
          models: new Set<string>(),
          regions: new Set<string>(),
          sources: new Set<string>(),
          asOf: null,
        };
        byBrand.set(key, e);
      }
      if (typeof r.priceCny === "number" && r.priceCny > 0) {
        e.pricesWan.push(r.priceCny / 10000);
      }
      e.sampleSize += r.sampleSize || 0;
      if (r.model) e.models.add(r.model);
      if (r.region) e.regions.add(r.region);
      if (r.sourceSite) e.sources.add(r.sourceSite);
      if (r.sourceDate && (!e.asOf || r.sourceDate > e.asOf)) e.asOf = r.sourceDate;
    }

    const brands = Array.from(byBrand.values())
      .filter((e) => e.sampleSize >= MIN_SAMPLE && e.pricesWan.length > 0)
      .map((e) => {
        const sorted = [...e.pricesWan].sort((a, b) => a - b);
        return {
          brand: e.brand,
          brandNameZh: e.brandNameZh,
          lowWan: Math.floor(sorted[0]),
          highWan: Math.ceil(sorted[sorted.length - 1]),
          sampleSize: e.sampleSize,
          modelCount: e.models.size,
          regions: Array.from(e.regions).sort(),
          sourceCount: e.sources.size,
          asOf: e.asOf,
        };
      })
      .sort((a, b) => b.sampleSize - a.sampleSize);

    const sampleTotal = brands.reduce((sum, b) => sum + b.sampleSize, 0);
    const sourceCount = new Set(rows.map((r) => r.sourceSite)).size;

    return NextResponse.json(
      {
        ok: true,
        site: SITE,
        generatedAt: new Date().toISOString(),
        available: brands.length > 0,
        unit: "万元",
        currency: "CNY",
        minSample: MIN_SAMPLE,
        summary: { brandCount: brands.length, sampleTotal, sourceCount },
        brands,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "query failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
