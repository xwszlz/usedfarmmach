/**
 * 将生成的文章JSON导入到Neon PostgreSQL数据库
 * 用法: node scripts/import-articles.js [json-file]
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonFile = process.argv[2] || path.join(__dirname, '..', '神雕日报', `articles_${new Date().toISOString().split('T')[0]}.json`);

  if (!fs.existsSync(jsonFile)) {
    console.error(`File not found: ${jsonFile}`);
    process.exit(1);
  }

  const articles = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
  console.log(`Found ${articles.length} articles to import`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const article of articles) {
    try {
      // Check if article with this slug already exists
      const existing = await prisma.article.findUnique({ where: { slug: article.slug } });
      if (existing) {
        console.log(`  SKIP (exists): ${article.slug}`);
        skipCount++;
        continue;
      }

      const result = await prisma.article.create({
        data: {
          slug: article.slug,
          titleZh: article.titleZh,
          titleEn: article.titleEn || null,
          titleRu: article.titleRu || null,
          contentZh: article.contentZh,
          contentEn: article.contentEn || null,
          contentRu: article.contentRu || null,
          excerptZh: article.excerptZh || null,
          excerptEn: article.excerptEn || null,
          excerptRu: article.excerptRu || null,
          coverImage: article.coverImage || null,
          status: article.status || 'published',
          category: article.category || null,
          tags: article.tags || null,
          sourcePlatform: article.sourcePlatform || null,
          sourceUrl: article.sourceUrl || null,
          metaTitle: article.metaTitle || null,
          metaDesc: article.metaDesc || null,
          keywords: article.keywords || null,
          publishedAt: article.publishedAt ? new Date(article.publishedAt) : new Date(),
        },
      });
      console.log(`  OK: ${result.id} - ${article.titleZh.substring(0, 50)}...`);
      successCount++;
    } catch (err) {
      console.error(`  ERROR: ${article.slug} - ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nImport complete: ${successCount} created, ${skipCount} skipped, ${errorCount} errors`);

  // Print article stats
  const totalArticles = await prisma.article.count({ where: { status: 'published' } });
  const categoryBreakdown = await prisma.article.groupBy({
    by: ['category'],
    where: { status: 'published' },
    _count: true,
  });
  console.log(`\nTotal published articles: ${totalArticles}`);
  console.log('By category:');
  categoryBreakdown.forEach(c => {
    console.log(`  ${c.category || 'uncategorized'}: ${c._count}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
