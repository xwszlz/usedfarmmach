/**
 * 更新产品图片数据库记录
 * 将OSS上已上传的图片绑定到对应的产品
 * 
 * 用法: node scripts/update-product-images.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OSS_BASE = 'https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com';

// 匹配的产品: 文件夹名 → 产品ID
const MAPPING = {
  '2009年的纽荷兰9080青储机': 'cmpdknjh6004x11kwkz5gvrbo',
  '2012年纽荷兰FR9040青储机': 'cmpfohy160011krh5odxnh6l5',
  '迪尔拖拉机': 'cmpfohxzd000lkrh5fiowud3v',
};

async function main() {
  let totalCreated = 0;

  for (const [folder, productId] of Object.entries(MAPPING)) {
    console.log(`\n=== ${folder} ===`);

    // 检查产品是否存在
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      console.log(`  产品${productId}不存在，跳过`);
      continue;
    }
    console.log(`  产品: ${product.modelName}`);

    // 删除旧图片
    const oldImages = await prisma.productImage.findMany({ where: { productId } });
    if (oldImages.length > 0) {
      await prisma.productImage.deleteMany({ where: { productId } });
      console.log(`  已删除${oldImages.length}张旧图片`);
    }

    // 添加图片记录
    const imageFiles = [
      'images/微信图片_20260523140618_76_325.jpg',
      'images/微信图片_20260523140619_77_325.jpg',
      'images/微信图片_20260523140621_79_325.jpg',
      'images/微信图片_20260523140622_80_325.jpg',
      'images/微信图片_20260523140623_81_325.jpg',
      'images/微信图片_20260523140624_82_325.jpg',
    ];

    // 只使用实际存在的OSS文件
    const fs = require('fs');
    const localFolder = `D:\\神雕农机\\出口农机0605\\${folder}`;
    let actualFiles = [];
    if (fs.existsSync(localFolder)) {
      actualFiles = fs.readdirSync(localFolder)
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f) && !f.startsWith('thumb'))
        .sort();
    }

    for (let i = 0; i < actualFiles.length && i < 10; i++) {
      const fname = actualFiles[i];
      const ext = fname.split('.').pop().toLowerCase();
      const isVideo = ['mp4', 'mov', 'avi'].includes(ext);
      const subDir = isVideo ? 'videos' : 'images';
      const url = `/uploads/products/${productId}/${subDir}/${fname}`;

      await prisma.productImage.create({
        data: {
          productId,
          url,
          sortOrder: i,
          isPrimary: i === 0,
        },
      });
      totalCreated++;
      console.log(`  ${i === 0 ? '⭐封面' : '   '} ${fname.substring(0, 30)}`);
    }
  }

  console.log(`\n总共创建${totalCreated}条图片记录`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
