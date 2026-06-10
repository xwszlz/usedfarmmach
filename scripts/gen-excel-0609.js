const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ExcelJS = require('exceljs');

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '神雕农机';
  workbook.created = new Date();

  const products = await prisma.product.findMany({
    include: {
      brand: true,
      category: true,
      _count: { select: { images: true, videos: true } }
    },
    orderBy: [{ brand: { nameZh: 'asc' } }, { modelName: 'asc' }]
  });

  // ========== Sheet 1: 产品明细 ==========
  const ws1 = workbook.addWorksheet('产品明细', { views: [{ state: 'frozen', ySplit: 1 }] });

  const h1 = ['序号', '品牌', '型号', '品类', '年份', '成色', '价格(元)', '图片数', '视频数', '状态', '所在地'];
  ws1.columns = h1.map(h => ({
    header: h, key: h,
    width: h === '序号' ? 6 : h === '品牌' ? 14 : h === '型号' ? 24 : h === '品类' ? 20 : h === '价格(元)' ? 14 : h === '状态' ? 8 : h === '所在地' ? 10 : 10
  }));

  const hr1 = ws1.getRow(1);
  hr1.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' };
  hr1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
  hr1.alignment = { horizontal: 'center', vertical: 'middle' };
  hr1.height = 28;

  let totalImages = 0, totalVideos = 0, pricedCount = 0, pricedSum = 0;
  const conditionMap = { excellent: '优秀', good: '良好', fair: '一般' };

  products.forEach((p, i) => {
    totalImages += p._count.images;
    totalVideos += p._count.videos;
    if (p.priceCny > 0) { pricedCount++; pricedSum += p.priceCny; }

    const row = ws1.addRow({
      '序号': i + 1,
      '品牌': p.brand.nameZh,
      '型号': p.modelName || '-',
      '品类': p.category.nameZh,
      '年份': p.year || '-',
      '成色': conditionMap[p.condition] || p.condition,
      '价格(元)': p.priceCny === 0 ? '面议' : p.priceCny,
      '图片数': p._count.images,
      '视频数': p._count.videos,
      '状态': p.status === 'active' ? '上架' : '下架',
      '所在地': p.location || '-'
    });

    if (i % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
    row.font = { size: 10, name: 'Arial' };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 22;

    const pc = row.getCell('价格(元)');
    if (p.priceCny > 0) pc.numFmt = '#,##0';
    else pc.font = { color: { argb: 'FFFF0000' }, size: 10, name: 'Arial' };

    if (p._count.videos === 0) row.getCell('视频数').font = { color: { argb: 'FFFF0000' }, size: 10, name: 'Arial' };
  });

  const sr1 = ws1.addRow({
    '序号': '', '品牌': '合计', '型号': products.length + '个产品', '品类': '', '年份': '',
    '成色': '', '价格(元)': pricedCount > 0 ? Math.round(pricedSum / pricedCount) : 0,
    '图片数': totalImages, '视频数': totalVideos, '状态': '', '所在地': ''
  });
  sr1.font = { bold: true, size: 11, name: 'Arial' };
  sr1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
  sr1.alignment = { horizontal: 'center', vertical: 'middle' };
  sr1.height = 28;
  sr1.getCell('价格(元)').numFmt = '#,##0';

  // ========== Sheet 2: 品牌汇总 ==========
  const brands = await prisma.brand.findMany({
    include: { products: { include: { _count: { select: { images: true, videos: true } } } } }
  });
  const brandData = brands.filter(b => b.products.length > 0).map(b => {
    const priced = b.products.filter(p => p.priceCny > 0);
    return {
      brand: b.nameZh, count: b.products.length,
      images: b.products.reduce((s, p) => s + p._count.images, 0),
      videos: b.products.reduce((s, p) => s + p._count.videos, 0),
      avgPrice: priced.length > 0 ? Math.round(priced.reduce((s, p) => s + p.priceCny, 0) / priced.length) : 0,
      minPrice: priced.length > 0 ? Math.min(...priced.map(p => p.priceCny)) : 0,
      maxPrice: priced.length > 0 ? Math.max(...priced.map(p => p.priceCny)) : 0
    };
  }).sort((a, b) => b.count - a.count);

  const ws2 = workbook.addWorksheet('品牌汇总', { views: [{ state: 'frozen', ySplit: 1 }] });
  const h2 = ['品牌', '产品数', '图片总数', '视频总数', '均价(元)', '最低价(元)', '最高价(元)'];
  ws2.columns = h2.map(h => ({ header: h, key: h === '品牌' ? 'brand' : h, width: h === '品牌' ? 16 : h.includes('价') ? 14 : 12 }));

  const hr2 = ws2.getRow(1);
  hr2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' };
  hr2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } };
  hr2.alignment = { horizontal: 'center', vertical: 'middle' };
  hr2.height = 28;

  brandData.forEach((b, i) => {
    const rowData = {
      '品牌': b.brand, '产品数': b.count, '图片总数': b.images, '视频总数': b.videos,
      '均价(元)': b.avgPrice === 0 ? '面议' : b.avgPrice,
      '最低价(元)': b.avgPrice === 0 ? '-' : b.minPrice,
      '最高价(元)': b.avgPrice === 0 ? '-' : b.maxPrice
    };
    const row = ws2.addRow(rowData);
    if (i % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    row.font = { size: 10, name: 'Arial' };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 22;
    ['均价(元)', '最低价(元)', '最高价(元)'].forEach(c => { const cell = row.getCell(c); if (typeof cell.value === 'number') cell.numFmt = '#,##0'; });
  });

  // ========== Sheet 3: 品类汇总 ==========
  const categories = await prisma.category.findMany({
    include: { products: { include: { _count: { select: { images: true, videos: true } } } } }
  });
  const catData = categories.filter(c => c.products.length > 0).map(c => {
    const priced = c.products.filter(p => p.priceCny > 0);
    return {
      category: c.nameZh, count: c.products.length,
      images: c.products.reduce((s, p) => s + p._count.images, 0),
      videos: c.products.reduce((s, p) => s + p._count.videos, 0),
      avgPrice: priced.length > 0 ? Math.round(priced.reduce((s, p) => s + p.priceCny, 0) / priced.length) : 0,
      minPrice: priced.length > 0 ? Math.min(...priced.map(p => p.priceCny)) : 0,
      maxPrice: priced.length > 0 ? Math.max(...priced.map(p => p.priceCny)) : 0
    };
  }).sort((a, b) => b.count - a.count);

  const ws3 = workbook.addWorksheet('品类汇总', { views: [{ state: 'frozen', ySplit: 1 }] });
  const h3 = ['品类', '产品数', '图片总数', '视频总数', '均价(元)', '最低价(元)', '最高价(元)'];
  ws3.columns = h3.map(h => ({ header: h, key: h === '品类' ? 'category' : h, width: h === '品类' ? 24 : h.includes('价') ? 14 : 12 }));

  const hr3 = ws3.getRow(1);
  hr3.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' };
  hr3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBF8F00' } };
  hr3.alignment = { horizontal: 'center', vertical: 'middle' };
  hr3.height = 28;

  catData.forEach((c, i) => {
    const rowData = {
      '品类': c.category, '产品数': c.count, '图片总数': c.images, '视频总数': c.videos,
      '均价(元)': c.avgPrice === 0 ? '面议' : c.avgPrice,
      '最低价(元)': c.avgPrice === 0 ? '-' : c.minPrice,
      '最高价(元)': c.avgPrice === 0 ? '-' : c.maxPrice
    };
    const row = ws3.addRow(rowData);
    if (i % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    row.font = { size: 10, name: 'Arial' };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 22;
    ['均价(元)', '最低价(元)', '最高价(元)'].forEach(col => { const cell = row.getCell(col); if (typeof cell.value === 'number') cell.numFmt = '#,##0'; });
  });

  // ========== Sheet 4: 价格分析 ==========
  const ws4 = workbook.addWorksheet('价格分析', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws4.columns = [
    { header: '指标', key: 'metric', width: 20 },
    { header: '数值', key: 'value', width: 18 }
  ];

  const hr4 = ws4.getRow(1);
  hr4.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' };
  hr4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF843C0C' } };
  hr4.alignment = { horizontal: 'center', vertical: 'middle' };
  hr4.height = 28;

  const allPrices = products.filter(p => p.priceCny > 0).map(p => p.priceCny).sort((a, b) => a - b);
  const zeroPriceCount = products.filter(p => p.priceCny === 0).length;

  const stats4 = [
    ['产品总数', products.length],
    ['已定价产品', pricedCount],
    ['未定价(面议)', zeroPriceCount],
    ['最低价(元)', allPrices[0] || 0],
    ['最高价(元)', allPrices[allPrices.length - 1] || 0],
    ['均价(元)', pricedCount > 0 ? Math.round(pricedSum / pricedCount) : 0],
    ['中位数(元)', allPrices.length > 0 ? allPrices[Math.floor(allPrices.length / 2)] : 0],
    ['', ''],
    ['价格区间', '产品数量']
  ];

  const ranges = [
    { label: '0-5万', min: 0, max: 50000 },
    { label: '5-10万', min: 50000, max: 100000 },
    { label: '10-20万', min: 100000, max: 200000 },
    { label: '20-30万', min: 200000, max: 300000 },
    { label: '30-50万', min: 300000, max: 500000 },
    { label: '50-100万', min: 500000, max: 1000000 },
    { label: '100万以上', min: 1000000, max: Infinity }
  ];
  ranges.forEach(r => {
    stats4.push([r.label, allPrices.filter(p => p > r.min && p <= r.max).length]);
  });

  stats4.forEach((s, i) => {
    const row = ws4.addRow({ metric: s[0], value: s[1] });
    row.font = { size: 10, name: 'Arial' };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 22;
    const vc = row.getCell('value');
    if (typeof s[1] === 'number' && (s[0].includes('价') || s[0] === '均价(元)' || s[0] === '中位数(元)')) {
      vc.numFmt = '#,##0';
    }
    if (s[0] === '价格区间') {
      row.font = { bold: true, size: 11, name: 'Arial' };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
    }
  });

  // ========== Sheet 5: 素材质量 ==========
  const ws5 = workbook.addWorksheet('素材质量', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws5.columns = [
    { header: '品牌', key: 'brand', width: 14 },
    { header: '型号', key: 'model', width: 24 },
    { header: '品类', key: 'category', width: 20 },
    { header: '图片数', key: 'images', width: 10 },
    { header: '视频数', key: 'videos', width: 10 },
    { header: '问题', key: 'issue', width: 20 }
  ];

  const hr5 = ws5.getRow(1);
  hr5.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' };
  hr5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };
  hr5.alignment = { horizontal: 'center', vertical: 'middle' };
  hr5.height = 28;

  const issues = [];
  const noVideoSet = new Set();
  products.forEach(p => {
    if (p._count.videos === 0) noVideoSet.add(p.id);
    const hasIssue = [];
    if (p._count.videos === 0) hasIssue.push('缺视频');
    if (p._count.images <= 5) hasIssue.push('图片不足');
    if (hasIssue.length > 0) {
      issues.push({
        brand: p.brand.nameZh, model: p.modelName || '-', category: p.category.nameZh,
        images: p._count.images, videos: p._count.videos, issue: hasIssue.join('+')
      });
    }
  });

  issues.sort((a, b) => {
    const wa = a.issue.split('+').length;
    const wb = b.issue.split('+').length;
    if (wa !== wb) return wb - wa;
    return a.issue.includes('缺视频') ? -1 : 1;
  });

  issues.forEach((q, i) => {
    const row = ws5.addRow(q);
    row.font = { size: 10, name: 'Arial' };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 22;
    if (q.issue.includes('+')) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF9999' } };
    } else if (q.issue === '缺视频') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    } else {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
    }
  });

  // Save
  const outputPath = 'D:/神雕农机/usedfarmmach/产品设备统计_0609.xlsx';
  await workbook.xlsx.writeFile(outputPath);
  console.log('Excel saved to: ' + outputPath);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
