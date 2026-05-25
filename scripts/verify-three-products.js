// 验证三个关键产品的图片和视频关联情况
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyProducts() {
  try {
    const productIds = [
      { id: 'cmpdknkog00b311kwql4ortgt', name: 'Orkel DENS-X' },
      { id: 'cmpfohy2g001dkrh55093csbq', name: '库恩 890大方捆' },
      { id: 'cmpfohxx30001krh5pv5bx5yc', name: '克罗尼 1270XC' }
    ];

    console.log('📊 验证三个关键产品媒体文件关联情况\n');

    for (const product of productIds) {
      const [images, videos] = await Promise.all([
        prisma.productImage.count({ where: { productId: product.id } }),
        prisma.productVideo.count({ where: { productId: product.id } })
      ]);

      const productInfo = await prisma.product.findUnique({
        where: { id: product.id },
        include: {
          brand: true,
          category: true
        }
      });

      console.log(`✅ ${product.name} (ID: ${product.id})`);
      console.log(`   型号: ${productInfo?.modelName || '未知'}`);
      console.log(`   品牌: ${productInfo?.brand?.nameZh || '未知'}`);
      console.log(`   品类: ${productInfo?.category?.nameZh || '未知'}`);
      console.log(`   图片数量: ${images} 张`);
      console.log(`   视频数量: ${videos} 个`);
      
      // 检查是否有主图
      const primaryImage = await prisma.productImage.findFirst({
        where: { productId: product.id, isPrimary: true }
      });
      
      if (primaryImage) {
        console.log(`   封面图: ${primaryImage.url}`);
      } else {
        console.log(`   ⚠️ 警告: 无封面图设置`);
      }
      
      console.log('---\n');
    }

    // 检查最新上传的几张图片
    console.log('📸 最近上传的图片示例:');
    const recentImages = await prisma.productImage.findMany({
      take: 5,
      orderBy: { id: 'desc' },
      include: {
        product: {
          include: {
            brand: true
          }
        }
      }
    });

    recentImages.forEach((img, index) => {
      console.log(`   ${index + 1}. ${img.product?.brand?.nameZh || '未知'} - ${img.url}`);
    });

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyProducts();