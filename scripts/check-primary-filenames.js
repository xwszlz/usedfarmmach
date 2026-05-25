const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 获取所有有图片的产品
  const products = await prisma.product.findMany({
    include: {
      images: {
        orderBy: [{ sortOrder: 'asc' }]
      }
    },
    where: {
      images: { some: {} }
    }
  });

  console.log(`有图片的产品数: ${products.length}`);

  let primaryIsFirstCount = 0;
  let primaryNotFirstCount = 0;
  let noPrimaryCount = 0;

  for (const product of products) {
    const primary = product.images.find(img => img.isPrimary);
    const first = product.images[0];
    
    if (!primary) {
      noPrimaryCount++;
      console.log(`  产品 ${product.modelName} (${product.id}) 无主图`);
    } else {
      if (primary.id === first.id) {
        primaryIsFirstCount++;
      } else {
        primaryNotFirstCount++;
        console.log(`  产品 ${product.modelName} (${product.id}) 主图不是第一张`);
        console.log(`    主图: ${primary.url}, sortOrder: ${primary.sortOrder}, isPrimary: ${primary.isPrimary}`);
        console.log(`    第一张: ${first.url}, sortOrder: ${first.sortOrder}, isPrimary: ${first.isPrimary}`);
      }
    }
  }

  console.log(`\n统计:`);
  console.log(`  主图是第一张: ${primaryIsFirstCount}`);
  console.log(`  主图不是第一张: ${primaryNotFirstCount}`);
  console.log(`  无主图: ${noPrimaryCount}`);

  // 检查主图文件名模式
  const primaryImages = await prisma.productImage.findMany({
    where: { isPrimary: true }
  });

  const patternCount = {};
  primaryImages.forEach(img => {
    const url = img.url || '';
    const match = url.match(/\/(\d+)\.(jpg|jpeg|png|webp)$/i);
    const number = match ? match[1] : 'unknown';
    patternCount[number] = (patternCount[number] || 0) + 1;
  });

  console.log('\n主图文件名数字分布:');
  Object.keys(patternCount).sort().forEach(num => {
    console.log(`  数字 ${num}: ${patternCount[num]} 张`);
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });