const fs = require("fs");
const path = require("path");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const OSS_BASE = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/images/covers/";

  const covers = {
    "global-forage-harvester-market-analysis-2026-06-14": OSS_BASE + "2026-06-14_global-forage-harvester-market-analysis-2026-06-14.png",
    "claas-jaguar-price-guide-2026-06-14": OSS_BASE + "2026-06-14_claas-jaguar-price-guide-2026-06-14.png",
    "used-square-baler-buying-guide-2026-06-14": OSS_BASE + "2026-06-14_used-square-baler-buying-guide-2026-06-14.png",
  };

  let updated = 0;
  let skipped = 0;

  for (const [slug, coverUrl] of Object.entries(covers)) {
    try {
      const article = await prisma.article.findUnique({ where: { slug } });
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
