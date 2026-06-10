const { PrismaClient } = require('@prisma/client');
const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 读取.env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const ossClient = new OSS({
  region: 'oss-cn-beijing',
  accessKeyId: env.OSS_ACCESS_KEY_ID || env.ALI_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.OSS_ACCESS_KEY_SECRET || env.ALI_OSS_ACCESS_KEY_SECRET,
  bucket: 'usedfarmmach-oss',
});

const BASE_DIR = 'D:/神雕农机/网站图片补充0609/2026.6.9';

// 手动匹配表（文件夹名 → 产品匹配关键词）
const matchMap = {
  '2020牧农GP21C018+18打包机': { brand: '牧农', model: 'GP21C018' },
  '2020牧农MH2022071茎穗双收': { brand: '牧农', model: 'MH2022071' },
  '2020牧农SDCML风吸玉米脱粒机': { brand: '牧农', model: 'SDCML' },
  '2020牧农YT24211075青储机': { brand: '牧农', model: 'YT24211075' },
  '冠军360割台': { brand: '冠军', model: '360' },
  '冠军390割台': { brand: '冠军', model: '390' },
  '冠军4500割台': { brand: '冠军', model: '4500' },
  '国产牧农柠条割台柠条割台': { brand: '牧农', model: 'YT24211075' },  // 柠条割台可能匹配YT型号
};

async function main() {
  const products = await prisma.product.findMany({ include: { brand: true, images: true } });
  
  const folders = fs.readdirSync(BASE_DIR).filter(f => fs.statSync(path.join(BASE_DIR, f)).isDirectory());
  
  let totalImgs = 0, totalVids = 0, matched = 0;
  
  for (const folder of folders) {
    const match = matchMap[folder];
    if (!match) { console.log('❌ 无匹配规则:', folder); continue; }
    
    // 找产品
    const found = products.find(p => {
      const brandZh = p.brand?.nameZh || '';
      const brandMatch = brandZh.includes(match.brand);
      const modelMatch = (p.modelName || '').includes(match.model);
      return brandMatch && modelMatch;
    });
    
    if (!found) {
      console.log('❌ 未匹配:', folder, '→', match.brand, match.model);
      continue;
    }
    
    console.log(`✅ 匹配: ${folder} → ${found.brand?.nameZh} ${found.modelName} (已有${found.images.length}张图)`);
    matched++;
    
    const folderPath = path.join(BASE_DIR, folder);
    const files = fs.readdirSync(folderPath);
    
    let imgCount = 0, vidCount = 0;
    let sortOrder = found.images.length; // 接着已有图片排序
    
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const ext = path.extname(file).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext);
      const isVideo = ['.mp4', '.mov', '.avi', '.mkv'].includes(ext);
      
      if (!isImage && !isVideo) continue;
      
      const ossPath = isImage 
        ? `products/${found.id}/${sortOrder}${ext}`
        : `products/${found.id}/videos/${vidCount}${ext}`;
      
      try {
        const result = await ossClient.put(ossPath, filePath);
        
        if (isImage) {
          await prisma.productImage.create({
            data: {
              productId: found.id,
              url: result.url,
              sortOrder: sortOrder,
              isPrimary: sortOrder === 0,
            }
          });
          imgCount++;
          sortOrder++;
        } else {
          await prisma.productVideo.create({
            data: { productId: found.id, url: result.url }
          });
          vidCount++;
        }
      } catch (e) {
        console.log('  ❌ 上传失败:', file, e.message);
      }
    }
    
    totalImgs += imgCount;
    totalVids += vidCount;
    console.log(`  上传: ${imgCount}张图片 + ${vidCount}个视频`);
  }
  
  console.log(`\n=== 完成 ===`);
  console.log(`匹配: ${matched}/${folders.length} 文件夹`);
  console.log(`图片: ${totalImgs}张 视频: ${totalVids}个`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
