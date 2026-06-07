/**
 * 将生成的文章JSON导入到Neon PostgreSQL数据库
 * 用法: node scripts/import-articles.js [json-file]
 *
 * 去重规则：
 * 1. slug唯一性（已有机制）
 * 2. 同category下标题前20字符相似 → 保留最新，删除旧的（新增）
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 标题相似度key：取前20字符，去除具体日期
function titleKey(title) {
  return (title || '').replace(/\d{4}年\d{2}月\d{2}日/g, 'DATE').slice(0, 20);
}

async function deduplicateByTitle(importingArticles) {
  /** 删除数据库中同category+标题相似的旧文章，只保留最新 */
  const existingAll = await prisma.article.findMany({
    orderBy: { publishedAt: 'desc' },
    select: { id: true, slug: true, titleZh: true, category: true, publishedAt: true }
  });

  // 合并新文章和已有文章
  const all = [...existingAll];
  for (const a of importingArticles) {
    // 如果slug已存在，用已有记录覆盖
    const existing = existingAll.find(e => e.slug === a.slug);
    if (!existing) {
      all.push({
        id: 'new_' + a.slug,
        slug: a.slug,
        titleZh: a.titleZh,
        category: a.category,
        publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
      });
    }
  }

  // 按category + titleKey分组
  const groups = {};
  for (const a of all) {
    const key = (a.category || 'uncategorized') + '|||' + titleKey(a.titleZh || '');
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }

  // 找出旧文章删除
  let deletedCount = 0;
  for (const [key, group] of Object.entries(groups)) {
    if (group.length > 1) {
      group.sort((a, b) => b.publishedAt - a.publishedAt);
      for (let i = 1; i < group.length; i++) {
        const old = group[i];
        // 只删除数据库中真实存在的记录（不是新文章的占位）
        if (old.id && !old.id.startsWith('new_')) {
          await prisma.article.delete({ where: { id: old.id } });
          console.log(`  DEDUP (deleted old): ${old.slug.slice(0,40)}`);
          deletedCount++;
        }
      }
    }
  }

  if (deletedCount > 0) {
    console.log(`  [去重] 删除了 ${deletedCount} 篇旧文章`);
  }
  return deletedCount;
}

async function main() {
  const jsonFile = process.argv[2] || path.join(__dirname, '..', '神雕日报', `articles_${new Date().toISOString().split('T')[0]}.json`);

  if (!fs.existsSync(jsonFile)) {
    console.error(`File not found: ${jsonFile}`);
    process.exit(1);
  }

  const articles = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
  console.log(`Found ${articles.length} articles to import`);

  // 去重：删除同category+标题相似的旧文章
  console.log('\n[去重检查] 相同类别下标题高度相似的文章...');
  await deduplicateByTitle(articles);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const article of articles) {
    try {
      // Check if article with this slug already exists
      const existing = await prisma.article.findUnique({ where: { slug: article.slug } });
      if (existing) {
        // If article exists but has no cover image, update it
        if (!existing.coverImage && article.coverImage) {
          await prisma.article.update({
            where: { id: existing.id },
            data: { coverImage: article.coverImage },
          });
          console.log(`  UPDATE (cover): ${article.slug}`);
          skipCount++;
        } else {
          console.log(`  SKIP (exists): ${article.slug}`);
          skipCount++;
        }
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
          tagsEn: article.tagsEn || null,
          tagsRu: article.tagsRu || null,
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
