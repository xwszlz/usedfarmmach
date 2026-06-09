const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
  return env;
}

const env = loadEnv();
const oss = new OSS({
  region: 'oss-cn-beijing',
  accessKeyId: env.OSS_ACCESS_KEY_ID,
  accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
  bucket: 'usedfarmmach-oss',
});

// 只看 网站图片补充0608 中还没处理的
// 上次 auto-upload-remaining.js 处理了10个，还有13个未匹配
const BASE_DIR = 'D:\\神雕农机\\网站图片补充0608\\2026.6.8';

// 已处理的文件夹名（上次上传成功的）
const ALREADY_DONE = [
  '2003纽荷兰FX38青储机', '2016法兰信伸缩臂夹包机', '2017冠军445割台',
  '2017康斯凯尔捡石机', '2019进口奥库DENS-X裹包机', '2020凯斯WD1903割草机',
  '2020牧农GP21C018+18打包机', '2020牧农MH2022071茎穗双收',
  '2020牧农SDCML风吸玉米脱粒机', '进口奥库DENS-X裹包机'
];

async function findBestMatch(folderName) {
  const all = await prisma.product.findMany({
    where: { images: { none: {} } },
    include: { brand: true }
  });
  
  let best = null, bestScore = 0;
  const upper = folderName.toUpperCase();
  
  for (const p of all) {
    let score = 0;
    const model = (p.modelName || '').toUpperCase();
    
    // 型号匹配
    if (model && model !== '无' && model.length >= 2) {
      if (upper.includes(model)) score += 6;
    }
    
    // 品牌匹配
    const brandName = (p.brand?.nameEn || p.brand?.nameZh || '').toUpperCase();
    if (brandName && upper.includes(brandName)) score += 4;
    else {
      // 尝试品牌别名
      const bn = (p.brand?.nameZh || p.brand?.nameEn || '').toUpperCase();
      if (bn && upper.includes(bn)) score += 3;
    }
    
    // 年份
    const yearMatch = folderName.match(/\b(20\d{2})\b/);
    if (yearMatch && p.year && p.year === parseInt(yearMatch[1])) score += 2;
    
    // 品类关键词
    const keywords = {
      '青储': '青储', '打包': '打包', '捆': '捆', '割台': '割台', '割草': '割草',
      '搂草': '搂草', '捡石': '捡石', '播种': '播种', '播': '播', '犁': '犁',
      '收获': '收获', '拖拉': '拖拉', '叉车': '叉车', '甜菜': '甜菜',
      '裹包': '裹包', '脱粒': '脱粒', '码垛': '码垛', '双收': '双收'
    };
    for (const [kw, cat] of Object.entries(keywords)) {
      if (upper.includes(kw) && model.includes(cat)) { score += 2; break; }
    }
    
    if (score > bestScore) { bestScore = score; best = p; }
  }
  
  // 如果没图片的产品没匹配到，搜全库
  if (!best || bestScore < 4) {
    const all2 = await prisma.product.findMany({ include: { brand: true } });
    for (const p of all2) {
      let score = 0;
      const model = (p.modelName || '').toUpperCase();
      if (model && model !== '无' && model.length >= 2 && upper.includes(model)) score += 6;
      const brandName = (p.brand?.nameEn || p.brand?.nameZh || '').toUpperCase();
      if (brandName && upper.includes(brandName)) score += 4;
      const yearMatch = folderName.match(/\b(20\d{2})\b/);
      if (yearMatch && p.year && p.year === parseInt(yearMatch[1])) score += 2;
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  
  return { product: best, score: bestScore };
}

async function uploadFolder(productId, folderPath) {
  const files = fs.readdirSync(folderPath);
  const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  const videos = files.filter(f => /\.(mp4|mov|avi)$/i.test(f));
  
  // 先清理旧数据
  await prisma.productImage.deleteMany({ where: { productId } });
  try { await prisma.productVideo.deleteMany({ where: { productId } }); } catch(e) {}
  
  let imgs = 0, vids = 0;
  
  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    const key = `products/${productId}/images/${String(i+1).padStart(3,'0')}${path.extname(file)}`;
    try {
      await oss.put(key, path.join(folderPath, file));
      imgs++;
      process.stdout.write('.');
    } catch(e) { process.stdout.write('x'); }
  }
  if (imgs) {
    const records = [];
    for (let i = 0; i < images.length; i++) {
      const key = `products/${productId}/images/${String(i+1).padStart(3,'0')}${path.extname(images[i])}`;
      records.push({
        productId, url: `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${key}`,
        sortOrder: i, isPrimary: i === 0
      });
    }
    // 只写实际成功上传的
    const succ = records.filter((_, i) => i < imgs);
    await prisma.productImage.createMany({ data: succ });
  }
  
  for (let i = 0; i < videos.length; i++) {
    const file = videos[i];
    const key = `products/${productId}/videos/${String(i+1).padStart(3,'0')}${path.extname(file)}`;
    try {
      await oss.put(key, path.join(folderPath, file));
      vids++;
      process.stdout.write('v');
    } catch(e) { process.stdout.write('X'); }
  }
  if (vids) {
    const records = [];
    for (let i = 0; i < videos.length; i++) {
      const key = `products/${productId}/videos/${String(i+1).padStart(3,'0')}${path.extname(videos[i])}`;
      records.push({ productId, url: `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${key}` });
    }
    try { await prisma.productVideo.createMany({ data: records }); } catch(e) {}
  }
  
  return { imgs: images.length, vids: videos.length };
}

async function main() {
  console.log('=== 第二轮：剩余13个文件夹匹配上传 ===\n');
  
  const allFolders = fs.readdirSync(BASE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .filter(d => !ALREADY_DONE.includes(d.name));
  
  console.log(`待处理文件夹: ${allFolders.length}个\n`);
  
  let uploaded = 0, skipped = 0;
  
  for (const folder of allFolders) {
    const folderPath = path.join(BASE_DIR, folder.name);
    console.log(`\n📁 ${folder.name}`);
    
    const { product, score } = await findBestMatch(folder.name);
    
    if (product && score >= 4) {
      console.log(`  ✅ 匹配: ${product.modelName} (${product.brand?.nameEn || product.brand?.nameZh}, 分数:${score})`);
      const result = await uploadFolder(product.id, folderPath);
      console.log(`\n  上传: ${result.imgs}张图, ${result.vids}个视频`);
      uploaded++;
    } else if (product) {
      console.log(`  ⚠️ 低匹配(分数:${score}): ${product.modelName} (${product.brand?.nameEn || '?'}), 跳过`);
      skipped++;
    } else {
      console.log(`  ❌ 无匹配, 跳过`);
      skipped++;
    }
  }
  
  console.log(`\n=== 完成 ===`);
  console.log(`上传: ${uploaded}, 跳过: ${skipped}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
