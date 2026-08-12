/**
 * export-cn-content.js — .cn 内容同步「导出端」
 *
 * 作用：在 .com / 本地（连接 Neon）侧执行，把 SEO 文章与市场情报导出为
 *       static JSON 文件到 public/daily-reports/，随 PR 提交后打包进 .cn 镜像。
 *
 * 用法：
 *   node scripts/export-cn-content.js [YYYY-MM-DD]          # 默认：今日
 *   node scripts/export-cn-content.js --backfill           # 一次性回填：导出 Neon 全量已发布文章
 *
 * 输出：
 *   public/daily-reports/articles-cn_YYYY-MM-DD.json        # 当日文章 + 置顶文章
 *   public/daily-reports/articles-cn_backfill.json          # --backfill 模式
 *   public/daily-reports/intelligence_YYYY-MM-DD.json      # 当日市场情报
 *
 * 设计要点：
 *   - 文章从 Neon 取「完整行」（含 coverImage 与多语字段），保证 .cn 与 .com 一致；
 *   - 文章同时包含 isPinned=true 的置顶文章，让 .cn 博客也有头部内容；
 *   - 仅白名单字段，不导出 id/createdAt/updatedAt 等由 DB 自动生成的列；
 *   - 不连接 .cn DB，符合「数据不出境」红线（仅在 .com 侧读 Neon）。
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const REPORTS_DIR = path.join(process.cwd(), 'public', 'daily-reports');

// Article 白名单（与 schema.prisma model Article 标量字段对齐，排除 id/createdAt/updatedAt）
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

// MarketIntel 白名单（排除 id/createdAt/updatedAt）
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
  for (const f of fields) {
    if (row[f] !== undefined) out[f] = row[f];
  }
  return out;
}

function getDateArg() {
  const args = process.argv.slice(2);
  const dateArg = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  return dateArg || new Date().toISOString().split('T')[0];
}

async function exportArticles(dateStr, backfill) {
  let articles = [];

  if (backfill) {
    // 一次性回填：导出 Neon 全部已发布文章
    const rows = await prisma.article.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
    });
    articles = rows.map(r => pick(r, ARTICLE_FIELDS));
    const out = path.join(REPORTS_DIR, 'articles-cn_backfill.json');
    fs.writeFileSync(out, JSON.stringify(articles, null, 2));
    console.log(`[backfill] Exported ${articles.length} published articles -> ${out}`);
    return;
  }

  // 1) 当日每日文章：从 daily-reports/articles_YYYY-MM-DD.json 取 slug 列表
  const dailyFile = path.join(REPORTS_DIR, `articles_${dateStr}.json`);
  const slugs = [];
  if (fs.existsSync(dailyFile)) {
    const daily = JSON.parse(fs.readFileSync(dailyFile, 'utf-8'));
    for (const a of daily) if (a.slug) slugs.push(a.slug);
  } else {
    console.warn(`WARN: daily article file not found: ${dailyFile}`);
  }

  // 2) 置顶文章（isPinned=true），保证 .cn 博客也有头部内容
  const pinned = await prisma.article.findMany({ where: { isPinned: true } });
  for (const p of pinned) if (p.slug && !slugs.includes(p.slug)) slugs.push(p.slug);

  // 3) 从 Neon 取完整行（含 coverImage + 多语字段）
  if (slugs.length > 0) {
    const rows = await prisma.article.findMany({ where: { slug: { in: slugs } } });
    articles = rows.map(r => pick(r, ARTICLE_FIELDS));
  }

  const out = path.join(REPORTS_DIR, `articles-cn_${dateStr}.json`);
  fs.writeFileSync(out, JSON.stringify(articles, null, 2));
  console.log(`Exported ${articles.length} articles (daily ${slugs.length} slugs + pinned) -> ${out}`);
}

async function exportIntelligence(dateStr) {
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
  const rows = await prisma.marketIntel.findMany({
    where: { date: { gte: dayStart, lte: dayEnd } },
    orderBy: { sortOrder: 'asc' },
  });
  const items = rows.map(r => pick(r, INTEL_FIELDS));
  const out = path.join(REPORTS_DIR, `intelligence_${dateStr}.json`);
  fs.writeFileSync(out, JSON.stringify(items, null, 2));
  console.log(`Exported ${items.length} intelligence items -> ${out}`);
}

async function main() {
  const args = process.argv.slice(2);
  const backfill = args.includes('--backfill');
  const dateStr = getDateArg();

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  await exportArticles(dateStr, backfill);
  if (!backfill) {
    await exportIntelligence(dateStr);
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
