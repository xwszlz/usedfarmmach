/**
 * 导入产品视频到网站
 * 数据源：出口农机/ 文件夹中的 .mp4 文件
 * 
 * 执行：tsx scripts/import-videos.ts
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const IMAGE_BASE = "D:/神雕农机/出口农机";
const PUBLIC_UPLOADS = "D:/神雕农机/usedfarmmach/public/uploads/products";

// folderName → productId 映射（从已导入的产品数据中提取）
const FOLDER_TO_PRODUCT: Record<string, string> = {
  "24年克拉斯860": "cmpdknii2000111kwcau06hey",
  "21年克拉斯970": "cmpdknimn000n11kwnxfuiuzv",
  "18年的克拉斯850青储机": "cmpdkniqf001911kwfr365zqq",
  "2016克拉斯 980": "cmpdknitp001v11kwskpdqx6s",
  "2015克拉斯青储机980": "cmpdknix7002h11kwupfm486g",
  "2003年克拉斯900": "cmpdknj0s003311kwvcfjwoia",
  "克拉斯    695": "cmpdknj4r003p11kwhsbejbh0",
  "2013迪尔青储机7250": "cmpdknj9v004b11kwqvki68wr",
  "2009纽荷兰青储机9080": "cmpdknjh6004x11kwkz5gvrbo",
  "2014纽荷兰青储机FR500（9040）": "cmpdknjlk005j11kwdeashk68",
  "18克罗尼600": "cmpdknjoo006511kwo96n6rh5",
  "克罗尼青储机700": "cmpdknjou006711kwwrsm5ypx",
  "2016芬特青储机": "cmpdknjsb006t11kwx8sjwfl5",
  "克拉斯950": "cmpdknk0w007f11kwdljgy0fq",
  "2022克拉斯打捆机5300RC大方捆": "cmpdknk4s008111kw3zr8aimf",
  "2020年克拉斯5300": "cmpdknk7n008n11kwssps4ivh",
  "2014年克罗尼1290": "cmpdknkb2009911kwv7u98vpe",
  "14年克罗尼 cf155xc圆捆打包缠膜机": "cmpdknkif009v11kw0dcmfq5q",
  "2025盈嘉圆捆打捆机": "cmpdknklh00ah11kwozy0g48e",
  "2019奥库DENS-X裹包机": "cmpdknkog00b311kwql4ortgt",
  "凯斯割草机": "cmpdknks300bp11kwp1c7z4cg",
  "迈科农机搂草机": "cmpdknkuz00cb11kwexyt0dbp",
  "克拉斯3300rc": "cmpdknle000fd11kwwfbic4p8",
  "2007克罗尼青储机500": "cmpdknlgv00fz11kwlmz8l0uw",
  // 以下产品也出现在出口农机文件夹中，但没有单独的folder（或图片文件夹名不同）
  "2009纽荷兰9080": "cmpdknjh6004x11kwkz5gvrbo", // 同上
  "2017欧版克拉斯970": "cmpdknimn000n11kwnxfuiuzv", // 同上
  "2018克拉斯青储机850": "cmpdkniqf001911kwfr365zqq", // 同上
  "2022全新牧神双收": "cmpdknl6n00dj11kwogl5io6x",
  "东洋甜菜机": "cmpdknl8s00e511kwiy4tzjax",
  "马赛甜菜收获机": "cmpdknlaz00er11kwncetd63g",
  "2017年Kongskilde 康斯捡拾机": "cmpdknkuz00cb11kwexyt0dbp", // 捡拾台/捡石机?
};

async function main() {
  console.log("🎬 开始导入产品视频...\n");

  // 先清除旧视频数据
  const deleted = await prisma.productVideo.deleteMany({});
  console.log(`  清除旧视频记录: ${deleted.count} 条\n`);

  let imported = 0;
  let skipped = 0;

  // 扫描出口农机目录
  const folders = fs.readdirSync(IMAGE_BASE);
  
  for (const folder of folders) {
    const folderPath = path.join(IMAGE_BASE, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    // 查找mp4文件
    const files = fs.readdirSync(folderPath);
    const mp4Files = files.filter(f => f.toLowerCase().endsWith(".mp4"));
    
    if (mp4Files.length === 0) continue;

    // 查找对应的产品ID
    const productId = FOLDER_TO_PRODUCT[folder];
    if (!productId) {
      console.log(`  ⚠️ 跳过(无产品映射): ${folder} (${mp4Files.length}个视频)`);
      skipped++;
      continue;
    }

    // 验证产品存在
    const product = await prisma.product.findUnique({ 
      where: { id: productId },
      include: { brand: true } 
    });
    if (!product) {
      console.log(`  ⚠️ 跳过(产品不存在): ${folder} → ${productId}`);
      skipped++;
      continue;
    }

    // 确保目标目录存在
    const targetDir = path.join(PUBLIC_UPLOADS, productId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 复制视频文件并创建数据库记录
    for (let i = 0; i < mp4Files.length; i++) {
      const mp4File = mp4Files[i];
      const srcPath = path.join(folderPath, mp4File);
      
      // 统一视频文件名: video_1.mp4, video_2.mp4
      const destName = `video_${i + 1}.mp4`;
      const destPath = path.join(targetDir, destName);
      
      // 复制文件
      fs.copyFileSync(srcPath, destPath);
      
      // 数据库URL路径
      const url = `/uploads/products/${productId}/${destName}`;
      
      // 创建ProductVideo记录
      await prisma.productVideo.create({
        data: {
          productId,
          url,
          sortOrder: i,
          title: `${product.brand.nameEn} ${product.modelName} - Video ${i + 1}`,
        },
      });
    }

    console.log(`  ✅ ${product.brand.nameEn} ${product.modelName}: ${mp4Files.length}个视频已导入`);
    imported += mp4Files.length;
  }

  console.log(`\n🎬 导入完成！`);
  console.log(`   导入: ${imported} 个视频`);
  console.log(`   跳过: ${skipped} 个文件夹`);
  
  // 统计有视频的产品数
  const productsWithVideo = await prisma.product.findMany({
    where: { videos: { some: {} } },
    select: { id: true, modelName: true, brand: { select: { nameEn: true } }, _count: { select: { videos: true } } },
  });
  console.log(`\n   有视频的产品: ${productsWithVideo.length} 个`);
  for (const p of productsWithVideo) {
    console.log(`   - ${p.brand.nameEn} ${p.modelName}: ${p._count.videos}个视频`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
