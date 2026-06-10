const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 克拉斯 3300rc -> 11万
  const claas3300 = await p.product.findFirst({
    where: { priceCny: 0, modelName: { contains: '3300', mode: 'insensitive' } }
  });
  if (claas3300) {
    await p.product.update({ where: { id: claas3300.id }, data: { priceCny: 110000, priceUsd: 15278 } });
    console.log('克拉斯 3300rc -> 110000');
  }

  // 牧农 SDCML -> 参考牧农其他定价10万
  const munong = await p.product.findFirst({
    where: { priceCny: 0, modelName: { contains: 'SDCML' } },
    include: { brand: true }
  });
  if (munong) {
    await p.product.update({ where: { id: munong.id }, data: { priceCny: 100000, priceUsd: 13889 } });
    console.log('牧农 SDCML -> 100000 (参考牧农其他)');
  }

  // 克拉斯 950: xlsx标注抵押，保持0
  console.log('克拉斯 950: 抵押不出售，保持0');

  const total = await p.product.count();
  const all = await p.product.findMany({ include: { brand: true, images: true, videos: true } });
  const priced = all.filter(p => p.priceCny && p.priceCny > 0);
  const zero = all.filter(p => !p.priceCny || p.priceCny === 0);
  const withImg = all.filter(p => p.images.length > 0);
  const withVid = all.filter(p => p.videos && p.videos.length > 0);

  console.log('\n=== 最终状态 ===');
  console.log('总产品:', total, '台');
  console.log('有定价:', priced.length, '台');
  console.log('有图:', withImg.length, '(' + Math.round(withImg.length/total*100) + '%)');
  console.log('有视频:', withVid.length, '(' + Math.round(withVid.length/total*100) + '%)');
  
  if (zero.length > 0) {
    console.log('\n仍¥0:');
    zero.forEach(p => console.log('  ' + (p.brand?.nameZh||p.brand?.nameEn) + ' ' + p.modelName + ' (' + p.year + ') 图:' + p.images.length));
  }
  
  // 品类分布
  const cats = {};
  all.forEach(pr => {
    const c = pr.category?.nameZh || '??';
    cats[c] = (cats[c]||0) + 1;
  });
  console.log('\n品类分布:');
  Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v + '台'));
}

main().catch(console.error).finally(function() { p.$disconnect(); });
