// Aggressive fix: match by brand only, update model+year, create missing products
const fs = require('fs');
const path = require('path');

const envPath = path.join('D:/神雕农机/usedfarmmach', '.env.local');
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const t = line.trim();
  if (t && !t.startsWith('#')) {
    const i = t.indexOf('=');
    if (i > 0) {
      let k = t.substring(0,i).trim(), v = t.substring(i+1).trim();
      if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
      if(!process.env[k]) process.env[k]=v;
    }
  }
});

const { PrismaClient } = require('@prisma/client');

const SOURCE_DIRS = [
  'D:/神雕农机/出口农机',
  'D:/神雕农机/神雕农机网站图片0606',
];

const BRAND_ALIASES = {
  '克拉斯':'克拉斯','claas':'克拉斯',
  '纽荷兰':'纽荷兰','newholland':'纽荷兰','new holland':'纽荷兰',
  '克罗尼':'克罗尼','krone':'克罗尼',
  '迪尔':'约翰迪尔','johndeere':'约翰迪尔','john deere':'约翰迪尔','deere':'约翰迪尔',
  '凯斯':'凯斯','caseih':'凯斯','case':'凯斯',
  '芬特':'芬特','fendt':'芬特',
  '奥库':'奥库','orkel':'奥库',
  '库恩':'库恩','kuhn':'库恩',
  '曼尼通':'曼尼通','manitou':'曼尼通',
  '麦赛弗格森':'麦赛弗格森','麦赛':'麦赛弗格森','massey':'麦赛弗格森',
  '美迪':'美迪','牧神':'牧神','牧农':'牧农',
  '金轮':'金轮','法兰信':'法兰信','falanxin':'法兰信',
  '冠军':'冠军',
  '康斯凯尔':'康斯凯尔','kongskilde':'康斯凯尔',
  '德翔':'德翔',
  '迈科':'迈科农机',
  '马赛':'马赛',
  '东洋':'东洋',
  '挪威':'格兰',
  '盈嘉':'盈嘉',
  '中农机':'中农机',
  '中联重科':'中联重科',
  '迪马':'迪马战狼',
  '常发':'常发',
  '东方红':'东方红',
  '都麦':'都麦',
  '格里莫':'格立莫','grimme':'格立莫',
  '罗斯特':'罗斯特',
  '艾美特':'艾美特',
  '奥贝斯':'奥贝斯',
  'IDASS':'IDASS',
};

function extractBrand(folderName) {
  const n = folderName.toLowerCase()
    .replace(/^\d{2,4}年?/, '').replace(/进口|国产/g, '')
    .replace(/全新|欧版|美版/g, '').trim();
  for (const [k, v] of Object.entries(BRAND_ALIASES)) {
    if (n.includes(k.toLowerCase())) return v;
  }
  return null;
}

function extractYear(folderName) {
  const m4 = folderName.match(/^(\d{4})/);
  if (m4) return parseInt(m4[1]);
  const m2 = folderName.match(/^(\d{2})年/);
  if (m2) return 2000 + parseInt(m2[1]);
  const m3 = folderName.match(/(\d{4})年/);
  if (m3) return parseInt(m3[1]);
  return null;
}

function extractModel(folderName, brand) {
  let n = folderName
    .replace(/^\d{2,4}年?/, '')
    .replace(/进口|国产/g, '')
    .replace(/全新|欧版|美版/g, '')
    .trim();
  if (brand) n = n.replace(brand, '').trim();
  // Clean up stray characters
  n = n.replace(/^的/, '').replace(/\s+/g, ' ').trim();
  return n || folderName;
}

