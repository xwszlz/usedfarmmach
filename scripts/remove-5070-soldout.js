/**
 * 清理纽荷兰5070相关数据（产品已脱销）
 *
 * 1. MarketIntel表：禁用所有含"5070"的情报条目 → 首页滚动条 + /intelligence 页面
 * 2. Article表：禁用所有含"5070"的文章 → 行业资讯 /blog
 *
 * 使用方式: node scripts/remove-5070-soldout.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("=== 开始清理纽荷兰5070脱销数据 ===\n");

  // ---- 1. MarketIntel: 禁用含5070的情报 ----
  console.log("📋 [1/2] 处理 MarketIntel 市场情报...");

  const intelResults = await prisma.marketIntel.findMany({
    where: {
      OR: [
        { text: { contains: "5070" } },
        { textEn: { contains: "5070" } },
        { textRu: { contains: "5070" } },
        { tags: { contains: "5070" } },
      ],
    },
    select: { id: true, text: true, region: true, isActive: true, date: true },
  });

  if (intelResults.length === 0) {
    console.log("   ✅ 未找到5070相关市场情报（可能已清理）");
  } else {
    console.log(`   找到 ${intelResults.length} 条5070相关情报:`);
    for (const item of intelResults) {
      console.log(`     - [${item.id.slice(0,8)}] ${item.region} | ${item.text?.slice(0, 60)}... | active=${item.isActive}`);
    }

    const intelDisabled = await prisma.marketIntel.updateMany({
      where: {
        OR: [
          { text: { contains: "5070" } },
          { textEn: { contains: "5070" } },
          { textRu: { contains: "5070" } },
          { tags: { contains: "5070" } },
        ],
      },
      data: { isActive: false },
    });
    console.log(`   🗑️ 已禁用 ${intelDisabled.count} 条市场情报\n`);
  }

  // ---- 2. Article: 归档含5070的文章 ----
  console.log("📰 [2/2] 处理 Article 行业资讯文章...");

  const articleResults = await prisma.article.findMany({
    where: {
      OR: [
        { titleZh: { contains: "5070" } },
        { titleEn: { contains: "5070" } },
        { titleRu: { contains: "5070" } },
        { slug: { contains: "5070" } },
      ],
    },
    select: { id: true, titleZh: true, titleEn: true, slug: true, status: true },
  });

  if (articleResults.length === 0) {
    console.log("   ✅ 未找到5070相关文章（可能已清理）");
  } else {
    console.log(`   找到 ${articleResults.length} 篇5070相关文章:`);
    for (const article of articleResults) {
      console.log(`     - [${article.id.slice(0,8)}] ${article.slug} | ${article.titleZh || article.titleEn} | status=${article.status}`);
    }

    const articleArchived = await prisma.article.updateMany({
      where: {
        OR: [
          { titleZh: { contains: "5070" } },
          { titleEn: { contains: "5070" } },
          { titleRu: { contains: "5070" } },
          { slug: { contains: "5070" } },
        ],
      },
      data: { status: "archived" },
    });
    console.log(`   🗑️ 已归档 ${articleArchived.count} 篇文章\n`);
  }

  // ---- 验证结果 ----
  console.log("🔍 验证清理结果...");
  const remainingIntel = await prisma.marketIntel.count({
    where: {
      isActive: true,
      OR: [
        { text: { contains: "5070" } },
        { tags: { contains: "5070" } },
      ],
    },
  });
  const remainingArticle = await prisma.article.count({
    where: {
      status: "published",
      OR: [
        { titleZh: { contains: "5070" } },
        { slug: { contains: "5070" } },
      ],
    },
  });

  console.log(`   市场情报活跃的5070条目: ${remainingIntel}（应为0）`);
  console.log(`   文章活跃的5070条目: ${remainingArticle}（应为0）`);

  if (remainingIntel === 0 && remainingArticle === 0) {
    console.log("\n✅ 全部清理完成！纽荷兰5070数据已从网站隐藏。");
  } else {
    console.log("\n⚠️ 还有残留数据，请检查。");
  }
}

main()
  .catch((e) => {
    console.error("❌ 清理失败:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
