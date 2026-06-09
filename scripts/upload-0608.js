/**
 * 批量匹配 + 上传 0608 新素材到 OSS
 * 
 * 素材来源：D:\神雕农机\网站图片补充0608\2026.6.8\
 * 
 * 流程：
 * 1. 扫描23个文件夹 → 解析品牌/型号/年份
 * 2. 匹配数据库产品
 * 3. 已匹配 → 上传到 existing product
 * 4. 未匹配 → 创建新产品 → 上传
 */

const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');

// ========== 加载 .env.local ==========
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
  console.log('✅ 已加载 .env.local');
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ========== 品牌映射（中文名 → DB品牌名） ==========
const BRAND_MAP = {
  '纽荷兰': '纽荷兰', 'newholland': '纽荷兰', 'new holland': '纽荷兰',
  '克拉斯': '克拉斯', 'claas': '克拉斯',
  '克罗尼': '克罗尼', 'krone': '克罗尼',
  '迪尔': '约翰迪尔', 'johndeere': '约翰迪尔', 'john deere': '约翰迪尔', 'deere': '约翰迪尔',
  '凯斯': '凯斯', 'case': '凯斯', 'caseih': '凯斯', 'case ih': '凯斯',
  '芬特': '芬特', 'fendt': '芬特',
  '奥库': '奥库', 'orkel': '奥库',
  '奥贝斯': '奥贝斯', 'aubis': '奥贝斯',
  '冠军': '冠军', 'champion': '冠军',
  '罗斯特': '罗斯特', 'rostselmash': '罗斯特', 'rsm': '罗斯特',
  '牧农': '牧农', 'munong': '牧农',
  '华夏': '华夏', 'huaxia': '华夏',
  '法兰信': '法兰信', 'falansin': '法兰信',
  '康斯凯尔': '康斯凯尔', 'konskilde': '康斯凯尔',
  'arcusln': 'arcusln',
  '国产牧农': '牧农',
  '德国': '德国',
  '其他': '其他',
};

// 品类关键词映射
const CATEGORY_KEYWORDS = [
  { kw: '青储机', cat: '青储机' },
  { kw: '裹包机', cat: '裹包机' },
  { kw: '打包机', cat: '打捆机' },
  { kw: '打捆机', cat: '打捆机' },
  { kw: '割台', cat: '割台' },
  { kw: '割草机', cat: '割草机' },
  { kw: '捡石机', cat: '捡石机' },
  { kw: '拖拉机', cat: '拖拉机' },
  { kw: '脱粒机', cat: '收获机' },
  { kw: '茎穗双收', cat: '收获机' },
  { kw: '码垛机', cat: '裹包机' },
  { kw: '夹包机', cat: '裹包机' },
  { kw: '柠条割台', cat: '割台' },
];

// ========== OSS 客户端 ==========
let ossClient = null;
function getOSS() {
  if (ossClient) return ossClient;
  ossClient = new OSS({
    region: 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: 'usedfarmmach-oss',
  });
  return ossClient;
}

// ========== 文件夹名解析 ==========
function parseFolderName(name) {
  const clean = name.replace(/进口|国产/g, '').trim();
  
  // 提取年份
  let year = null;
  const yearMatch = clean.match(/(\d{4})/);
  if (yearMatch) year = parseInt(yearMatch[1]);
  
  // 提取品牌
  let brand = null;
  // 按品牌名长度排序（长名优先匹配，避免"迪尔"匹配到"约翰迪尔"）
  const sortedBrands = Object.keys(BRAND_MAP).sort((a, b) => b.length - a.length);
  for (const b of sortedBrands) {
    if (clean.toLowerCase().includes(b.toLowerCase()) || 
        clean.includes(BRAND_MAP[b])) {
      brand = BRAND_MAP[b];
      break;
    }
  }
  
  // 提取品类
  let category = '其他';
  for (const c of CATEGORY_KEYWORDS) {
    if (clean.includes(c.kw)) { category = c.cat; break; }
  }
  
  // 提取型号（去掉品牌和品类后剩下的）
  let model = clean;
  if (brand) {
    for (const b of Object.keys(BRAND_MAP)) {
      if (BRAND_MAP[b] === brand) {
        model = model.replace(new RegExp(b, 'i'), '').trim();
      }
    }
  }
  if (category !== '其他') model = model.replace(category, '').trim();
  
  // 清理
  model = model.replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!model || model === '' || model === '进口' || model === '国产') {
    model = name.replace(/进口|国产/g, '').trim().replace(/\d{4}/, '').trim();
  }
  
  return { folderName: name, year, brand, category, model };
}

