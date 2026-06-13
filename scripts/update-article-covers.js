/**
 * 更新文章coverImage字段为OSS URL
 * 用法: node update-article-covers.js <upload_result_json>
 */

const fs = require("fs");
const path = require("path");

// 动态加载Prisma
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const resultPath = process.argv[2];
  if (!resultPath) {
    console.error("用法: node update-article-covers.js <upload_result_json>");
    process.exit(1);
  }

  const uploadResults = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  const slugs = Object.keys(uploadResults);

  console.log(`找到 ${slugs.length} 个封面图需要更新...\n`);

  let updated = 0;
  let skipped = 0;

  for (const slug of slugs) {
    const coverUrl = uploadResults[slug];
    
    try {
      const article = await prisma.article.findUnique({
        where: { slug },
      });

      if (!article) {
        console.log(`  ⚠️  文章不存在: ${slug}`);
        skipped++;
        continue;
      }

      await prisma.article.update({
        where: { slug },
        data: { coverImage: coverUrl },
      });

      console.log(`  ✅ 已更新: ${slug}`);
      console.log(`     ${coverUrl}`);
      updated++;
    } catch (err) {
      console.error(`  ❌ 更新失败 ${slug}:`, err.message);
      skipped++;
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`更新: ${updated}, 跳过: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
