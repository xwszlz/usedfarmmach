// scripts/fetch-live-market-data.js
// 重写于 2026-09-02：彻底移除硬编码模拟数据。
//
// 【历史教训】2026-08-26 恢复本脚本时，Jaguar 各型号 EUR 价、平台供给台数、
// EUR/CNY 汇率均为「硬编码常量 + 按日期 seed 的伪随机抖动」的假数据，
// 导致日报长期输出虚高 4~8.5 倍的价格，并据此得出「平台连续去库存、
// 供给收缩、定价权上升」等完全不成立的结论（实为随机数抖动）。
// 立忠于 2026-09-02 发现异常后核实，现改为全部走数据库真实记录。
//
// 【铁律】抓不到就置 null，并在 data.meta.warnings 中显式记录，
//       绝不允许再用任何形式的假数、估算数、随机抖动数填充。
//
// 数据源（均为真实抓取入库）：
//   1. BrandBenchmark    — 品牌×机型×源站的市场基准价，含 listingCount(真实在售台数)
//   2. InternationalPrice — 绑定具体库存机器的国际配对价
// 输出: D:/神雕农机/scripts/market_data.json
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const OUT_DIR = path.resolve(__dirname, '../../scripts');
const OUT_FILE = path.join(OUT_DIR, 'market_data.json');
const TODAY = new Date().toISOString().slice(0, 10);

// 型号 key 归一化：'Jaguar 970' -> 'jaguar970'
function normKey(s) {
  return String(s || '').replace(/[\s\-_]/g, '').toLowerCase();
}

// 取 key 末尾的数字段：'jaguar970' -> '970'，'lexion8600' -> '8600'
function tailOf(key) {
  const m = String(key).match(/(\d+)$/);
  return m ? m[1] : null;
}

// InternationalPrice 的 product.modelName 往往是纯型号（'970'、'5300RC'），
// 不含品牌前缀，无法与 'jaguar970' 直接相等，故做尾缀匹配。
// 规则：完全相等，或「尾缀 + 非数字后缀」（5300RC 匹配 jaguar5300，
// 但 5000 不会误匹配 jaguar500）。
function matchIntlRows(key, intlByKey) {
  if (intlByKey[key]) return intlByKey[key];
  const tail = tailOf(key);
  if (!tail) return null;
  for (const k of Object.keys(intlByKey)) {
    if (k === tail) return intlByKey[k];
    if (new RegExp('^' + tail + '[^0-9]').test(k)) return intlByKey[k];
  }
  return null;
}

// 从 BrandBenchmark / InternationalPrice 记录中挑出「最近一次抓取」的真实汇率
// 返回 { eurCny, usdCny, gbpCny, source, sourceDate }，找不到则为 null
function pickRealRates(benchRows, intlRows) {
  const candidates = [];
  for (const r of benchRows) {
    if (r.exchangeRate && r.currency) {
      candidates.push({ cur: r.currency, rate: r.exchangeRate, date: r.sourceDate || '', src: 'BrandBenchmark/' + r.sourceSite });
    }
  }
  for (const r of intlRows) {
    if (r.exchangeRate && r.currency) {
      candidates.push({ cur: r.currency, rate: r.exchangeRate, date: r.sourceDate || '', src: 'InternationalPrice/' + r.source });
    }
  }
  if (!candidates.length) return null;

  const latest = {};
  for (const c of candidates) {
    const cur = String(c.cur).toUpperCase();
    if (!latest[cur] || c.date > latest[cur].date) latest[cur] = c;
  }
  return {
    eurCny: latest.EUR ? latest.EUR.rate : null,
    usdCny: latest.USD ? latest.USD.rate : null,
    gbpCny: latest.GBP ? latest.GBP.rate : null,
    source: Object.values(latest).map((v) => v.src).join('; '),
    sourceDate: Object.values(latest).map((v) => v.date).filter(Boolean).sort().pop() || null,
  };
}

