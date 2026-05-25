const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 统计有图片的产品数量
  const productsWithImages = await prisma.product.findMany({
    include: {
      images: {
        orderBy: [{ sortOrder: 'asc' }]
      }
    }
  });

  console.log(`总产品数: ${productsWithImages.length}`);

  let totalImages = 0;
  let primaryCount = 0;
  let productsWithoutPrimary = [];

  for (const product of productsWithImages) {
    totalImages += product.images.length;
    const primary = product.images.find(img => img.isPrimary);
    if (primary) {
      primaryCount++;
    } else {
      productsWithoutPrimary.push({
        id: product.id,
        modelName: product.modelName,
        imageCount: product.images.length,
        firstImage: product.images[0]?.url || 'none'
      });
    }
  }

  console.log(`总图片数: ${totalImages}`);
  console.log(`有主图的产品数: ${primaryCount}`);
  console.log(`无主图的产品数: ${productsWithoutPrimary.length}`);

  if (productsWithoutPrimary.length > 0) {
    console.log('\n无主图的产品列表:');
    productsWithoutPrimary.slice(0, 10).forEach(p => {
      console.log(`  ${p.modelName} (${p.id}): ${p.imageCount} 张图片, 第一张: ${p.firstImage}`);
    });
    if (productsWithoutPrimary.length > 10) {
      console.log(`  ... 还有 ${productsWithoutPrimary.length - 10} 个`);
    }
  }

  // 检查图片命名模式
  const allImages = await prisma.productImage.findMany({
    orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }]
  });

  const namePatterns = {};
  allImages.forEach(img => {
    const url = img.url || '';
    const match = url.match(/\/(\d+)\.(jpg|jpeg|png|webp)$/i);
    const number = match ? match[1] : 'unknown';
    namePatterns[number] = (namePatterns[number] || 0) + 1;
  });

  console.log('\n图片文件名模式统计:');
  Object.keys(namePatterns).sort().forEach(num => {
    console.log(`  以 ${num}.xxx 结尾: ${namePatterns[num]} 张`);
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