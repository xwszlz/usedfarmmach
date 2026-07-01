/**
 * 实时市场数据获取 — 供文章/日报生成使用
 * 
 * 从数据库 MarketIntel + JSON 文件获取最新 Agriaffaires 数据
 * 输出标准化格式，供 generate_articles.py / 日报脚本调用
 * 
 * 用法: node scripts/fetch-live-market-data.js [--json] [--summary]
 *   --json: 输出原始JSON (供Python脚本调用)
 *   --summary: 输出文本摘要 (默认)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const DATA_FILE = path.join(__dirname, 'agriaffaires_data.json');
const EUR_CNY_RATE = 7.91; // 2026-06 参考汇率

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--json') ? 'json' : 'summary';

  // 尝试从JSON文件读取（更新、更全）
  let listings = [];
  let scrapedAt = '';
  
  if (fs.existsSync(DATA_FILE)) {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    listings = raw.listings;
    scrapedAt = raw.scrapedAt;
  }

  // 如果JSON不存在，回退到数据库
  if (listings.length === 0) {
    const records = await prisma.marketIntel.findMany({
      orderBy: { date: 'desc' },
      take: 10,
    });
    if (records.length > 0 && records[0].detailedContent) {
      try {
        const data = JSON.parse(records[0].detailedContent);
        listings = data.listings || [];
        scrapedAt = data.scrapedAt || '';
      } catch (e) {}
    }
  }

  if (listings.length === 0) {
    console.error('❌ 没有可用的市场数据');
    process.exit(1);
  }

  const withPrice = listings.filter(l => l.priceEur != null);

  // 型号价格统计
  const modelPrices = {};
  for (const l of withPrice) {
    const model = l.modelName;
    if (!modelPrices[model]) modelPrices[model] = { prices: [], years: [], hours: [], countries: {} };
    modelPrices[model].prices.push(l.priceEur);
    if (l.year) modelPrices[model].years.push(l.year);
    if (l.engineHours) modelPrices[model].hours.push(l.engineHours);
    modelPrices[model].countries[l.country] = (modelPrices[model].countries[l.country] || 0) + 1;
  }

  const modelStats = {};
  for (const [model, data] of Object.entries(modelPrices)) {
    const prices = data.prices.sort((a, b) => a - b);
    const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
    const median = prices[Math.floor(prices.length / 2)];
    const cnyAvg = Math.round(avg * EUR_CNY_RATE / 10000 * 10) / 10; // 万元
    const cnyMin = Math.round(prices[0] * EUR_CNY_RATE / 10000 * 10) / 10;
    const cnyMax = Math.round(prices[prices.length - 1] * EUR_CNY_RATE / 10000 * 10) / 10;
    
    modelStats[model] = {
      count: prices.length,
      avgEur: avg,
      medianEur: median,
      minEur: prices[0],
      maxEur: prices[prices.length - 1],
      avgCnyWan: cnyAvg,
      minCnyWan: cnyMin,
      maxCnyWan: cnyMax,
      avgYear: data.years.length ? Math.round(data.years.reduce((s, y) => s + y, 0) / data.years.length) : null,
      avgHours: data.hours.length ? Math.round(data.hours.reduce((s, h) => s + h, 0) / data.hours.length) : null,
      topCountries: Object.entries(data.countries).sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }

  if (mode === 'json') {
    console.log(JSON.stringify({
      scrapedAt,
      totalListings: listings.length,
      withPrice: withPrice.length,
      eurCnyRate: EUR_CNY_RATE,
      modelStats,
      topListings: withPrice.sort((a, b) => b.priceEur - a.priceEur).slice(0, 20),
    }, null, 2));
    return;
  }

  // Summary 模式
  console.log('=' .repeat(60));
  console.log('📊 Agriaffaires CLAAS 青储机实时市场数据');
  console.log(`   更新时间: ${scrapedAt}`);
  console.log(`   在售总数: ${listings.length} | 有标价: ${withPrice.length}`);
  console.log(`   EUR/CNY: ${EUR_CNY_RATE}`);
  console.log('=' .repeat(60));

  const popularModels = Object.entries(modelStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  for (const [model, stats] of popularModels) {
    console.log(`\n🔧 ${model} (${stats.count}台, 年份均值:${stats.avgYear || 'N/A'})`);
    console.log(`   EUR: €${(stats.minEur/1000).toFixed(1)}K ~ €${(stats.maxEur/1000).toFixed(1)}K (中位€${(stats.medianEur/1000).toFixed(1)}K)`);
    console.log(`   CNY: 约 ¥${stats.minCnyWan}万 ~ ¥${stats.maxCnyWan}万 (中位¥${(stats.avgCnyWan - (stats.maxCnyWan-stats.minCnyWan)/2/stats.count).toFixed(0)}万)`);
    console.log(`   分布: ${stats.topCountries.map(([c, n]) => `${c}(${n})`).join(' | ')}`);
  }
}

main()
  .catch(e => console.error('❌', e.message))
  .finally(() => prisma.$disconnect());
