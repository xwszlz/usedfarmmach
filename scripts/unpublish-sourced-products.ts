// ───────────────────────────────────────────────
// 下架「采集导入」误上架的 active 采集商品（软下架，绝不删除）
//
// 背景：老板曾把采集数据经「转 Product → active」误挂进 /products 自营货架
// （全部「采集导入」卖家、错挂「配件」品类）。本脚本按**全集口径**下架：
//   WHERE Product.status = 'active' AND Product.seller.companyName = '采集导入'
//   → UPDATE Product.status = 'draft'（软下架，保审计，可恢复）。
//
// ⚠️ 严禁按 modelName LIKE 'Variant%' 前缀匹配 —— 这些商品实为多品类混合
//    （圆捆机 / 大方捆 / 拖拉机），前缀法会漏掉大量行。
//
// 用法（**默认 dry-run，不写库**）：
//   tsx scripts/unpublish-sourced-products.ts            # 仅统计 + 预览
//   tsx scripts/unpublish-sourced-products.ts --apply    # 真正下架
// ───────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCOUT_COMPANY = "采集导入";
const ACTIVE = "active";
const DRAFT = "draft";

async function main() {
  const apply = process.argv.includes("--apply");

  console.log("=".repeat(60));
  console.log("🛡️  下架「采集导入」误上架 active 采集商品");
  console.log("=".repeat(60));
  console.log(`模式: ${apply ? "✅ 真实下架（status→draft）" : "🔍 试运行（不写库）"}`);

  // 取全集：active + 采集导入卖家
  const targets = await prisma.product.findMany({
    where: {
      status: ACTIVE,
      seller: { companyName: SCOUT_COMPANY },
    },
    select: {
      id: true,
      modelName: true,
      status: true,
      category: { select: { nameZh: true } },
      brand: { select: { nameZh: true } },
      seller: { select: { companyName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📊 命中 ${targets.length} 条（status=active 且 seller.companyName=${SCOUT_COMPANY}）`);
  console.log("─".repeat(60));

  // 按品类聚合（用于核对是否多品类混合，避免前缀误判）
  const byCategory = new Map<string, number>();
  for (const t of targets) {
    const c = t.category?.nameZh ?? "（无品类）";
    byCategory.set(c, (byCategory.get(c) || 0) + 1);
  }
  console.log("品类分布：");
  for (const [cat, n] of byCategory) {
    console.log(`   • ${cat}: ${n} 条`);
  }
  console.log("─".repeat(60));

  if (targets.length === 0) {
    console.log("✅ 没有需要下架的采集商品，无需操作。");
    await prisma.$disconnect();
    return;
  }

  // 预览前 20 条
  const preview = targets.slice(0, 20);
  console.log("预览（前 20 条）：");
  for (const t of preview) {
    console.log(
      `   • ${t.brand?.nameZh ?? "?"} ${t.modelName} [${t.category?.nameZh ?? "?"}] (${t.id.slice(-6)})`
    );
  }
  if (targets.length > 20) console.log(`   … 其余 ${targets.length - 20} 条省略`);
  console.log("─".repeat(60));

  if (!apply) {
    console.log("⏭️  试运行结束，未做任何修改。加 --apply 执行真实下架。");
    await prisma.$disconnect();
    return;
  }

  // 真实下架：软下架（status→draft），保留数据用于审计 / 新栏目迁移
  const result = await prisma.product.updateMany({
    where: {
      status: ACTIVE,
      seller: { companyName: SCOUT_COMPANY },
    },
    data: { status: DRAFT },
  });

  console.log(`✅ 已下架 ${result.count} 条（status: active → draft，软下架，未删除）`);
  if (result.count !== targets.length) {
    console.warn(
      `⚠️  预览命中 ${targets.length} 条，实际更新 ${result.count} 条 —— 期间数据可能变动，请复核。`
    );
  }
  console.log("ℹ️  这些采集数据后续可经 RawListing.isPublic 进入 /overseas 只读栏目（去交易化）。");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
