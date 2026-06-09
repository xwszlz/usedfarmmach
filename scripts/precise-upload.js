#!/usr/bin/env node
/**
 * precise-upload.js
 * 精准匹配 + 上传：只匹配品牌+型号数字都确认正确的
 */
const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const { PrismaClient } = require('@prisma/client');

// 手动加载 .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const t = line.trim();
      if (t && !t.startsWith('#')) {
        const i = t.indexOf('=');
        if (i > 0) {
          let k = t.substring(0, i).trim(), v = t.substring(i + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
          if (!process.env[k]) process.env[k] = v;
        }
      }
    });
  }
} catch (e) { console.warn('env load failed:', e.message); }

const OSS_CONFIG = {
  region: 'oss-cn-beijing',
  bucket: 'usedfarmmach-oss',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
};
const OSS_BASE = `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com`;

const SOURCE_DIRS = [
  'D:/神雕农机/出口农机',
  'D:/神雕农机/神雕农机网站图片0606',
];

// 品牌标准化映射
const BRAND_NORM = {
  '克拉斯': 'claas', 'claas': 'claas',
  '纽荷兰': 'newholland', 'newholland': 'newholland', 'new holland': 'newholland',
  '克罗尼': 'krone', 'krone': 'krone',
  '迪尔': 'johndeere', 'johndeere': 'johndeere', 'john deere': 'johndeere',
  '凯斯': 'caseih', 'caseih': 'caseih', 'case': 'caseih',
  '芬特': 'fendt', 'fendt': 'fendt',
  '奥库': 'orkel', 'orkel': 'orkel',
  '库恩': 'kuhn', 'kuhn': 'kuhn',
  '曼尼通': 'manitou', 'manitou': 'manitou',
  '麦赛': 'masseyferguson', '麦赛弗格森': 'masseyferguson', 'massey': 'masseyferguson',
  '美迪': 'meidi', '牧神': 'mushen', '牧农': 'munong',
  '金轮': 'jinlun', '法兰信': 'falanxin',
  '冠军': 'guanjun', '康斯凯尔': 'kongskilde', 'kongskilde': 'kongskilde',
  '德翔': 'dexiang', '迈科': 'maike', '马赛': 'masai',
  '东洋': 'dongyang', '挪威格兰': 'norwegian', '盈嘉': 'yingjia',
  '中农机': 'zhongnongji', '中联重科': 'zhonglian',
  '迪马': 'dima', '常发': 'changfa',
  '东方红': 'dongfanghong', '都麦': 'dumai',
  '进口': '', '国产': '',
};

function normalizeBrand(name) {
  const n = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(BRAND_NORM)) {
    if (n.includes(k)) return v;
  }
  return n;
}

function extractNumbers(s) {
  return (s.match(/\d+/g) || []).map(Number);
}

