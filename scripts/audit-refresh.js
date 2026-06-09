const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const products = await p.product.findMany({
    include: { brand: true, category: true, images: true, videos: true },
    orderBy: [{ brand: { nameEn: 'asc' } }, { year: 'desc' }]
  });

  console.log('TOTAL:', products.length);

  const noImg = products.filter(pr => pr.images.length === 0);
  console.log('NO_IMG:', noImg.length);
  for (const pr of noImg) {
    console.log('NOIMG|' + pr.id + '|' + (pr.brand?.nameEn||'') + '|' + (pr.brand?.nameZh||'') + '|' + pr.modelName + '|' + pr.year + '|' + (pr.category?.nameZh||'') + '|' + (pr.priceCny||0));
  }

  const noVid = products.filter(pr => !pr.videos || pr.videos.length === 0);
  console.log('NO_VID:', noVid.length);
  for (const pr of noVid) {
    console.log('NOVID|' + pr.id + '|' + (pr.brand?.nameEn||'') + '|' + (pr.brand?.nameZh||'') + '|' + pr.modelName + '|' + pr.year + '|' + pr.images.length);
  }

  const brands = {};
  products.forEach(pr => {
    const b = pr.brand?.nameEn || pr.brand?.nameZh || '??';
    if (!brands[b]) brands[b] = { count: 0, withImg: 0, withVid: 0 };
    brands[b].count++;
    if (pr.images.length > 0) brands[b].withImg++;
    if (pr.videos && pr.videos.length > 0) brands[b].withVid++;
  });
  console.log('BRANDS_JSON:', JSON.stringify(brands));

  const cats = {};
  products.forEach(pr => {
    const c = pr.category?.nameZh || '??';
    if (!cats[c]) cats[c] = { count: 0, withImg: 0, withVid: 0 };
    cats[c].count++;
    if (pr.images.length > 0) cats[c].withImg++;
    if (pr.videos && pr.videos.length > 0) cats[c].withVid++;
  });
  console.log('CATS_JSON:', JSON.stringify(cats));

  const full = products.map(pr => ({
    id: pr.id.substring(0,12),
    brandEn: pr.brand?.nameEn||'',
    brandZh: pr.brand?.nameZh||'',
    model: pr.modelName||'',
    year: pr.year,
    cat: pr.category?.nameZh||'',
    price: pr.priceCny||0,
    usd: pr.priceUsd||0,
    img: pr.images.length,
    vid: (pr.videos||[]).length,
    loc: pr.location||'',
    condition: pr.condition||'',
  }));
  console.log('FULL:', JSON.stringify(full));
}

main().catch(console.error).finally(() => p.$disconnect());
