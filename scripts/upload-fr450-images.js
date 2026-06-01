/**
 * 上传纽荷兰 FR450 产品图片到 OSS 并更新数据库
 * 
 * 使用: node scripts/upload-fr450-images.js
 * (从 usedfarmmach 项目根目录运行)
 */
const OSS = require("ali-oss");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

// 配置
const PRODUCT_ID = "cmpfohy0n000xkrh5d14tvnqy";
const LOCAL_DIR = "D:\\神雕农机\\网站图片补充0601\\2013年纽荷兰FR450";
const OSS_PREFIX = `uploads/products/${PRODUCT_ID}`;
const OSS_BASE_URL = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";

// OSS 客户端
const client = new OSS({
  region: process.env.OSS_REGION || "oss-cn-beijing",
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET || "usedfarmmach-oss",
  secure: true,
});

// 数据库
const prisma = new PrismaClient();

async function main() {
  // 1. 列出本地文件
  const files = fs.readdirSync(LOCAL_DIR);
  const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
  const videos = files.filter(f => /\.(mp4|mov|avi)$/i.test(f)).sort();

  console.log(`本地文件: ${files.length} 个`);
  console.log(`图片: ${images.length} 个`);
  console.log(`视频: ${videos.length} 个\n`);

  // 2. 上传到 OSS
  console.log("=== 上传到 OSS ===");
  const uploadedUrls = [];

  for (const file of [...images, ...videos]) {
    const localPath = path.join(LOCAL_DIR, file);
    const ossKey = `${OSS_PREFIX}/${file}`;

    try {
      // 检查是否已存在
      try {
        await client.head(ossKey);
        console.log(`  ⏭ ${file} — 已存在，跳过`);
      } catch {
        // 不存在，上传
        const result = await client.put(ossKey, localPath);
        console.log(`  ✅ ${file} — 上传成功`);
      }

      const url = `${OSS_BASE_URL}/${ossKey}`;
      uploadedUrls.push({ file, url, isVideo: videos.includes(file), isCover: file.startsWith("fm") });
    } catch (err) {
      console.error(`  ❌ ${file} — 上传失败: ${err.message}`);
    }
  }

  // 3. 删除旧图片/视频记录
  console.log("\n=== 更新数据库 ===");
  const oldImages = await prisma.productImage.findMany({ where: { productId: PRODUCT_ID } });
  if (oldImages.length > 0) {
    console.log(`删除 ${oldImages.length} 条旧图片记录...`);
    await prisma.productImage.deleteMany({ where: { productId: PRODUCT_ID } });
  }
  const oldVideos = await prisma.productVideo.findMany({ where: { productId: PRODUCT_ID } });
  if (oldVideos.length > 0) {
    console.log(`删除 ${oldVideos.length} 条旧视频记录...`);
    await prisma.productVideo.deleteMany({ where: { productId: PRODUCT_ID } });
  }

  // 4. 创建新图片记录
  const imageUploads = uploadedUrls.filter(u => !u.isVideo);
  for (const u of imageUploads) {
    const isCover = u.isCover;
    await prisma.productImage.create({
      data: {
        productId: PRODUCT_ID,
        url: u.url,
        sortOrder: isCover ? -1 : 0,
        isPrimary: isCover,
      },
    });
    console.log(`  🖼 ${isCover ? "⭐封面" : "  图片"} ${u.file}`);
  }

  // 5. 创建新视频记录
  const videoUploads = uploadedUrls.filter(u => u.isVideo);
  for (const u of videoUploads) {
    await prisma.productVideo.create({
      data: {
        productId: PRODUCT_ID,
        url: u.url,
        sortOrder: 0,
        title: "纽荷兰 FR450 青储机",
      },
    });
    console.log(`  🎬 视频 ${u.file}`);
  }

  // 6. 摘要
  console.log("\n========== 完成 ==========");
  console.log(`产品: 纽荷兰 FR450 (${PRODUCT_ID})`);
  console.log(`上传: ${imageUploads.length} 张图片 + ${videoUploads.length} 个视频`);
  console.log(`封面: ${imageUploads.find(u => u.isCover)?.file || "未设置"}`);
  console.log(`\nOSS 路径: ${OSS_BASE_URL}/${OSS_PREFIX}/`);
}

main()
  .catch((e) => {
    console.error("脚本出错:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
