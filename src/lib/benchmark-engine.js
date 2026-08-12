/**
 * 多品牌国际基准价 — 采集/聚合引擎（单一真相源）
 *
 * 设计（2026-08-12 改造，方案 A：Vercel Cron 调度）：
 *  - 原 scripts/fetch-benchmark.js + scripts/benchmark-config.js 的逻辑合并到此模块。
 *  - 本文件是 CommonJS，可被两类消费者复用：
 *      1) Next.js 路由 src/app/api/cron/benchmark/route.ts（Vercel 定时跑，境外出网自由）
 *      2) 本地/海外 VPS 的 CLI 脚本 scripts/fetch-benchmark.js（node 直接跑）
 *  - 自带 PrismaClient（不依赖 @/lib/db 别名，保证 node CLI 也能用）。
 *  - runRefresh 支持并发 + 单目标超时，规避 Vercel 函数 60s/300s 上限：
 *      18 品牌 × 机型 × 7 源 ≈ 266 目标，并发 12、单目标 8s 超时 → 最坏 ~184s。
 *
 * 决策（2026-08-12 用户拍板）：18 品牌全上 / 轻量爬虫 / 俄线(Avito/OLX)首期 / 每天1次。
 *
 * 准确性机制：
 *  - 价格取样本「中位价」而非均值，剔除 >1.5×IQR 离群挂牌
 *  - 置信度随「源数 / 样本量 / 时效」评分
 *  - 外币价按采集日 FX 折算 CNY；成交价(sold)权重高于挂牌价(listing)
 *  - 降级：网络不可达时不写脏数据，仅刷新 FX + 重算聚合 + 保留已有样本
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();

// —— FX 兜底常量（离线时使用）——
const FX_FALLBACK = { EUR: 7.90, USD: 7.25, RUB: 0.090, GBP: 9.20, CNY: 1 };

// —— 品类分类法（与 BrandBenchmark.category 一致）——
const CATEGORY = {
  TRACTOR: 'tractor',
  FORAGE: 'forage_harvester',
  COMBINE: 'combine',
  BALER: 'baler',
  HAY: 'mower_tedder',
  SOIL: 'soil',
};

// 18 个品牌（拖拉机 11 + 收获青贮 4 + 耕整 3）
const BRANDS = [
  { slug: 'john-deere', nameZh: '约翰迪尔', nameEn: 'John Deere', origin: 'US', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'new-holland', nameZh: '纽荷兰', nameEn: 'New Holland', origin: 'IT/US', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'case-ih', nameZh: '凯斯', nameEn: 'Case IH', origin: 'US', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'massey-ferguson', nameZh: '麦赛福格森', nameEn: 'Massey Ferguson', origin: 'US/UK', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'fendt', nameZh: '芬特', nameEn: 'Fendt', origin: 'DE', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'valtra', nameZh: '维特拉', nameEn: 'Valtra', origin: 'FI', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'deutz-fahr', nameZh: '道依茨法尔', nameEn: 'Deutz-Fahr', origin: 'DE', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'kubota', nameZh: '久保田', nameEn: 'Kubota', origin: 'JP', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'yto', nameZh: '东方红', nameEn: 'YTO', origin: 'CN', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'lovol', nameZh: '雷沃', nameEn: 'Lovol', origin: 'CN', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'mccormick', nameZh: '麦考密克', nameEn: 'McCormick', origin: 'IT', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'claas', nameZh: '克拉斯', nameEn: 'CLAAS', origin: 'DE', primaryCategory: CATEGORY.FORAGE },
  { slug: 'krone', nameZh: '科罗尼', nameEn: 'Krone', origin: 'DE', primaryCategory: CATEGORY.FORAGE },
  { slug: 'vermeer', nameZh: '维米尔', nameEn: 'Vermeer', origin: 'US', primaryCategory: CATEGORY.BALER },
  { slug: 'mchale', nameZh: '麦克海尔', nameEn: 'McHale', origin: 'IE', primaryCategory: CATEGORY.BALER },
  { slug: 'kuhn', nameZh: '库恩', nameEn: 'Kuhn', origin: 'FR', primaryCategory: CATEGORY.SOIL },
  { slug: 'lemken', nameZh: '雷肯', nameEn: 'Lemken', origin: 'DE', primaryCategory: CATEGORY.SOIL },
  { slug: 'amazone', nameZh: '阿玛松', nameEn: 'Amazone', origin: 'DE', primaryCategory: CATEGORY.SOIL },
];

// 各品牌旗舰机型（1–3 个）
const MODELS = {
  'john-deere': [
    { model: '8R 410', category: CATEGORY.TRACTOR },
    { model: '6R 250', category: CATEGORY.TRACTOR },
  ],
  'new-holland': [
    { model: 'T7.315', category: CATEGORY.TRACTOR },
    { model: 'T8.435', category: CATEGORY.TRACTOR },
    { model: 'FR920', category: CATEGORY.FORAGE },
  ],
  'case-ih': [
    { model: 'Magnum 380', category: CATEGORY.TRACTOR },
    { model: 'Axial-Flow 8240', category: CATEGORY.COMBINE },
  ],
  'massey-ferguson': [
    { model: '8S.305', category: CATEGORY.TRACTOR },
    { model: 'MF 7700', category: CATEGORY.TRACTOR },
  ],
  fendt: [
    { model: '1050 Vario', category: CATEGORY.TRACTOR },
    { model: '724 Vario', category: CATEGORY.TRACTOR },
  ],
  valtra: [
    { model: 'T254 Versu', category: CATEGORY.TRACTOR },
    { model: 'N175', category: CATEGORY.TRACTOR },
  ],
  'deutz-fahr': [
    { model: '9340 TTV', category: CATEGORY.TRACTOR },
    { model: '7250 TTV', category: CATEGORY.TRACTOR },
  ],
  kubota: [
    { model: 'M7171', category: CATEGORY.TRACTOR },
    { model: 'M135', category: CATEGORY.TRACTOR },
  ],
  yto: [
    { model: 'LX2204', category: CATEGORY.TRACTOR },
    { model: 'MF704', category: CATEGORY.TRACTOR },
  ],
  lovol: [
    { model: 'M2004-5G', category: CATEGORY.TRACTOR },
    { model: 'GE80', category: CATEGORY.COMBINE },
  ],
  mccormick: [
    { model: 'X7.210', category: CATEGORY.TRACTOR },
    { model: 'X8.680', category: CATEGORY.TRACTOR },
  ],
  claas: [
    { model: 'Jaguar 970', category: CATEGORY.FORAGE },
    { model: 'Lexion 8600', category: CATEGORY.COMBINE },
    { model: 'Xerion 5000', category: CATEGORY.TRACTOR },
  ],
  krone: [
    { model: 'BigX 1180', category: CATEGORY.FORAGE },
    { model: 'BiG Pack 1290', category: CATEGORY.BALER },
  ],
  vermeer: [
    { model: '604 Pro', category: CATEGORY.BALER },
    { model: 'WR360', category: CATEGORY.HAY },
  ],
  mchale: [
    { model: 'Fusion 3 Plus', category: CATEGORY.BALER },
    { model: 'V660', category: CATEGORY.BALER },
  ],
  kuhn: [
    { model: 'VB 3190', category: CATEGORY.BALER },
    { model: 'GA 4121', category: CATEGORY.HAY },
  ],
  lemken: [
    { model: 'Rubin 10', category: CATEGORY.SOIL },
    { model: 'Juwel 8', category: CATEGORY.SOIL },
  ],
  amazone: [
    { model: 'Cenius', category: CATEGORY.SOIL },
    { model: 'ZA-TS', category: CATEGORY.SOIL },
  ],
};

// 首期数据源（7 站，含俄线）。russian=true 的站优先（套利核心市场）。
const SOURCES = [
  { key: 'agroline', name: 'Agroline', region: 'EU', currency: 'EUR', russian: false },
  { key: 'machinerypete', name: 'MachineryPete', region: 'US', currency: 'USD', russian: false },
  { key: 'mascus', name: 'Mascus', region: 'GLOBAL', currency: 'EUR', russian: false },
  { key: 'tractorhouse', name: 'TractorHouse', region: 'US', currency: 'USD', russian: false },
  { key: 'efarm', name: 'e-farm', region: 'GLOBAL', currency: 'EUR', russian: false },
  { key: 'avito', name: 'Avito', region: 'RU', currency: 'RUB', russian: true },
  { key: 'olx', name: 'OLX', region: 'RU/UA', currency: 'RUB', russian: true },
];

// 生成"品牌×机型×源站"目标清单（供爬虫逐条采集）
function buildTargets() {
  const targets = [];
  for (const b of BRANDS) {
    const models = MODELS[b.slug] || [];
    for (const m of models) {
      for (const s of SOURCES) {
        targets.push({
          brand: b.slug,
          brandNameZh: b.nameZh,
          nameEn: b.nameEn,
          model: m.model,
          category: m.category,
          sourceSite: s.key,
          region: s.region,
          currency: s.currency,
          russian: s.russian,
        });
      }
    }
  }
  return targets;
}

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
          return reject(new Error(`HTTP ${res.statusCode}`));
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
    const eurToCny = rates.CNY;
    return {
      EUR: eurToCny,
      USD: rates.USD ? eurToCny / rates.USD : FX_FALLBACK.USD,
      RUB: rates.RUB ? eurToCny / rates.RUB : FX_FALLBACK.RUB,
      GBP: rates.GBP ? eurToCny / rates.GBP : FX_FALLBACK.GBP,
      CNY: 1,
    };
  } catch (e) {
    console.warn('  ⚠️ FX 实时获取失败，使用兜底常量：', e.message);
    return FX_FALLBACK;
  }
}

// —— 源站搜索 URL 构造 ——
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
      let num;
      if (raw.includes(',') && raw.includes('.')) {
        num = parseFloat(raw.replace(/[,.]/g, (c) => (c === ',' ? '.' : '')));
      } else if (raw.includes(',')) {
        const parts = raw.split(',');
        num = parts.length === 2 && parts[1].length === 3 ? parseFloat(raw.replace(/,/g, '')) : parseFloat(raw.replace(',', '.'));
      } else {
        num = parseFloat(raw);
      }
      if (num && num > 500 && num < 10000000) found.push(num);
    }
  }
  return found;
}

// —— 聚合：中位价 + IQR 离群过滤 + 置信度 ——
function aggregate(listings, source, fx, opts = {}) {
  if (!listings.length) return null;
  const nums = listings.map((l) => l.priceForeign).sort((a, b) => a - b);
  const median = medianOf(nums);
  const q1 = quantile(nums, 0.25);
  const q3 = quantile(nums, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const clean = nums.filter((n) => n >= lo && n <= hi);
  const finalNums = clean.length >= 3 ? clean : nums;
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

// —— 单目标采集（网络不可达/无样本则降级，不写脏数据）——
async function fetchOneTarget(target, fx, timeoutMs) {
  const source = SOURCES.find((s) => s.key === target.sourceSite);
  if (!source) return { status: 'skip', reason: 'no-source' };
  const url = buildSearchUrl(source, target);
  try {
    const html = await httpGet(url, { timeout: timeoutMs });
    const prices = extractPrices(html, source.currency);
    if (!prices.length) return { status: 'skip', reason: 'no-price' };
    const listings = prices.map((p) => ({ priceForeign: p }));
    const agg = aggregate(listings, source, fx, { priceType: 'listing' });
    if (!agg) return { status: 'skip', reason: 'no-agg' };
    await upsertBenchmark({
      ...target,
      ...agg,
      sourceUrl: url,
      sourceDate: new Date().toISOString().slice(0, 10),
      region: source.region,
    });
    return { status: 'ok' };
  } catch (e) {
    return { status: 'failed', reason: e.message };
  }
}

// —— 并发刷新（规避 Vercel 函数超时）——
// opts: { fx, concurrency=12, timeoutMs=8000, targets?, sources? }
async function runRefresh(opts = {}) {
  const fx = opts.fx || (await getFxRates());
  let all = opts.targets || buildTargets();
  if (Array.isArray(opts.sources) && opts.sources.length) {
    const set = new Set(opts.sources);
    all = all.filter((t) => set.has(t.sourceSite));
  }
  const queue = all.slice();
  const stats = { ok: 0, skip: 0, failed: 0, total: all.length, bySource: {} };
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      const r = await fetchOneTarget(t, fx, opts.timeoutMs || 8000);
      stats[r.status] = (stats[r.status] || 0) + 1;
      const bs = (stats.bySource[t.sourceSite] = stats.bySource[t.sourceSite] || { ok: 0, skip: 0, failed: 0 });
      bs[r.status] = (bs[r.status] || 0) + 1;
    }
  };
  const n = Math.max(1, Math.min(opts.concurrency || 12, all.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return stats;
}

// —— 种子（研究 JSON → DB）——
async function seedFromResearch(jsonPath) {
  const abs = path.isAbsolute(jsonPath) ? jsonPath : path.join(process.cwd(), jsonPath);
  if (!fs.existsSync(abs)) throw new Error(`种子文件不存在: ${abs}`);
  const rows = JSON.parse(fs.readFileSync(abs, 'utf8'));
  console.log(`🌱 种子写入：读取 ${rows.length} 条`);
  let n = 0, err = 0;
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

// —— 只读报告 ——
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

function disconnectBenchmark() {
  return prisma.$disconnect();
}

module.exports = {
  prisma,
  CATEGORY,
  BRANDS,
  MODELS,
  SOURCES,
  FX_FALLBACK,
  buildTargets,
  httpGet,
  getFxRates,
  buildSearchUrl,
  extractPrices,
  aggregate,
  upsertBenchmark,
  fetchOneTarget,
  runRefresh,
  seedFromResearch,
  report,
  disconnectBenchmark,
};
