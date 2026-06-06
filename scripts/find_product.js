const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 查法兰信品牌的产品
  const products = await p.product.findMany({
    where: {
      OR: [
        { brand: { nameZh: { contains: '法兰信' } } },
        { brand: { nameEn: { contains: '法兰' } } },
        { modelName: { contains: '法兰信' } },
        { modelName: { contains: '夹包' } },
      ]
    },
    select: {
      id: true, modelName: true,
      brand: { select: { nameZh: true, nameEn: true } },
      category: { select: { nameZh: true } },
      year: true,
      _count: { select: { images: true, videos: true } }
    }
  });

  console.log('=== 法兰信/夹包机相关产品 ===');
  if (products.length === 0) {
    console.log('未找到匹配产品，查所有产品...');
    const all = await p.product.findMany({
      select: { id: true, modelName: true, brand: { select: { nameZh: true } }, category: { select: { nameZh: true } } },
      take: 20
    });
    all.forEach(pr => {
      console.log(`[${pr.id}] ${pr.brand?.nameZh || '?'} ${pr.modelName} | ${pr.category?.nameZh || '?'}`);
    });
  } else {
    products.forEach(pr => {
      console.log(`[${pr.id}] ${pr.brand?.nameZh || '?'} ${pr.modelName} | ${pr.category?.nameZh || '?'} | ${pr.year || '?'}年 | 图:${pr._count.images} 视频:${pr._count.videos}`);
    });
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); }).finally(() => p.$disconnect());
