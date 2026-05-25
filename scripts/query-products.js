const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // 查询所有产品，包含品牌和分类信息
    const products = await prisma.product.findMany({
      include: {
        brand: true,
        category: true,
        images: {
          orderBy: { sortOrder: 'asc' }
        },
        videos: {
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`共有 ${products.length} 个产品:`);
    console.log('='.repeat(80));
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ID: ${product.id}`);
      console.log(`   型号: ${product.modelName}`);
      console.log(`   品牌: ${product.brand.nameZh} (${product.brand.nameEn})`);
      console.log(`   分类: ${product.category.nameZh}`);
      console.log(`   年份: ${product.year}, 价格: ${product.priceCny} CNY`);
      console.log(`   图片: ${product.images.length} 张, 视频: ${product.videos.length} 个`);
      console.log(`   状态: ${product.status}`);
      console.log();
    });

    // 列出所有唯一的型号名称
    const uniqueModels = [...new Set(products.map(p => p.modelName))];
    console.log('\n唯一型号列表:');
    console.log(uniqueModels.join(', '));

  } catch (error) {
    console.error('查询错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();