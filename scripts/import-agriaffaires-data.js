/**
 * Agriaffaires 数据导入脚本
 * 
 * 将 scrape_agriaffaires.py 生成的 JSON 数据导入数据库 MarketIntel 表
 * 用法: node scripts/import-agriaffaires-data.js
 * 
 * 前置条件: npx prisma generate (确保 Prisma Client 更新)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const DATA_FILE = path.join(__dirname, '..', '..', 'scripts', 'agriaffaires_data.json');

async function main() {
  console.log('=' .repeat(60));
  console.log('📥 Agriaffaires 数据导入器');
  console.log('=' .repeat(60));

  // 1. 读取JSON
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ 数据文件不存在: ${DATA_FILE}`);
    console.error('   请先运行: python scripts/build_agriaffaires_json.py');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const listings = raw.listings;
  console.log(`\n📊 读取到 ${listings.length} 条CLAAS青储机在售数据`);
  console.log(`   有价格: ${raw.withPrice} | 价格面议: ${raw.priceOnRequest}`);
  console.log(`   数据日期: ${raw.scrapedAt}`);

  // 2. 统计分析
  const withPrice = listings.filter(l => l.priceEur != null);
  
  // 型号统计
  const modelStats = {};
  const modelPrices = {};
  for (const l of withPrice) {
    const model = l.modelName;
    if (!modelStats[model]) modelStats[model] = [];
    modelStats[model].push(l.priceEur);
    if (!modelPrices[model]) modelPrices[model] = { min: Infinity, max: -Infinity, prices: [] };
    modelPrices[model].prices.push(l.priceEur);
    if (l.priceEur < modelPrices[model].min) modelPrices[model].min = l.priceEur;
    if (l.priceEur > modelPrices[model].max) modelPrices[model].max = l.priceEur;
  }

  // 3. 构建 MarketIntel 条目
  const entries = [];
  
  // 主条目: 市场总览
    const totalOverview = {
    icon: '📊',
    region: '欧洲市场总览',
    sortOrder: 10,
    regionEn: 'European Market Overview',
    regionRu: 'Обзор европейского рынка',
    tags: JSON.stringify(['CLAAS', '青储机', '欧洲市场', '二手农机', '实时数据']),
    tagsEn: JSON.stringify(['CLAAS', 'Forage Harvester', 'European Market', 'Used Machinery', 'Real-time Data']),
    tagsRu: JSON.stringify(['CLAAS', 'Кормоуборочный комбайн', 'Европейский рынок', 'Подержанная техника']),
    text: `Agriaffaires平台CLAAS青储机在售${listings.length}台 | 有标价${raw.withPrice}台 | 价格面议${raw.priceOnRequest}台 | 数据更新${raw.scrapedAt}`,
    detailedContent: JSON.stringify(raw, null, 2),
    dataSummary: JSON.stringify({
      total: listings.length,
      withPrice: raw.withPrice,
      onRequest: raw.priceOnRequest,
      priceRange: {
        min: Math.min(...withPrice.map(l => l.priceEur)),
        max: Math.max(...withPrice.map(l => l.priceEur)),
        avg: Math.round(withPrice.reduce((s, l) => s + l.priceEur, 0) / withPrice.length),
      },
      yearRange: {
        min: Math.min(...listings.filter(l => l.year).map(l => l.year)),
        max: Math.max(...listings.filter(l => l.year).map(l => l.year)),
      },
      topCountries: getTopCountries(listings, 5),
      topModels: getTopModels(listings, 10),
    }),
    actionTips: JSON.stringify([`🇪🇺 欧洲市场活跃 | CLAAS JAGUAR 950 最受欢迎(${modelStats['JAGUAR 950']?.length || 0}台) | 德国市场最大(${listings.filter(l => l.country === 'Germany').length}台) | 适合跨境套利参考`]),
  };
  entries.push(totalOverview);

  // 型号条目: Top 5 型号的价格统计
  const top5Models = Object.entries(modelPrices)
    .sort((a, b) => b[1].prices.length - a[1].prices.length)
    .slice(0, 5);

  let idx = 0;
  for (const [model, data] of top5Models) {
    idx++;
    const avg = Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length);
    const median = getMedian(data.prices);
    const samples = data.prices.length;

    const modelEntry = {
      icon: '🔧',
      sortOrder: 10 + idx,
      region: `${model} 价格参考`,
      regionEn: `${model} Price Reference`,
      regionRu: `${model} Ценовой ориентир`,
      tags: JSON.stringify([model, '价格参考', '欧洲市场']),
      tagsEn: JSON.stringify([model, 'Price Reference', 'European Market']),
      tagsRu: JSON.stringify([model, 'Ценовой ориентир', 'Европейский рынок']),
      text: `${model}: 均价€${(avg/1000).toFixed(1)}K | 中位数€${(median/1000).toFixed(1)}K | 范围€${(data.min/1000).toFixed(1)}K~€${(data.max/1000).toFixed(1)}K | ${samples}个样本`,
      detailedContent: JSON.stringify(data, null, 2),
      dataSummary: JSON.stringify({
        model,
        sampleCount: samples,
        avgPrice: avg,
        medianPrice: median,
        minPrice: data.min,
        maxPrice: data.max,
        priceStdDev: Math.round(getStdDev(data.prices)),
      }),
      actionTips: JSON.stringify([`${model} 欧洲均价约 €${(avg/1000).toFixed(0)}K，对比国内同类可评估套利空间`]),
    };
    entries.push(modelEntry);
  }

  // 4. 清空旧数据 + 写入新数据（⚠️ 保留 sortOrder=0 的永久推广位）
  console.log('\n🗑️  清理旧 MarketIntel 数据（保留永久推广位）...');
  const deleted = await prisma.marketIntel.deleteMany({
    where: { sortOrder: { gt: 0 } }  // 只删除非永久推广的旧记录
  });
  console.log(`   已删除 ${deleted.count} 条旧记录`);

  console.log('📝 写入新数据...');
  let imported = 0;
  for (const entry of entries) {
    await prisma.marketIntel.create({
      data: {
        date: new Date(),
        icon: entry.icon,
        region: entry.region,
        regionEn: entry.regionEn,
        regionRu: entry.regionRu,
        tags: entry.tags,
        tagsEn: entry.tagsEn,
        tagsRu: entry.tagsRu,
        text: entry.text,
        detailedContent: entry.detailedContent,
        dataSummary: entry.dataSummary,
        actionTips: entry.actionTips,
        sortOrder: entry.sortOrder,
        isActive: true,
      },
    });
    imported++;
    console.log(`   ✅ ${entry.region}`);
  }

  console.log(`\n✅ 导入完成: ${imported} 条 MarketIntel 记录`);
  console.log('=' .repeat(60));
}

// 辅助函数
function getTopCountries(listings, n) {
  const count = {};
  for (const l of listings) {
    count[l.country] = (count[l.country] || 0) + 1;
  }
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([c, n]) => ({ country: c, count: n }));
}

function getTopModels(listings, n) {
  const count = {};
  for (const l of listings) {
    count[l.modelName] = (count[l.modelName] || 0) + 1;
  }
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([m, n]) => ({ model: m, count: n }));
}

function getMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getStdDev(arr) {
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

main()
  .catch(e => {
    console.error('❌ 导入失败:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
