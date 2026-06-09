/**
 * 自动匹配本地素材 → 无图产品，筛选高置信度 → 批量上传到 OSS
 * 策略：品牌名+型号关键词+年份 得分 ≥ 5 才上传
 */
const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// ---- 加载 .env.local ----
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const eq = t.indexOf('=');
      if (eq > 0) {
        let k = t.substring(0, eq).trim(), v = t.substring(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
  console.log('✅ .env.local 已加载');
}

const prisma = new PrismaClient();
const client = new OSS({
  region: 'oss-cn-beijing',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: 'usedfarmmach-oss',
});

// ---- 品牌别名映射（本地文件夹名 → DB品牌名） ----
const brandAliases = {
  '克拉斯': 'CLAAS', 'claas': 'CLAAS',
  '克罗尼': 'Krone', 'krone': 'Krone',
  '纽荷兰': 'New Holland', 'newholland': 'New Holland', 'new holland': 'New Holland',
  '迪尔': '约翰迪尔', 'johndeere': '约翰迪尔', 'john deere': '约翰迪尔', 'deere': '约翰迪尔',
  '约翰迪尔': '约翰迪尔',
  '凯斯': 'Case IH', 'case': 'Case IH', 'caseih': 'Case IH', 'case ih': 'Case IH',
  '芬特': 'Fendt', 'fendt': 'Fendt',
  '格力莫': 'Grimme', 'grimme': 'Grimme', '格立莫': 'Grimme',
  '奥库': 'Orkel', 'orkel': 'Orkel',
  '康斯凯尔': 'Kongskilde', 'kongskilde': 'Kongskilde',
  '罗斯特': 'Rostselmash', 'rostselmash': 'Rostselmash', 'rsm': 'Rostselmash',
  '法兰信': 'Fransgard', 'fransgard': 'Fransgard',
  '华夏': '华夏', '牧农': '牧农', '冠军': '冠军', '奥贝斯': '奥贝斯',
  '迪马': '迪马战狼', '迈科': '迈科农机', '格兰': '格兰', 'arcusln': 'arcusln',
};

// ---- 扫描本地文件夹 ----
function scanFolders(baseDirs) {
  const folders = [];
  for (const dir of baseDirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const fp = path.join(dir, e.name);
      const files = fs.readdirSync(fp).filter(f =>
        /\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|webm)$/i.test(f));
      if (files.length === 0) continue;
      const images = files.filter(f => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f));
      const videos = files.filter(f => /\.(mp4|mov|avi|webm)$/i.test(f));
      // 找封面图(fm)
      const fmIdx = images.findIndex(f => f.toLowerCase().includes('fm'));
      const sorted = [...images];
      if (fmIdx >= 0) { sorted.splice(fmIdx, 1); sorted.unshift(images[fmIdx]); }

      folders.push({ name: e.name, path: fp, images: sorted, videos, fileCount: files.length });
    }
  }
  return folders;
}

// ---- 从文件夹名提取年份 ----
function extractYear(name) {
  const m = name.match(/(\d{4})年?/);
  return m ? parseInt(m[1]) : null;
}

// ---- 从文件夹名识别品牌 ----
function detectBrand(name) {
  const n = name.toLowerCase();
  // 按别名长度降序匹配（优先长匹配）
  const sorted = Object.entries(brandAliases).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, dbName] of sorted) {
    if (n.includes(alias.toLowerCase())) return dbName;
  }
  return null;
}

// ---- 打分匹配 ----
function matchScore(folder, product, brandMap) {
  const fn = folder.name.toLowerCase();
  const b = (brandMap[product.brandId] || '').toLowerCase();
  const m = (product.modelName || '').toLowerCase();
  const y = product.year;
  const fy = extractYear(folder.name);

  let score = 0;

  // 品牌匹配
  const detected = detectBrand(folder.name);
  if (detected && b && (b === detected.toLowerCase() || detected.toLowerCase() === b)) {
    score += 3;
  }

  // 型号关键词匹配
  if (m && m !== '无' && m !== '无型号') {
    // 提取型号中的数字和字母
    const modelParts = m.match(/[a-z]+|\d+/gi) || [];
    let partsMatched = 0;
    for (const part of modelParts) {
      if (part.length >= 2 && fn.includes(part.toLowerCase())) {
        partsMatched++;
      }
    }
    // 至少匹配1个关键部分，越多越好
    if (partsMatched >= 2) score += 5;
    else if (partsMatched === 1) score += 3;
  }

  // 年份匹配（容差 ±1）
  if (y && fy && Math.abs(y - fy) <= 1) {
    score += 2;
  }

  return score;
}