// ========== 匹配数据库产品 ==========
async function matchWithDB(parsed, allProducts, allBrands, allCategories) {
  const brandMap = Object.fromEntries(allBrands.map(b => [b.nameZh, b.id]));
  const catMap = Object.fromEntries(allCategories.map(c => [c.nameZh, c.id]));
  
  const matched = [];
  const unmatched = [];
  
  for (const p of parsed) {
    const year = p.year;
    const targetBrandId = brandMap[p.brand] || null;
    const targetCatId = catMap[p.category] || null;
    
    // 策略1：品牌+型号+年份精确匹配
    if (targetBrandId && year) {
      let candidates = allProducts.filter(db => {
        if (db.brandId !== targetBrandId) return false;
        if (Math.abs(db.year - year) > 2) return false;
        return true;
      });
      
      // 型号模糊匹配
      if (p.model && p.model !== '') {
        const modelNums = p.model.match(/\d+/g) || [];
        if (modelNums.length > 0) {
          candidates = candidates.filter(db => {
            const dbNums = (db.modelName || '').match(/\d+/g) || [];
            return modelNums.some(n => dbNums.includes(n));
          });
        }
      }
      
      // 取第一个候选
      if (candidates.length > 0) {
        // 优先选没有图片的
        candidates.sort((a, b) => {
          const aNoImg = a._count?.images || 0;
          const bNoImg = b._count?.images || 0;
          return aNoImg - bNoImg; // 无图的排前面
        });
        matched.push({ ...p, productId: candidates[0].id, dbModel: candidates[0].modelName, dbYear: candidates[0].year });
        continue;
      }
    }
    
    // 策略2：只看型号+年份（放宽品牌限制）
    if (year && p.model) {
      const modelNums = p.model.match(/\d+/g) || [];
      if (modelNums.length > 0) {
        let candidates = allProducts.filter(db => {
          if (Math.abs(db.year - year) > 2) return false;
          const dbNums = (db.modelName || '').match(/\d+/g) || [];
          return modelNums.some(n => dbNums.includes(n));
        });
        if (candidates.length > 0) {
          candidates.sort((a, b) => (a._count?.images || 0) - (b._count?.images || 0));
          matched.push({ ...p, productId: candidates[0].id, dbModel: candidates[0].modelName, dbYear: candidates[0].year });
          continue;
        }
      }
    }
    
    unmatched.push(p);
  }
  
  return { matched, unmatched, brandMap, catMap };
}

// ========== 上传图片到 OSS ==========
async function uploadImages(folderPath, productId) {
  const files = fs.readdirSync(folderPath).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext);
  });
  
  if (files.length === 0) {
    console.log(`  ⚠️ 没有图片文件`);
    return { images: 0, videos: 0 };
  }
  
  // 找出封面图（带 fm 标记的）
  let coverIdx = files.findIndex(f => f.toLowerCase().includes('fm'));
  if (coverIdx === -1) coverIdx = 0; // 默认第一张为封面
  
  const oss = getOSS();
  let sortOrder = 0;
  let uploadedImgs = 0;
  const imageRecords = [];
  
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const localPath = path.join(folderPath, f);
    const ext = path.extname(f);
    const ossKey = `products/${productId}/${Date.now()}_${i}${ext}`;
    
    try {
      const result = await oss.put(ossKey, localPath);
      const url = `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${ossKey}`;
      
      imageRecords.push({
        productId,
        url,
        sortOrder: i === coverIdx ? 0 : ++sortOrder,
        isPrimary: i === coverIdx,
      });
      uploadedImgs++;
    } catch (err) {
      console.log(`  ❌ 上传失败 ${f}: ${err.message}`);
    }
  }
  
  // 批量写入 ProductImage
  if (imageRecords.length > 0) {
    await prisma.productImage.createMany({ data: imageRecords });
  }
  
  return { images: uploadedImgs, videos: 0 };
}

