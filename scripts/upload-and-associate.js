/**
 * 上传新产品资料到OSS并关联到数据库产品
 * 
 * 需要:
 * 1. OSS环境变量或硬编码凭证
 * 2. 数据库连接
 * 3. 文件夹到产品ID的映射
 */

const OSS = require("ali-oss");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// OSS配置 - 使用现有上传脚本中的硬编码值或环境变量
const ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || "OSS_ACCESS_KEY_ID_PLACEHOLDER";
const ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || "OSS_ACCESS_KEY_SECRET_PLACEHOLDER";
const BUCKET = process.env.OSS_BUCKET || "usedfarmmach-oss";
const REGION = process.env.OSS_REGION || "oss-cn-beijing";

// 源目录（解压的新产品资料）
const SOURCE_DIR = path.join(__dirname, "..", "..", "产品资料", "新建文件夹");
// 目标目录（用于上传的临时位置）
const TARGET_DIR = path.join(__dirname, "..", "public", "uploads", "products");

// 文件夹到产品ID的映射（需要手动确认）
// 格式: { "文件夹名称": "产品ID" }
const FOLDER_TO_PRODUCT_MAP = {
  // 明确匹配的
  "奥库DENS-X": "cmpdknkog00b311kwql4ortgt", // DENS-X产品
  "迪尔7250": "cmpdknj9v004b11kwqvki68wr",   // 7250产品
  // 需要确认的匹配 - 暂时留空
  // "库恩1290": "",
  // "曼尼通叉车": "",
  // "纽荷兰1270": "",
  // "纽荷兰1290": "",
  // "纽荷兰5070小方捆": "",
  // "纽荷兰870": "",
  // "美迪3300": "",
  // "迪尔拖拉机": "",
  // "金轮夹包机": ""
};

