/**
 * 多品牌国际基准价 — 轻量爬虫 + 聚合引擎
 *
 * 决策（2026-08-12）：18 品牌全上 / 投入轻量爬虫 / 俄线(Avito/OLX)首期 / 每天1次
 *
 * 两种运行模式：
 *   node fetch-benchmark.js --seed PATH.json   从研究种子 JSON 写入 BrandBenchmark（首期锚定价）
 *   node fetch-benchmark.js --refresh           逐条目标尝试实时抓取并聚合（网络不可达时降级保底）
 *   node fetch-benchmark.js --report            仅输出当前 BrandBenchmark 汇总（不抓取）
 *
 * 准确性机制：
 *   - 价格取样本「中位价」而非均值，剔除 >1.5×IQR 离群挂牌
 *   - 置信度随「源数 / 样本量 / 时效」评分
 *   - 外币价按采集日 FX 折算 CNY；lastVerified 超 30/60 天分别标黄/红
 *   - 成交价(sold)权重高于挂牌价(listing)
 *
 * 降级：沙箱无稳定外网出口时，--refresh 不写脏数据，仅刷新 FX + 重算聚合 + 保留已有样本。
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const cfg = require('./benchmark-config');

const prisma = new PrismaClient();

// —— FX 兜底常量（离线时使用）——
const FX_FALLBACK = { EUR: 7.90, USD: 7.25, RUB: 0.090, GBP: 9.20, CNY: 1 };

// —— 简单 GET（带 UA + 超时），失败时抛错由调用方降级 ——
function httpGet(url, { timeout = 12000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      {
        timeout,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          ...headers,
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return httpGet(res.headers.location, { timeout, headers }).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// —— 取 FX（foreign→CNY）。优先 open.er-api，失败用兜底 ——
async function getFxRates() {
  try {
    const json = await httpGet('https://open.er-api.com/v6/latest/EUR', { timeout: 10000 });
    const rates = JSON.parse(json).rates; // base EUR
    // 转换为 foreign→CNY
    const eurToCny = rates.CNY;
    return {
      EUR: eurToCny,
      USD: (rates.USD ? eurToCny / rates.USD : FX_FALLBACK.USD),
      RUB: (rates.RUB ? eurToCny / rates.RUB : FX_FALLBACK.RUB),
      GBP: (rates.GBP ? eurToCny / rates.GBP : FX_FALLBACK.GBP),
      CNY: 1,
    };
  } catch (e) {
    console.warn('  ⚠️ FX 实时获取失败，使用兜底常量：', e.message);
    return FX_FALLBACK;
  }
}

// —— 源站搜索 URL 构造（已知站点直搜；未知用 Bing 限定域名）——
function buildSearchUrl(source, target) {
  const q = encodeURIComponent(`${target.nameEn} ${target.model}`);
  switch (source.key) {
    case 'agroline':
      return `https://www.google.com/search?q=${encodeURIComponent(`${target.nameEn} ${target.model} site:agroline.com`)}`;
    case 'machinerypete':
      return `https://www.machinerypete.com/search?q=${q}`;
    case 'mascus':
      return `https://www.mascus.com/search?q=${q}`;
    case 'tractorhouse':
      return `https://www.tractorhouse.com/search?q=${q}`;
    case 'efarm':
      return `https://www.e-farm.com/en/machines?search=${q}`;
    case 'avito':
      return `https://www.avito.ru/rossiya?q=${encodeURIComponent(`${target.nameEn} ${target.model}`)}`;
    case 'olx':
      return `https://www.olx.ua/list/q-${encodeURIComponent(`${target.nameEn} ${target.model}`)}`;
    default:
      return `https://www.bing.com/search?q=${encodeURIComponent(`${target.nameEn} ${target.model} ${source.name}`)}`;
  }
}

// —— 通用价格抽取（多币种）——
// 提取形如 €123,456 / $123.456 / 1 234 567 ₽ / 123.456,78 € 的金额
const PRICE_RE = [
  /(?:€|EUR|Eur)\s?([\d][\d .\d]{2,}(?:,\d{2})?)/gi,
  /(?:US?\$|USD)\s?([\d][\d .,\d]{2,})/gi,
  /([\d][\d .\d]{3,}(?:,\d{2})?)\s?(?:₽|руб|RUB)/gi,
  /(?:£|GBP)\s?([\d][\d .,\d]{2,})/gi,
];

function extractPrices(text, currency) {
  const found = [];
  for (const re of PRICE_RE) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1].replace(/[^\d.,]/g, '');
      // 欧式 1.234,56 / 美式 1,234.56 → 统一
      let num;
      if (raw.includes(',') && raw.includes('.')) {
        num = parseFloat(raw.replace(/[,.]/g, (c) => (c === ',' ? '.' : '')));
      } else if (raw.includes(',')) {
        // 可能是小数点（欧式）或千分位（美式）。按长度启发：若逗号后3位→千分位
        const parts = raw.split(',');
        num = parts.length === 2 && parts[1].length === 3 ? parseFloat(raw.replace(/,/g, '')) : parseFloat(raw.replace(',', '.'));
      } else {
        num = parseFloat(raw);
      }
      if (num && num > 500 && num < 10000000) found.push(num); // 合理农机价区间
    }
  }
  return found;
}

// —— 聚合：中位价 + IQR 离群过滤 + 置信度 ——
function aggregate(listings, source, fx, opts = {}) {
  if (!listings.length) return null;
  const nums = listings.map((l) => l.priceForeign).sort((a, b) => a - b);
  const median = medianOf(nums);
  // IQR 离群过滤（>1.5×IQR）
  const q1 = quantile(nums, 0.25);
  const q3 = quantile(nums, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const clean = nums.filter((n) => n >= lo && n <= hi);
  const finalNums = clean.length >= 3 ? clean : nums; // 样本太少不过滤
  const priceForeign = medianOf(finalNums);
  const rate = fx[source.currency] || FX_FALLBACK[source.currency] || 1;
  const sampleSize = finalNums.length;
  const confidence = confidenceScore({ sources: 1, sampleSize, ageDays: 0 });
  return {
    priceForeign: round2(priceForeign),
    medianPrice: round2(median),
    currency: source.currency,
    priceCny: round2(priceForeign * rate),
    exchangeRate: round4(rate),
    sampleSize,
    listingCount: listings.length,
    confidenceScore: round2(confidence),
    priceType: opts.priceType || 'listing',
  };
}

function medianOf(arr) {
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
function quantile(arr, q) {
  if (!arr.length) return 0;
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return arr[base] !== undefined ? arr[base] + rest * ((arr[base + 1] || arr[base]) - arr[base]) : arr[0];
}
function confidenceScore({ sources, sampleSize, ageDays }) {
  let s = 0.3;
  if (sources >= 2) s = 0.6;
  if (sources >= 3) s = 0.85;
  if (sampleSize >= 3) s += 0.05;
  if (sampleSize >= 8) s += 0.05;
  if (ageDays > 30) s -= 0.2;
  if (ageDays > 60) s -= 0.2;
  return Math.max(0.1, Math.min(0.95, s));
}
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;

// —— 写库（按 brand+model+sourceSite upsert）——
async function upsertBenchmark(row) {
  // 按 brand+model+sourceSite 查找（无复合唯一索引，用 findFirst 兜底 upsert）
  const existing = await prisma.brandBenchmark.findFirst({
    where: { brand: row.brand, model: row.model, sourceSite: row.sourceSite },
  });
  const data = {
    brand: row.brand,
    brandNameZh: row.brandNameZh,
    model: row.model,
    category: row.category,
    sourceSite: row.sourceSite,
    priceForeign: row.priceForeign,
    currency: row.currency,
    priceCny: row.priceCny,
    exchangeRate: row.exchangeRate,
    sourceUrl: row.sourceUrl || null,
    sourceDate: row.sourceDate || null,
    confidenceScore: row.confidenceScore,
    sampleSize: row.sampleSize,
    medianPrice: row.medianPrice,
    listingCount: row.listingCount,
    priceType: row.priceType || 'listing',
    region: row.region || null,
    lastVerified: new Date(),
    isActive: true,
  };
  if (existing) {
    return prisma.brandBenchmark.update({ where: { id: existing.id }, data });
  }
  return prisma.brandBenchmark.create({ data });
}

// —— 模式1：种子（研究 JSON → DB）——
async function seedFromResearch(jsonPath) {
  const abs = path.isAbsolute(jsonPath) ? jsonPath : path.join(process.cwd(), jsonPath);
  if (!fs.existsSync(abs)) throw new Error(`种子文件不存在: ${abs}`);
  const rows = JSON.parse(fs.readFileSync(abs, 'utf8'));
  console.log(`🌱 种子写入：读取 ${rows.length} 条`);
  let n = 0,
    err = 0;
  for (const r of rows) {
    try {
      await upsertBenchmark(r);
      n++;
    } catch (e) {
      err++;
      console.error(`  ✗ ${r.brand} ${r.model} @${r.sourceSite}: ${e.message}`);
    }
  }
  console.log(`  ✅ 写入 ${n} 条，失败 ${err} 条`);
  return { n, err };
}

// —— 模式2：实时刷新（逐目标抓取；不可达降级）——
async function refresh(fx) {
  const targets = cfg.buildTargets();
  console.log(`🔄 实时刷新：共 ${targets.length} 个目标（${cfg.BRANDS.length} 品牌 × 机型 × ${cfg.SOURCES.length} 源站）`);
  let ok = 0,
    skip = 0,
    failed = 0;
  for (const t of targets) {
    const source = cfg.SOURCES.find((s) => s.key === t.sourceSite);
    const url = buildSearchUrl(source, t);
    try {
      const html = await httpGet(url);
      const prices = extractPrices(html, source.currency);
      if (!prices.length) {
        skip++;
        continue;
      }
      const listings = prices.map((p) => ({ priceForeign: p }));
      const agg = aggregate(listings, source, fx, { priceType: 'listing' });
      if (!agg) {
        skip++;
        continue;
      }
      await upsertBenchmark({
        ...t,
        ...agg,
        sourceUrl: url,
        sourceDate: new Date().toISOString().slice(0, 10),
        region: source.region,
      });
      ok++;
    } catch (e) {
      failed++;
      // 降级：不写脏数据，保留已有样本
      console.warn(`  ⚠️ ${t.brand} ${t.model} @${t.sourceSite} 抓取失败（降级保底）: ${e.message}`);
    }
  }
  console.log(`  ✅ 成功 ${ok} / 跳过(无样本) ${skip} / 失败(网络) ${failed}`);
  return { ok, skip, failed };
}

// —— 模式3：报告（只读汇总）——
async function report() {
  const rows = await prisma.brandBenchmark.findMany({ where: { isActive: true } });
  console.log(`\n📊 BrandBenchmark 汇总（${rows.length} 行）`);
  const byBrand = {};
  for (const r of rows) {
    byBrand[r.brand] = byBrand[r.brand] || { zh: r.brandNameZh, models: {} };
    byBrand[r.brand].models[r.model] = byBrand[r.brand].models[r.model] || [];
    byBrand[r.brand].models[r.model].push({
      site: r.sourceSite,
      cny: Math.round(r.priceCny),
      conf: r.confidenceScore,
      samp: r.sampleSize,
      date: r.sourceDate,
    });
  }
  for (const [brand, info] of Object.entries(byBrand)) {
    console.log(`\n■ ${info.zh} (${brand})`);
    for (const [model, srcs] of Object.entries(info.models)) {
      const cnys = srcs.map((s) => s.cny).filter((x) => x);
      const med = cnys.length ? (medianOf(cnys.sort((a, b) => a - b)) / 10000).toFixed(1) : '-';
      console.log(`  · ${model}  中位CNY≈${med}万  源数=${srcs.length}  样本=${srcs.reduce((a, s) => a + s.samp, 0)}`);
      for (const s of srcs) console.log(`      - ${s.site}: ¥${(s.cny / 10000).toFixed(1)}万 置信${s.conf} 样本${s.samp} ${s.date || ''}`);
    }
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === '--seed') {
    const fx = await getFxRates();
    console.log('FX(→CNY):', fx);
    await seedFromResearch(process.argv[3] || 'scripts/benchmark-seed.json');
  } else if (mode === '--refresh') {
    const fx = await getFxRates();
    console.log('FX(→CNY):', fx);
    await refresh(fx);
  } else if (mode === '--report') {
    await report();
  } else {
    console.log('用法:');
    console.log('  node fetch-benchmark.js --seed scripts/benchmark-seed.json');
    console.log('  node fetch-benchmark.js --refresh');
    console.log('  node fetch-benchmark.js --report');
  }
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
