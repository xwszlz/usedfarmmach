const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const total = await p.product.count();
  const noImages = await p.product.count({
    where: { images: { none: {} } }
  });

  // 查型号为"其他"或空字符串的产品
  const junk = await p.product.findMany({
    where: {
      OR: [
        { modelName: '' },
        { modelName: '其他' }
      ]
    },
    select: {
      id: true, modelName: true,
      brand: { select: { nameZh: true } },
      category: { select: { nameZh: true } },
      priceCny: true,
      _count: { select: { images: true } }
    }
  });

  console.log(`总产品数: ${total}`);
  console.log(`无图片: ${noImages}`);
  console.log(`型号为空/"其他": ${junk.length}`);

  if (junk.length > 0) {
    console.log('\n=== 待清理产品列表 ===');
    junk.forEach(pr => {
      console.log(`[${pr.id}] ${pr.brand?.nameZh || '?'} ${pr.modelName || '(空)'} | ${pr.category?.nameZh || '?'} | ¥${pr.priceCny || 0} | 图:${pr._count.images}`);
    });
  } else {
    console.log('\n✅ 没有型号为空或"其他"的垃圾数据了');
  }

  // 顺便查一下无图片的产品（取前20个）
  const noImgProducts = await p.product.findMany({
    where: { images: { none: {} } },
    take: 20,
    select: {
      id: true, modelName: true,
      brand: { select: { nameZh: true } },
      category: { select: { nameZh: true } },
      priceCny: true,
      location: true
    }
  });

  console.log(`\n=== 无图片产品（前20个） ===`);
  noImgProducts.forEach(pr => {
    console.log(`[${pr.id}] ${pr.brand?.nameZh || '?'} ${pr.modelName} | ${pr.category?.nameZh || '?'} | ¥${pr.priceCny || 0} | ${pr.location || ''}`);
  });
}

main()
  .catch(e => { console.error('❌ 错误:', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