async function main() {
  console.log("📦 开始上传新产品资料到OSS并关联到数据库");
  console.log("=".repeat(80));
  
  // 1. 检查源目录
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ 源目录不存在: ${SOURCE_DIR}`);
    process.exit(1);
  }
  
  // 2. 确保目标目录存在
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    console.log(`✅ 创建目标目录: ${TARGET_DIR}`);
  }
  
  // 3. 获取所有产品文件夹
  const sourceFolders = fs.readdirSync(SOURCE_DIR).filter(name => {
    return fs.statSync(path.join(SOURCE_DIR, name)).isDirectory();
  });
  
  console.log(`📁 找到 ${sourceFolders.length} 个产品文件夹:`);
  sourceFolders.forEach(folder => {
    const productId = FOLDER_TO_PRODUCT_MAP[folder];
    const status = productId ? `✅ 已映射到产品ID: ${productId}` : "❓ 未映射";
    console.log(`  - ${folder}: ${status}`);
  });
  
  console.log("\n" + "=".repeat(80));
  console.log("⚠️  注意: 此脚本仅处理已明确映射的文件夹");
  console.log("   对于未映射的文件夹，需要手动确认产品ID");
  console.log("=".repeat(80) + "\n");
  
  // 只处理已映射的文件夹
  const mappedFolders = sourceFolders.filter(folder => FOLDER_TO_PRODUCT_MAP[folder]);
  
  if (mappedFolders.length === 0) {
    console.log("❌ 没有已映射的文件夹可供处理");
    console.log("   请先更新 FOLDER_TO_PRODUCT_MAP 映射表");
    process.exit(1);
  }
  
  console.log(`🔄 将处理 ${mappedFolders.length} 个已映射的文件夹`);
  
  // 4. 初始化OSS客户端
  const ossClient = new OSS({
    region: REGION,
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
    bucket: BUCKET,
    secure: true,
  });
  
  console.log(`☁️  OSS配置: bucket=${BUCKET}, region=${REGION}`);
  
  // 5. 处理每个已映射的文件夹
  for (const folder of mappedFolders) {
    const productId = FOLDER_TO_PRODUCT_MAP[folder];
    await processFolder(folder, productId, ossClient);
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("🎉 处理完成!");
  console.log("=".repeat(80));
  
  await prisma.$disconnect();
}

async function processFolder(folderName, productId, ossClient) {
  console.log(`\n📁 处理文件夹: ${folderName} → 产品ID: ${productId}`);
  console.log("-".repeat(60));
  
  // 获取产品信息
  let product;
  try {
    product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true, videos: true }
    });
    
    if (!product) {
      console.log(`❌ 产品不存在: ${productId}`);
      return;
    }
    
    console.log(`  产品: ${product.modelName} (${product.brand.nameZh})`);
    console.log(`  现有图片: ${product.images.length} 张, 视频: ${product.videos.length} 个`);
  } catch (error) {
    console.error(`❌ 查询产品失败: ${error.message}`);
    return;
  }
  
  const sourceFolderPath = path.join(SOURCE_DIR, folderName);
  const targetFolderPath = path.join(TARGET_DIR, productId); // 使用产品ID作为目标文件夹名
  
  // 创建目标文件夹
  if (!fs.existsSync(targetFolderPath)) {
    fs.mkdirSync(targetFolderPath, { recursive: true });
  }
  
  // 获取源文件
  const sourceFiles = fs.readdirSync(sourceFolderPath).filter(file => {
    return fs.statSync(path.join(sourceFolderPath, file)).isFile();
  });
  
  console.log(`  源文件: ${sourceFiles.length} 个`);
  
  // 分离图片和视频
  const imageFiles = sourceFiles.filter(file => 
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file)
  );
  const videoFiles = sourceFiles.filter(file => 
    /\.(mp4|avi|mov|wmv|flv|mkv)$/i.test(file)
  );
  const otherFiles = sourceFiles.filter(file => 
    !/\.(jpg|jpeg|png|gif|webp|bmp|mp4|avi|mov|wmv|flv|mkv)$/i.test(file)
  );
  
  console.log(`  图片: ${imageFiles.length} 个, 视频: ${videoFiles.length} 个, 其他: ${otherFiles.length} 个`);
  
  // 处理图片
  if (imageFiles.length > 0) {
    console.log(`  🖼️  处理图片...`);
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      await processImageFile(file, sourceFolderPath, targetFolderPath, productId, i, ossClient);
    }
  }
  
  // 处理视频
  if (videoFiles.length > 0) {
    console.log(`  🎬 处理视频...`);
    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i];
      await processVideoFile(file, sourceFolderPath, targetFolderPath, productId, i, ossClient);
    }
  }
  
  // 跳过其他文件
  if (otherFiles.length > 0) {
    console.log(`  ⚠️  跳过 ${otherFiles.length} 个非图片/视频文件`);
  }
}

async function processImageFile(filename, sourcePath, targetPath, productId, index, ossClient) {
  const sourceFile = path.join(sourcePath, filename);
  const targetFile = path.join(targetPath, filename);
  
  // 复制到目标目录
  try {
    fs.copyFileSync(sourceFile, targetFile);
  } catch (error) {
    console.error(`    ❌ 复制失败 ${filename}: ${error.message}`);
    return;
  }
  
  // OSS路径
  const ossKey = `uploads/products/${productId}/${filename}`;
  
  try {
    // 检查是否已存在
    try {
      await ossClient.head(ossKey);
      console.log(`    ⏭️  图片已存在OSS: ${filename}`);
      // 即使文件已存在，我们仍然需要确保数据库中有记录
      await ensureImageRecord(productId, ossKey, index);
      return;
    } catch (e) {
      // 文件不存在，继续上传
    }
    
    // 上传到OSS
    const result = await ossClient.put(ossKey, targetFile);
    const sizeMB = (fs.statSync(sourceFile).size / 1024 / 1024).toFixed(2);
    console.log(`    ✅ 上传图片: ${filename} (${sizeMB}MB) → ${result.url}`);
    
    // 创建数据库记录
    await createImageRecord(productId, ossKey, index);
    
  } catch (error) {
    console.error(`    ❌ 上传失败 ${filename}: ${error.message}`);
  }
}

async function processVideoFile(filename, sourcePath, targetPath, productId, index, ossClient) {
  const sourceFile = path.join(sourcePath, filename);
  const targetFile = path.join(targetPath, filename);
  
  // 复制到目标目录
  try {
    fs.copyFileSync(sourceFile, targetFile);
  } catch (error) {
    console.error(`    ❌ 复制失败 ${filename}: ${error.message}`);
    return;
  }
  
  // OSS路径
  const ossKey = `uploads/products/${productId}/${filename}`;
  
  try {
    // 检查是否已存在
    try {
      await ossClient.head(ossKey);
      console.log(`    ⏭️  视频已存在OSS: ${filename}`);
      // 确保数据库中有记录
      await ensureVideoRecord(productId, ossKey, index);
      return;
    } catch (e) {
      // 文件不存在，继续上传
    }
    
    // 上传到OSS
    const result = await ossClient.put(ossKey, targetFile);
    const sizeMB = (fs.statSync(sourceFile).size / 1024 / 1024).toFixed(2);
    console.log(`    ✅ 上传视频: ${filename} (${sizeMB}MB) → ${result.url}`);
    
    // 创建数据库记录
    await createVideoRecord(productId, ossKey, index, filename);
    
  } catch (error) {
    console.error(`    ❌ 上传失败 ${filename}: ${error.message}`);
  }
}

async function createImageRecord(productId, ossUrl, sortOrder) {
  try {
    // 注意：ossUrl应该是相对路径，如 uploads/products/xxx/file.jpg
    const relativeUrl = `/${ossUrl}`;
    
    await prisma.productImage.create({
      data: {
        productId,
        url: relativeUrl,
        sortOrder,
        isPrimary: sortOrder === 0 // 第一个图片设为主图
      }
    });
    console.log(`      📝 创建图片记录: sortOrder=${sortOrder}, isPrimary=${sortOrder === 0}`);
  } catch (error) {
    console.error(`      ❌ 创建图片记录失败: ${error.message}`);
  }
}

async function ensureImageRecord(productId, ossUrl, sortOrder) {
  const relativeUrl = `/${ossUrl}`;
  
  try {
    // 检查是否已存在
    const existing = await prisma.productImage.findFirst({
      where: {
        productId,
        url: relativeUrl
      }
    });
    
    if (!existing) {
      await createImageRecord(productId, ossUrl, sortOrder);
    } else {
      console.log(`      📝 图片记录已存在`);
    }
  } catch (error) {
    console.error(`      ❌ 检查图片记录失败: ${error.message}`);
  }
}

async function createVideoRecord(productId, ossUrl, sortOrder, filename) {
  try {
    const relativeUrl = `/${ossUrl}`;
    // 生成简化的标题（去掉扩展名和随机字符）
    const title = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').substring(0, 50);
    
    await prisma.productVideo.create({
      data: {
        productId,
        url: relativeUrl,
        sortOrder,
        title
      }
    });
    console.log(`      📝 创建视频记录: "${title}", sortOrder=${sortOrder}`);
  } catch (error) {
    console.error(`      ❌ 创建视频记录失败: ${error.message}`);
  }
}

async function ensureVideoRecord(productId, ossUrl, sortOrder, filename) {
  const relativeUrl = `/${ossUrl}`;
  
  try {
    // 检查是否已存在
    const existing = await prisma.productVideo.findFirst({
      where: {
        productId,
        url: relativeUrl
      }
    });
    
    if (!existing) {
      await createVideoRecord(productId, ossUrl, sortOrder, filename);
    } else {
      console.log(`      📝 视频记录已存在`);
    }
  } catch (error) {
    console.error(`      ❌ 检查视频记录失败: ${error.message}`);
  }
}

main().catch(console.error);