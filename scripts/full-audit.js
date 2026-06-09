const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const products = await p.product.findMany({
    include: { brand: true, category: true, images: true, videos: true },
    orderBy: [{ brand: { nameEn: 'asc' } }, { modelName: 'asc' }]
  });

  // ===================== 完整JSON输出 =====================
  const report = products.map(p => ({
    id: p.id,
    brandEn: p.brand?.nameEn || '',
    brandZh: p.brand?.nameZh || '',
    model: p.modelName || '',
    year: p.year,
    categoryZh: p.category?.nameZh || '',
    priceCny: p.priceCny,
    priceUsd: p.priceUsd,
    condition: p.condition,
    workingHours: p.workingHours,
    images: p.images.length,
    videos: (p.videos || []).length,
    location: p.location || '',
    hasLocalMedia: false
  }));

  console.log(JSON.stringify(report));
}

main().catch(console.error).finally(() => p.$disconnect());
