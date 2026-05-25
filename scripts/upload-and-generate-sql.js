/**
 * 上传新产品资料到OSS并生成SQL更新脚本
 * 可以稍后手动执行SQL
 */

const OSS = require("ali-oss");
const fs = require("fs");
const path = require("path");

// OSS配置
const ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || "OSS_ACCESS_KEY_ID_PLACEHOLDER";
const ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || "OSS_ACCESS_KEY_SECRET_PLACEHOLDER";
const BUCKET = process.env.OSS_BUCKET || "usedfarmmach-oss";
const REGION = process.env.OSS_REGION || "oss-cn-beijing";

// 源目录
const SOURCE_BASE = path.join(__dirname, "..", "..", "产品资料", "新建文件夹");
// 目标目录
const TARGET_BASE = path.join(__dirname, "..", "public", "uploads", "products");

// 产品映射 - 基于之前的分析
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
  },
  {
    folder: "库恩1290",
    productId: "cmpfohy2g001dkrh55093csbq",
    brand: "库恩",
    model: "1290"
  },
  {
    folder: "曼尼通叉车",
    productId: "",
    brand: "曼尼通",
    model: "叉车"
  },
  {
    folder: "纽荷兰1270",
    productId: "cmpfohxx30001krh5pv5bx5yc",
    brand: "克罗尼",
    model: "1270"
  },
  {
    folder: "纽荷兰1290",
    productId: "cmpdknkb2009911kwv7u98vpe",
    brand: "克罗尼",
    model: "1290"
  },
  {
    folder: "纽荷兰5070小方捆",
    productId: "cmpdknjh6004x11kwkz5gvrbo",
    brand: "纽荷兰",
    model: "5070小方捆"
  },
  {
    folder: "纽荷兰870",
    productId: "cmpdknjh6004x11kwkz5gvrbo",
    brand: "纽荷兰",
    model: "870"
  },
  {
    folder: "美迪3300",
    productId: "cmpdknle000fd11kwwfbic4p8",
    brand: "克拉斯",
    model: "3300"
  },
  {
    folder: "迪尔拖拉机",
    productId: "cmpdknj9v004b11kwqvki68wr",
    brand: "约翰迪尔",
    model: "拖拉机"
  },
  {
    folder: "金轮夹包机",
    productId: "",
    brand: "金轮",
    model: "夹包机"
  }
];

async function main() {
  console.log("🚀 上传新产品资料到OSS并生成SQL脚本");
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
  
  // 存储SQL语句
  const sqlStatements = [];
  const summary = [];
  
  // 处理每个映射
  for (const mapping of PRODUCT_MAPPINGS) {
    const result = await processProduct(mapping, ossClient, sqlStatements);
    summary.push(result);
  }
  
  // 生成SQL文件
  const sqlContent = generateSQLFile(sqlStatements);
  const sqlFilePath = path.join(__dirname, "update-product-images.sql");
  fs.writeFileSync(sqlFilePath, sqlContent);
  
  console.log("\n" + "=".repeat(80));
  console.log("📊 处理摘要:");
  console.log("=".repeat(80));
  
  summary.forEach(item => {
    console.log(`📁 ${item.folder}:`);
    console.log(`   状态: ${item.status}`);
    if (item.productId) console.log(`   产品ID: ${item.productId}`);
    if (item.images > 0) console.log(`   上传图片: ${item.images} 张`);
    if (item.videos > 0) console.log(`   上传视频: ${item.videos} 个`);
    console.log();
  });
  
  console.log("=".repeat(80));
  console.log(`💾 SQL脚本已生成: ${sqlFilePath}`);
  console.log("   请检查并手动执行SQL语句以更新数据库");
  console.log("=".repeat(80));
}

async function processProduct(mapping, ossClient, sqlStatements) {
  const { folder, productId, brand, model } = mapping;
  
  const result = {
    folder,
    productId,
    status: "未处理",
    images: 0,
    videos: 0
  };
  
  // 如果没有产品ID，跳过
  if (!productId) {
    result.status = "⚠️  需要产品ID映射";
    return result;
  }
  
  console.log(`📁 处理: ${folder} → ${brand} ${model} (ID: ${productId})`);
  console.log("-".repeat(60));
  
  // 检查源文件夹
  const sourceFolder = path.join(SOURCE_BASE, folder);
  if (!fs.existsSync(sourceFolder)) {
    console.log(`❌ 源文件夹不存在: ${sourceFolder}`);
    result.status = "❌ 源文件夹不存在";
    return result;
  }
  
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
  
  console.log(`  图片: ${imageFiles.length} 张, 视频: ${videoFiles.length} 个`);
  
  // 创建目标目录
  const targetFolder = path.join(TARGET_BASE, productId);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }
  
  // 获取现有文件以确定起始序号
  const existingFiles = fs.existsSync(targetFolder) ? 
    fs.readdirSync(targetFolder).filter(f => fs.statSync(path.join(targetFolder, f)).isFile()) : [];
  const existingImageCount = existingFiles.filter(f => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f)).length;
  const existingVideoCount = existingFiles.filter(f => /\.(mp4|avi|mov|wmv|flv|mkv)$/i.test(f)).length;
  
  console.log(`  现有文件: 图片 ${existingImageCount} 张, 视频 ${existingVideoCount} 个`);
  
  // 处理图片
  let uploadedImages = 0;
  if (imageFiles.length > 0) {
    console.log(`  🖼️  上传图片...`);
    
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const success = await uploadFile(
        file, 
        sourceFolder, 
        targetFolder, 
        productId, 
        existingImageCount + i + 1,
        'image',
        ossClient,
        sqlStatements
      );
      if (success) uploadedImages++;
    }
  }
  
  // 处理视频
  let uploadedVideos = 0;
  if (videoFiles.length > 0) {
    console.log(`  🎬 上传视频...`);
    
    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i];
      const success = await uploadFile(
        file,
        sourceFolder,
        targetFolder,
        productId,
        existingVideoCount + i + 1,
        'video',
        ossClient,
        sqlStatements
      );
      if (success) uploadedVideos++;
    }
  }
  
  console.log(`  ✅ 上传完成: ${uploadedImages} 张图片, ${uploadedVideos} 个视频`);
  
  result.status = "✅ 完成";
  result.images = uploadedImages;
  result.videos = uploadedVideos;
  
  return result;
}

