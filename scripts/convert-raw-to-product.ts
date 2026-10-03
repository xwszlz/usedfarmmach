// ───────────────────────────────────────────────
// 《采集数据上架》转换入口（P0）
// 用法：
//   tsx scripts/convert-raw-to-product.ts --dry-run        # 只跑 sanity 统计，不写库
//   tsx scripts/convert-raw-to-product.ts                  # 真正执行：sanity + 转换
//   tsx scripts/convert-raw-to-product.ts --limit=20       # 限制处理条数
//
// 流程（docs/采集数据上架方案.md §3.4）：
//   findMany(status∈{pending,approved}, productId=null) → sanity.evaluate →
//     auto_reject → status=auto_rejected
//     needs_review→ status=needs_review
//     auto_pass   → convert → Product(status=draft) → 回写 RawListing
//                    {status:converted, productId, convertedAt, reviewedBy, notes}
//
// 合规（§5）：按 SITE 分站，仅处理本站合法来源；跨站硬断言。
// 性能：品牌/品类解析按输入做进程内缓存（distinct 品牌≈58、型号≈482），避免逐行重复查询。
// ───────────────────────────────────────────────

import "dotenv/config";

import type { PrismaClient } from "@prisma/client";
import type {
  CategoryResolution,
  BrandResolution,
  ConvertResult,
  RawListingLike,
  SanityAction,
  SanityContext,
  SanityResult,
} from "@/lib/raw-listing/types";

// ── CLI 参数 ──
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : null;

// ── 分站与合规判定 ──
type Station = "cn" | "com";
const STATION: Station = process.env.SITE === "cn" ? "cn" : "com";

function resolveDbUrl(): string {
  if (STATION === "cn") {
    // §5.2-1：SITE=cn 但未设 DATABASE_URL_CN → 拒绝运行
    const url = process.env.DATABASE_URL_CN;
    if (!url) {
      console.error("❌ 合规拦截：SITE=cn 但未设置 DATABASE_URL_CN，拒绝运行（exit 2）。");
      process.exit(2);
    }
    process.env.SITE = "cn"; // 固定单例 db.ts 走 cn 库
    return url;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ 未设置 DATABASE_URL，无法连接 .com 库（exit 2）。");
    process.exit(2);
  }
  process.env.SITE = "com";
  return url;
}

