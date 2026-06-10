// 根据xlsx建议价格填充14台待定价产品
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// xlsx建议价格（万元 → 元）
const priceMap = {
  // 克拉斯 3300RC → 11万
  'CLAAS|3300RC': 110000,
  // 克罗尼 500 → 28万
  'Krone|500': 280000,
  // 迈科农机 9GL-950 → 14万
  'Maike|9GL-950': 140000,
  // 纽荷兰 870 → 16万
  'New Holland|870': 160000,
  // 纽荷兰 2003FX50 → 11万
  'New Holland|2003FX50': 110000,
  // 奥库 2000 → 59万
  'Orkel|2000': 590000,
  // 东洋 甜菜机 → 10万（一套）
  'Toyonoki|甜菜机': 100000,
  // 华夏 1804拖拉机 → 5万
  '华夏|1804拖拉机': 50000,
  // 艾美特 AMTY → 15万（一套）
  '艾美特|AMTY': 150000,
  // 进口/克拉斯 850 → 36万
  '进口|850': 360000,
};

async function main() {
  const products = await p.product.findMany({
    include: { brand: true, images: true, videos: true },
    orderBy: [{ brand: { nameEn: 'asc' } }, { year: 'desc' }]
  });

  console.log('=== 当前数据库状态 ===');
  console.log('总产品:', products.length);
  
  const withImg = products.filter(p => p.images.length > 0).length;
  const withVid = products.filter(p => p.videos && p.videos.length > 0).length;
  console.log('有图:', withImg, '(' + Math.round(withImg / products.length * 100) + '%)');
  console.log('有视频:', withVid, '(' + Math.round(withVid / products.length * 100) + '%)');

  const zeroPrice = products.filter(p => !p.priceCny || p.priceCny === 0);
  console.log('待定价(¥0):', zeroPrice.length, '台');
  
  console.log('\n--- 待定价产品 ---');
  zeroPrice.forEach(p => {
    console.log('ID:' + p.id + ' | ' + (p.brand?.nameZh || p.brand?.nameEn) + ' ' + p.modelName + ' (' + p.year + ') 图:' + p.images.length + ' 位置:' + (p.location || '?'));
  });

  // 填充价格
  console.log('\n=== 开始填充价格 ===');
  let filled = 0;
  
  for (const [key, price] of Object.entries(priceMap)) {
    const [brandHint, modelHint] = key.split('|');
    
    // 在待定价产品中查找匹配
    for (const prod of zeroPrice) {
      const brandEn = (prod.brand?.nameEn || '').toLowerCase();
      const brandZh = (prod.brand?.nameZh || '').toLowerCase();
      const brandMatch = brandEn.includes(brandHint.toLowerCase()) || brandZh.includes(brandHint.toLowerCase());
      const modelMatch = (prod.modelName || '').includes(modelHint);
      
      if (brandMatch && modelMatch) {
        await p.product.update({
          where: { id: prod.id },
          data: { priceCny: price, priceUsd: Math.round(price / 7.2) }
        });
        console.log('✅', (prod.brand?.nameZh || prod.brand?.nameEn), prod.modelName, '(' + prod.year + ') → ¥' + price.toLocaleString());
        filled++;
        break;
      }
    }
  }
  
  // 最终统计
  const final = await p.product.findMany({
    include: { brand: true, images: true, videos: true }
  });
  const stillZero = final.filter(p => !p.priceCny || p.priceCny === 0);
  
  console.log('\n=== 填充完成 ===');
  console.log('已填充:', filled, '台');
  console.log('总产品:', final.length, '台');
  console.log('有定价:', final.filter(p => p.priceCny && p.priceCny > 0).length, '台');
  console.log('仍待定价:', stillZero.length, '台');
  
  if (stillZero.length > 0) {
    console.log('\n仍待定价产品:');
    stillZero.forEach(p => {
      console.log('  ' + (p.brand?.nameZh || p.brand?.nameEn) + ' ' + p.modelName + ' (' + p.year + ')');
    });
  }
  
  // 品牌分布
  const brands = {};
  final.forEach(pr => {
    const b = pr.brand?.nameZh || pr.brand?.nameEn || '??';
    brands[b] = (brands[b] || 0) + 1;
  });
  console.log('\n品牌分布:');
  Object.entries(brands).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k + ': ' + v + '台'));
}

main().catch(console.error).finally(() => p.$disconnect());
