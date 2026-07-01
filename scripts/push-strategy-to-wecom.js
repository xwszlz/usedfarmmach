/**
 * 神雕农机 - 运营日报群全量推送（内部运营群）
 * 
 * 用法：
 *   node scripts/push-strategy-to-wecom.js --date YYYY-MM-DD
 * 
 * 功能：
 *   1. 【文件直发】推送跨境套利日报HD PDF（群内可直接打开下载）
 *   2. 【文件直发】推送竞争力分析报告Excel（群内可直接打开下载）
 *   3. 【文件直发】推送全量产品策略分析Excel（群内可直接打开下载）
 *   4. 推送全量产品策略分析文字详情
 *   推送到"神雕套利运营日报(3)"群的Webhook机器人
 */

var https = require('https');
var fs = require('fs');
var path = require('path');

// ========== config ==========
// 【重要】这是"神雕套利运营日报(3)"群的机器人 Webhook Key
var STRATEGY_WEBHOOK_KEY = '658da92f-33e1-48af-9f17-46d130a51acd';
var STRATEGY_WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + STRATEGY_WEBHOOK_KEY;

var REPORT_BASE_DIR = 'D:/神雕农机/神雕日报';

function formatDate(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate() + 1).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function postToWecom(webhookUrl, msgtype, content) {
  return new Promise(function(resolve, reject) {
    var bodyStr;
    if (msgtype === 'markdown') {
      bodyStr = JSON.stringify({ msgtype: 'markdown', markdown: { content: content } });
    } else {
      bodyStr = JSON.stringify({ msgtype: 'text', text: { content: content } });
    }
    var url = new URL(webhookUrl);
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

// ========== 企微Webhook文件直发功能 ==========

/**
 * 上传文件到企微Webhook临时素材，返回media_id
 */
function uploadMediaToWecom(webhookKey, filePath, mediaType) {
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
    
    var urlStr = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/upload_media?key=' + webhookKey + '&type=' + mediaType;
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

/**
 * 发送文件消息到企微群（使用media_id）
 */
function sendFileToWecom(webhookUrl, mediaId) {
  return new Promise(function(resolve, reject) {
    var bodyStr = JSON.stringify({ msgtype: 'file', file: { media_id: mediaId } });
    var urlObj = new URL(webhookUrl);
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

/**
 * 上传并发送一个文件到企微群（说明文字 + 文件附件）
 * @returns {Promise<boolean>}
 */
async function pushFileToWecomGroup(webhookKey, webhookUrl, filePath, description) {
  if (description) {
    try { await postToWecom(webhookUrl, 'markdown', description); }
    catch(e) { console.warn('[WARN] desc send failed: ' + e.message); }
    await new Promise(function(r) { setTimeout(r, 300); });
  }
  
  try {
    var uploadResult = await uploadMediaToWecom(webhookKey, filePath, 'file');
    var sendResult = await sendFileToWecom(webhookUrl, uploadResult.media_id);
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

/**
 * 从全量策略分析数据文件中读取数据
 * 优先查找 gen_full_portfolio_strategy.py 生成的 JSON
 * 如果没有则返回null（需要先生成）
 */
function readStrategyData(dateStr) {
  // 优先查找策略分析脚本生成的完整JSON
  var strategyJsonPath = path.join(REPORT_BASE_DIR, '\u795E\u96D5\u519C\u673A_\u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790_' + dateStr + '.json');
  
  if (fs.existsSync(strategyJsonPath)) {
    console.log('[STRATEGY-PUSH] found strategy JSON: ' + strategyJsonPath);
    return JSON.parse(fs.readFileSync(strategyJsonPath, 'utf-8'));
  }
  
  // 兼容旧的临时文件路径
  var legacyPath = path.join(REPORT_BASE_DIR, '_temp_strategy_' + dateStr + '.json');
  if (fs.existsSync(legacyPath)) {
    return JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
  }

  // 没有可用的JSON数据
  return null;
}

/**
 * 构建策略分析Markdown消息 — 核心内容全部推送
 */
function buildStrategyMarkdown(strategyData, dateStr) {
  if (!strategyData || !strategyData.products) {
    return null; // 数据不可用
  }

  var products = strategyData.products;
  var totalProducts = strategyData.totalProducts || products.length;
  var highArbCount = strategyData.highArbCount || 0;
  var remainingCount = products.length;

  // 按分类统计
  var categories = {};
  products.forEach(function(p) {
    var cat = p.strategyCategory || 'H-待分类';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  // 按优先级统计
  var priorityStats = { high: 0, medium: 0, low: 0 };
  products.forEach(function(p) {
    var pri = p.priority || 'medium';
    priorityStats[pri]++;
  });

  // 构建消息
  var lines = [];

  lines.push('## \uD83E\uDDEA \u795E\u96D5\u519C\u673A \u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790 \u00B7 ' + dateStr);
  lines.push('> <font color="warning">\u3010\u5185\u90E8\u6587\u4EF6\u3011\u53EA\u9002\u5408\u8FD0\u8425\u56E2\u961F\u67E5\u770B</font>');
  lines.push('');

  // === 概览 ===
  lines.push('**\uD83D\uDCCA \u5E93\u5B58\u6982\u89C8**');
  lines.push('- \u7F51\u7AD9\u603B\u4EA7\u54C1\uFF1A**' + totalProducts + '**\u4E2A | \u9AD8\u5957\u5229\u4EA7\u54C1\uFF1A**' + highArbCount + '**\u4E2A(\u7ADE\u4E89\u529B\u62A5\u544A\u8986\u76D6)');
  lines.push('- **\u672C\u62A5\u544A\u5206\u6790\u4EA7\u54C1\uFF1A' + remainingCount + '**\u4E2A(\u5269\u4F59\u5168\u91CF)');
  lines.push('');

  // === 策略分类分布 ===
  lines.push('**\uD83D\uDD20 \u7B56\u7565\u5206\u7C7B\u5206\u5E03**');

  var categoryOrder = [
    ['A-\u51C6\u65B0\u673A\u63A8\u5E7F\u578B', '\u9AD8\u6210\u8272+\u8FD12\u5E74'],
    ['B-\u9AD8\u4EF7\u56FD\u9645\u724C', '\u226560\u4E07\u5927\u724C'],
    ['C-\u4E2D\u7AEF\u8D70\u91CF\u578B', '15-60\u4E07'],
    ['D-\u56FD\u4EA7/\u5C0F\u4F17\u724C', '\u56FD\u4EA7+\u65B0\u5174\u5E02\u573A'],
    ['E-\u8001\u65E7\u6E05\u4ED3\u578B', '>15\u5E74\u8F66\u9F84'],
    ['F-\u4F4E\u4EF7\u65B0\u54C1\u578B', '\u226420\u4E07\u5F15\u6D41'],
    ['G-\u4E13\u7528\u8BBE\u5907\u578B', '\u5782\u76F4\u573A\u666F'],
    ['H-\u5F85\u5206\u7C7B', '\u9700\u4EBA\u5DE5\u590D\u6838']
  ];

  categoryOrder.forEach(function(item) {
    var catName = item[0];
    var desc = item[1];
    var count = categories[catName] || 0;
    if (count > 0) {
      lines.push('- **' + catName + '**:' + count + '\u4E2A (' + desc + ')');
    }
  });

  lines.push('');

  // === 产品逐一分析摘要（按分组） ===
  lines.push('**\uD83D\uDCDD \u4EA7\u54C1\u9010\u4E00\u5206\u6790**');
  lines.push('');

  var groupLabels = {
    'A-\u51C6\u65B0\u673A\u63A8\u5E7F\u578B': '\uD83D\uDC51 A.\u51C6\u65B0\u673A\u63A8\u5E7F',
    'B-\u9AD8\u4EF7\u56FD\u9645\u724C': '\uD83D\uDCDC B.\u9AD8\u4EF7\u56FD\u9645\u724C',
    'C-\u4E2D\u7AEF\u8D70\u91CF\u578B': '\uD83D\uDCB5 C.\u4E2D\u7AEF\u8D70\u91CF',
    'D-\u56FD\u4EA7/\u5C0F\u4F17\u724C': '\uD83D\uDD34 D.\u56FD\u4EA7\u5C0F\u4F17',
    'E-\u8001\u65E7\u6E05\u4ED3\u578B': '\u26A0 FE.\u8001\u65E7\u6E05\u4ED3',
    'F-\u4F4E\u4EF7\u65B0\u54C1\u578B': '\u2604 F.\u4F4E\u4EF7\u65B0\u54C1',
    'G-\u4E13\u7528\u8BBE\u5907\u578B': '\u2699 G.\u4E13\u7528\u8BBE\u5907',
    'H-\u5F85\u5206\u7C7B': '\u2753 H.\u5F85\u5206\u7C7B'
  };

  categoryOrder.forEach(function(item) {
    var catName = item[0];
    var groupProducts = products.filter(function(p) {
      return (p.strategyCategory || 'H-待分类') === catName;
    });

    if (groupProducts.length > 0) {
      lines.push('---');
      lines.push('**' + (groupLabels[catName] || catName) + '** (' + groupProducts.length + '\u4E2A)');
      
      // 只列出前10个，避免超长
      var displayProducts = groupProducts.slice(0, 10);
      displayProducts.forEach(function(p, idx) {
        var line = (idx + 1) + '. **' + (p.brandNameZh || '?') + ' ' + (p.modelName || '-') + '** ';
        line += (p.year || '-') + '\u5E74 | \u00A5' + ((p.priceCny || 0) / 10000).toFixed(1) + '\u4E07 | ';
        line += (p.condition || '-') + ' | ' + (p.workingHours ? (p.workingHours + '\u5C0F\u65F6') : '-');
        
        // 加行动建议（截取前30字）
        if (p.actionSuggestion) {
          var suggestion = p.actionSuggestion.substring(0, 35);
          if (p.actionSuggestion.length > 35) suggestion += '...';
          line += '\n   \u2192 ' + suggestion;
        }
        
        // 加推荐市场
        if (p.recommendedMarket) {
          line += ' [' + p.recommendedMarket + ']';
        }
        
        lines.push(line);
      });
      
      if (groupProducts.length > 10) {
        lines.push('... \u8FD8\u6709' + (groupProducts.length - 10) + '\u4E2A\u4EA7\u54C1\uFF0C\u8BE7\u67E5\u770BExcel\u5B8C\u6574\u7248');
      }
      lines.push('');
    }
  });

  // === 行动清单汇总 ===
  lines.push('**\u2705 \u884C\u52A8\u6E05\u5355\u6C47\u603B**');
  lines.push('');
  lines.push('| \u7B56\u7565\u7EC4 | \u6570\u91CF | \u6838\u5FC3\u884C\u52A8 | \u4F18\u5148\u7EA7 |');
  lines.push('|--------|------|----------|------|');

  var actionGroups = [
    ['A-\u51C6\u65B0\u673A\u63A8\u5E7F\u578B', '\u6807\u6746\u5C55\u793A+\u89C6\u9891\u91CD\u70B9\u6295\u5165', 'P0'],
    ['B-\u9AD8\u4EF7\u56FD\u9645\u724C', '\u6D77\u5916\u7CBE\u51C6\u8425\u9500+\u591A\u8BED\u79CD\u8BF4\u660E\u4E66', 'P0'],
    ['C-\u4E2D\u7AEF\u8D70\u91CF\u578B', '\u6279\u91CF\u62A5\u4EF7+\u4FE1\u606F\u63A8\u9001', 'P1'],
    ['D-\u56FD\u4EA7/\u5C0F\u4F17\u724C', '\u56FD\u5185\u76F4\u4F9B+\u65B0\u5174\u5E02\u573A\u5F00\u62D3', 'P2'],
    ['E-\u8001\u65E7\u6E05\u4ED3\u578B', '\u5FEB\u901F\u6E05\u4ED3\u56DE\u7B58\u8D44\u91D1', 'P0'],
    ['F-\u4F4E\u4EF7\u65B0\u54C1\u578B', '\u5F15\u6D41\u83B7\u5BA2+\u5C55\u793A\u4F4D\u7F6E', 'P1'],
    ['G-\u4E13\u7528\u8BBE\u5907\u578B', '\u5782\u76F4\u573A\u666F\u8425\u9500', 'P2']
  ];

  actionGroups.forEach(function(group) {
    var catName = group[0];
    var count = categories[catName] || 0;
    if (count > 0) {
      lines.push('| ' + catName + ' | **' + count + '** | ' + group[1] + ' | ' + group[2] + ' |');
    }
  });

  lines.push('');
  lines.push('---');
  lines.push('\uD83D\uDCC4 \u5B8C\u6574Excel\u62A5\u544A\uFF1A`神雕农机_全量产品策略分析_' + dateStr + '.xlsx`');
  lines.push('\uD83D\uDCCC \u6587\u4EF6\u4F4D\u7F6E\uFF1AD\:\\\\神雕农机\\\\神雕日报\\\\');

  return lines.join('\n');
}

/**
 * 备用方案：如果无法读取详细数据，生成基础版消息
 */
function buildBasicStrategySummary(dateStr) {
  return '## \uD83E\uDDEA \u795E\u96D5\u519C\u673A \u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790 \u00B7 ' + dateStr + '\n\n' +
    '> <font color="warning">\u3010\u5185\u90E8\u6587\u4EF6\u3011\u8FD0\u8425\u56E2\u961F\u4E13\u770B\n\n' +
    '\uD83D\uDCC4 **Excel+JSON\u5DF2\u751F\u6210\uFF1A**\n' +
    '- `' + '\u795E\u96D5\u519C\u673A_\u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790_' + dateStr + '.xlsx`\n' +
    '- `' + '\u795E\u96D5\u519C\u673A_\u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790_' + dateStr + '.json`\n' +
    '\uD83D\uDCF1 **\u5C0F\u7A0B\u5E8F\u67E5\u770B\uFF1A** \u53D1\u73B0\u9875 \u2192 \u4E13\u4E1A\u7B56\u7565\u5206\u6790\u62A5\u544A \u2192 4Tab\u539F\u751F\u6E32\u67D3\n' +
    '\uD83D\uDCCC **\u6587\u4EF6\u4F4D\u7F6E\uFF1A** D\:\\\\u795E\u96D5\u519C\u673A\\\\\u795E\u96D5\u65E5\u62A5\\\\\n\n' +
    '**\u5305\u542B\u5185\u5BB9\uFF1a**\n' +
    '- \u62A5\u544A\u6982\u8981\uFF1a\u603B\u4EA7\u54C1\u6570/\u9AD8\u5957\u5229\u6570/\u5269\u4F59\u5206\u6790\u6570\n' +
    '- \u4EA7\u54C1\u9010\u4E00\u5206\u6790\uFF1a\u6BCF\u6B3E\u7684\u7B56\u7565\u5206\u7C7B(A-H)\u3001\u884c\u52A8\u5efa\u8BAE\u3001\u4F18\u5148\u7EA7\n' +
    '- \u5206\u7EC4\u884c\u52A8\u6E05\u5355\uFF1a\u6309\u7B56\u7565\u7EC4\u6C47\u603B\n' +
    '- \u5E93\u5B58\u4F18\u5316\u5EFA\u8BAE';
}

/**
 * 将长消息拆分为多条，每条不超过maxLen字符
 */
function splitMessages(markdown, maxLen) {
  var lines = markdown.split('\n');
  var chunks = [];
  var current = '';
  
  lines.forEach(function(line) {
    if ((current + '\n' + line).length > maxLen && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? (current + '\n' + line) : line;
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

/**
 * 构建策略分析多条Markdown消息（每条<4000字）
 */
function buildStrategyMessages(strategyData, dateStr) {
  if (!strategyData || !strategyData.products) return null;

  var products = strategyData.products;
  var totalProducts = strategyData.totalProducts || products.length;
  var highArbCount = strategyData.highArbCount || 0;
  var remainingCount = products.length;

  // 按分类统计
  var categories = {};
  products.forEach(function(p) {
    var cat = p.strategyCategory || 'H-待分类';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  var messages = [];

  // === 消息1: 概览 ===
  var msg1 = [];
  msg1.push('## \uD83E\uDDEA \u795E\u96D5\u519C\u673A \u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790 \u00B7 ' + dateStr);
  msg1.push('> <font color="warning">\u3010\u5185\u90E8\u6587\u4EF6\u3011\u53EA\u9002\u5408\u8FD0\u8425\u56E2\u961F\u67E5\u770B</font>');
  msg1.push('');
  msg1.push('**\uD83D\uDCCA \u5E93\u5B58\u6982\u89C8**');
  msg1.push('- \u7F51\u7AD9\u603B\u4EA7\u54C1\uFF1A**' + totalProducts + '**\u4E2A | \u9AD8\u5957\u5229\uFF1A**' + highArbCount + '**\u4E2A | **\u672C\u62A5\u544A\u5206\u6790\uFF1A' + remainingCount + '**\u4E2A');
  msg1.push('');
  msg1.push('**\uD83D\uDD20 \u7B56\u7565\u5206\u7C7B\u5206\u5E03**');

  var catList = [
    ['A-\u51C6\u65B0\u673A\u63A8\u5E7F', '\u9AD8\u6210\u8272+\u8FD12\u5E74'],
    ['B-\u9AD8\u4EF7\u56FD\u9645\u724C', '\u226560\u4E07\u5927\u724C'],
    ['C-\u4E2D\u7AEF\u8D70\u91CF', '15-60\u4E07'],
    ['D-\u56FD\u4EA7\u5C0F\u4F17', '\u56FD\u4EA7+\u65B0\u5174\u5E02\u573A'],
    ['E-\u8001\u65E7\u6E05\u4ED3', '>15\u5E74\u8F66\u9F84'],
    ['F-\u4F4E\u4EF7\u65B0\u54C1', '\u226420\u4E07\u5F15\u6D41'],
    ['G-\u4E13\u7528\u8BBE\u5907', '\u5782\u76F4\u573A\u666F'],
    ['H-\u5F85\u5206\u7C7B', '\u9700\u4EBA\u5DE5\u590D\u6838']
  ];
  catList.forEach(function(item) {
    var c = categories[item[0]] || 0;
    if (c > 0) msg1.push('- **' + item[0] + '**: ' + c + '\u4E2A (' + item[1] + ')');
  });
  msg1.push('');
  msg1.push('**\u2705 \u884C\u52A8\u6E05\u5355\u6C47\u603B**');
  msg1.push('');
  var actions = [
    ['A', '\u6807\u6746\u5C55\u793A+\u89C6\u9891\u91CD\u70B9', 'P0'],
    ['B', '\u6D77\u5916\u7CBE\u51C6+\u591A\u8BED\u79CD', 'P0'],
    ['C', '\u6279\u91CF\u62A5\u4EF7+\u4FE1\u606F\u63A8\u9001', 'P1'],
    ['D', '\u56FD\u5185\u76F4\u4F9B+\u65B0\u5174\u5E02\u573A', 'P2'],
    ['E', '\u5FEB\u901F\u6E05\u4ED3\u56DE\u7B54\u8D44\u91D1', 'P0'],
    ['F', '\u5F15\u6D41\u83B7\u5BA2+\u5C55\u793A\u4F4D\u7F6E', 'P1'],
    ['G', '\u5782\u76F4\u573A\u666F\u8425\u9500', 'P2']
  ];
  actions.forEach(function(a) {
    var cn = catList[parseInt(a[0].charCodeAt(0))-65];
    var cnt = categories[cn[0]] || 0;
    if (cnt > 0) msg1.push('- ' + cn[0] + ': **' + cnt + '**\u4E2A \u2192 ' + a[1] + ' (' + a[2] + ')');
  });
  messages.push(msg1.join('\n'));

  // === 消息2-N: 每个分组的产品详情 ===
  var groupNames = {
    'A-\u51C6\u65B0\u673A\u63A8\u5E7F\u578B': '\uD83D\uDC51 A.\u51C6\u65B0\u673A\u63A8\u5E7F',
    'B-\u9AD8\u4EF7\u56FD\u9645\u724C\u578B': '\uD83D\uDCDC B.\u9AD8\u4EF7\u56FD\u9645\u724C',
    'C-\u4E2D\u7AEF\u8D70\u91CF\u578B': '\uD83D\uDCB5 C.\u4E2D\u7AEF\u8D70\u91CF',
    'D-\u56FD\u4EA7/\u5C0F\u4F17\u724C\u578B': '\uD83D\uDD34 D.\u56FD\u4EA7\u5C0F\u4F17',
    'E-\u8001\u65E7\u6E05\u4ED3\u578B': '\u26A0 FE.\u8001\u65E7\u6E05\u4ED3',
    'F-\u4F4E\u4EF7\u65B0\u54C1\u578B': '\u2604 F.\u4F4E\u4EF7\u65B0\u54C1',
    'G-\u4E13\u7528\u8BBE\u5907\u578B': '\u2699 G.\u4E13\u7528\u8BBE\u5907'
  };

  catList.forEach(function(item) {
    var catName = item[0] + '\u578B';
    var groupProducts = products.filter(function(p) { return (p.strategyCategory || '') === catName; });
    
    if (groupProducts.length === 0) return;

    var gmsg = [];
    gmsg.push('---');
    gmsg.push('**' + (groupNames[catName] || catName) + '** (' + groupProducts.length + '\u4E2A)');
    gmsg.push('');

    groupProducts.forEach(function(p, idx) {
      var line = (idx+1) + '. **' + (p.brandNameZh||'?') + ' ' + (p.modelName||'-') + '** ';
      line += (p.year||'-') + '\u5E74 | \u00A5' + ((p.priceCny||0)/10000).toFixed(1) + '\u4E07';
      
      if (p.actionSuggestion) {
        var s = p.actionSuggestion.substring(0, 30);
        if (p.actionSuggestion.length > 30) s += '..';
        line += '\n   \u2192 ' + s;
      }
      if (p.recommendedMarket) line += ' [' + p.recommendedMarket + ']';
      gmsg.push(line);
    });
    
    messages.push(gmsg.join('\n'));
  });

  // 最后一条：文件链接
  messages.push(
    '---\n' +
    '\uD83D\uDCC4 **\u5B8C\u6574\u62A5\u544A\u6587\u4EF6\uFF1a**\n' +
    '- `神雕农机_全量产品策略分析_' + dateStr + '.xlsx`\n' +
    '- `神雕农机_全量产品策略分析_' + dateStr + '.json`\n\n' +
    '\uD83D\uDCF1 **\u5C0F\u7A0B\u5E8F\u67E5\u770B\uFF1a** \u53D1\u73B0\u9875 \u2192 \u4E13\u4E1A\u7B56\u7565\u5206\u6790\u62A5\u544A \u2192 4Tab\u539F\u751F\u6E32\u67D3\n' +
    '\uD83D\uDCCC **\u6587\u4EF6\u5728\u672C\u673A** D\:\\\\u795E\u96D5\u519C\u673A\\\\\u795E\u96D5\u65E5\u62A5\\\\'
  );

  return messages;
}

// ========== 日报PDF和竞争力Excel推送（仅高套利产品） ==========

/**
 * 构建跨境套利日报HD PDF推送通知
 * 仅覆盖高套利产品，已适配小程序手机查看
 */
function buildDailyPdfNotification(dateStr) {
  var pdfPath = dateStr + '\u8DE8\u5883\u5957\u5229\u65E5\u62A5_HD.pdf';
  return '## \uD83D\uDCF0 \u8DE8\u5883\u5957\u5229\u65E5\u62A5 \u00B7 ' + dateStr + '\n\n' +
    '> <font color="info">\u4EC5\u8986\u76D6\u9AD8\u5957\u5229\u4EA7\u54C1</font>\n\n' +
    '\uD83D\uDCC4 **HD PDF\u5DF2\u751F\u6210\uFF1A** `' + pdfPath + '`\n' +
    '\uD83D\uDCF1 **\u5C0F\u7A0B\u5E8F\u67E5\u770B\uFF1A** \u53D1\u73B0\u9875 \u2192 \u4E13\u4E1A\u5957\u5229\u65E5\u62A5\n' +
    '\uD83D\uDCCC **\u6587\u4EF6\u4F4D\u7F6E\uFF1A** D:\\\u795E\u96D5\u519C\u673A\\\u795E\u96D5\u65E5\u62A5\\\n\n' +
    '\u26A1 **\u5185\u5BB9\uFF1A** \u5F53\u65E5\u5957\u5229\u673A\u4F1A\u3001\u56FD\u9645\u4EF7\u683C\u951A\u70B9\u3001\u6C47\u7387\u884C\u60C5\u3001\u7269\u6D41\u6210\u672C\u3001\u5229\u6DA6\u7A7A\u95F4\u5206\u6790';
}

/**
 * 构建竞争力分析报告Excel推送通知
 * 仅覆盖高套利产品，7工作表，已适配小程序手机查看
 */
function buildCompetitionReportNotification(dateStr) {
  var excelPath = '\u795E\u96D5\u519C\u673A\u7ADE\u4E89\u529B\u5206\u6790\u62A5\u544A_' + dateStr + '.xlsx';
  return '## \uD83D\uDCCA \u7ADE\u4E89\u529B\u5206\u6790\u62A5\u544A \u00B7 ' + dateStr + '\n\n' +
    '> <font color="info">\u4EC5\u8986\u76D6\u9AD8\u5957\u5229\u4EA7\u54C1 | 7\u5DE5\u4F5C\u8868</font>\n\n' +
    '\uD83D\uDCC4 **Excel\u5DF2\u751F\u6210\uFF1A** `' + excelPath + '`\n' +
    '\uD83D\uDCF1 **\u5C0F\u7A0B\u5E8F\u67E5\u770B\uFF1A** \u53D1\u73B0\u9875 \u2192 \u4E13\u4E1A\u7ADE\u4E89\u529B\u62A5\u544A \u2192 7Tab\u539F\u751F\u6E32\u67D3\n' +
    '\uD83D\uDCCC **\u6587\u4EF6\u4F4D\u7F6E\uFF1A** D:\\\u795E\u96D5\u519C\u673A\\\u795E\u96D5\u65E5\u62A5\\\n\n' +
    '\uD83D\uDCCA **7\u4E2A\u5DE5\u4F5C\u8868\uFF1A**\n' +
    '1. \u4ECA\u65E5\u60C5\u62A5\u66F4\u65B0 | 2. \u4EA7\u54C1\u57FA\u7840\u4FE1\u606F\u5BF9\u7167\n' +
    '3. \u56FD\u9645\u5E73\u53F0\u552E\u4EF7\u5BF9\u6BD4 | 4. \u7269\u6D41\u6210\u672C\u4F30\u7B97\n' +
    '5. \u5229\u6DA6\u7A7A\u95F4\u5206\u6790 | 6. \u76EE\u6807\u5E02\u573A\u5EFA\u8BAE\n' +
    '7. \u7ADE\u4E89\u7B56\u7565\u5EFA\u8BAE';
}

/**
 * 阶段1：直接推送3个报告文件到企微群（PDF + 2个Excel）
 * 群成员可直接点开/下载查看
 * @returns {number} 成功发送的文件数
 */
async function pushReportsToWecom(dateStr) {
  var count = 0;
  
  // 文件1: 跨境套利日报 HD PDF
  var pdfPath = path.join(REPORT_BASE_DIR, dateStr + '_\u8DE8\u5883\u5957\u5229\u65E5\u62A5_HD.pdf');
  if (fs.existsSync(pdfPath)) {
    console.log('[FILE-PUSH] daily PDF: ' + pdfPath);
    var desc = '## \uD83D\uDCF0 \u8DE8\u5883\u5957\u5229\u65E5\u62A5 \u00B7 ' + dateStr + '\n\n' +
      '> \u4EC5\u8986\u76D6\u9AD8\u5957\u5229\u4EA7\u54C1\n\n' +
      '\uD83D\uDCE6 \u2193 \u4E0B\u65B9\u53D1\u9001\u6587\u4EF6\uFF0C\u70B9\u51FB\u5373\u53EF\u67E5\u770B/\u4E0B\u8F7D';
    var ok = await pushFileToWecomGroup(STRATEGY_WEBHOOK_KEY, STRATEGY_WEBHOOK_URL, pdfPath, desc);
    if (ok) count++;
    await new Promise(function(r) { setTimeout(r, 800); });
  } else {
    console.warn('[WARN] daily PDF not found: ' + pdfPath);
  }

  // 文件2: 竞争力分析报告 Excel
  var compPath = path.join(REPORT_BASE_DIR, '\u795E\u96D5\u519C\u673A\u7ADE\u4E89\u529B\u5206\u6790\u62A5\u544A_' + dateStr + '.xlsx');
  if (fs.existsSync(compPath)) {
    console.log('[FILE-PUSH] competition Excel: ' + compPath);
    var desc2 = '## \uD83D\uDCCA \u7ADE\u4E89\u529B\u5206\u6790\u62A5\u544A \u00B7 ' + dateStr + '\n\n' +
      '> \u4EC5\u8986\u76D6\u9AD8\u5957\u5229\u4EA7\u54C1 | 7\u4E2A\u5DE5\u4F5C\u8868\n\n' +
      '\uD83D\uDCE6 \u2193 \u4E0B\u65B9\u53D1\u9001\u6587\u4EF6\uFF0C\u70B9\u51FB\u5373\u53EF\u67E5\u770B/\u4E0B\u8F7D';
    var ok2 = await pushFileToWecomGroup(STRATEGY_WEBHOOK_KEY, STRATEGY_WEBHOOK_URL, compPath, desc2);
    if (ok2) count++;
    await new Promise(function(r) { setTimeout(r, 800); });
  } else {
    console.warn('[WARN] competition Excel not found: ' + compPath);
  }

  // 文件3: 全量产品策略分析 Excel
  var strategyPath = path.join(REPORT_BASE_DIR, '\u795E\u96D5\u519C\u673A_\u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790_' + dateStr + '.xlsx');
  if (fs.existsSync(strategyPath)) {
    console.log('[FILE-PUSH] strategy Excel: ' + strategyPath);
    var desc3 = '## \uD83E\uDDEA \u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790 \u00B7 ' + dateStr + '\n\n' +
      '> <font color="warning">\u3010\u5185\u90E8\u6587\u4EF6\u3011\u8986\u76D6\u6240\u6709\u5269\u4F59\u4EA7\u54C1</font>\n\n' +
      '\uD83D\uDCE6 \u2193 \u4E0B\u65B9\u53D1\u9001\u6587\u4EF6\uFF0C\u70B9\u51FB\u5373\u53EF\u67E5\u770B/\u4E0B\u8F7D';
    var ok3 = await pushFileToWecomGroup(STRATEGY_WEBHOOK_KEY, STRATEGY_WEBHOOK_URL, strategyPath, desc3);
    if (ok3) count++;
    await new Promise(function(r) { setTimeout(r, 800); });
  } else {
    console.warn('[WARN] strategy Excel not found: ' + strategyPath);
  }

  return count;
}

async function main() {
  var args = process.argv.slice(2);
  var targetDate = null;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) targetDate = args[++i];
  }
  var dateStr = targetDate || formatDate(new Date());

  console.log('[PUSH] === 神雕套利运营日报(3)群推送开始 === ' + dateStr);

  // Check webhook key is configured
  if (STRATEGY_WEBHOOK_KEY === 'PLACEHOLDER_NEW_WEBHOOK_KEY') {
    console.error('[FAIL] STRATEGY_WEBHOOK_KEY not configured!');
    process.exit(1);
  }

  // ====== 阶段1: 直接推送3个报告文件（PDF + Excel）到群内 ======
  console.log('[PUSH] --- 阶段1: 直推3个文件到群（PDF+竞争力Excel+策略Excel） ---');
  var fileCount = await pushReportsToWecom(dateStr);
  console.log('[PUSH] 阶段1完成: 成功推送 ' + fileCount + '/3 个文件');

  // ====== 阶段2: 推送全量产品策略分析 ======
  console.log('[PUSH] --- 阶段2: 全量产品策略分析 ---');

  // Check if strategy Excel exists
  var excelPath = path.join(REPORT_BASE_DIR, '\u795E\u96D5\u519C\u673A_\u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790_' + dateStr + '.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error('[FAIL] Strategy Excel not found: ' + excelPath);
    process.exit(1);
  }
  console.log('[STRATEGY-PUSH] found strategy Excel: ' + excelPath);

  // Try to read detailed strategy data
  var strategyData = readStrategyData(dateStr);

  var messages;
  if (strategyData) {
    console.log('[STRATEGY-PUSH] using full detail mode');
    messages = buildStrategyMessages(strategyData, dateStr);
  } else {
    console.log('[STRATEGY-PUSH] using basic summary mode (no JSON data)');
    messages = [buildBasicStrategySummary(dateStr)];
  }

  if (!messages || messages.length === 0) {
    console.error('[FAIL] no messages to send');
    process.exit(1);
  }

  // Send each message sequentially
  for (var m = 0; m < messages.length; m++) {
    var md = messages[m];
    // Ensure each message is under limit
    var chunks = splitMessages(md, 3800); // leave some margin from 4096
    for (var c = 0; c < chunks.length; c++) {
      console.log('[STRATEGY-PUSH] sending message ' + (m+1) + '/' + messages.length + ' chunk ' + (c+1) + '/' + chunks.length + ' (' + chunks[c].length + ' chars)...');
      var result = await postToWecom(STRATEGY_WEBHOOK_URL, 'markdown', chunks[c]);
      if (result.errcode !== 0) {
        console.error('[FAIL] chunk send failed: ' + result.errmsg);
        process.exit(1);
      }
      // Small delay between messages to avoid rate limiting
      if (c < chunks.length - 1 || m < messages.length - 1) {
        await new Promise(function(r) { setTimeout(r, 500); });
      }
    }
  }

  var totalSent = fileCount + messages.length;
  console.log('[OK] All ' + totalSent + ' items sent to \u795E\u96D5\u5957\u5229\u8FD0\u8425\u65E5\u62A5(3) (files: ' + fileCount + ' + strategy msgs: ' + messages.length + ')');
}

main()
  .catch(function(e) {
    console.error('[FAIL] ' + e.message);
    process.exit(1);
  });
