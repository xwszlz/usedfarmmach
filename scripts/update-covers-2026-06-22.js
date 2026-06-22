const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // 从upload结果读取今日URL
  const uploadResults = JSON.parse(fs.readFileSync('D:/神雕农机/神雕日报/cover-upload-results.json', 'utf-8'));
  const today = uploadResults.filter(x => x.file.includes('2026-06-22'));

  console.log('📋 今日上传封面图:', today.length);
  for (const t of today) {
    console.log(`  - ${t.file}`);
    console.log(`    ${t.url}`);
  }

  // 根据文章slug匹配封面图
  const slugToFile = {
    'global-forage-harvester-market-analysis-2026-06-22': 'Professional_agricultural_mach_2026-06-22T01-04-44.png',
    'claas-jaguar-price-guide-2026-06-22': 'Professional_price_guide_cover_2026-06-22T01-04-44.png',
    'ecb-june-2026-rate-decision-agri-impact-2026-06-22': 'European_Central_Bank_ECB_June_2026-06-22T01-04-54.png',
  };

  let updated = 0;
  for (const [slug, filename] of Object.entries(slugToFile)) {
    const t = today.find(x => x.file === filename);
    if (!t) {
      console.log(`  ⚠️ 未找到封面: ${filename}`);
      continue;
    }
    // 把oss URL转换为https
    const httpsUrl = t.url.replace('http://', 'https://');
    const result = await prisma.article.updateMany({
      where: { slug: slug },
      data: { coverImage: httpsUrl }
    });
    console.log(`  ✅ 更新: ${slug} -> ${result.count} 篇`);
    updated += result.count;
  }

  console.log(`\n📊 更新完成: ${updated} 篇`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
