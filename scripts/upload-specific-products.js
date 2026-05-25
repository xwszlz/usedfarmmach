/**
 * 上传特定产品的新资料到OSS
 * 只处理明确匹配的产品
 */

const OSS = require("ali-oss");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// OSS配置
const ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || "OSS_ACCESS_KEY_ID_PLACEHOLDER";
const ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || "OSS_ACCESS_KEY_SECRET_PLACEHOLDER";
const BUCKET = process.env.OSS_BUCKET || "usedfarmmach-oss";
const REGION = process.env.OSS_REGION || "oss-cn-beijing";

// 源目录
const SOURCE_BASE = path.join(__dirname, "..", "..", "产品资料", "新建文件夹");
// 目标目录
const TARGET_BASE = path.join(__dirname, "..", "public", "uploads", "products");

// 明确匹配的产品映射
const PRODUCT_MAPPINGS = [
  {
    folder: "奥库DENS-X",
    productId: "cmpdknkog00b311kwql4ortgt",
    brand: "奥库",
    model: "DENS-X"
  },
  {
    folder: "迪尔7250", 
    productId: "cmpdknj9v004b11kwqvki68wr",
    brand: "约翰迪尔",
    model: "7250"
  }
];

async function main() {
  console.log("🚀 开始上传新产品资料到OSS");
  console.log("=".repeat(80));
  
  // 检查源目录
  if (!fs.existsSync(SOURCE_BASE)) {
    console.error(`❌ 源目录不存在: ${SOURCE_BASE}`);
    process.exit(1);
  }
  
  // 初始化OSS客户端
  const ossClient = new OSS({
    region: REGION,
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
    bucket: BUCKET,
    secure: true,
  });
  
  console.log(`☁️  OSS配置: bucket=${BUCKET}, region=${REGION}\n`);
  
  // 处理每个映射
  for (const mapping of PRODUCT_MAPPINGS) {
    await processProductMapping(mapping, ossClient);
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ 处理完成!");
  console.log("=".repeat(80));
  
  await prisma.$disconnect();
}

async function processProductMapping(mapping, ossClient) {
  const { folder, productId, brand, model } = mapping;
  
  console.log(`📁 处理: ${folder}`);
  console.log(`  产品: ${brand} ${model} (ID: ${productId})`);
  console.log("-".repeat(60));
  
  // 检查源文件夹
  const sourceFolder = path.join(SOURCE_BASE, folder);
  if (!fs.existsSync(sourceFolder)) {
    console.log(`❌ 源文件夹不存在: ${sourceFolder}`);
    return;
  }
  
  // 获取产品信息
  let product;
  try {
    product = await prisma.product.findUnique({
      where: { id: productId },
      include: { 
        images: { orderBy: { sortOrder: 'asc' } },
        videos: { orderBy: { sortOrder: 'asc' } }
      }
    });
    
    if (!product) {
      console.log(`❌ 产品不存在: ${productId}`);
      return;
    }
  } catch (error) {
    console.error(`❌ 查询产品失败: ${error.message}`);
    return;
  }
  
  console.log(`  现有图片: ${product.images.length} 张, 视频: ${product.videos.length} 个`);
  
  // 获取源文件
  const sourceFiles = fs.readdirSync(sourceFolder).filter(file => {
    return fs.statSync(path.join(sourceFolder, file)).isFile();
  });
  
  console.log(`  源文件: ${sourceFiles.length} 个`);
  
  // 过滤图片和视频
  const imageFiles = sourceFiles.filter(file => 
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file)
  );
  const videoFiles = sourceFiles.filter(file => 
    /\.(mp4|avi|mov|wmv|flv|mkv)$/i.test(file)
  );
  
  console.log(`  新图片: ${imageFiles.length} 张, 新视频: ${videoFiles.length} 个`);
  
  // 创建目标目录（使用产品ID）
  const targetFolder = path.join(TARGET_BASE, productId);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }
  
  // 处理图片
  let uploadedImages = 0;
  if (imageFiles.length > 0) {
    console.log(`  🖼️  上传图片...`);
    
    // 计算起始排序序号（在现有图片之后）
    const startSortOrder = product.images.length;
    
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const success = await uploadAndCreateImage(
        file, 
        sourceFolder, 
        targetFolder, 
        productId, 
        startSortOrder + i, 
        ossClient
      );
      if (success) uploadedImages++;
    }
  }
  
  // 处理视频
  let uploadedVideos = 0;
  if (videoFiles.length > 0) {
    console.log(`  🎬 上传视频...`);
    
    // 计算起始排序序号（在现有视频之后）
    const startSortOrder = product.videos.length;
    
    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i];
      const success = await uploadAndCreateVideo(
        file,
        sourceFolder,
        targetFolder,
        productId,
        startSortOrder + i,
        ossClient
      );
      if (success) uploadedVideos++;
    }
  }
  
  console.log(`  ✅ 完成: 上传了 ${uploadedImages} 张图片和 ${uploadedVideos} 个视频`);
}

