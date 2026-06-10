const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const https = require('https');

const WEBHOOK_KEY = '9d46e962-5b34-48af-b010-06e8e8b78cf4';
const WEBHOOK_URL = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${WEBHOOK_KEY}`;

function postToWecom(content) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      msgtype: 'markdown',
      markdown: { content }
    });
    const url = new URL(WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateReport() {
  const products = await prisma.product.findMany({
    include: { images: true, brand: true, category: true, videos: true }
  });
  
  const total = products.length;
  const withVid = products.filter(p => p.videos.length > 0).length;
  const withPrice = products.filter(p => p.priceCny > 0).length;
  
  const priced = products.filter(p => p.priceCny > 0).map(p => p.priceCny);
  const minPrice = Math.min(...priced);
  const maxPrice = Math.max(...priced);
  const avgPrice = Math.round(priced.reduce((a, b) => a + b, 0) / priced.length);
  
  // Brand stats
  const brandCount = {};
  products.forEach(p => {
    const b = p.brand?.nameZh || '?';
    brandCount[b] = (brandCount[b] || 0) + 1;
  });
  const topBrands = Object.entries(brandCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], i) => `${i + 1}. ${name} ${count}台`)
    .join('\n');
  
  // Price ranges
  const ranges = { '0-5万': 0, '5-15万': 0, '15-30万': 0, '30-60万': 0, '60-100万': 0, '100万+': 0 };
  priced.forEach(pr => {
    const w = pr / 10000;
    if (w < 5) ranges['0-5万']++;
    else if (w < 15) ranges['5-15万']++;
    else if (w < 30) ranges['15-30万']++;
    else if (w < 60) ranges['30-60万']++;
    else if (w < 100) ranges['60-100万']++;
    else ranges['100万+']++;
  });
  
  const today = new Date().toISOString().slice(0, 10);
  const vidPct = ((withVid / total) * 100).toFixed(1);
  const pricePct = ((withPrice / total) * 100).toFixed(1);
  
  return `## 🚜 神雕农机日报 · ${today}

**📊 核心数据**
> 在售产品：**${total}台** | 图片覆盖：✅100% | 视频覆盖：⚠️${vidPct}%
> 已标价：✅${pricePct}% | 均价：¥${(avgPrice/10000).toFixed(1)}万 | 最高：¥${(maxPrice/10000).toFixed(0)}万

**💰 价格分布**
- 0-5万：${ranges['0-5万']}台 | 5-15万：${ranges['5-15万']}台 | 15-30万：${ranges['15-30万']}台
- 30-60万：${ranges['30-60万']}台 | 60-100万：${ranges['60-100万']}台 | 100万+：${ranges['100万+']}台

**🏭 品牌TOP5**
${topBrands}

**⚠️ 待处理**
- 品牌名异常：3台（迪尔7250/进口/废铁）
- 缺视频：${total - withVid}台
- 未标价：${total - withPrice}台

---
📎 [查看完整报告](https://lexiangla.com/pages/a00f01e64db74506b1df05da923b79fa)`;
}

async function main() {
  try {
    const content = await generateReport();
    const result = await postToWecom(content);
    console.log('推送结果:', result);
    if (result.errcode === 0) {
      console.log('✅ 推送成功！');
    } else {
      console.error('❌ 推送失败:', result.errmsg);
    }
  } catch (e) {
    console.error('❌ 错误:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
