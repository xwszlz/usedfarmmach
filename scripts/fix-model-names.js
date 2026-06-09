// Fix DB model names by matching to local folder names
const fs = require('fs');
const path = require('path');

// Load .env
try {
  const envPath = path.join('D:/神雕农机/usedfarmmach', '.env.local');
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
} catch (e) {}

const { PrismaClient } = require('@prisma/client');

const SOURCE_DIRS = [
  'D:/神雕农机/出口农机',
  'D:/神雕农机/神雕农机网站图片0606',
];

// Brand name mapping (Chinese → DB brand nameZh)
const BRAND_MAP = {
  '克拉斯': '克拉斯', 'claas': '克拉斯',
  '纽荷兰': '纽荷兰', 'newholland': '纽荷兰', 'new holland': '纽荷兰',
  '克罗尼': '克罗尼', 'krone': '克罗尼',
  '迪尔': '迪尔', 'johndeere': '迪尔', 'john deere': '迪尔',
  '凯斯': '凯斯', 'caseih': '凯斯', 'case': '凯斯',
  '芬特': '芬特', 'fendt': '芬特',
  '奥库': '奥库', 'orkel': '奥库',
  '库恩': '库恩', 'kuhn': '库恩',
  '曼尼通': '曼尼通', 'manitou': '曼尼通',
  '麦赛弗格森': '麦赛弗格森', 'masseyferguson': '麦赛弗格森', '麦赛': '麦赛弗格森',
  '美迪': '美迪', '牧神': '牧神', '牧农': '牧农',
  '金轮': '金轮', '法兰信': '法兰信',
  '冠军': '冠军', '康斯凯尔': '康斯凯尔', 'kongskilde': '康斯凯尔',
  '德翔': '德翔', '迈科': '迈科', '马赛': '马赛',
  '东洋': '东洋', '挪威': '挪威', '盈嘉': '盈嘉',
  '中农机': '中农机', '中联重科': '中联重科',
  '迪马': '迪马', '常发': '常发',
  '东方红': '东方红', '都麦': '都麦',
  '格里莫': '格里莫',
};

function extractBrand(folderName) {
  const n = folderName.toLowerCase().replace(/^\d+年?/, '').replace(/进口|国产/g, '').trim();
  for (const [k, v] of Object.entries(BRAND_MAP)) {
    if (n.includes(k.toLowerCase())) return v;
  }
  return null;
}

function extractYear(folderName) {
  const m = folderName.match(/(\d{4})|(^\d{2})年/);
  if (!m) return null;
  const y = parseInt(m[1] || m[2]);
  if (m[2]) return 2000 + y; // "14年" → 2014
  return y;
}

function extractModelNumbers(folderName) {
  // Get all numeric sequences, filter out years
  const nums = (folderName.match(/\d+/g) || []).map(Number);
  return nums.filter(n => n < 1900 || n > 2030); // Exclude years
}

async function main() {
  const prisma = new PrismaClient();

  // Read all local folders
  const allFolders = [];
  for (const dir of SOURCE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fp = path.join(dir, entry.name);
      const files = fs.readdirSync(fp).filter(f => /\.(jpg|jpeg|png|webp|avif|mp4|mov)$/i.test(f));
      if (files.length === 0) continue;
      
      const brand = extractBrand(entry.name);
      const year = extractYear(entry.name);
      const modelNums = extractModelNumbers(entry.name);
      
      allFolders.push({ name: entry.name, path: fp, brand, year, modelNums, files });
    }
  }

  // Get all products without images
  const dbProducts = await prisma.product.findMany({
    where: { images: { none: {} } },
    include: { brand: true },
  });

  // Get all brands
  const allBrands = await prisma.brand.findMany();
  const brandNameToId = {};
  allBrands.forEach(b => { brandNameToId[b.nameZh] = b.id; });

  // Match + plan updates
  const updates = [];
  const usedDb = new Set();

  for (const folder of allFolders) {
    if (!folder.brand || !folder.year || folder.modelNums.length === 0) continue;

    const dbBrand = folder.brand;
    const candidates = dbProducts.filter(p => 
      p.brand?.nameZh === dbBrand && 
      Math.abs((p.year || 2020) - folder.year) <= 2 &&
      !usedDb.has(p.id)
    );

    if (candidates.length === 0) continue;

    // Pick the best candidate
    const sorted = candidates.map(p => {
      const dbNums = (p.modelName || '').match(/\d+/g) || [];
      const common = folder.modelNums.filter(n => dbNums.includes(n.toString()));
      return { p, score: common.length };
    }).sort((a, b) => b.score - a.score);

    const best = sorted[0];
    // Build model name from folder
    const modelStr = folder.name.replace(/^\d{2,4}年?/, '').replace(/进口|国产/g, '').replace(dbBrand, '').trim();
    
    if (best.p.modelName === '无' || best.p.modelName === '无型号' || 
        (best.score === 0 && modelStr.length > 0 && modelStr.length < 30)) {
      updates.push({ productId: best.p.id, oldName: best.p.modelName, newName: modelStr, folder: folder.name });
      usedDb.add(best.p.id);
    }
  }

  console.log(`📋 发现 ${updates.length} 个可修正的型号名:\n`);
  for (const u of updates) {
    console.log(`  ${u.oldName} → ${u.newName}  (来自: ${u.folder})`);
  }

  if (updates.length === 0) {
    console.log('没有需要修正的型号。');
    await prisma.$disconnect();
    return;
  }

  // Apply updates
  console.log(`\n🔧 正在更新 ${updates.length} 个产品...`);
  let done = 0;
  for (const u of updates) {
    await prisma.product.update({
      where: { id: u.productId },
      data: { modelName: u.newName }
    });
    done++;
  }
  console.log(`✅ 已更新 ${done} 个产品的型号名\n`);

  // Show remaining unmatched
  const remaining = await prisma.product.count({ where: { images: { none: {} } } });
  console.log(`📊 剩余无图片产品: ${remaining} 台`);

  await prisma.$disconnect();
}

main().catch(e => { console.error('💥', e); process.exit(1); });
