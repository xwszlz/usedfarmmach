const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const ids = [
    'cmpzzm1mpz0006yylp9julbyd9',
    'cmpzzm1nb9000myllp74yzzwgb',
    'cmpzzm1pys002byyllpdt74cfgh',
    'cmpzzm1q4e0002eyl1pl5jfcos4'
  ];

  // 先查一下要删除的产品，让用户确认
  const products = await p.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, modelName: true, brand: { select: { nameZh: true } }, category: { select: { nameZh: true } }, priceCny: true }
  });

  console.log('=== 待删除产品列表 ===');
  products.forEach(pr => {
    console.log(`[${pr.id}] ${pr.brand?.nameZh || '?'} ${pr.modelName} | ${pr.category?.nameZh || '?'} | ¥${pr.priceCny || 0}`);
  });
  console.log(`\n共 ${products.length} 条，确认删除...`);

  const result = await p.product.deleteMany({
    where: { id: { in: ids } }
  });

  console.log(`\n✅ 成功删除 ${result.count} 条记录`);
}

main()
  .catch(e => { console.error('❌ 错误:', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
