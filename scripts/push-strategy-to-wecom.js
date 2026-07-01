/**
 * 神雕农机 - 全量产品策略分析报告 -> 企业微信群推送（内部运营群）
 * 
 * 用法：
 *   node scripts/push-strategy-to-wecom.js --date YYYY-MM-DD
 * 
 * 功能：
 *   1. 读取已生成的全量产品策略分析Excel
 *   2. 提取关键策略信息
 *   3. 推送到"神雕套利运营日报"群的Webhook机器人
 */

var https = require('https');
var fs = require('fs');
var path = require('path');

// ========== config ==========
// 【重要】这是"神雕套利运营日报(3)"群的机器人 Webhook Key
var STRATEGY_WEBHOOK_KEY = 'PLACEHOLDER_NEW_WEBHOOK_KEY'; // 需要替换为新群的Key
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

/**
 * 从全量策略分析JSON文件中读取数据
 * 如果没有JSON，则从Excel中解析（简化版：只读概要）
 */
function readStrategyData(dateStr) {
  var dataFile = path.join(REPORT_BASE_DIR, '_temp_strategy_' + dateStr + '.json');
  
  // 尝试直接从数据库导出（通过临时JSON）
  if (fs.existsSync(dataFile)) {
    return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  }
  
  // 如果没有预处理的JSON，返回null（需要先运行导出）
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
  lines.push('\uD83D\uDC49 [\u67E5\u770B\u5728\u552E\u4EA7\u54C1](https://usedfarmmach.cn/zh/products)');

  return lines.join('\n');
}

/**
 * 备用方案：如果无法读取详细数据，生成基础版消息
 */
function buildBasicStrategySummary(dateStr) {
  return '## \uD83E\uDDEA \u795E\u96D5\u519C\u673A \u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790 \u00B7 ' + dateStr + '\n\n' +
    '> <font color="warning">\u3010\u5185\u90E8\u6587\u4EF6\u3011\u8FD0\u8425\u56E2\u961F\u4E13\u770B\n\n' +
    '**\u62A5\u544A\u5DF2\u751F\u6210\uFF1A** `神雕农机_全量产品策略分析_' + dateStr + '.xlsx`\n\n' +
    '**\u5305\u542B\u5185\u5BB9\uFF1A**\n' +
    '- \u62A5\u544A\u6982\u8981\uFF1A\u603B\u4EA7\u54C1\u6570/\u9AD8\u5957\u5229\u6570/\u5269\u4F59\u5206\u6790\u6570\n' +
    '- \u4EA7\u54C1\u9010\u4E00\u5206\u6790\uFF1A\u6BCF\u6B3E\u7684\u7B56\u7565\u5206\u7C7B(A-H)\u3001\u884c\u52A8\u5efa\u8BAE\u3001\u4F18\u5148\u7EA7\n' +
    '- \u5206\u7EC4\u884c\u52A8\u6E05\u5355\uFF1A\u6309\u7B56\u7565\u7EC4\u6C47\u603B\n' +
    '- \u5E93\u5B58\u4F18\u5316\u5EFA\u8BAE\n\n' +
    '**\u7B56\u7565\u5206\u7C7B\u4F53\u7CFB\uFF1a**\n' +
    '- A.\u51C6\u65B0\u673A\u63A8\u5E7F\u2192\u6807\u6746\u5C55\u793A\n' +
    '- B.\u9AD8\u4EF7\u56FD\u9645\u724C\u2192\u7CBE\u51C6\u6D77\u5916\u8425\u9500\n' +
    '- C.\u4E2D\u7AEF\u8D70\u91CF\u2192\u6279\u91CF\u62A5\u4EF7\n' +
    '- D.\u56FD\u4EA7\u5C0F\u4F17\u2192\u56FD\u5185+\u65B0\u5174\u5E02\u573A\n' +
    '- E.\u8001\u65E7\u6E05\u4ED3\u2192\u5FEB\u901F\u56DE\u7B54\n' +
    '- F.\u4F4E\u4EF7\u65B0\u54C1\u2192\u5F15\u6D41\u83B7\u5BA2\n' +
    '- G.\u4E13\u7528\u8BBE\u5907\u2192\u5782\u76F4\u573A\u666F\n' +
    '- H.\u5F85\u5206\u7C7B\u2192\u9700\u4EBA\u5DE5\u590D\u6838\n\n' +
    '\uD83D\uDCC4 \u8BE6\u7EC6\u5185\u5BB9\u8BF7\u67E5\u770BExcel\u6587\u4EF6\n' +
    '\uD83D\uDC49 [\u67E5\u770b\u5728\u552e\u4ea7\u54c1](https://usedfarmmach.cn/zh/products)';
}

async function main() {
  var args = process.argv.slice(2);
  var targetDate = null;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) targetDate = args[++i];
  }
  var dateStr = targetDate || formatDate(new Date());

  console.log('[STRATEGY-PUSH] preparing strategy report for ' + dateStr);

  // Check if strategy Excel exists
  var excelPath = path.join(REPORT_BASE_DIR, '\u795E\u96D5\u519C\u673A_\u5168\u91CF\u4EA7\u54C1\u7B56\u7565\u5206\u6790_' + dateStr + '.xlsx');

  if (!fs.existsSync(excelPath)) {
    console.error('[FAIL] Strategy Excel not found: ' + excelPath);
    console.error('Please run gen_full_portfolio_strategy.py first.');
    process.exit(1);
  }

  console.log('[STRATEGY-PUSH] found strategy Excel: ' + excelPath);

  // Try to read detailed strategy data
  var strategyData = readStrategyData(dateStr);

  // Build message
  var markdown;
  if (strategyData) {
    console.log('[STRATEGY-PUSH] using full detail mode');
    markdown = buildStrategyMarkdown(strategyData, dateStr);
  } else {
    console.log('[STRATEGY-PUSH] using basic summary mode (no JSON data)');
    markdown = buildBasicStrategySummary(dateStr);
  }

  // Check webhook key is configured
  if (STRATEGY_WEBHOOK_KEY === 'PLACEHOLDER_NEW_WEBHOOK_KEY') {
    console.error('[FAIL] STRATEGY_WEBHOOK_KEY not configured!');
    console.error('Please edit this script and replace PLACEHOLDER_NEW_WEBHOOK_KEY with the actual webhook key.');
    process.exit(1);
  }

  // Send message
  console.log('[STRATEGY-PUSH] sending to strategy group...');
  var result = await postToWecom(STRATEGY_WEBHOOK_URL, 'markdown', markdown);

  if (result.errcode === 0) {
    console.log('[OK] Strategy report sent to 神雕套利运营日报 group successfully');
  } else {
    console.error('[FAIL] send failed: ' + result.errmsg + ' (errcode: ' + result.errcode + ')');
    process.exit(1);
  }
}

main()
  .catch(function(e) {
    console.error('[FAIL] ' + e.message);
    process.exit(1);
  });
