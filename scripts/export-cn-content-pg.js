/**
 * export-cn-content-pg.js —— .cn 内容同步「导出端」（pg 版）
 *
 * 【为什么有 pg 版】
 * 原版 export-cn-content.js 用 Prisma。Prisma 的 query engine 是 Rust 二进制，
 * 自带 DNS 解析器，绕过本机的 dns.lookup 劫持补丁，在 Clash fake-ip 环境下
 * **永远连不上 Neon**。故用 pg 驱动等价重写。
 *
 * 【逻辑与原版严格对齐】
 *   1) 读 public/daily-reports/articles_YYYY-MM-DD.json 取 slug 列表（当日文章）
 *   2) 追加 isPinned=true 的文章（不过滤 status，原版即如此）
 *   3) 按 slug 从 Neon 取完整行，只保留白名单字段
 *   4) 输出 public/daily-reports/articles-cn_YYYY-MM-DD.json
 *   5) 输出 intelligence_YYYY-MM-DD.json（MarketIntel 当日）
 *
 * 【用法】
 *   node scripts/export-cn-content-pg.js 2026-09-14
 *   node scripts/export-cn-content-pg.js 2026-09-14 --dry
 */
'use strict';

const { bootstrapAsync } = require('./lib/neon-connect');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(process.cwd(), 'public', 'daily-reports');

// 与原版逐字一致的字段白名单
const ARTICLE_FIELDS = [
  'slug', 'titleZh', 'titleEn', 'titleRu',
  'contentZh', 'contentEn', 'contentRu',
  'excerptZh', 'excerptEn', 'excerptRu',
  'coverImage', 'status', 'category',
  'tags', 'tagsEn', 'tagsRu',
  'sourcePlatform', 'sourceUrl',
  'metaTitle', 'metaDesc', 'keywords',
  'publishedAt', 'isPinned',
];

const INTEL_FIELDS = [
  'date', 'icon', 'region', 'tags', 'text', 'url',
  'detailedContent', 'dataSummary', 'actionTips', 'sortOrder', 'isActive',
  'detailedContentEn', 'detailedContentRu',
  'regionEn', 'regionRu', 'tagsEn', 'tagsRu', 'textEn', 'textRu',
  'detailedContentEs', 'detailedContentPt',
  'regionEs', 'regionPt', 'tagsEs', 'tagsPt', 'textEs', 'textPt',
  'detailedContentAr', 'detailedContentFr', 'detailedContentHi',
  'regionAr', 'regionFr',
];

function pick(row, fields) {
  const out = {};
  for (const f of fields) if (row[f] !== undefined) out[f] = row[f];
  return out;
}

function q(col) { return '"' + col + '"'; }

(async () => {
  const args = process.argv.slice(2);
  const dateStr = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const dry = args.includes('--dry');
  if (!dateStr) { console.error('用法: node scripts/export-cn-content-pg.js YYYY-MM-DD'); process.exit(1); }

  await bootstrapAsync();

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('CONNECTED\n');

  // ── 1) 当日文章 slug ──
  const dailyFile = path.join(REPORTS_DIR, 'articles_' + dateStr + '.json');
  const slugs = [];
  if (fs.existsSync(dailyFile)) {
    const daily = JSON.parse(fs.readFileSync(dailyFile, 'utf-8'));
    for (const a of daily) if (a.slug) slugs.push(a.slug);
    console.log('[1] 当日文件 ' + path.basename(dailyFile) + ' → ' + slugs.length + ' 个 slug');
  } else {
    console.warn('[1] WARN 当日文件不存在: ' + dailyFile);
  }

  // ── 2) 追加 pinned ──
  const pinned = await c.query('SELECT slug FROM "Article" WHERE "isPinned"=true');
  let added = 0;
  for (const p of pinned.rows) {
    if (p.slug && !slugs.includes(p.slug)) { slugs.push(p.slug); added++; }
  }
  console.log('[2] pinned 追加 ' + added + ' 个，合计 ' + slugs.length + ' 个 slug');

  // ── 3) 取完整行 ──
  let articles = [];
  if (slugs.length) {
    const rows = await c.query('SELECT * FROM "Article" WHERE slug = ANY($1)', [slugs]);
    articles = rows.rows.map((r) => pick(r, ARTICLE_FIELDS));
    console.log('[3] Neon 实取 ' + articles.length + ' 篇');
  }

  console.log('\n文章清单:');
  articles.forEach((a) => console.log('   ' + String(a.status || '').padEnd(11) + 'pin=' + String(a.isPinned).padEnd(6) + a.slug));

  // ── 4) 写 articles-cn ──
  const artOut = path.join(REPORTS_DIR, 'articles-cn_' + dateStr + '.json');
  if (!dry) {
    fs.writeFileSync(artOut, JSON.stringify(articles, null, 2));
    console.log('\n✅ ' + path.basename(artOut) + '  ' + fs.statSync(artOut).size + ' B');
  } else {
    console.log('\n[DRY] 将写 ' + path.basename(artOut) + '（' + articles.length + ' 篇）');
  }

  // ── 5) 写 intelligence ──
  // 2026-09-29 修复：原先传 JS Date 对象当参数，pg 会按会话时区做一次转换，
  // 而 MarketIntel.date 是 `timestamp without time zone` ⇒ `date >= $1` 恒不成立，
  // 实测每一期都返回 0 条（导出空文件）。改为传 ISO/裸日期字符串（文本 → timestamp 直转）。
  const intel = await c.query(
    'SELECT * FROM "MarketIntel" WHERE date >= $1::timestamp AND date <= $2::timestamp ORDER BY "sortOrder" ASC',
    [dateStr + 'T00:00:00.000', dateStr + 'T23:59:59.999']);
  const items = intel.rows.map((r) => pick(r, INTEL_FIELDS));
  console.log('\n[5] MarketIntel(UTC 口径 ' + dateStr + ') = ' + items.length + ' 条');

  const intelOut = path.join(REPORTS_DIR, 'intelligence_' + dateStr + '.json');
  if (!dry) {
    fs.writeFileSync(intelOut, JSON.stringify(items, null, 2));
    console.log('✅ ' + path.basename(intelOut) + '  ' + fs.statSync(intelOut).size + ' B');
  } else {
    console.log('[DRY] 将写 ' + path.basename(intelOut) + '（' + items.length + ' 条）');
  }

  await c.end();
})().catch((e) => { console.error('FATAL ' + (e.code || '') + ' ' + (e.message || e)); process.exit(1); });
