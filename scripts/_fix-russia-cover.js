const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const RESULTS_FILE = 'D:/神雕农机/神雕日报/cover-upload-results-2026-07-03.json';

async function main() {
  const covers = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));

  // Russia article uses Russia-themed cover (industry-news file) even though category is market-analysis
  const russiaUrl = covers['industry-news'];
  if (russiaUrl) {
    const updated = await prisma.article.updateMany({
      where: { slug: 'russia-used-farm-machinery-market-2026-07-03' },
      data: { coverImage: russiaUrl },
    });
    console.log(`  ✅ Russia article updated: ${russiaUrl} (${updated.count} updated)`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
