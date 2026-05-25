// 修复三个关键产品的封面图设置
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPrimaryImages() {
  try {
    const productsToFix = [
      { id: 'cmpdknkog00b311kwql4ortgt', name: 'Orkel DENS-X' },
      { id: 'cmpfohy2g001dkrh55093csbq', name: '库恩 890大方捆' },
      { id: 'cmpfohxx30001krh5pv5bx5yc', name: '克罗尼 1270XC' }
    ];

    console.log('🔧 修复产品封面图设置\n');

    for (const product of productsToFix) {
      // 1. 检查当前是否有封面图
      const currentPrimary = await prisma.productImage.findFirst({
        where: { 
          productId: product.id,
          isPrimary: true 
        }
      });

      if (currentPrimary) {
        console.log(`✅ ${product.name} 已有封面图: ${currentPrimary.url}`);
        continue;
      }

      // 2. 查找该产品的第一张图片（按sortOrder排序）
      const firstImage = await prisma.productImage.findFirst({
        where: { productId: product.id },
        orderBy: { sortOrder: 'asc' }
      });

      if (!firstImage) {
        console.log(`⚠️ ${product.name} 无图片可设为封面图`);
        continue;
      }

      // 3. 设置第一张图片为封面图
      await prisma.productImage.update({
        where: { id: firstImage.id },
        data: { isPrimary: true }
      });

      console.log(`✅ ${product.name} 封面图已设置: ${firstImage.url} (sortOrder: ${firstImage.sortOrder})`);
    }

    // 4. 验证修复结果
    console.log('\n📊 修复后验证:');
    
    for (const product of productsToFix) {
      const [imageCount, primaryImage] = await Promise.all([
        prisma.productImage.count({ where: { productId: product.id } }),
        prisma.productImage.findFirst({ 
          where: { 
            productId: product.id,
            isPrimary: true 
          }
        })
      ]);

      console.log(`   ${product.name}:`);
      console.log(`     图片总数: ${imageCount}`);
      console.log(`     封面图: ${primaryImage ? primaryImage.url : '❌ 未设置'}`);
    }

    console.log('\n🎯 封面图修复完成！');

  } catch (error) {
    console.error('❌ 修复失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixPrimaryImages();