const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const RESULTS_FILE = 'D:/神雕农机/神雕日报/cover-upload-results-2026-07-03.json';
const ARTICLES_FILE = 'D:/神雕农机/神雕日报/articles_2026-07-03.json';

async function main() {
  const covers = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  const articles = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf-8'));

  console.log('Updating cover images for articles...');
  for (const article of articles) {
    const category = article.category;
    const coverUrl = covers[category];
    if (!coverUrl) {
      console.log(`  ⚠️ No cover for category ${category}`);
      continue;
    }
    const updated = await prisma.article.updateMany({
      where: { slug: article.slug },
      data: { coverImage: coverUrl },
    });
    console.log(`  ✅ ${article.slug} -> ${coverUrl} (${updated.count} updated)`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
