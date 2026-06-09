const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 手动解析 .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  const env = {};
  lines.forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
  return env;
}

const env = loadEnv();

const ossClient = new OSS({
  region: 'oss-cn-beijing',
  accessKeyId: env.OSS_ACCESS_KEY_ID,
  accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
  bucket: 'usedfarmmach-oss',
});

// 三个本地图片目录
const IMAGE_DIRS = [
  'D:\\神雕农机\\网站图片补充',
  'D:\\神雕农机\\网站图片补充0608\\2026.6.8',
];

// 品牌别名映射
const BRAND_ALIASES = {
  'CLAAS': ['CLAAS', 'claas'],
  'John Deere': ['JOHN DEERE', 'JOHN-DEERE', 'JOHNDEERE', '约翰迪尔', 'John Deere'],
  'Krone': ['KRONE', 'krone'],
  'New Holland': ['NEW HOLLAND', 'NEWHOLLAND', 'New Holland'],
  'Case IH': ['CASE', 'CASEIH', 'Case IH'],
  'Fendt': ['FENDT', 'fendt'],
  'Orkel': ['ORKE', 'ORKE', 'Orkel'],
  'Kuhn': ['KUHN', 'kuhn'],
  'Massey Ferguson': ['MASSEY', 'Massey Ferguson', 'massey'],
  'Grimme': ['GRIMME', 'grimme'],
  'Kongskilde': ['KONGSKILDE', 'kongskilde'],
};

// 从文件夹名提取品牌
function extractBrand(folderName) {
  const upper = folderName.toUpperCase();
  for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
    for (const alias of aliases) {
      if (upper.includes(alias.toUpperCase())) {
        return brand;
      }
    }
  }
  return null;
}

// 从文件夹名提取型号
function extractModel(folderName) {
  // 去掉品牌名、年份等，保留型号部分
  let model = folderName;
  // 去掉年份 (4位数)
  model = model.replace(/\b(20\d{2})\b/g, '');
  // 去掉品牌名
  for (const aliases of Object.values(BRAND_ALIASES)) {
    for (const alias of aliases) {
      model = model.replace(new RegExp(alias, 'gi'), '');
    }
  }
  // 去掉特殊字符
  model = model.replace(/[·•\-_\(\)\[\]\.]/g, ' ');
  // 压缩空格
  model = model.replace(/\s+/g, ' ').trim();
  return model;
}

// 从文件夹名提取年份
function extractYear(folderName) {
  const match = folderName.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

// 计算匹配分数
function calcMatchScore(folderName, product) {
  let score = 0;
  const upperFolder = folderName.toUpperCase();
  
  // 获取品牌名
  const brand = product.brand;
  if (brand) {
    const brandNames = [brand.nameZh, brand.nameEn, brand.nameRu].filter(Boolean);
    for (const name of brandNames) {
      if (upperFolder.includes(name.toUpperCase())) {
        score += 3;
        break;
      }
    }
  }
  
  // 型号匹配
  const modelName = product.modelName || '';
  if (modelName && modelName !== '无') {
    // 从型号中提取关键词
    const modelWords = modelName.split(/[\s\-_]+/).filter(w => w.length >= 2);
    for (const word of modelWords) {
      if (upperFolder.includes(word.toUpperCase())) {
        score += 5;
        break;
      }
    }
  }
  
  // 年份匹配
  const year = product.year;
  if (year) {
    if (upperFolder.includes(year.toString())) {
      score += 2;
    }
  }
  
  return score;
}

// 扫描所有本地文件夹
function scanAllFolders() {
  const folders = [];
  for (const dir of IMAGE_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`目录不存在: ${dir}`);
      continue;
    }
    const subs = fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(dir, d.name));
    folders.push(...subs);
    console.log(`扫描目录: ${dir}, 找到 ${subs.length} 个文件夹`);
  }
  return folders;
}

