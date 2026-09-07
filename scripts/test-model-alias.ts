/**
 * ModelAlias 效果验证（只读，不写库）
 *
 * 用真实数据对比「改造前 / 改造后」的国际价配对覆盖率：
 *   改造前：product.modelName 精确 / contains 抓取型号 / contains 首词（区分大小写）
 *   改造后：上述 + ModelAlias 归一化候选（忽略大小写、剥离系列前缀）
 *
 * 运行：
 *   DATABASE_URL="..." npx tsx scripts/test-model-alias.ts
 */
import { PrismaClient } from "@prisma/client";
import { resolveModelCandidates, normalizeModel } from "../src/lib/model-alias";

const prisma = new PrismaClient();

/** 改造前逻辑（对齐 agent.ts 原 matchProduct 的 4 步，区分大小写） */
function oldMatch(productModels: string[], rawModel: string): boolean {
  if (!rawModel) return false;
  const model = rawModel.trim();
  const first = model.split(/\s+/)[0];
  return productModels.some(
    (pm) => pm === model || pm.includes(model) || pm.includes(first)
  );
}

/** 改造后逻辑（原 4 步 + ModelAlias 候选，忽略大小写） */
function newMatch(productModels: string[], rawModel: string, brandSlug: string): boolean {
  if (!rawModel) return false;
  if (oldMatch(productModels, rawModel)) return true;
  const candidates = resolveModelCandidates(brandSlug, rawModel);
  return productModels.some((pm) => {
    const pmNorm = normalizeModel(pm);
    // 必须是「库存型号 startsWith 候选」，双向 contains 会产生误配（如 6R 250 误吃 7250）
    return candidates.some((c) => pmNorm === c || pmNorm.startsWith(c));
  });
}

async function main() {
  console.log("=== ModelAlias 覆盖率影响验证（真实数据只读）===\n");

  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: { id: true, modelName: true, brandId: true, brand: { select: { nameZh: true } } },
  });
  const totalProducts = products.length;
  // brandId(slug) → 该品牌下所有库存型号
  const modelsByBrand: Record<string, string[]> = {};
  for (const p of products) {
    (modelsByBrand[p.brandId] ||= []).push(p.modelName);
  }

  const bench = await prisma.brandBenchmark.findMany({
    where: { isActive: true, priceForeign: { gt: 0 } },
    select: {
      brand: true, model: true, sourceSite: true,
      priceForeign: true, currency: true, listingCount: true, sampleSize: true, sourceUrl: true,
    },
  });
  console.log(`在库产品：${totalProducts} 台`);
  console.log(`BrandBenchmark 真实抓取行：${bench.length} 条\n`);

  const oldHitProducts = new Set<string>();
  const newHitProducts = new Set<string>();
  const gainRows: Array<{ brand: string; model: string; site: string; products: string[] }> = [];

  for (const b of bench) {
    const slug = (b.brand || "").toLowerCase();
    const models = modelsByBrand[slug];
    if (!models) continue; // 我们不经营的品牌（fendt/valtra 等）跳过
    const hitsNew = models.filter((m) => newMatch([m], b.model, slug));
    const hitsOld = models.filter((m) => oldMatch([m], b.model));
    if (hitsNew.length) {
      // 记录命中该行的库存型号（用于展示）
      for (const m of hitsNew) {
        const p = products.find(
          (x) => x.brandId === slug && x.modelName === m
        );
        if (p) newHitProducts.add(p.id);
      }
      if (!hitsOld.length) {
        gainRows.push({ brand: slug, model: b.model, site: b.sourceSite, products: hitsNew });
      }
    }
    if (hitsOld.length) {
      for (const m of hitsOld) {
        const p = products.find((x) => x.brandId === slug && x.modelName === m);
        if (p) oldHitProducts.add(p.id);
      }
    }
  }

  const pct = (n: number) => ((n / totalProducts) * 100).toFixed(1);
  console.log("--- 配对覆盖率（BrandBenchmark 真实抓取 → 库存产品）---");
  console.log(`改造前：${oldHitProducts.size} / ${totalProducts} 台 = ${pct(oldHitProducts.size)}%`);
  console.log(`改造后：${newHitProducts.size} / ${totalProducts} 台 = ${pct(newHitProducts.size)}%`);
  console.log(`净新增：+${newHitProducts.size - oldHitProducts.size} 台\n`);

  if (gainRows.length) {
    console.log("--- 新增配对明细（改造前配不上、改造后能配上）---");
    for (const g of gainRows.slice(0, 30)) {
      console.log(`  ${g.brand} | "${g.model}" (${g.site}) → 库存 [${g.products.join(", ")}]`);
    }
    console.log(`  共 ${gainRows.length} 条抓取行新增命中\n`);
  }

  // 逐品牌明细
  console.log("--- 逐品牌（改造后）/ 该品牌库存台数 ---");
  const byBrand: Record<string, Set<string>> = {};
  for (const b of bench) {
    const slug = (b.brand || "").toLowerCase();
    const models = modelsByBrand[slug];
    if (!models) continue;
    for (const m of models) {
      if (newMatch([m], b.model, slug)) {
        const p = products.find((x) => x.brandId === slug && x.modelName === m);
        if (p) (byBrand[slug] ||= new Set()).add(p.id);
      }
    }
  }
  for (const [slug, set] of Object.entries(byBrand).sort((a, b) => b[1].size - a[1].size)) {
    const total = modelsByBrand[slug]?.length || 0;
    console.log(`  ${slug}: ${set.size}/${total} 台`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
