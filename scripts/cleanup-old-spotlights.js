/**
 * 删除旧版明星展品推荐文章（v1/v2/v3 的所有旧slug）
 * 用法: node scripts/cleanup-old-spotlights.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 所有旧版本slug
  const oldSlugs = [
    'claas-jaguar-970-product-highlight-20260605',
    'claas-5300rc-product-highlight-20260605',
    'orkel-dens-x-product-highlight-20260605',
    'claas-jaguar-970-product-highlight-20260605-v2',
    'claas-5300rc-product-highlight-20260605-v2',
    'orkel-dens-x-product-highlight-20260605-v2',
    'claas-jaguar-970-spotlight-20260605',
    'claas-5300rc-spotlight-20260605',
    'orkel-dens-x-spotlight-20260605',
  ];

  let deleted = 0;
  for (const slug of oldSlugs) {
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) {
      await prisma.article.delete({ where: { slug } });
      console.log(`  DELETED: ${slug}`);
      deleted++;
    }
  }

  console.log(`\nTotal deleted: ${deleted}`);

  const total = await prisma.article.count({ where: { status: 'published' } });
  console.log(`Total remaining published articles: ${total}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