async function main() {
  const prisma = new PrismaClient();
  const oss = new OSS(OSS_CONFIG);
  
  // 测试 OSS
  try { await oss.list({ 'max-keys': 1 }); console.log('✅ OSS 连接成功'); } 
  catch (e) { console.error('❌ OSS 连接失败:', e.message); process.exit(1); }

  // 获取所有本地文件夹
  const allFolders = [];
  for (const dir of SOURCE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fp = path.join(dir, entry.name);
      const files = fs.readdirSync(fp).filter(f => /\.(jpg|jpeg|png|webp|avif|mp4|mov)$/i.test(f));
      if (files.length === 0) continue;
      const imgs = files.filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f));
      const vids = files.filter(f => /\.(mp4|mov)$/i.test(f));
      const fm = imgs.find(f => f.toLowerCase().includes('fm')) || imgs[0];
      allFolders.push({ name: entry.name, path: fp, source: dir, imgs, vids, fm });
    }
  }

  // 获取所有无图片的 DB 产品
  const dbProducts = await prisma.product.findMany({
    where: { images: { none: {} } },
    include: { brand: true, category: true },
  });

  console.log(`📁 本地文件夹: ${allFolders.length}`);
  console.log(`🗄️  无图片产品: ${dbProducts.length}\n`);

  // 精准匹配：品牌标准化 + 型号数字交集
  const matches = [];
  const usedProducts = new Set();

  for (const folder of allFolders) {
    const fnName = folder.name.toLowerCase();
    const fnBrand = normalizeBrand(folder.name);
    const fnNumbers = extractNumbers(folder.name);
    if (!fnBrand || fnNumbers.length === 0) continue;

    let best = null, bestScore = 0;
    for (const prod of dbProducts) {
      if (usedProducts.has(prod.id)) continue;
      const dbBrand = normalizeBrand(prod.brand?.nameZh || '');
      if (dbBrand !== fnBrand) continue;

      const dbNumbers = extractNumbers(prod.modelName || '');
      const common = fnNumbers.filter(n => dbNumbers.includes(n));
      const score = common.length * 100 + (dbNumbers.length > 0 ? 50 : 0) 
        + (Math.abs((prod.year || 2020) - (fnNumbers.find(n => n > 1900 && n < 2030) || 2020)) <= 1 ? 30 : 0);
      
      if (score > bestScore && common.length > 0) {
        bestScore = score;
        best = prod;
      }
      // Brand matches + single large number match (like 5070, 970, 1290)
      if (bestScore === 0 && common.length === 0) {
        const bigNums = fnNumbers.filter(n => n >= 100);
        if (bigNums.length === 0) continue;
        if (bigNums.some(n => dbNumbers.includes(n)) && score > bestScore) {
          bestScore = score;
          best = prod;
        }
      }
    }

    if (best && bestScore >= 100) {
      const existing = matches.find(m => m.product.id === best.id);
      if (existing) {
        // 同一产品多文件夹，合并图片
        existing.folders.push(folder);
      } else {
        matches.push({ product: best, folders: [folder], score: bestScore });
        usedProducts.add(best.id);
      }
    }
  }

  console.log('========== 精准匹配结果 ==========');
  console.log(`✅ 精准匹配: ${matches.length} 个产品\n`);

  let totalImages = 0, totalVideos = 0;
  for (const m of matches) {
    const imgCount = m.folders.reduce((s, f) => s + f.imgs.length, 0);
    const vidCount = m.folders.reduce((s, f) => s + f.vids.length, 0);
    totalImages += imgCount;
    totalVideos += vidCount;
    const folderNames = m.folders.map(f => f.name).join(' + ');
    console.log(`  ${m.product.brand?.nameZh || '?'} ${m.product.modelName} (${m.product.year})`);
    console.log(`    ← ${folderNames}`);
    console.log(`    ${imgCount} 图 + ${vidCount} 视频 | 得分: ${m.score}`);
  }

  if (matches.length === 0) {
    console.log('❌ 没有找到精准匹配。需要先修正数据库中的型号名称。');
    console.log('\n📋 数据库无图片产品列表（供人工匹配）：');
    for (const p of dbProducts) {
      console.log(`  ${p.brand?.nameZh || '?'} | ${p.modelName} | ${p.year} | ${p.category?.nameZh || '?'} | ${p.id}`);
    }
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📦 待上传: ${totalImages} 图 + ${totalVideos} 视频`);
  console.log('开始上传...\n');

  // 上传
  let uploaded = 0, failed = 0;
  for (const match of matches) {
    const pid = match.product.id;
    const ossDir = `products/${pid}`;
    console.log(`📤 ${match.product.brand?.nameZh} ${match.product.modelName} (${pid.substring(0, 10)}...)`);

    let sortOrder = 0;
    const allImages = [];
    const allVideos = [];

    for (const folder of match.folders) {
      for (const img of folder.imgs) {
        const isCover = img === folder.fm;
        const ossPath = `${ossDir}/${img}`;
        
        // 检查是否已存在
        const existing = await prisma.productImage.findFirst({
          where: { productId: pid, url: { contains: img } }
        });
        if (existing) { console.log(`  ⏭️  跳过已存在: ${img}`); continue; }

        try {
          await oss.put(ossPath, path.join(folder.path, img));
          const url = `${OSS_BASE}/${ossPath}`;
          await prisma.productImage.create({
            data: { productId: pid, url, sortOrder: isCover ? 0 : sortOrder + 1, isPrimary: isCover }
          });
          uploaded++;
          if (!isCover) sortOrder++;
          if (uploaded % 20 === 0) console.log(`  ... ${uploaded} 张已上传`);
        } catch (e) {
          console.error(`  ❌ ${img}: ${e.message}`);
          failed++;
        }
      }
      for (const vid of folder.vids) {
        const ossPath = `${ossDir}/videos/${vid}`;
        try {
          await oss.put(ossPath, path.join(folder.path, vid));
          const url = `${OSS_BASE}/${ossPath}`;
          await prisma.productVideo.create({ data: { productId: pid, url } }).catch(() => {});
          uploaded++;
        } catch (e) {
          console.error(`  ❌ 视频 ${vid}: ${e.message}`);
          failed++;
        }
      }
    }
    console.log(`  ✅ 完成 (${match.folders.reduce((s,f)=>s+f.imgs.length,0)}图 + ${match.folders.reduce((s,f)=>s+f.vids.length,0)}视频)\n`);
  }

  console.log(`\n🎉 上传完成！成功: ${uploaded}, 失败: ${failed}`);

  // 更新计数
  const withImgNow = await prisma.product.count({ where: { images: { some: {} } } });
  const total = await prisma.product.count();
  console.log(`📊 有图片产品: ${withImgNow}/${total} (${(withImgNow/total*100).toFixed(0)}%)`);

  await prisma.$disconnect();
}

main().catch(e => { console.error('💥', e); process.exit(1); });