async function main() {
  const prisma = new PrismaClient();

  // Scan local folders
  const folders = [];
  for (const dir of SOURCE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fp = path.join(dir, entry.name);
      const files = fs.readdirSync(fp).filter(f => /\.(jpg|jpeg|png|webp|avif|mp4|mov)$/i.test(f));
      if (files.length === 0) continue;
      const brand = extractBrand(entry.name);
      if (!brand) continue;
      const year = extractYear(entry.name) || 2020;
      const model = extractModel(entry.name, brand);
      folders.push({ name: entry.name, path: fp, source: dir, brand, year, model, files });
    }
  }

  // Get all DB info
  const dbProducts = await prisma.product.findMany({
    where: { images: { none: {} } },
    include: { brand: true, category: true },
  });
  const allBrands = await prisma.brand.findMany();
  const allCategories = await prisma.category.findMany();
  const brandIdMap = {}; allBrands.forEach(b => brandIdMap[b.nameZh] = b.id);
  const catIdMap = {}; allCategories.forEach(c => catIdMap[c.nameZh] = c.id);

  // Track used DB products
  const usedDbIds = new Set();
  
  // Match: brand only
  const updates = [];
  const needsCreate = [];

  for (const folder of folders) {
    const candidates = dbProducts.filter(p => 
      p.brand?.nameZh === folder.brand && !usedDbIds.has(p.id)
    );

    if (candidates.length > 0) {
      // Pick closest year match
      candidates.sort((a, b) => Math.abs((a.year||2020)-folder.year) - Math.abs((b.year||2020)-folder.year));
      const best = candidates[0];
      updates.push({ productId: best.id, oldName: best.modelName, oldYear: best.year, newName: folder.model, newYear: folder.year, folder: folder.name });
      usedDbIds.add(best.id);
    } else {
      // Need to create product in DB
      const brandId = brandIdMap[folder.brand];
      if (!brandId) { console.log('⚠️  Unknown brand:', folder.brand); continue; }
      // Guess category from folder name
      let catName = '其他';
      const n = folder.name;
      if (/青储|青贮/.test(n)) catName = '青储机';
      else if (/打捆|打包|缠膜|裹包/.test(n)) catName = '打捆机';
      else if (/割草/.test(n)) catName = '割草机';
      else if (/割台/.test(n)) catName = '割台';
      else if (/捡拾/.test(n)) catName = '捡拾台';
      else if (/拖拉机/.test(n)) catName = '拖拉机';
      else if (/搂草/.test(n)) catName = '搂草机';
      else if (/播种|条播/.test(n)) catName = '播种机';
      else if (/甜菜/.test(n)) catName = '甜菜收获机';
      else if (/胡萝卜/.test(n)) catName = '收获机';
      else if (/叉车|夹包/.test(n)) catName = '叉车';
      else if (/收割|双收/.test(n)) catName = '收割机';
      else if (/打捆包膜/.test(n)) catName = '打捆包膜一体机';
      else if (/码垛/.test(n)) catName = '码垛机';

      needsCreate.push({ ...folder, brandId, categoryName: catName, categoryId: catIdMap[catName] || catIdMap['其他'] });
      console.log('🆕 需创建:', folder.brand, folder.model, folder.year, '→', catName);
    }
  }

  console.log(`\n📊 分析结果:`);
  console.log(`  修正现有产品: ${updates.length}`);
  console.log(`  需创建新产品: ${needsCreate.length}`);
  console.log(`  剩余无匹配: ${dbProducts.length - updates.length - needsCreate.length}`);

  // Apply updates
  console.log(`\n🔧 修正 ${updates.length} 个产品型号名和年份...`);
  for (const u of updates) {
    await prisma.product.update({
      where: { id: u.productId },
      data: { modelName: u.newName, year: u.newYear }
    });
    console.log(`  ✅ ${u.oldName}(${u.oldYear}) → ${u.newName}(${u.newYear})  ← ${u.folder}`);
  }

  // Create missing products
  console.log(`\n📝 创建 ${needsCreate.length} 个新产品...`);
  for (const nc of needsCreate) {
    const p = await prisma.product.create({
      data: {
        sellerId: 'cmpdjc7xv0000mfv72up1a2y0',
        brandId: nc.brandId,
        categoryId: nc.categoryId || Object.values(catIdMap)[0],
        modelName: nc.model || nc.name,
        year: nc.year,
        condition: 'good',
        priceCny: 0,
        location: '中国',
        descriptionZh: nc.name,
      }
    });
    console.log(`  ✅ 创建: ${nc.brand} ${nc.model} (${nc.year}) → ${p.id}`);
    // Update the match to use new product ID instead of an old one
    updates.push({ productId: p.id, oldName: '', oldYear: 0, newName: nc.model, newYear: nc.year, folder: nc.name, isNew: true });
  }

  // Now re-run precise-upload with fixed data
  const total = await prisma.product.count();
  const withImg = await prisma.product.count({ where: { images: { some: {} } } });
  console.log(`\n📊 数据库状态: ${withImg}/${total} 有图片 (${(withImg/total*100).toFixed(0)}%)`);
  console.log(`无图片: ${total - withImg} 台`);

  await prisma.$disconnect();
  console.log('\n✅ 数据修正完成，可以重新运行 precise-upload.js');
}

main().catch(e => { console.error('💥', e); process.exit(1); });
