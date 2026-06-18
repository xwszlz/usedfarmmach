/**
 * 神雕农机 - 每日产品统计报告 -> 企业微信群机器人推送
 * 
 * 用法：
 *   node scripts/push-daily-to-wecom.js [--date YYYY-MM-DD]
 * 
 * 功能：
 *   1. 从数据库查询产品统计
 *   2. 生成markdown格式报告
 *   3. 推送到企业微信群机器人webhook
 */

var PrismaClient = require('@prisma/client').PrismaClient;
var https = require('https');
var fs = require('fs');
var path = require('path');

var prisma = new PrismaClient();

// ========== config ==========
var WEBHOOK_KEY = '9d46e962-5b34-48af-b010-06e8e8b78cf4';
var WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + WEBHOOK_KEY;
var LEXIANG_REPORT_BASE = 'https://lexiangla.com/pages';
var COMPANY_FROM = 'e987003e566611f187fa321d7b2198c0';

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
  var minPrice = Math.min.apply(null, priced);
  var maxPrice = Math.max.apply(null, priced);
  var avgPrice = (priced.reduce(function(a, b) { return a + b; }, 0) / priced.length).toFixed(1);
  
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
    var b = p.brand ? (p.brand.nameZh || '?') : '?';
    brandCount[b] = (brandCount[b] || 0) + 1;
  });
  var topBrands = Object.entries(brandCount)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 5)
    .map(function(entry, i) { return (i + 1) + '. ' + entry[0] + ' ' + entry[1] + '台'; });
  
  // missing video brands
  var missingVidBrands = {};
  products.filter(function(p) { return p.videos.length === 0; }).forEach(function(p) {
    var b = p.brand ? (p.brand.nameZh || '?') : '?';
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
    var b = p.brand ? (p.brand.nameZh || '') : '';
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

function buildMarkdown(report) {
  var r = report;
  var priceRangeLine = '0-5万:' + r.ranges['0-5万'] + '台 | 5-15万:' + r.ranges['5-15万'] + '台 | 15-30万:' + r.ranges['15-30万'] + '台\n' +
    '30-60万:' + r.ranges['30-60万'] + '台 | 60-100万:' + r.ranges['60-100万'] + '台 | 100万+:' + r.ranges['100万+'] + '台';
  
  var anomalyDetail = '';
  if (r.anomalies.length > 0) {
    var names = r.anomalies.map(function(a) { return a.name; }).join('、');
    anomalyDetail = '\n**品牌异常**：' + names + '共' + r.anomalies.length + '个品牌名需修正';
  }
  
  var anomalyFixList = '';
  if (r.anomalies.length > 0) {
    anomalyFixList = r.anomalies.map(function(a) { return a.name + a.fix; }).join('、');
  }
  
  var vidColor = parseFloat(r.vidPct) >= 80 ? 'info' : 'warning';
  var priceColor = parseFloat(r.pricePct) >= 95 ? 'info' : 'warning';
  
  return '## \uD83D\uDE9C 神雕农机日报 \u00B7 ' + r.date + '\n\n' +
    '> \uD83D\uDCCA 在售产品：<font color="info">**' + r.total + '台**</font> | 图片：**' + r.totalImages + '张** | 均价：\u00A5<font color="warning">' + r.avgPrice + '万</font>\n' +
    '> \uD83C\uDFAC 视频覆盖：<font color="' + vidColor + '">' + r.vidPct + '%</font>(' + r.withVid + '/' + r.total + ') | \uD83D\uDCB0 已标价：<font color="' + priceColor + '">' + r.pricePct + '%</font>(' + r.withPrice + '/' + r.total + ')\n' +
    '> \uD83D\uDCCA 价格区间：\u00A5' + r.minPrice + '~\u00A5' + r.maxPrice + '万\n\n' +
    '**\uD83D\uDCB0 价格分布**\n' + priceRangeLine + '\n\n' +
    '**\uD83C\uDFED 品牌TOP5**\n' + r.topBrands.join('\n') + '\n\n' +
    '**\uD83C\uDFAC 缺视频TOP6品牌**\n' + r.topMissingVid.map(function(x, i) { return (i+1) + '. ' + x; }).join('  ') + '\n' +
    '<font color="warning">共' + r.missingVidCount + '台缺视频</font>' + anomalyDetail + '\n\n' +
    '---\n' +
    '**\uD83D\uDCDD 待办事项（请群主 @许建辉总 指派）**\n' +
    '> \uD83D\uDD27 品牌异常' + r.anomalies.length + '个需修正：' + anomalyFixList + '\n' +
    '> \uD83D\uDCF9 缺视频' + r.missingVidCount + '台需拍摄/上传视频\n' +
    '> \uD83D\uDCB0 未标价' + r.unpricedCount + '台需补充价格\n' +
    '> \uD83C\uDFF7\uFE0F 异常品牌信息需确认并修改\n' +
    '> \n' +
    '> \uD83D\uDC49 [查看完整83台产品明细报告](https://lexiangla.com/pages/)';
}

function buildTextReminder(report, lexiangUrl) {
  var r = report;
  var anomalyNames = r.anomalies.map(function(a) { return a.name; }).join('\u3001');
  
  return '\uD83D\uDCCB 神雕农机日报 ' + r.date + '\n' +
    '在售' + r.total + '台 | 缺视频' + r.missingVidCount + '台 | 未标价' + r.unpricedCount + '台 | 品牌异常' + r.anomalies.length + '个\n' +
    '完整报告：' + lexiangUrl + '\n\n' +
    '请群主 @许建辉总 根据工作职责指派任务：\n' +
    '- 品牌异常修正（' + anomalyNames + '）\n' +
    '- 缺视频' + r.missingVidCount + '台拍摄上传\n' +
    '- 未标价' + r.unpricedCount + '台补充价格';
}

async function main() {
  var args = process.argv.slice(2);
  var targetDate = null;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) targetDate = args[++i];
  }
  var dateStr = targetDate || formatDate(new Date());
  
  console.log('[PUSH] generating daily report... ' + dateStr);
  
  var report = await generateReport(dateStr);
  var markdown = buildMarkdown(report);
  
  console.log('[PUSH] sending markdown report to wecom group...');
  var result = await postToWecom('markdown', markdown);
  if (result.errcode === 0) {
    console.log('[OK] markdown report sent');
  } else {
    console.error('[FAIL] markdown send failed: ' + result.errmsg);
  }
  
  console.log('[PUSH] sending reminder message...');
  var lexiangUrl = LEXIANG_REPORT_BASE + '/762b50adcd8c4662aa3e6db79c5f329d?_fid=762b50adcd8c4662aa3e6db79c5f329d&company_from=' + COMPANY_FROM;
  var reminder = buildTextReminder(report, lexiangUrl);
  var result2 = await postToWecom('text', reminder);
  if (result2.errcode === 0) {
    console.log('[OK] reminder sent');
  } else {
    console.error('[FAIL] reminder send failed: ' + result2.errmsg);
  }
  
  console.log('\n[DONE] ' + report.total + ' products | avg ' + report.avgPrice + 'wan | missing video ' + report.missingVidCount);
}

main()
  .catch(function(e) {
    console.error('[FAIL] ' + e.message);
    process.exit(1);
  })
  .finally(function() { prisma.$disconnect(); });
