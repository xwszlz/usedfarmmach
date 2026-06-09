const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const products = await p.product.findMany({
    include: { brand: true, category: true, images: true, videos: true },
    orderBy: [{ brand: { nameEn: 'asc' } }, { year: 'desc' }]
  });

  console.log('TOTAL:', products.length);

  const noImg = products.filter(pr => pr.images.length === 0);
  const noVid = products.filter(pr => !pr.videos || pr.videos.length === 0);
  const both = products.filter(pr => pr.images.length === 0 && (!pr.videos || pr.videos.length === 0));
  const hasImgNoVid = products.filter(pr => pr.images.length > 0 && (!pr.videos || pr.videos.length === 0));

  console.log('NO_IMG:', noImg.length);
  console.log('NO_VID:', noVid.length);
  console.log('BOTH:', both.length);
  console.log('IMG_NO_VID:', hasImgNoVid.length);

  const full = products.map(pr => ({
    id: pr.id.substring(0, 12),
    brandEn: pr.brand?.nameEn || '',
    brandZh: pr.brand?.nameZh || '',
    model: pr.modelName || '',
    year: pr.year,
    cat: pr.category?.nameZh || '',
    price: pr.priceCny || 0,
    img: pr.images.length,
    vid: (pr.videos || []).length,
    loc: pr.location || '',
    condition: pr.condition || '',
    hours: pr.workingHours || 0,
  }));
  console.log('FULL:', JSON.stringify(full));
}

main().catch(console.error).finally(() => p.$disconnect());