// ---- 主流程 ----
(async () => {
  // 1. 扫描本地文件夹
  const baseDirs = [
    'D:/神雕农机/出口农机',
    'D:/神雕农机/神雕农机网站图片0606',
    'D:/神雕农机/网站图片补充0608/2026.6.8',
  ];
  const folders = scanFolders(baseDirs);
  console.log(`📁 扫描到 ${folders.length} 个本地素材文件夹\n`);

  // 2. 查询无图产品
  const allProds = await prisma.product.findMany({
    select: { id: true, modelName: true, brandId: true, categoryId: true, year: true }
  });
  const imgCounts = await prisma.productImage.groupBy({ by: ['productId'], _count: true });
  const hasImg = new Set(imgCounts.map(x => x.productId));
  const noImg = allProds.filter(x => !hasImg[x.id]);

  const brands = await prisma.brand.findMany({ select: { id: true, nameZh: true } });
  const cats = await prisma.category.findMany({ select: { id: true, nameZh: true } });
  const brandMap = {}; brands.forEach(b => brandMap[b.id] = b.nameZh);
  const catMap = {}; cats.forEach(c => catMap[c.id] = c.nameZh);

  console.log(`📊 无图产品: ${noImg.length} / ${allProds.length}\n`);

  // 3. 匹配打分
  const matches = [];
  for (const prod of noImg) {
    let best = null, bestScore = 0;
    for (const folder of folders) {
      const score = matchScore(folder, prod, brandMap);
      if (score > bestScore) { bestScore = score; best = folder; }
    }
    matches.push({ product: prod, folder: best, score: bestScore });
  }

  // 4. 筛选高置信度 (score >= 5) 并去重（一个文件夹只能匹配一个产品）
  const highConf = matches.filter(m => m.score >= 5);
  const usedFolders = new Set();
  const toUpload = [];
  for (const m of highConf.sort((a, b) => b.score - a.score)) {
    if (usedFolders.has(m.folder.path)) continue;
    usedFolders.add(m.folder.path);
    toUpload.push(m);
  }

  console.log(`🎯 高置信度匹配 (score≥5): ${toUpload.length} 台`);
  console.log('');
  toUpload.forEach((m, i) => {
    console.log(`${i + 1}. [${m.score}分] ${brandMap[m.product.brandId]} ${m.product.modelName} (${m.product.year})`);
    console.log(`   ← ${m.folder.name} (${m.folder.images.length}图 + ${m.folder.videos.length}视频)`);
  });

  // 5. 限制20台
  const batch = toUpload.slice(0, 20);
  console.log(`\n🚀 即将上传 ${batch.length} 台...\n`);

  // 6. 上传
  let totalImgs = 0, totalVids = 0, success = 0;

  for (let i = 0; i < batch.length; i++) {
    const { product, folder } = batch[i];
    const pid = product.id;
    const prefix = `products/${pid}/`;
    
    process.stdout.write(`[${i + 1}/${batch.length}] ${brandMap[product.brandId]} ${product.modelName} `);

    let imgOk = 0, vidOk = 0;
    
    // 上传图片
    for (let j = 0; j < folder.images.length; j++) {
      const f = folder.images[j];
      try {
        const r = await client.put(prefix + f, path.join(folder.path, f));
        await prisma.productImage.create({
          data: {
            productId: pid,
            url: r.url,
            sortOrder: j,
            isPrimary: j === 0,
          }
        });
        imgOk++;
        process.stdout.write('.');
      } catch (e) {
        process.stdout.write('✗');
      }
    }

    // 上传视频
    for (const f of folder.videos) {
      try {
        const r = await client.put(prefix + 'videos/' + f, path.join(folder.path, f));
        await prisma.productVideo.create({
          data: { productId: pid, url: r.url }
        });
        vidOk++;
        process.stdout.write('v');
      } catch (e) {
        process.stdout.write('V✗');
      }
    }

    totalImgs += imgOk;
    totalVids += vidOk;
    success++;
    console.log(` ✅ ${imgOk}图+${vidOk}视频`);
  }

  // 7. 汇总
  const finalAll = await prisma.product.count();
  const finalImg = await prisma.productImage.groupBy({ by: ['productId'], _count: true });
  console.log('\n═══════════════════════════');
  console.log(`✅ 上传完成！`);
  console.log(`   产品: ${success}台 | 图片: ${totalImgs}张 | 视频: ${totalVids}个`);
  console.log(`   DB总产品: ${finalAll} | 有图产品: ${finalImg.length}/${finalAll} (${Math.round(finalImg.length/finalAll*100)}%)`);

  await prisma.$disconnect();
})();