// 把一条真实记录整理成下游兼容的价格对象
// 下游依赖字段：euro / euroFormatted / usd / usdFormatted / euroHigh / euroHighFormatted
// 新增可溯源字段：source / sourceDate / sampleSize / listingCount / confidence / cny
function toPriceObj(row, eurCny, usdCny) {
  const isEur = String(row.currency || '').toUpperCase() === 'EUR';
  const foreign = row.priceForeign != null ? row.priceForeign : row.priceForeignRaw;

  let euro = null;
  let usd = null;
  if (isEur) {
    euro = foreign;
    usd = eurCny && usdCny ? Math.round((foreign * eurCny) / usdCny) : null;
  } else if (String(row.currency || '').toUpperCase() === 'USD') {
    usd = foreign;
    euro = usdCny && eurCny ? Math.round((foreign * usdCny) / eurCny) : null;
  }

  // cny 优先用库内已有换算值，其次用真实汇率现算
  let cny = row.priceCny != null ? row.priceCny : null;
  if (cny == null && isEur && eurCny && euro != null) cny = Math.round(euro * eurCny);
  if (cny == null && !isEur && usdCny && usd != null) cny = Math.round(usd * usdCny);

  return {
    euro,
    euroFormatted: euro != null ? `EUR${Math.round(euro / 1000)}K` : null,
    usd,
    usdFormatted: usd != null ? `$${Math.round(usd / 1000)}K` : null,
    cny,
    cnyWan: cny != null ? +(cny / 10000).toFixed(1) : null,
    // 高位值：仅在存在 medianPrice/多机型聚合时给出，否则为 null（不再用 base×1.08 伪造）
    euroHigh: null,
    euroHighFormatted: null,
    source: row.sourceSite || row.source || null,
    sourceDate: row.sourceDate || null,
    sourceUrl: row.sourceUrl || null,
    sampleSize: row.sampleSize != null ? row.sampleSize : null,
    listingCount: row.listingCount != null ? row.listingCount : null,
    confidence: row.confidenceScore != null ? row.confidenceScore : null,
    note: row.notes || null,
  };
}

