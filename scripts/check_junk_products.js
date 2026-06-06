const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 查"其他"类别的所有产品
  const others = await p.product.findMany({
    where: { category: { nameZh: '其他' } },
    select: {
      id: true,
      modelName: true,
      brand: { select: { nameZh: true } },
      category: { select: { nameZh: true } },
      priceCny: true,
      location: true,
      _count: { select: { images: true, videos: true } }
    }
  });

  console.log('=== 当前"其他"类别产品 ===');
  others.forEach(pr => {
    console.log(`[${pr.id}] ${pr.brand?.nameZh || '?'} ${pr.modelName || '(无型号)'} | ¥${pr.priceCny || 0} | 图:${pr._count.images} 视频:${pr._count.videos} | ${pr.location || '无地区'}`);
  });
  console.log(`\n共 ${others.length} 条`);
}

main()
  .catch(e => { console.error('❌ 错误:', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
