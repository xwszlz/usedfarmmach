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

// 补传目录
const BASE_DIR = 'D:\\神雕农机\\网站产品图品补充06082\\2026.6.8.补';

// 手动匹配：文件夹名 → 数据库关键词搜索
async function findProduct(brandKeywords, modelKeywords, nameKeyword) {
  // 尝试多种匹配
  const candidates = await prisma.product.findMany({
    where: {
      images: { none: {} }  // 只找没图片的
    },
    include: { brand: true }
  });
  
  for (const p of candidates) {
    const modelName = (p.modelName || '').toLowerCase();
    const folderInfo = (nameKeyword || '').toLowerCase();
    
    // 型号匹配
    for (const mk of modelKeywords) {
      if (modelName.includes(mk.toLowerCase())) return p;
    }
    
    // 名称关键词匹配
    for (const nk of [nameKeyword || '']) {
      if (nk && modelName.includes(nk.toLowerCase())) return p;
    }
  }
  
  // 如果还是没找到，尝试全库搜索（包括有图片的）
  const all = await prisma.product.findMany({
    include: { brand: true }
  });
  
  for (const p of all) {
    const modelName = (p.modelName || '').toLowerCase();
    for (const mk of modelKeywords) {
      if (modelName.includes(mk.toLowerCase())) return p;
    }
  }
  
  return null;
}

async function uploadFolder(productId, folderPath) {
  const files = fs.readdirSync(folderPath);
  const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  const videos = files.filter(f => /\.(mp4|mov|avi)$/i.test(f));
  
  console.log(`  图片${images.length}张, 视频${videos.length}个`);
  
  // 删除该产品已有图片（如果之前传错了）
  await prisma.productImage.deleteMany({ where: { productId } });
  await prisma.productVideo.deleteMany({ where: { productId } });
  
  // 上传图片
  const imgRecords = [];
  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    const key = `products/${productId}/images/${String(i+1).padStart(3,'0')}${path.extname(file)}`;
    try {
      await ossClient.put(key, path.join(folderPath, file));
      const url = `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${key}`;
      imgRecords.push({ productId, url, sortOrder: i, isPrimary: i===0 });
      process.stdout.write('.');
    } catch(e) {
      console.error(`\n  上传失败: ${file}`, e.message);
    }
  }
  if (imgRecords.length) {
    await prisma.productImage.createMany({ data: imgRecords });
    console.log(`\n  图片记录: ${imgRecords.length}条`);
  }
  
  // 上传视频
  const vidRecords = [];
  for (let i = 0; i < videos.length; i++) {
    const file = videos[i];
    const key = `products/${productId}/videos/${String(i+1).padStart(3,'0')}${path.extname(file)}`;
    try {
      await ossClient.put(key, path.join(folderPath, file));
      const url = `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${key}`;
      vidRecords.push({ productId, url });
      process.stdout.write('v');
    } catch(e) {
      console.error(`\n  上传失败: ${file}`, e.message);
    }
  }
  if (vidRecords.length) {
    try {
      await prisma.productVideo.createMany({ data: vidRecords });
      console.log(`\n  视频记录: ${vidRecords.length}条`);
    } catch(e) {
      console.log(`\n  视频记录写入失败: ${e.message}`);
    }
  }
}

async function main() {
  console.log('=== 补传产品图片 ===\n');
  
  const folders = [
    { name: '1999纽荷兰fx38青储机', brand: ['纽荷兰'], model: ['fx38'], keyword: '青储' },
    { name: '克拉斯65小方捆打捆机', brand: ['克拉斯','CLAAS'], model: ['65'], keyword: '小方捆' },
    { name: '库恩mm300搂草机', brand: ['库恩','Kuhn'], model: ['mm300','300'], keyword: '搂草' },
    { name: '纽荷兰5070小方捆', brand: ['纽荷兰'], model: ['5070'], keyword: '小方捆' },
    { name: '艾美特AMTY甜菜机', brand: ['艾美特'], model: ['AMTY','amty'], keyword: '甜菜机' },
  ];
  
  for (const folder of folders) {
    const folderPath = path.join(BASE_DIR, folder.name);
    console.log(`\n📁 ${folder.name}`);
    
    if (!fs.existsSync(folderPath)) {
      console.log('  文件夹不存在，跳过');
      continue;
    }
    
    const product = await findProduct(folder.brand, folder.model, folder.keyword);
    if (product) {
      console.log(`  ✅ 匹配到: ${product.modelName} (品牌: ${product.brand?.nameEn || '?'}, ID: ${product.id})`);
      await uploadFolder(product.id, folderPath);
    } else {
      console.log(`  ❌ 未匹配到任何产品`);
    }
  }
  
  console.log('\n=== 完成 ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
