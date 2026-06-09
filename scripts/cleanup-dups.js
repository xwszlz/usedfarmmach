const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const DELETE_IDS = [
  // === 12条垃圾数据 ===
  'cmpzm1ngd', // Other 无 2020
  'cmpzm1oeb', // Other 无 2020
  'cmpzm1mvk', // Other 无 2020
  'cmpzm1n3e', // Other 无 2023
  'cmpzm1pqn', // Other (空) 2020
  'cmpzm1n0q', // 奥贝斯 无 2020
  'cmpzm1my5', // 奥贝斯 无 2020
  'cmpzm1nob', // IDASS 无 2020
  'cmpzm1nlj', // IDASS 无 2020
  'cmpzm1n61', // 冠军 无 2020
  'cmpzm1oml', // 凯斯 (空) 2020
  'cmpzm1p5k', // 明宇 (空) 2020
  // === 7条重复项 ===
  'cmq4pripj', // CLAAS 970 2021 (价格0)
  'cmq4prhqp', // CLAAS 980 2016 (价格0)
  'cmpdknjoo', // Krone 600 2018 (价格0)
  'cmq4pri3t', // Krone 600 2018 (价格0)
  'cmq4z0mcq', // Orkel DENS-X 2020 (价格0)
  'cmpzm1ozz', // Orkel DENS-X 2020 (价格0)
  'cmpzm1o95', // 迪马战狼 4Y2-4CJ1 2020
];

async function main() {
  console.log('=== 清理开始 ===\n');

  for (const shortId of DELETE_IDS) {
    // 查找完整ID
    const product = await p.product.findFirst({
      where: { id: { startsWith: shortId } },
      include: { images: true, videos: true }
    });

    if (!product) {
      console.log(`❌ 未找到: ${shortId}`);
      continue;
    }

    const fullId = product.id;
    const imgCount = product.images.length;
    const vidCount = (product.videos || []).length;

    // 先删关联的图片和视频
    if (imgCount > 0) await p.productImage.deleteMany({ where: { productId: fullId } });
    if (vidCount > 0) await p.productVideo.deleteMany({ where: { productId: fullId } });

    // 删产品
    await p.product.delete({ where: { id: fullId } });
    console.log(`✅ 已删: ${shortId} | ${product.brand?.nameEn||product.brand?.nameZh} ${product.modelName} (${product.year}) | 图:${imgCount} 视频:${vidCount}`);
  }

  const remaining = await p.product.count();
  console.log(`\n=== 清理完成 ===`);
  console.log(`删除: ${DELETE_IDS.length} 条`);
  console.log(`剩余: ${remaining} 台`);
}

main().catch(console.error).finally(() => p.$disconnect());