async function main() {
  const prisma = new PrismaClient();
  const warnings = [];
  let benchRows = [];
  let intlRows = [];
  let dbPrices = [];
  let dbOk = false;

  try {
    benchRows = await prisma.brandBenchmark.findMany({
      where: { isActive: true },
      orderBy: { sourceDate: 'desc' },
      take: 200,
    });
    intlRows = await prisma.internationalPrice.findMany({
      where: { isActive: true },
      orderBy: { sourceDate: 'desc' },
      take: 50,
      include: { product: { select: { id: true, modelName: true, year: true, priceCny: true } } },
    });
    dbOk = true;
    console.log(`[fetch-live-market-data] BrandBenchmark 命中 ${benchRows.length} 条`);
    console.log(`[fetch-live-market-data] InternationalPrice 命中 ${intlRows.length} 条`);

    dbPrices = intlRows.map((r) => ({
      productId: r.productId,
      priceForeignCny: r.priceForeignCny,
      priceForeignRaw: r.priceForeignRaw,
      source: r.source,
      currency: r.currency,
      sourceDate: r.sourceDate,
      sourceUrl: r.sourceUrl,
      confidenceScore: r.confidenceScore,
    }));
  } catch (e) {
    // 【关键】数据库不可用时，绝不回退假数据，直接置空并记 warning
    warnings.push(`数据库查询失败，本期所有国际行情数据空缺：${e.message}`);
    console.error('[fetch-live-market-data] 数据库查询失败，不回退假数据:', e.message);
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }

  // ---- 真实汇率 ----
  const rates = pickRealRates(benchRows, intlRows);
  const eurCny = rates ? rates.eurCny : null;
  const usdCny = rates ? rates.usdCny : null;
  if (!eurCny) warnings.push('未取到 EUR→CNY 真实汇率（库中无记录），相关换算为空');
  if (!usdCny) warnings.push('未取到 USD→CNY 真实汇率（库中无记录），相关换算为空');

  // ---- 平台真实在售台数（BrandBenchmark.listingCount 按源站汇总）----
  const counts = {};
  const siteAgg = {};
  for (const r of benchRows) {
    const site = r.sourceSite || '(未知)';
    siteAgg[site] = siteAgg[site] || { count: 0, sample: 0, lastDate: '' };
    siteAgg[site].count += r.listingCount || 0;
    siteAgg[site].sample += r.sampleSize || 0;
    if ((r.sourceDate || '') > siteAgg[site].lastDate) siteAgg[site].lastDate = r.sourceDate || '';
  }
  Object.entries(siteAgg).forEach(([site, v]) => {
    counts[site] = {
      listingCount: v.count,
      sampleSize: v.sample,
      sourceDate: v.lastDate || null,
      source: 'BrandBenchmark',
    };
  });

  // ---- Jaguar / 各型号真实国际价 ----
  // 优先取 BrandBenchmark（品牌×机型基准，样本多、可溯源）；
  // 取不到再退回 InternationalPrice（绑定具体机器的配对价）。
  const benchByKey = {};
  for (const r of benchRows) {
    const k = normKey(r.model);
    if (!k) continue;
    if (!benchByKey[k] || (r.sourceDate || '') > (benchByKey[k].sourceDate || '')) benchByKey[k] = r;
  }

    // ---- 剔除反爬失败的「回落污染值」----
  // 特征：同一来源 + 完全相同的原始报价，重复出现多次（如 TractorHouse 的 $35,862
  // 在 980/850/970 上各出现一次且卡在 2026-04-30）。这类值是采集失败后的兜底，
  // 不是真实行情，必须剔除，否则会拉低均价、污染高位区间。
  // 判定关键：必须落在「不同产品」上才算污染。
  // 同一台机器在两个日期被抓到相同价格（如 970 的 €320,000 出现在 20260830 与
  // 20260802）是正常的重复记录，不能误杀；只有多个不同产品顶着完全相同的报价，
  // 才是采集失败后的兜底回落值（如 980/850/970 全是 $35,862）。
  const rawModels = {};
  for (const r of intlRows) {
    const k = (r.source || '?') + '|' + String(r.priceForeignRaw);
    rawModels[k] = rawModels[k] || new Set();
    const mn = r.product && r.product.modelName ? r.product.modelName : null;
    if (mn) rawModels[k].add(normKey(mn));
  }
  const pollutedKeys = new Set(
    Object.entries(rawModels)
      .filter(([, s]) => s.size >= 2)
      .map(([k]) => k)
  );
  const polluted = [];
  const cleanIntl = intlRows.filter((r) => {
    const k = (r.source || '?') + '|' + String(r.priceForeignRaw);
    if (pollutedKeys.has(k)) {
      polluted.push(`${r.source} ${r.priceForeignRaw} ${r.currency} (${r.sourceDate})`);
      return false;
    }
    return true;
  });
  if (polluted.length) {
    warnings.push(`已剔除 ${polluted.length} 条跨型号重复的反爬回落污染值：${[...new Set(polluted)].join('；')}`);
  }

  // InternationalPrice 中 Agroline 行 sourceUrl 为空，系 AI agent 按型号估算所得，
  // 同型号必然同值，不可逐条溯源；套利榜引用时须知悉其为估算而非真实挂牌。
  const estimated = cleanIntl.filter((r) => !r.sourceUrl);
  if (estimated.length) {
    warnings.push(
      `InternationalPrice 中有 ${estimated.length} 条无 sourceUrl（AI 按型号估算，非真实挂牌，同型号同值），` +
      `套利榜予以保留但可信度低于 BrandBenchmark 的真实样本聚合值`
    );
  }

  // dbPrices 同步使用过滤后的干净数据，避免下游套利榜把污染值当真实行情
  dbPrices = cleanIntl.map((r) => ({
    productId: r.productId,
    priceForeignCny: r.priceForeignCny,
    priceForeignRaw: r.priceForeignRaw,
    source: r.source,
    currency: r.currency,
    sourceDate: r.sourceDate,
    sourceUrl: r.sourceUrl,
    confidenceScore: r.confidenceScore,
    modelName: r.product && r.product.modelName ? r.product.modelName : null,
    year: r.product && r.product.year ? r.product.year : null,
  }));

  // InternationalPrice 关联的机型名，从 Product.modelName 取
  const intlByKey = {};
  for (const r of cleanIntl) {
    const mn = r.product && r.product.modelName ? r.product.modelName : null;
    if (!mn) continue;
    const k = normKey(mn);
    if (!k) continue;
    intlByKey[k] = intlByKey[k] || [];
    intlByKey[k].push(r);
  }

  // 日报需要呈现的型号清单（key -> 展示名）
  const WATCH_MODELS = [
    ['jaguar970', 'Jaguar 970'],
    ['jaguar980', 'Jaguar 980'],
    ['jaguar850', 'Jaguar 850'],
    ['jaguar990', 'Jaguar 990'],
    ['jaguar960', 'Jaguar 960'],
    ['jaguar9080', 'Jaguar 9080'],
    ['jaguar8400', 'Jaguar 8400'],
    ['jaguar5300', 'Jaguar 5300'],
    ['jaguar500', 'Jaguar 500'],
    ['jaguar450', 'Jaguar 450'],
    ['lexion8600', 'Lexion 8600'],
    ['xerion5000', 'Xerion 5000'],
  ];

  const prices = {};
  const missing = [];
  for (const [key, label] of WATCH_MODELS) {
    const bRow = benchByKey[key];
    if (bRow) {
      prices[key] = toPriceObj(bRow, eurCny, usdCny);
      prices[key].label = label;
      prices[key].origin = 'BrandBenchmark';
      continue;
    }
    const iRows = matchIntlRows(key, intlByKey);
    if (iRows && iRows.length) {
      // 多台取中位，并给出高低区间（真实样本，不是 base×1.08）
      const eurs = iRows
        .map((r) => (String(r.currency).toUpperCase() === 'EUR' ? r.priceForeignRaw : null))
        .filter((v) => v != null)
        .sort((a, b) => a - b);
      const base = iRows[0];
      const obj = toPriceObj(base, eurCny, usdCny);
      // 高位值仅在真实存在更高样本时给出；若 base 已是最高，置空而非把自身当高位
      const eurMax = eurs.length ? eurs[eurs.length - 1] : null;
      if (eurs.length > 1 && eurMax != null && obj.euro != null && eurMax > obj.euro) {
        obj.euroHigh = eurMax;
        obj.euroHighFormatted = `EUR${Math.round(eurMax / 1000)}K`;
      }
      if (eurs.length > 1) {
        obj.euroLow = eurs[0];
        obj.euroLowFormatted = `EUR${Math.round(eurs[0] / 1000)}K`;
      }
      obj.label = label;
      obj.origin = 'InternationalPrice';
      obj.sampleSize = iRows.length;
      prices[key] = obj;
      continue;
    }
    prices[key] = null; // 今日无数据，绝不用假值填充
    missing.push(label);
  }

  if (missing.length) {
    warnings.push(`以下型号今日无真实国际行情数据：${missing.join('、')}`);
  }

  // 关注清单之外、库中仍真实存在的型号，一并输出，避免漏掉可用行情
  const allModels = {};
  for (const k of Object.keys(benchByKey)) {
    if (prices[k]) continue;
    const r = benchByKey[k];
    const obj = toPriceObj(r, eurCny, usdCny);
    obj.label = r.model;
    obj.origin = 'BrandBenchmark';
    allModels[k] = obj;
  }

  const dataCounts = {
    agrolineClaas: counts.agroline ? counts.agroline.listingCount : null,
    machineryPeteClaas: counts.machinerypete ? counts.machinerypete.listingCount : null,
    bySite: counts,
    generatedAt: new Date().toISOString(),
    date: TODAY,
    note: 'listingCount 为 BrandBenchmark 库内各源站真实在售台数合计，非估算',
  };

  const data = {
    counts: dataCounts,
    prices,
    allModels,
    exchangeRate: {
      eurCny,
      eurCnyFormatted: eurCny != null ? String(eurCny) : null,
      usdCny,
      usdCnyFormatted: usdCny != null ? String(usdCny) : null,
      gbpCny: rates ? rates.gbpCny : null,
      source: rates ? rates.source : null,
      sourceDate: rates ? rates.sourceDate : null,
      // 不再提供 eurCnyChange / eurRub：库内无真实历史序列，不做假环比
      eurCnyChange: null,
      eurRub: null,
      note: '汇率取自 BrandBenchmark / InternationalPrice 库内最近一次真实抓取记录',
      generatedAt: new Date().toISOString(),
    },
    dbPrices,
    meta: {
      date: TODAY,
      generatedAt: new Date().toISOString(),
      dbConnected: dbOk,
      benchRowCount: benchRows.length,
      intlRowCount: intlRows.length,
      // 数据可信度声明：下游日报须据此标注
      dataIntegrity: {
        pricesFromDb: true,
        countsFromDb: true,
        ratesFromDb: true,
        simulated: false,
      },
      warnings,
    },
  };

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2));
  console.log(`[fetch-live-market-data] 写入 ${OUT_FILE}`);
  console.log(`  Agroline真实在售=${dataCounts.agrolineClaas} | MachineryPete真实在售=${dataCounts.machineryPeteClaas}`);
  console.log(`  EUR/CNY=${eurCny} | USD/CNY=${usdCny} | DB行数=${dbPrices.length}`);
  if (missing.length) console.log(`  ⚠️ 无数据型号(${missing.length}): ${missing.join('、')}`);
  if (warnings.length) {
    console.log('  ⚠️ Warnings:');
    warnings.forEach((w) => console.log('     - ' + w));
  }
}

main().catch((e) => {
  console.error('[fetch-live-market-data] 致命错误:', e);
  process.exit(1);
});