async function uploadFile(filename, sourcePath, targetPath, productId, index, type, ossClient, sqlStatements) {
  const sourceFile = path.join(sourcePath, filename);
  
  // 生成安全文件名
  const ext = path.extname(filename);
  const safeFilename = generateSafeFilename(filename, index, ext.replace('.', ''), type);
  const targetFile = path.join(targetPath, safeFilename);
  
  // OSS路径
  const ossKey = `uploads/products/${productId}/${safeFilename}`;
  
  try {
    // 检查是否已存在
    try {
      await ossClient.head(ossKey);
      console.log(`    ⏭️  文件已存在OSS: ${safeFilename}`);
      
      // 即使存在，也生成SQL记录
      generateSQLRecord(productId, ossKey, type, index, sqlStatements);
      return true;
    } catch (e) {
      // 文件不存在，继续上传
    }
    
    // 复制文件
    fs.copyFileSync(sourceFile, targetFile);
    
    // 上传到OSS
    const result = await ossClient.put(ossKey, targetFile);
    const sizeMB = (fs.statSync(sourceFile).size / 1024 / 1024).toFixed(2);
    console.log(`    ✅ 上传${type === 'image' ? '图片' : '视频'}: ${filename} → ${safeFilename} (${sizeMB}MB)`);
    
    // 生成SQL记录
    generateSQLRecord(productId, ossKey, type, index, sqlStatements, filename);
    
    return true;
  } catch (error) {
    console.error(`    ❌ 上传失败 ${filename}: ${error.message}`);
    return false;
  }
}

function generateSafeFilename(originalName, index, extension, type) {
  const baseName = path.basename(originalName, path.extname(originalName));
  
  // 微信图片模式: 微信图片_20260523134139_3_691.jpg
  const wechatMatch = originalName.match(/微信图片_\d+_(\d+)_\d+/);
  if (wechatMatch) {
    const sequence = wechatMatch[1];
    return `wechat_${sequence}_${index}.${extension}`;
  }
  
  // 哈希名称
  if (/^[a-f0-9]{32}$/.test(baseName)) {
    return `${type}_${index}.${extension}`;
  }
  
  // 其他
  return `${type}_additional_${index}.${extension}`;
}

function generateSQLRecord(productId, ossKey, type, index, sqlStatements, originalFilename = '') {
  const relativeUrl = `/${ossKey}`;
  const now = new Date().toISOString();
  
  if (type === 'image') {
    const isPrimary = index === 1 ? 'true' : 'false'; // 第一个图片设为主图
    
    const sql = `INSERT INTO "ProductImage" (id, "productId", url, "sortOrder", "isPrimary") VALUES (
      gen_random_uuid(),
      '${productId}',
      '${relativeUrl}',
      ${index - 1}, -- sortOrder (0-based)
      ${isPrimary}
    ) ON CONFLICT (url) DO NOTHING;`;
    
    sqlStatements.push({
      type: 'image',
      sql,
      productId,
      url: relativeUrl
    });
  } else if (type === 'video') {
    const title = originalFilename ? 
      `'${originalFilename.replace(/\.[^.]+$/, '').substring(0, 50)}'` : 
      `'视频 ${index}'`;
    
    const sql = `INSERT INTO "ProductVideo" (id, "productId", url, "sortOrder", title) VALUES (
      gen_random_uuid(),
      '${productId}',
      '${relativeUrl}',
      ${index - 1}, -- sortOrder (0-based)
      ${title}
    ) ON CONFLICT (url) DO NOTHING;`;
    
    sqlStatements.push({
      type: 'video', 
      sql,
      productId,
      url: relativeUrl
    });
  }
}

function generateSQLFile(sqlStatements) {
  let content = `-- 产品图片和视频更新SQL脚本
-- 生成时间: ${new Date().toISOString()}
-- 总计: ${sqlStatements.length} 条记录

BEGIN;

-- 删除可能重复的记录（可选）
-- DELETE FROM "ProductImage" WHERE "productId" IN (
--   SELECT DISTINCT "productId" FROM (VALUES ${Array.from(new Set(sqlStatements.filter(s => s.type === 'image').map(s => `('${s.productId}')`))).join(',')}
-- ) AS products(id));

`;

  // 按产品分组
  const byProduct = {};
  sqlStatements.forEach(stmt => {
    if (!byProduct[stmt.productId]) {
      byProduct[stmt.productId] = { images: [], videos: [] };
    }
    if (stmt.type === 'image') {
      byProduct[stmt.productId].images.push(stmt);
    } else {
      byProduct[stmt.productId].videos.push(stmt);
    }
  });
  
  // 按产品输出
  Object.entries(byProduct).forEach(([productId, records]) => {
    const imageCount = records.images.length;
    const videoCount = records.videos.length;
    
    content += `\n-- 产品ID: ${productId} (${imageCount} 张图片, ${videoCount} 个视频)\n`;
    
    records.images.forEach(img => {
      content += img.sql + '\n';
    });
    
    records.videos.forEach(vid => {
      content += vid.sql + '\n';
    });
  });
  
  content += "\nCOMMIT;\n";
  
  return content;
}

main().catch(console.error);