// 上传文件到OSS
async function uploadToOSS(productId, folderPath) {
  const files = fs.readdirSync(folderPath);
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  const videoFiles = files.filter(f => /\.(mp4|mov|avi)$/i.test(f));
  
  console.log(`  找到 ${imageFiles.length} 张图片, ${videoFiles.length} 个视频`);
  
  const uploadedImages = [];
  const uploadedVideos = [];
  
  // 上传图片
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const filePath = path.join(folderPath, file);
    const objectKey = `products/${productId}/images/${String(i + 1).padStart(3, '0')}${path.extname(file)}`;
    
    try {
      const result = await ossClient.put(objectKey, filePath);
      const url = `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${objectKey}`;
      uploadedImages.push({ url, sortOrder: i, isPrimary: i === 0 });
      console.log(`    上传图片: ${file} -> ${url}`);
    } catch (err) {
      console.error(`    上传失败: ${file}`, err.message);
    }
  }
  
  // 上传视频
  for (let i = 0; i < videoFiles.length; i++) {
    const file = videoFiles[i];
    const filePath = path.join(folderPath, file);
    const objectKey = `products/${productId}/videos/${String(i + 1).padStart(3, '0')}${path.extname(file)}`;
    
    try {
      const result = await ossClient.put(objectKey, filePath);
      const url = `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${objectKey}`;
      uploadedVideos.push({ url });
      console.log(`    上传视频: ${file} -> ${url}`);
    } catch (err) {
      console.error(`    上传失败: ${file}`, err.message);
    }
  }
  
  return { uploadedImages, uploadedVideos };
}

// 主函数
async function main() {
  console.log('=== 自动上传剩余高匹配产品 ===\n');
  
  // 1. 获取所有没有图片的产品
  const productsWithoutImages = await prisma.product.findMany({
    where: {
      NOT: {
        images: {
          some: {}
        }
      }
    },
    include: { brand: true }
  });
  
  console.log(`没有图片的产品: ${productsWithoutImages.length} 台\n`);
  
  // 2. 扫描所有本地文件夹
  const allFolders = scanAllFolders();
  console.log(`总共扫描到 ${allFolders.length} 个本地文件夹\n`);
  
  // 3. 匹配并上传
  let uploadedCount = 0;
  let failedCount = 0;
  
  for (const folderPath of allFolders) {
    const folderName = path.basename(folderPath);
    
    // 为每个文件夹找最佳匹配
    let bestMatch = null;
    let bestScore = 0;
    
    for (const product of productsWithoutImages) {
      const score = calcMatchScore(folderName, product);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }
    
    // 只处理高匹配度（分数≥5）
    if (bestMatch && bestScore >= 5) {
      console.log(`\n匹配: ${folderName}`);
      console.log(`  产品: ${bestMatch.modelName} (ID: ${bestMatch.id})`);
      console.log(`  品牌: ${bestMatch.brand?.nameEn || '未知'}`);
      console.log(`  匹配分数: ${bestScore}`);
      
      // 上传到OSS
      const { uploadedImages, uploadedVideos } = await uploadToOSS(bestMatch.id, folderPath);
      
      // 更新数据库
      if (uploadedImages.length > 0) {
        await prisma.productImage.createMany({
          data: uploadedImages.map(img => ({
            productId: bestMatch.id,
            url: img.url,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          }))
        });
        console.log(`  已创建 ${uploadedImages.length} 条图片记录`);
      }
      
      if (uploadedVideos.length > 0) {
        // 检查是否有ProductVideo模型
        try {
          await prisma.productVideo.createMany({
            data: uploadedVideos.map(vid => ({
              productId: bestMatch.id,
              url: vid.url,
            }))
          });
          console.log(`  已创建 ${uploadedVideos.length} 条视频记录`);
        } catch (err) {
          console.log(`  视频记录创建失败（可能模型不存在）: ${err.message}`);
        }
      }
      
      uploadedCount++;
      
      // 从待处理列表中移除
      const idx = productsWithoutImages.findIndex(p => p.id === bestMatch.id);
      if (idx !== -1) {
        productsWithoutImages.splice(idx, 1);
      }
    }
  }
  
  console.log(`\n=== 上传完成 ===`);
  console.log(`成功上传: ${uploadedCount} 台`);
  console.log(`失败: ${failedCount} 台`);
  console.log(`剩余无图片产品: ${productsWithoutImages.length} 台`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
