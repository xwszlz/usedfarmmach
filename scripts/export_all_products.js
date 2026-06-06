const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function main() {
  const products = await p.product.findMany({
    select: {
      id: true,
      modelName: true,
      year: true,
      workingHours: true,
      priceCny: true,
      location: true,
      condition: true,
      brand: { select: { nameZh: true, nameEn: true } },
      category: { select: { nameZh: true, nameEn: true } },
      images: { select: { id: true, url: true, isPrimary: true }, orderBy: { sortOrder: 'asc' } },
      videos: { select: { id: true, url: true } },
      descriptionZh: true,
    },
    orderBy: [{ brand: { nameZh: 'asc' } }, { modelName: 'asc' }],
  });

  const output = products.map(p => ({
    id: p.id,
    brand: p.brand?.nameZh || p.brand?.nameEn || '?',
    model: p.modelName || '',
    category: p.category?.nameZh || p.category?.nameEn || '?',
    year: p.year || '',
    hours: p.workingHours || '',
    price: p.priceCny || 0,
    location: p.location || '',
    condition: p.condition || '',
    imageCount: p.images.length,
    videoCount: p.videos.length,
    hasPrimary: p.images.some(i => i.isPrimary),
    descLen: p.descriptionZh?.length || 0,
  }));

  fs.writeFileSync('D:/神雕农机/scripts/products_export.json', JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✅ 导出完毕，共 ${output.length} 条产品`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); }).finally(() => p.$disconnect());
