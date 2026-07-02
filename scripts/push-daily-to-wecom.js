/**
 * 神雕农机 - 每日产品统计报告 -> 企业微信群机器人推送
 * 
 * 用法：
 *   node scripts/push-daily-to-wecom.js [--date YYYY-MM-DD]
 * 
 * 功能：
 *   1. 从数据库查询产品统计
 *   2. 生成产品统计Excel（4Sheet）
 *   3. 推送统计摘要markdown + Excel文件卡片到企业微信群
 */

var PrismaClient = require('@prisma/client').PrismaClient;
var https = require('https');
var fs = require('fs');
var path = require('path');
var XLSX = require('xlsx');

var prisma = new PrismaClient();

// ========== config ==========
var WEBHOOK_KEY = '9d46e962-5b34-48af-b010-06e8e8b78cf4';
var WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + WEBHOOK_KEY;
var STATS_XLSX_DIR = 'D:/神雕农机/神雕日报';

function formatDate(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function toWan(val) {
  if (val === null || val === undefined || val === 0) return 0;
  return val / 10000;
}

function safeBrand(p) {
  return p.brand ? (p.brand.nameZh || p.brand.nameEn || '?') : '?';
}

function safeCategory(p) {
  return p.category ? (p.category.nameZh || '?') : '?';
}

// ========== 企微 Webhook 通信 ==========

function postToWecom(msgtype, content) {
  return new Promise(function(resolve, reject) {
    var bodyStr;
    if (msgtype === 'markdown') {
      bodyStr = JSON.stringify({ msgtype: 'markdown', markdown: { content: content } });
    } else {
      bodyStr = JSON.stringify({ msgtype: 'text', text: { content: content } });
    }
    var url = new URL(WEBHOOK_URL);
    var options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    var req = https.request(options, function(res) {
      var buf = '';
      res.on('data', function(chunk) { buf += chunk; });
      res.on('end', function() { resolve(JSON.parse(buf)); });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function uploadMediaToWecom(filePath, mediaType) {
  return new Promise(function(resolve, reject) {
    var fileBuffer = fs.readFileSync(filePath);
    var fileName = path.basename(filePath);
    var boundary = '----WeComUploadBoundary' + Date.now();
    
    var header = '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="media"; filename="' + fileName + '"\r\n' +
      'Content-Type: application/octet-stream\r\n\r\n';
    
    var footer = '\r\n--' + boundary + '--\r\n';
    
    var body = Buffer.concat([
      Buffer.from(header),
      fileBuffer,
      Buffer.from(footer)
    ]);
    
    var urlStr = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/upload_media?key=' + WEBHOOK_KEY + '&type=file';
    var urlObj = new URL(urlStr);
    
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length
      }
    };
    
    console.log('[UPLOAD] uploading ' + fileName + ' (' + (fileBuffer.length / 1024).toFixed(1) + ' KB)...');
    
    var req = https.request(options, function(res) {
      var buf = '';
      res.on('data', function(chunk) { buf += chunk; });
      res.on('end', function() {
        try {
          var result = JSON.parse(buf);
          if (result.errcode === 0) {
            console.log('[UPLOAD] OK media_id=' + result.media_id);
            resolve(result);
          } else {
            reject(new Error('upload errcode=' + result.errcode + ' errmsg=' + result.errmsg));
          }
        } catch(e) { reject(new Error('parse error: ' + buf.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, function() { req.destroy(); reject(new Error('upload timeout')); });
    req.write(body);
    req.end();
  });
}

function sendFileToWecom(mediaId) {
  return new Promise(function(resolve, reject) {
    var bodyStr = JSON.stringify({ msgtype: 'file', file: { media_id: mediaId } });
    var urlObj = new URL(WEBHOOK_URL);
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    var req = https.request(options, function(res) {
      var buf = '';
      res.on('data', function(chunk) { buf += chunk; });
      res.on('end', function() { resolve(JSON.parse(buf)); });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function pushFileToGroup(filePath, description) {
  // 先发说明文字
  if (description) {
    try { await postToWecom('markdown', description); }
    catch(e) { console.warn('[WARN] desc send failed: ' + e.message); }
    await new Promise(function(r) { setTimeout(r, 300); });
  }
  
  try {
    var uploadResult = await uploadMediaToWecom(filePath, 'file');
    var sendResult = await sendFileToWecom(uploadResult.media_id);
    if (sendResult.errcode === 0) {
      console.log('[FILE-OK] ' + path.basename(filePath) + ' sent');
      return true;
    } else {
      console.error('[FAIL] file send: ' + sendResult.errmsg);
      return false;
    }
  } catch(e) {
    console.error('[FAIL] file push error: ' + e.message);
    return false;
  }
}

// ========== 数据查询 ==========

async function generateReport(dateStr) {
  var products = await prisma.product.findMany({
    where: { status: { in: ['active', 'sold'] } },
    include: { brand: true, category: true, images: true, videos: true },
    orderBy: [{ brand: { nameZh: 'asc' } }, { modelName: 'asc' }],
  });

  var total = products.length;
  var totalImages = products.reduce(function(sum, p) { return sum + p.images.length; }, 0);
  var totalVideos = products.reduce(function(sum, p) { return sum + p.videos.length; }, 0);
  var withVid = products.filter(function(p) { return p.videos.length > 0; }).length;
  var vidPct = ((withVid / total) * 100).toFixed(1);
  var withPrice = products.filter(function(p) { return p.priceCny > 0; }).length;
  var pricePct = ((withPrice / total) * 100).toFixed(1);
  var unpricedCount = total - withPrice;
  
  var priced = products.filter(function(p) { return p.priceCny > 0; }).map(function(p) { return toWan(p.priceCny); });
  var minPrice = priced.length > 0 ? Math.min.apply(null, priced) : 0;
  var maxPrice = priced.length > 0 ? Math.max.apply(null, priced) : 0;
  var avgPrice = priced.length > 0 ? (priced.reduce(function(a, b) { return a + b; }, 0) / priced.length).toFixed(1) : '0';
  
  // price ranges
  var ranges = { '0-5万': 0, '5-15万': 0, '15-30万': 0, '30-60万': 0, '60-100万': 0, '100万+': 0 };
  priced.forEach(function(pr) {
    if (pr < 5) ranges['0-5万']++;
    else if (pr < 15) ranges['5-15万']++;
    else if (pr < 30) ranges['15-30万']++;
    else if (pr < 60) ranges['30-60万']++;
    else if (pr < 100) ranges['60-100万']++;
    else ranges['100万+']++;
  });
  
  // top brands
  var brandCount = {};
  products.forEach(function(p) {
    var b = safeBrand(p);
    brandCount[b] = (brandCount[b] || 0) + 1;
  });
  var topBrands = Object.entries(brandCount)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 5)
    .map(function(entry, i) { return (i + 1) + '. ' + entry[0] + ' ' + entry[1] + '台'; });
  
  // missing video brands
  var missingVidBrands = {};
  products.filter(function(p) { return p.videos.length === 0; }).forEach(function(p) {
    var b = safeBrand(p);
    missingVidBrands[b] = (missingVidBrands[b] || 0) + 1;
  });
  var topMissingVid = Object.entries(missingVidBrands)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 6)
    .map(function(entry) { return entry[0] + '(' + entry[1] + ')'; });
  
  // brand anomalies
  var anomalies = [];
  var anomalyChecks = [
    { pattern: '迪尔', fix: '→约翰迪尔' },
    { pattern: '进口', fix: '→待确认' },
    { pattern: '废铁', fix: '→待确认' },
    { pattern: 'arcusln', fix: '→ARCLUSIN' },
  ];
  products.forEach(function(p) {
    var b = safeBrand(p);
    anomalyChecks.forEach(function(check) {
      if (b.toLowerCase().indexOf(check.pattern.toLowerCase()) !== -1) {
        var already = anomalies.some(function(a) { return a.name === b; });
        if (!already) {
          anomalies.push({ name: b, fix: check.fix });
        }
      }
    });
  });
  
  return {
    date: dateStr, total: total, totalImages: totalImages, totalVideos: totalVideos,
    withVid: withVid, vidPct: vidPct, withPrice: withPrice, pricePct: pricePct,
    avgPrice: avgPrice, minPrice: minPrice, maxPrice: maxPrice,
    ranges: ranges, topBrands: topBrands, topMissingVid: topMissingVid,
    missingVidCount: total - withVid, unpricedCount: unpricedCount,
    anomalies: anomalies,
  };
}

// ========== Excel 生成 ==========

function genProductStatsXlsx(products, dateStr) {
  var XLSX = require('xlsx');
  var rows;

  // Sheet1: 产品总览
  function sheetOverview() {
    rows = [['序号', '品牌', '型号', '年份', '价格(万)', '状态', '图片数', '视频数', '工时(h)', '品类', '位置']];
    products.forEach(function(p, i) {
      rows.push([
        i + 1, safeBrand(p), p.modelName || '-', String(p.year || '-'),
        (p.priceCny && p.priceCny > 0) ? (p.priceCny / 10000).toFixed(1) : '-',
        p.status || '-', p.images.length, p.videos.length,
        p.workingHours || '-', safeCategory(p), p.location || '-',
      ]);
    });
    return XLSX.utils.aoa_to_sheet(rows);
  }

  // Sheet2: 缺视频清单（按品牌分组）
  function sheetMissingVids() {
    rows = [['品牌', '型号', '年份', '价格(万)', '状态', '图片数', '品类']];
    var brandGroups = {};
    products.filter(function(p) { return p.videos.length === 0; }).forEach(function(p) {
      var b = safeBrand(p);
      if (!brandGroups[b]) brandGroups[b] = [];
      brandGroups[b].push(p);
    });
    Object.keys(brandGroups).sort().forEach(function(brand) {
      rows.push(['【' + brand + ' 共' + brandGroups[brand].length + '台】', '', '', '', '', '', '']);
      brandGroups[brand].sort(function(a, b) { return (a.modelName||'').localeCompare(b.modelName||''); }).forEach(function(p) {
        rows.push([brand, p.modelName||'-', String(p.year||'-'), (p.priceCny&&p.priceCny>0)?(p.priceCny/10000).toFixed(1):'-', p.status||'-', String(p.images.length), safeCategory(p)]);
      });
    });
    return XLSX.utils.aoa_to_sheet(rows);
  }

  // Sheet3: 品牌异常
  function sheetAnomalies() {
    rows = [['品牌名', '型号', '年份', '价格(万)', '状态', '建议修正为', '备注']];
    var checks = [
      { pattern: '迪尔', fix: '约翰迪尔', note: '品牌名不规范' },
      { pattern: '进口', fix: '待确认', note: '非标准品牌名' },
      { pattern: '废铁', fix: '待确认', note: '非标准品牌名' },
      { pattern: 'arcusln', fix: 'ARCLUSIN', note: '拼写错误' },
    ];
    products.forEach(function(p) {
      var b = safeBrand(p);
      checks.forEach(function(c) {
        if (b.toLowerCase().indexOf(c.pattern.toLowerCase()) !== -1) {
          rows.push([b, p.modelName||'-', String(p.year||'-'), (p.priceCny&&p.priceCny>0)?(p.priceCny/10000).toFixed(1):'-', p.status||'-', c.fix, c.note]);
        }
      });
    });
    if (rows.length === 1) rows.push(['无品牌异常', '', '', '', '', '', '']);
    return XLSX.utils.aoa_to_sheet(rows);
  }

  // Sheet4: 未标价
  function sheetUnpriced() {
    rows = [['品牌', '型号', '年份', '状态', '图片数', '工时(h)', '品类', '位置']];
    products.filter(function(p) { return !p.priceCny || p.priceCny === 0; }).forEach(function(p) {
      rows.push([safeBrand(p), p.modelName||'-', String(p.year||'-'), p.status||'-', String(p.images.length), p.workingHours||'-', safeCategory(p), p.location||'-']);
    });
    if (rows.length === 1) rows.push(['所有产品均已标价', '', '', '', '', '', '', '']);
    return XLSX.utils.aoa_to_sheet(rows);
  }

  // Build workbook
  var wb = XLSX.utils.book_new();
  
  var ws1 = sheetOverview();
  ws1['!cols'] = [{wch:5},{wch:14},{wch:20},{wch:6},{wch:10},{wch:6},{wch:6},{wch:6},{wch:8},{wch:8},{wch:10}];
  XLSX.utils.book_append_sheet(wb, ws1, '产品总览');
  
  var ws2 = sheetMissingVids();
  ws2['!cols'] = [{wch:16},{wch:20},{wch:6},{wch:10},{wch:6},{wch:6},{wch:8}];
  XLSX.utils.book_append_sheet(wb, ws2, '缺视频清单');
  
  var ws3 = sheetAnomalies();
  ws3['!cols'] = [{wch:14},{wch:20},{wch:6},{wch:10},{wch:6},{wch:14},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws3, '品牌异常');
  
  var ws4 = sheetUnpriced();
  ws4['!cols'] = [{wch:14},{wch:20},{wch:6},{wch:6},{wch:6},{wch:8},{wch:8},{wch:10}];
  XLSX.utils.book_append_sheet(wb, ws4, '未标价');

  if (!fs.existsSync(STATS_XLSX_DIR)) fs.mkdirSync(STATS_XLSX_DIR, { recursive: true });
  var outputPath = path.join(STATS_XLSX_DIR, '神雕农机_产品统计表_' + dateStr + '.xlsx');
  XLSX.writeFile(wb, outputPath);
  
  return outputPath;
}

// ========== 消息构建 ==========

function buildMarkdown(report) {
  var r = report;
  var missingVidCount = r.total - r.withVid;
  
  var priceRangeLine = '0-5万:' + r.ranges['0-5万'] + '台 | 5-15万:' + r.ranges['5-15万'] + '台 | 15-30万:' + r.ranges['15-30万'] + '台\n' +
    '30-60万:' + r.ranges['30-60万'] + '台 | 60-100万:' + r.ranges['60-100万'] + '台 | 100万+:' + r.ranges['100万+'] + '台';
  
  var vidColor = parseFloat(r.vidPct) >= 80 ? 'info' : 'warning';
  var priceColor = parseFloat(r.pricePct) >= 95 ? 'info' : 'warning';
  
  var anomalyLine = '';
  if (r.anomalies.length > 0) {
    anomalyLine = '\n> ⚠️ 品牌异常：<font color="warning">' + r.anomalies.map(function(a) { return a.name + a.fix; }).join('、') + '</font>';
  }
  
  return '## 🚜 神雕农机日报 · ' + r.date + '\n\n' +
    '> 📊 在售产品：<font color="info">**' + r.total + '台**</font> | 图片：**' + r.totalImages + '张** | 均价：¥<font color="warning">' + r.avgPrice + '万</font>\n' +
    '> 🎬 视频覆盖：<font color="' + vidColor + '">' + r.vidPct + '%</font>(' + r.withVid + '/' + r.total + ') | 💰 已标价：<font color="' + priceColor + '">' + r.pricePct + '%</font>(' + r.withPrice + '/' + r.total + ')\n' +
    '> 📊 价格区间：¥' + r.minPrice + '~¥' + r.maxPrice + '万\n\n' +
    '**💰 价格分布**\n' + priceRangeLine + '\n\n' +
    '**🏭 品牌TOP5**\n' + r.topBrands.join('\n') + '\n\n' +
    '**🎬 缺视频TOP6品牌**\n' + r.topMissingVid.map(function(x, i) { return (i+1) + '. ' + x; }).join('  ') + '\n' +
    '<font color="warning">共' + missingVidCount + '台缺视频</font>' + anomalyLine + '\n\n' +
    '---\n' +
    '> 📎 [点击下载产品统计Excel](' + STATS_XLSX_DIR + '/神雕农机_产品统计表_' + r.date + '.xlsx) — 也可在下方文件卡片直接下载';
}

// ========== 主流程 ==========

async function main() {
  var args = process.argv.slice(2);
  var targetDate = null;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) targetDate = args[++i];
  }
  var dateStr = targetDate || formatDate(new Date());
  
  console.log('[PUSH] generating daily report... ' + dateStr);
  
  // 1. 查询产品数据
  var products = await prisma.product.findMany({
    where: { status: { in: ['active', 'sold'] } },
    include: { brand: true, category: true, images: true, videos: true },
    orderBy: [{ brand: { nameZh: 'asc' } }, { modelName: 'asc' }],
  });
  
  var report = await generateReport(dateStr);
  
  // 2. 生成统计Excel
  console.log('[PUSH] generating stats Excel...');
  var excelPath = genProductStatsXlsx(products, dateStr);
  console.log('[PUSH] Excel saved: ' + excelPath);
  
  // 3. 推送统计摘要markdown
  var markdown = buildMarkdown(report);
  console.log('[PUSH] sending markdown report to wecom group...');
  var result = await postToWecom('markdown', markdown);
  if (result.errcode === 0) {
    console.log('[OK] markdown report sent');
  } else {
    console.error('[FAIL] markdown send failed: ' + result.errmsg);
  }
  
  // 4. 推送Excel文件卡片
  await new Promise(function(r) { setTimeout(r, 500); }); // 等markdown先显示
  console.log('[PUSH] uploading stats Excel as file card...');
  var fileOk = await pushFileToGroup(excelPath, null);
  if (fileOk) {
    console.log('[OK] stats Excel file card sent');
  }
  
  console.log('\n[DONE] ' + report.total + ' products | avg ' + report.avgPrice + '万 | missing video ' + (report.total - report.withVid));
}

main()
  .catch(function(e) {
    console.error('[FAIL] ' + e.message);
    console.error(e.stack);
    process.exit(1);
  })
  .finally(function() { prisma.$disconnect(); });