// ========== 主流程 ==========
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  0608 新素材批量匹配 + 上传');
  console.log('═══════════════════════════════════════\n');
  
  // 1. 扫描文件夹
  const baseDir = 'D:/神雕农机/网站图片补充0608/2026.6.8';
  const folders = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  
  console.log(`📁 扫描到 ${folders.length} 个产品文件夹\n`);
  
  // 2. 解析文件夹名
  const parsed = folders.map(f => parseFolderName(f));
  console.log('📋 解析结果：');
  parsed.forEach(p => console.log(`  ${p.folderName}`));
  console.log();
  
  // 3. 加载数据库
  const allProducts = await prisma.product.findMany({
    select: { id: true, modelName: true, brandId: true, categoryId: true, year: true,
      _count: { select: { images: true } }
    }
  });
  const allBrands = await prisma.brand.findMany({ select: { id: true, nameZh: true } });
  const allCategories = await prisma.category.findMany({ select: { id: true, nameZh: true } });
  
  console.log(`🗄️ DB: ${allProducts.length} 产品, ${allBrands.length} 品牌, ${allCategories.length} 品类\n`);
  
  // 4. 匹配
  const { matched, unmatched, brandMap, catMap } = await matchWithDB(parsed, allProducts, allBrands, allCategories);
  
  console.log(`✅ 匹配成功: ${matched.length} 个`);
  matched.forEach(m => console.log(`  ${m.folderName} → ${m.dbModel} (${m.dbYear}) [${m.productId}]`));
  console.log();
  
  console.log(`❓ 未匹配: ${unmatched.length} 个`);
  unmatched.forEach(m => console.log(`  ${m.folderName} | 品牌:${m.brand} 型号:${m.model} ${m.year}`));
  console.log();
  
  // 5. 先创建未匹配的产品
  const createdIds = {};
  for (const u of unmatched) {
    const bid = brandMap[u.brand];
    const cid = catMap[u.category] || Object.values(catMap)[0];
    
    if (!bid) {
      console.log(`  ⚠️ 跳过 ${u.folderName}: 品牌"${u.brand}"不在DB中`);
      continue;
    }
    
    const product = await prisma.product.create({
      data: {
        sellerId: 'cmpdjc7xv0000mfv72up1a2y0',
        brandId: bid,
        categoryId: cid,
        modelName: u.model || u.folderName,
        year: u.year || 2020,
        condition: 'good',
        priceCny: 0,
        location: '中国',
        descriptionZh: u.folderName,
      }
    });
    createdIds[u.folderName] = product.id;
    console.log(`  🆕 创建 ${u.folderName} → ${product.id}`);
  }
  
  console.log(`\n📦 新产品创建完成: ${Object.keys(createdIds).length} 个\n`);
  
  // 6. 上传图片（已匹配 + 新创建）
  let totalImgs = 0;
  let successFolders = 0;
  
  console.log('🚀 开始上传...\n');
  
  for (const m of matched) {
    const folderPath = path.join(baseDir, m.folderName);
    console.log(`  📤 ${m.folderName} (${m.productId})`);
    try {
      const result = await uploadImages(folderPath, m.productId);
      totalImgs += result.images;
      successFolders++;
      console.log(`    ✅ ${result.images} 张图片已上传`);
    } catch (err) {
      console.log(`    ❌ 错误: ${err.message}`);
    }
  }
  
  for (const [folderName, productId] of Object.entries(createdIds)) {
    const folderPath = path.join(baseDir, folderName);
    console.log(`  📤 ${folderName} (${productId}) [新]`);
    try {
      const result = await uploadImages(folderPath, productId);
      totalImgs += result.images;
      successFolders++;
      console.log(`    ✅ ${result.images} 张图片已上传`);
    } catch (err) {
      console.log(`    ❌ 错误: ${err.message}`);
    }
  }
  
  // 7. 汇总
  const totalAfter = await prisma.product.count();
  const withImgAfter = await prisma.productImage.groupBy({ by: ['productId'], _count: true });
  
  console.log('\n═══════════════════════════════════════');
  console.log('  上传完成');
  console.log('═══════════════════════════════════════');
  console.log(`  处理文件夹: ${successFolders}/${matched.length + Object.keys(createdIds).length}`);
  console.log(`  上传图片: ${totalImgs} 张`);
  console.log(`  产品总数: ${totalAfter}`);
  console.log(`  有图产品: ${withImgAfter.length}/${totalAfter} (${Math.round(withImgAfter.length/totalAfter*100)}%)`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