/** §5.2：单条来源是否属本站合法范围 */
function isAllowedSourceForStation(station: Station, source: string): boolean {
  const isDomestic = source.startsWith("domestic_");
  return station === "cn" ? isDomestic : !isDomestic;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

type ListingRow = {
  id: string; source: string; sourceUrl: string; brandName: string; modelName: string;
  year: number | null; workingHours: number | null; condition: string | null;
  priceRaw: number | null; currency: string | null; priceCny: number | null; location: string;
  sellerName: string | null; sellerPhone: string | null; sellerWechat: string | null; sellerWhatsapp: string | null;
};

function toRawListingLike(r: ListingRow): RawListingLike {
  return {
    id: r.id, source: r.source, sourceUrl: r.sourceUrl, brandName: r.brandName, modelName: r.modelName,
    year: r.year, workingHours: r.workingHours, condition: r.condition,
    priceRaw: r.priceRaw, currency: r.currency, priceCny: r.priceCny, location: r.location,
    sellerName: r.sellerName, sellerPhone: r.sellerPhone, sellerWechat: r.sellerWechat, sellerWhatsapp: r.sellerWhatsapp,
  };
}

async function main() {
  const dbUrl = resolveDbUrl();
  console.log("=".repeat(64));
  console.log(`🚜 采集数据上架转换 — station=${STATION}  mode=${DRY_RUN ? "DRY-RUN(只读)" : "WRITE"}`);
  console.log(`   db host: ${new URL(dbUrl).host}`); // 仅打印 host，绝不打印凭证
  console.log("=".repeat(64));

  // ── env 固定后再动态 import（保证 db.ts 单例指向正确库）──
  const { prisma } = (await import("@/lib/db")) as { prisma: PrismaClient };
  const { evaluateSanity, resolveEffectivePriceCny } = await import("@/lib/raw-listing/sanity");
  const {
    convertListing, resolveBrandForListing, inferCategory, normalizeBrandName,
    findScoutSellerId, probeDuplicate,
  } = await import("@/lib/raw-listing/convert");

  // ── §5.2-3：.com 站若库内存在 domestic_* 行 → 立即拒绝（国内 PII 不得出境）──
  if (STATION === "com") {
    const domesticCount = await prisma.rawListing.count({ where: { source: { startsWith: "domestic_" } } });
    if (domesticCount > 0) {
      console.error(`❌ 合规拦截：.com 库内检出 ${domesticCount} 条 domestic_* 采集行（国内 PII），拒绝出境处理（exit 3）。`);
      process.exit(3);
    }
  }

  // ── 拉取待处理行 ──
  const rows = (await prisma.rawListing.findMany({
    where: { productId: null, status: { in: ["pending", "approved"] } },
    orderBy: { scrapedAt: "asc" },
    ...(LIMIT && LIMIT > 0 ? { take: LIMIT } : {}),
    select: {
      id: true, source: true, sourceUrl: true, brandName: true, modelName: true,
      year: true, workingHours: true, condition: true, priceRaw: true, currency: true,
      priceCny: true, location: true, sellerName: true, sellerPhone: true,
      sellerWechat: true, sellerWhatsapp: true,
    },
  })) as ListingRow[];
  console.log(`\n🎯 待处理 RawListing: ${rows.length} 条（status∈{pending,approved} 且 productId=null）`);

  // ── §5.2：分站来源隔离 ──
  const localRows: ListingRow[] = [];
  let crossStationSkipped = 0;
  for (const r of rows) {
    if (isAllowedSourceForStation(STATION, r.source)) localRows.push(r);
    else { crossStationSkipped++; console.warn(`   ⚠️ 跨站跳过：source=${r.source}（本站 ${STATION} 不处理）`); }
  }
  if (crossStationSkipped > 0) console.log(`   ⚠️ 跨站跳过合计: ${crossStationSkipped} 条`);

  // ── 预计算同品牌中位价（全库，按归一品牌分组）──
  const allForMedian = await prisma.rawListing.findMany({
    select: { brandName: true, priceRaw: true, currency: true, priceCny: true },
  });
  const priceBuckets = new Map<string, number[]>();
  for (const r of allForMedian) {
    const key = normalizeBrandName(r.brandName).toLowerCase();
    const p = resolveEffectivePriceCny({ priceCny: r.priceCny, priceRaw: r.priceRaw, currency: r.currency });
    if (p == null) continue;
    const arr = priceBuckets.get(key) ?? [];
    arr.push(p);
    priceBuckets.set(key, arr);
  }
  const medianMap = new Map<string, number | null>();
  for (const [k, arr] of priceBuckets) medianMap.set(k, median(arr));

  // ── 只读探测：采集系统卖家（不存在 ⇒ 无历史重复）──
  const scoutSellerId = await findScoutSellerId(prisma);
  console.log(`   采集系统卖家已存在: ${scoutSellerId ? "是" : "否（首次运行将自动创建）"}`);

  // ── 品牌/品类解析缓存（避免逐行重复查询）──
  const brandCache = new Map<string, BrandResolution>();
  const catCache = new Map<string, CategoryResolution>();
  const getBrand = async (brandName: string): Promise<BrandResolution> => {
    const key = normalizeBrandName(brandName).toLowerCase();
    const hit = brandCache.get(key);
    if (hit) return hit;
    const res = await resolveBrandForListing(brandName);
    brandCache.set(key, res);
    return res;
  };
  const getCategory = async (modelName: string): Promise<CategoryResolution> => {
    const key = (modelName || "").trim();
    const hit = catCache.get(key);
    if (hit) return hit;
    const res = await inferCategory(modelName, prisma);
    catCache.set(key, res);
    return res;
  };

  // ── 统计容器 ──
  const actionCount: Record<SanityAction, number> = { auto_reject: 0, needs_review: 0, auto_pass: 0 };
  const ruleCount: Record<string, number> = {};
  const convertCount = { converted: 0, skipped: 0, fallbackCategory: 0, brandNormalized: 0 };
  const errors: string[] = [];
  const samples: Record<SanityAction, string[]> = { auto_reject: [], needs_review: [], auto_pass: [] };

  let processed = 0;
  for (const r of localRows) {
    processed++;
    if (processed % 100 === 0) console.log(`   …已处理 ${processed}/${localRows.length}`);
    try {
      const listing = toRawListingLike(r);

      // 探测 sanity 上下文（缓存）
      const brandRes = await getBrand(listing.brandName);
      const catRes = await getCategory(listing.modelName);
      const brandKey = normalizeBrandName(listing.brandName).toLowerCase();
      const brandMedianCny = medianMap.get(brandKey) ?? null;

      let isDuplicate = false;
      const year = listing.year;
      if (scoutSellerId && brandRes.brandId && year != null && year >= 1980 && year <= new Date().getFullYear() + 1) {
        isDuplicate = await probeDuplicate(scoutSellerId, brandRes.brandId, listing.modelName.trim(), year, prisma);
      }

      const ctx: SanityContext = {
        brandMatched: brandRes.matched,
        categoryInferable: catRes.matched && !catRes.usedFallback,
        brandMedianCny,
        isDuplicate,
      };

      const result: SanityResult = evaluateSanity(listing, ctx);
      actionCount[result.action]++;
      for (const h of result.hits) ruleCount[h.rule] = (ruleCount[h.rule] || 0) + 1;
      if (brandRes.mapped) convertCount.brandNormalized++;
      if (samples[result.action].length < 6) {
        samples[result.action].push(`#${r.id.slice(-6)} ${listing.source} | ${listing.brandName} → ${brandRes.normalized} | ${listing.modelName} | ¥${listing.priceCny ?? "-"} | [${result.reasons.join(",")}]`);
      }

      if (DRY_RUN) continue;

      // ── 写库 ──
      const now = new Date();
      if (result.action === "auto_reject") {
        await prisma.rawListing.update({
          where: { id: r.id },
          data: { status: "auto_rejected", reviewedBy: "auto", reviewedAt: now, notes: result.notes },
        });
      } else if (result.action === "needs_review") {
        await prisma.rawListing.update({
          where: { id: r.id },
          data: { status: "needs_review", reviewedBy: "auto", reviewedAt: now, notes: result.notes },
        });
      } else {
        const conv: ConvertResult = await convertListing(listing, prisma, {
          brandId: brandRes.brandId as string,
          brandDisplayName: brandRes.displayName ?? brandRes.normalized,
          categoryId: catRes.categoryId as string,
          categoryDisplayName: catRes.displayName ?? "",
          usedCategoryFallback: catRes.usedFallback,
        });
        if (conv.status === "converted") {
          convertCount.converted++;
          if (conv.usedCategoryFallback) convertCount.fallbackCategory++;
          const noteSuffix = conv.usedCategoryFallback ? "；品类回退兜底（农机配件/配件），强制人工复核" : "";
          await prisma.rawListing.update({
            where: { id: r.id },
            data: {
              status: "converted",
              productId: conv.productId,
              convertedAt: now,
              reviewedBy: "auto",
              reviewedAt: now,
              notes: `${result.notes}；已生成 draft 产品 ${conv.productId}${noteSuffix}`,
            },
          });
        } else {
          convertCount.skipped++;
          await prisma.rawListing.update({
            where: { id: r.id },
            data: { status: "needs_review", reviewedBy: "auto", reviewedAt: now, notes: `[convert-skip] ${conv.reason}` },
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`#${r.id}: ${msg}`);
      console.error(`   ❌ 处理失败 #${r.id}: ${msg}`);
    }
  }

  // ── 汇总 ──
  console.log("\n" + "=".repeat(64));
  console.log(`📊 sanity 判定分布（有效处理 ${localRows.length} 条）`);
  console.log(`   auto_reject : ${actionCount.auto_reject}`);
  console.log(`   needs_review: ${actionCount.needs_review}`);
  console.log(`   auto_pass   : ${actionCount.auto_pass}`);
  console.log("\n📊 规则命中次数（可多项叠加）");
  Object.entries(ruleCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
  console.log(`\n📊 品牌归一命中: ${convertCount.brandNormalized} 条（distinct 缓存 ${brandCache.size} 品牌 / ${catCache.size} 型号）`);
  if (!DRY_RUN) {
    console.log(`📊 转换成功: ${convertCount.converted} | 其中回退品类: ${convertCount.fallbackCategory} | 转换跳过: ${convertCount.skipped}`);
  }
  if (errors.length) console.log(`\n⚠️ 错误 ${errors.length} 条`);

  console.log("\n📋 抽样（来源 | 品牌→归一 | 型号 | 价 | 命中规则）");
  (["auto_reject", "needs_review", "auto_pass"] as SanityAction[]).forEach((a) => {
    console.log(`   [${a}]`);
    samples[a].forEach((s) => console.log(`      ${s}`));
  });

  console.log("\n✅ 完成" + (DRY_RUN ? "（dry-run，未写库）" : ""));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
