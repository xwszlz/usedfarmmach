const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.product.count();
  
  const withImages = await prisma.product.findMany({
    include: { images: true }
  });
  const withImgs = withImages.filter(p => p.images.length > 0).length;
  
  const withVideos = await prisma.product.findMany({
    include: { videos: true }
  });
  const withVids = withVideos.filter(p => p.videos && p.videos.length > 0).length;
  
  console.log('总产品数:', total);
  console.log('有图片的产品:', withImgs);
  console.log('有视频的产品:', withVids);
  console.log('图片覆盖率:', Math.round(withImgs/total*100) + '%');
  console.log('视频覆盖率:', Math.round(withVids/total*100) + '%');
  
  // 列出没有图片的产品
  const noImages = withImages.filter(p => p.images.length === 0);
  console.log('\n没有图片的产品 (' + noImages.length + '台):');
  noImages.forEach(p => {
    console.log(`  - ID: ${p.id}, 名称: ${p.modelName}, 品牌: ${p.brandId}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