async function uploadAndCreateImage(filename, sourcePath, targetPath, productId, sortOrder, ossClient) {
  const sourceFile = path.join(sourcePath, filename);
  const targetFile = path.join(targetPath, filename);
  
  // 生成一个更友好的文件名（避免中文和特殊字符）
  const safeFilename = generateSafeFilename(filename, sortOrder, 'jpg');
  const finalTargetFile = path.join(targetPath, safeFilename);
  
  // OSS路径
  const ossKey = `uploads/products/${productId}/${safeFilename}`;
  
  try {
    // 检查是否已存在
    try {
      await ossClient.head(ossKey);
      console.log(`    ⏭️  图片已存在OSS: ${safeFilename}`);
      return false; // 跳过
    } catch (e) {
      // 文件不存在，继续上传
    }
    
    // 复制文件
    fs.copyFileSync(sourceFile, finalTargetFile);
    
    // 上传到OSS
    const result = await ossClient.put(ossKey, finalTargetFile);
    const sizeMB = (fs.statSync(sourceFile).size / 1024 / 1024).toFixed(2);
    console.log(`    ✅ 上传图片: ${filename} → ${safeFilename} (${sizeMB}MB)`);
    
    // 创建数据库记录
    const relativeUrl = `/${ossKey}`;
    await prisma.productImage.create({
      data: {
        productId,
        url: relativeUrl,
        sortOrder,
        isPrimary: false // 不设为主图，保持现有主图
      }
    });
    
    return true;
  } catch (error) {
    console.error(`    ❌ 上传失败 ${filename}: ${error.message}`);
    return false;
  }
}

async function uploadAndCreateVideo(filename, sourcePath, targetPath, productId, sortOrder, ossClient) {
  const sourceFile = path.join(sourcePath, filename);
  const targetFile = path.join(targetPath, filename);
  
  // 生成安全文件名
  const ext = path.extname(filename);
  const safeFilename = generateSafeFilename(filename, sortOrder, ext.replace('.', ''));
  const finalTargetFile = path.join(targetPath, safeFilename);
  
  // OSS路径
  const ossKey = `uploads/products/${productId}/${safeFilename}`;
  
  try {
    // 检查是否已存在
    try {
      await ossClient.head(ossKey);
      console.log(`    ⏭️  视频已存在OSS: ${safeFilename}`);
      return false;
    } catch (e) {
      // 文件不存在，继续上传
    }
    
    // 复制文件
    fs.copyFileSync(sourceFile, finalTargetFile);
    
    // 上传到OSS
    const result = await ossClient.put(ossKey, finalTargetFile);
    const sizeMB = (fs.statSync(sourceFile).size / 1024 / 1024).toFixed(2);
    console.log(`    ✅ 上传视频: ${filename} → ${safeFilename} (${sizeMB}MB)`);
    
    // 创建数据库记录
    const relativeUrl = `/${ossKey}`;
    const title = `视频 ${sortOrder + 1}`;
    
    await prisma.productVideo.create({
      data: {
        productId,
        url: relativeUrl,
        sortOrder,
        title
      }
    });
    
    return true;
  } catch (error) {
    console.error(`    ❌ 上传失败 ${filename}: ${error.message}`);
    return false;
  }
}

function generateSafeFilename(originalName, index, extension) {
  // 从原始文件名提取有用部分，或使用索引
  const baseName = path.basename(originalName, path.extname(originalName));
  
  // 如果是微信图片，尝试提取编号
  const wechatMatch = originalName.match(/微信图片_(\d+)_(\d+)_(\d+)/);
  if (wechatMatch) {
    const num = wechatMatch[3];
    return `wechat_${num}.${extension}`;
  }
  
  // 如果是哈希名称，使用索引
  if (/^[a-f0-9]{32}$/.test(baseName)) {
    return `file_${index + 1}.${extension}`;
  }
  
  // 否则使用索引
  return `additional_${index + 1}.${extension}`;
}

main().catch(console.error);