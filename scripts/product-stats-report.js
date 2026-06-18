/**
 * 神雕农机 - 产品统计报告生成脚本
 * 每天凌晨执行，拉取所有产品数据，生成完整统计报告
 * 
 * 用法：
 *   cd D:\神雕农机\usedfarmmach
 *   node scripts/product-stats-report.js [--date YYYY-MM-DD] [--output path/to/output.json]
 * 
 * 输出：JSON格式，包含完整报告数据，可直接推送到乐享知识库
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// ============ 工具函数 ============

// 数据库以"元"存储价格，报告中以"万元"显示
function toWan(val) {
  if (val === null || val === undefined || val === 0) return 0;
  return val / 10000;
}

function fmtPrice(val) {
  if (val === null || val === undefined || val === 0) return '未标价';
  return toWan(val);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 品牌异常检测规则
const brandAnomalyRules = [
  { pattern: /^迪尔/i, suggestion: '→ 约翰迪尔' },
  { pattern: /^进口$/i, suggestion: '→ 待确认真实品牌' },
  { pattern: /^废铁$/i, suggestion: '→ 待确认真实品牌' },
  { pattern: /^arcusln$/i, suggestion: '→ ARCLUSIN' },
  { pattern: /^爱科MF$/i, suggestion: '→ 麦赛弗格森' },
  { pattern: /^MF$/i, suggestion: '→ 麦赛弗格森' },
  { pattern: /^爱科$/i, suggestion: '→ 麦赛弗格森' },
  { pattern: /^克拉斯$/i, suggestion: null },  // 正常
  { pattern: /^纽荷兰$/i, suggestion: null },   // 正常
  { pattern: /^奥库$/i, suggestion: null },     // 正常
  { pattern: /^约翰迪尔$/i, suggestion: null }, // 正常
  { pattern: /^牧农$/i, suggestion: null },     // 正常
];

function detectBrandAnomaly(brandName) {
  for (const rule of brandAnomalyRules) {
    if (rule.pattern.test(brandName)) {
      return rule.suggestion;
    }
  }
  return null; // 未知品牌，不算异常
}

// ============ 核心统计 ============

async function generateReport(targetDate) {
  const dateStr = targetDate || formatDate(new Date());

  // 查询所有活跃产品（包括sold/archived也纳入统计）
  const products = await prisma.product.findMany({
    where: {
      status: { in: ['active', 'sold'] }
    },
    select: {
      id: true,
      modelName: true,
      year: true,
      workingHours: true,
      condition: true,
      priceCny: true,
      location: true,
      status: true,
      brand: { select: { nameZh: true, nameEn: true } },
      category: { select: { nameZh: true, nameEn: true } },
      images: { select: { id: true, url: true, isPrimary: true }, orderBy: { sortOrder: 'asc' } },
      videos: { select: { id: true, url: true, sortOrder: true } },
    },
    orderBy: [
      { brand: { nameZh: 'asc' } },
      { modelName: 'asc' },
    ],
  });

  // ============ 基础统计 ============
  const totalCount = products.length;
  const totalImages = products.reduce((sum, p) => sum + p.images.length, 0);
  const totalVideos = products.reduce((sum, p) => sum + p.videos.length, 0);
  const withVideos = products.filter(p => p.videos.length > 0).length;
  const videoCoverageRate = totalCount > 0 ? (withVideos / totalCount * 100).toFixed(1) : '0';
  const imageCoverageRate = totalCount > 0 ? (products.filter(p => p.images.length > 0).length / totalCount * 100).toFixed(1) : '0';
  
  const pricedProducts = products.filter(p => p.priceCny && p.priceCny > 0);
  const pricedRate = totalCount > 0 ? (pricedProducts.length / totalCount * 100).toFixed(1) : '0';
  
  const prices = pricedProducts.map(p => toWan(p.priceCny));
  const avgPrice = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  const unpriced = products.filter(p => !p.priceCny || p.priceCny === 0);

  // ============ 价格分布 ============
  const priceDistribution = [
    { range: '0 - 5 万', min: 0, max: 5 },
    { range: '5 - 15 万', min: 5, max: 15 },
    { range: '15 - 30 万', min: 15, max: 30 },
    { range: '30 - 60 万', min: 30, max: 60 },
    { range: '60 - 100 万', min: 60, max: 100 },
    { range: '100 万以上', min: 100, max: Infinity },
  ];

  priceDistribution.forEach(dist => {
    dist.count = pricedProducts.filter(p => {
      const priceWan = toWan(p.priceCny);
      if (dist.max === Infinity) return priceWan >= dist.min;
      return priceWan >= dist.min && priceWan < dist.max;
    }).length;
    dist.ratio = pricedProducts.length > 0 ? (dist.count / pricedProducts.length * 100).toFixed(1) : '0';
  });

  // ============ 产品明细 ============
  const productDetails = products.map((p, idx) => ({
    seq: idx + 1,
    idShort: p.id.slice(-6),
    brand: p.brand?.nameZh || p.brand?.nameEn || '?',
    model: p.modelName || '?',
    year: p.year || '',
    hours: p.workingHours || '',
    condition: p.condition || '?',
    price: fmtPrice(p.priceCny),
    imageCount: p.images.length,
    videoCount: p.videos.length,
    category: p.category?.nameZh || p.category?.nameEn || '?',
    location: p.location || '',
    status: p.status,
  }));

  // ============ 缺视频清单 ============
  const missingVideos = products.filter(p => p.videos.length === 0).map(p => {
    const brandName = p.brand?.nameZh || p.brand?.nameEn || '?';
    const anomaly = detectBrandAnomaly(brandName);
    return {
      idShort: p.id.slice(-6),
      brand: brandName,
      model: p.modelName || '?',
      price: fmtPrice(p.priceCny),
      category: p.category?.nameZh || p.category?.nameEn || '?',
      brandAnomaly: anomaly || '',
    };
  });

  // ============ 品牌异常 ============
  const brandAnomalies = [];
  const checkedBrands = new Set();
  products.forEach(p => {
    const brandName = p.brand?.nameZh || p.brand?.nameEn || '?';
    if (checkedBrands.has(brandName)) return;
    checkedBrands.add(brandName);
    const suggestion = detectBrandAnomaly(brandName);
    if (suggestion) {
      brandAnomalies.push({
        idShort: p.id.slice(-6),
        currentBrand: brandName,
        model: p.modelName || '?',
        price: fmtPrice(p.priceCny),
        suggestion: suggestion,
      });
    }
  });

  // ============ 品牌价格分析 ============
  const brandMap = {};
  products.forEach(p => {
    const brandName = p.brand?.nameZh || p.brand?.nameEn || '?';
    if (!brandMap[brandName]) {
      brandMap[brandName] = { products: [], pricedProducts: [] };
    }
    brandMap[brandName].products.push(p);
    if (p.priceCny && p.priceCny > 0) {
      brandMap[brandName].pricedProducts.push(p);
    }
  });

  const brandPriceAnalysis = Object.entries(brandMap)
    .map(([brand, data]) => {
      const priced = data.pricedProducts;
      return {
        brand,
        productCount: data.products.length,
        pricedCount: priced.length,
        unpricedCount: data.products.length - priced.length,
        minPrice: priced.length > 0 ? Math.min(...priced.map(p => toWan(p.priceCny))) : null,
        maxPrice: priced.length > 0 ? Math.max(...priced.map(p => toWan(p.priceCny))) : null,
        avgPrice: priced.length > 0 ? (priced.reduce((s, p) => s + toWan(p.priceCny), 0) / priced.length).toFixed(2) : null,
      };
    })
    .sort((a, b) => b.productCount - a.productCount);

  // ============ 品类分布 ============
  const categoryMap = {};
  products.forEach(p => {
    const catName = p.category?.nameZh || p.category?.nameEn || '?';
    categoryMap[catName] = (categoryMap[catName] || 0) + 1;
  });
  const categoryDistribution = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    reportDate: dateStr,
    summary: {
      totalProducts: totalCount,
      totalImages,
      totalVideos,
      imageCoverageRate: `${imageCoverageRate}%`,
      videoCoverageRate: `${videoCoverageRate}%`,
      withVideos,
      pricedCount: pricedProducts.length,
      pricedRate: `${pricedRate}%`,
      unpricedCount: unpriced.length,
      avgPrice: parseFloat(avgPrice),
      minPrice,
      maxPrice,
    },
    priceDistribution,
    productDetails,
    missingVideos,
    brandAnomalies,
    brandPriceAnalysis,
    categoryDistribution,
  };
}

// ============ 生成 Lexiang HTML 内容（用于直接推送到乐享） ============

function generateLexiangHtml(data) {
  const { reportDate, summary, priceDistribution, productDetails, missingVideos, brandAnomalies, brandPriceAnalysis, categoryDistribution } = data;

  // 核心指标表
  let summaryRows = '';
  summaryRows += `<tr><td>在售产品总数</td><td>${summary.totalProducts} 台</td><td>—</td></tr>\n`;
  summaryRows += `<tr><td>图片覆盖率</td><td>${summary.imageCoverageRate}</td><td>${summary.totalImages} 张图片</td></tr>\n`;
  summaryRows += `<tr><td>视频覆盖率</td><td>${summary.videoCoverageRate}</td><td>${summary.withVideos}/${summary.totalProducts} 台有视频，共 ${summary.totalVideos} 个视频</td></tr>\n`;
  summaryRows += `<tr><td>已标价率</td><td>${summary.pricedRate}</td><td>${summary.pricedCount}/${summary.totalProducts} 台${summary.unpricedCount > 0 ? `（${summary.unpricedCount}台未标价）` : ''}</td></tr>\n`;
  summaryRows += `<tr><td>图片总数</td><td>${summary.totalImages} 张</td><td>—</td></tr>\n`;
  summaryRows += `<tr><td>视频总数</td><td>${summary.totalVideos} 个</td><td>—</td></tr>\n`;
  summaryRows += `<tr><td>均价</td><td>¥${summary.avgPrice.toFixed(2)}万</td><td>区间 ¥${summary.minPrice} ~ ¥${summary.maxPrice}万</td></tr>\n`;

  // 价格分布行
  let priceDistRows = '';
  priceDistribution.forEach(d => {
    priceDistRows += `<tr><td>${d.range}</td><td>${d.count}</td><td>${d.ratio}%</td></tr>\n`;
  });

  // 产品明细行 - 只显示品牌名
  let productRows = '';
  productDetails.forEach(p => {
    const priceDisplay = typeof p.price === 'number' ? p.price : p.price;
    productRows += `<tr><td>${p.seq}</td><td>${p.idShort}</td><td>${p.brand}</td><td>${p.model}</td><td>${p.year}</td><td>${p.hours}</td><td>${p.condition}</td><td>${priceDisplay}</td><td>${p.imageCount}</td><td>${p.videoCount}</td><td>${p.category}</td><td>${p.location}</td><td>${p.status}</td></tr>\n`;
  });

  // 缺视频行
  let missingVideoRows = '';
  missingVideos.forEach((m, idx) => {
    const priceDisplay = typeof m.price === 'number' ? m.price : m.price;
    missingVideoRows += `<tr><td>${idx + 1}</td><td>${m.idShort}</td><td>${m.brand}</td><td>${m.model}</td><td>${priceDisplay}</td><td>${m.category}</td><td>${m.brandAnomaly}</td></tr>\n`;
  });

  // 品牌异常行
  let brandAnomalyRows = '';
  brandAnomalies.forEach(b => {
    const priceDisplay = typeof b.price === 'number' ? b.price : b.price;
    brandAnomalyRows += `<tr><td>${b.idShort}</td><td>${b.currentBrand}</td><td>${b.model}</td><td>${priceDisplay}</td><td>${b.suggestion}</td></tr>\n`;
  });

  // 品牌价格分析行
  let brandPriceRows = '';
  brandPriceAnalysis.forEach(b => {
    brandPriceRows += `<tr><td>${b.brand}</td><td>${b.productCount}</td><td>${b.pricedCount}</td><td>${b.unpricedCount}</td><td>${b.minPrice !== null ? Number(b.minPrice.toFixed(2)) : '-'}</td><td>${b.maxPrice !== null ? Number(b.maxPrice.toFixed(2)) : '-'}</td><td>${b.avgPrice !== null ? b.avgPrice : '-'}</td></tr>\n`;
  });

  // 品类分布行
  let categoryRows = '';
  categoryDistribution.forEach(c => {
    categoryRows += `<tr><td>${c.name}</td><td>${c.count}</td><td>${(c.count / summary.totalProducts * 100).toFixed(1)}%</td></tr>\n`;
  });

  return `[📊 总览:神雕农机 · 产品统计总览（${reportDate}）]
|核心指标|核心指标|核心指标|
|---|---|---|
|指标|数值|占比 / 说明|
${summaryRows}
|价格分布|价格分布|价格分布|
|价格区间|数量|占比|
${priceDistRows}

[📋 产品明细]
|序号|ID(末6位)|品牌|型号|年份|工时(h)|车况|价格(万)|图片数|视频数|品类|位置|状态|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${productRows}

[🎬 缺视频清单]
|序号|ID|品牌|型号|价格(万)|品类|品牌异常|
|---|---|---|---|---|---|---|
${missingVideoRows}

[⚠️ 品牌异常]
|ID|当前品牌名|型号|价格(万)|建议修正|
|---|---|---|---|---|
${brandAnomalyRows}

[💰 品牌价格分析]
|品牌|产品数|已标价|未标价|最低(万)|最高(万)|平均(万)|
|---|---|---|---|---|---|---|
${brandPriceRows}

[📂 品类分布]
|品类|数量|占比|
|---|---|---|
${categoryRows}
`;
}

// ============ 主函数 ============

async function main() {
  const args = process.argv.slice(2);
  let targetDate = null;
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      targetDate = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = path.resolve(args[++i]);
    }
  }

  console.log(`🔍 正在生成产品统计报告... (日期: ${targetDate || '今天'})`);
  
  const reportData = await generateReport(targetDate);
  
  // 生成 Lexiang HTML
  const lexiangContent = generateLexiangHtml(reportData);
  
  // 输出文件
  const outputDir = path.resolve(__dirname, '../../神雕日报');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const htmlPath = path.join(outputDir, `神雕农机产品统计报告_${reportData.reportDate}.md`);
  fs.writeFileSync(htmlPath, lexiangContent, 'utf-8');
  
  console.log(`✅ 报告已生成: ${htmlPath}`);
  console.log(`📊 产品总数: ${reportData.summary.totalProducts}`);
  console.log(`📷 图片覆盖率: ${reportData.summary.imageCoverageRate}`);
  console.log(`🎬 视频覆盖率: ${reportData.summary.videoCoverageRate}`);
  console.log(`💰 已标价率: ${reportData.summary.pricedRate}`);
  console.log(`💵 均价: ${reportData.summary.avgPrice.toFixed(2)}万`);
  console.log(`🎯 缺视频: ${reportData.missingVideos.length} 台`);
  console.log(`⚠️ 品牌异常: ${reportData.brandAnomalies.length} 个`);
  
  // 如果指定了 JSON 输出路径
  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2), 'utf-8');
    console.log(`📄 JSON已保存: ${outputPath}`);
  }
  
  // 输出标题供自动化使用
  console.log(`📋 REPORT_TITLE: 神雕农机产品统计报告_${reportData.reportDate}`);
  console.log(`📋 REPORT_PATH: ${htmlPath}`);
}

main()
  .catch(e => {
    console.error('❌ 报告生成失败:', e.message);
    console.error(e.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
