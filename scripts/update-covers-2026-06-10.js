const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updates = [
  {
    slug: 'global-forage-harvester-market-analysis-2026-06-10-v2',
    coverImage: 'https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/images/covers/2026-06-10_global-forage-harvester-market-analysis-2026-06-10.png'
  },
  {
    slug: 'claas-jaguar-price-guide-2026-06-10-v2',
    coverImage: 'https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/images/covers/2026-06-10_claas-jaguar-price-guide-2026-06-10.png'
  },
  {
    slug: 'claas-brand-review-2026-06-10-v2',
    coverImage: 'https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/images/covers/2026-06-10_claas-brand-review-2026-06-10.png'
  }
];

async function main() {
  console.log('开始更新文章封面图...');
  
  for (const { slug, coverImage } of updates) {
    try {
      const article = await prisma.article.updateMany({
        where: { slug },
        data: { coverImage }
      });
      
      if (article.count > 0) {
        console.log(`✅ 更新成功: ${slug}`);
        console.log(`   URL: ${coverImage}`);
      } else {
        console.log(`⚠️  未找到文章: ${slug}`);
      }
    } catch (e) {
      console.log(`❌ 更新失败: ${slug} - ${e.message}`);
    }
  }
  
  console.log('\n更新完成！');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
