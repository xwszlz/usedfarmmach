/**
 * import-articles-to-cn.js — .cn 内容同步「导入端·文章」
 *
 * 在 .cn 容器内执行（docker exec cn-app node scripts/import-articles-to-cn.js）。
 * 读取镜像内 public/daily-reports/articles-cn_*.json（由 export-cn-content.js 生成并随镜像打包），
 * 幂等写入 cn-postgres（境内，数据不出境红线）。
 *
 * 幂等：按 slug 删除后重建；扫描所有 articles-cn_*.json 文件，保证历史 + 当日内容一致。
 * 容错：单条失败不影响整体；外部由 deploy-cn.sh 用 `|| echo WARN` 包裹，不阻塞部署。
 */

require('./lib/neon-connect').bootstrap(); // fake-ip 绕过
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// 连接串：优先 DATABASE_URL（PrismaClient 默认读取），回退 DATABASE_URL_CN
const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_CN;
const prisma = new PrismaClient(dbUrl ? { datasources: { db: { url: dbUrl } } } : {});

const REPORTS_DIR = path.join(process.cwd(), 'public', 'daily-reports');

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

// 标量必填字段：Prisma schema 中无 `?` 且无 @default，传 null 会直接报
// 「Argument `xxx` must not be null」。合成产物里若写成 null，必须在入库前清洗。
// 注意：String? 字段收 null 是合法的，不能一刀切把 null 全删。
const REQUIRED_SCALARS = ['slug', 'titleZh', 'contentZh', 'isPinned'];

function toData(it) {
  const data = {};
  for (const f of ARTICLE_FIELDS) {
    if (it[f] === undefined) continue;
    // 必填标量字段遇 null 直接跳过，交给下面的默认值补齐
    if (it[f] === null && REQUIRED_SCALARS.includes(f)) continue;
    if (f === 'publishedAt' && it[f]) {
      data[f] = new Date(it[f]);
    } else {
      data[f] = it[f];
    }
  }
  if (!data.status) data.status = 'published';
  if (!data.publishedAt) data.publishedAt = new Date();
  // isPinned 是必填 Boolean，缺省按「非置顶」处理
  if (data.isPinned === undefined) data.isPinned = false;
  return data;
}

async function main() {
  if (!fs.existsSync(REPORTS_DIR)) {
    console.warn(`WARN: reports dir not found: ${REPORTS_DIR}`);
    return;
  }

  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => /^articles-cn_.*\.json$/.test(f))
    .map(f => path.join(REPORTS_DIR, f));

  if (files.length === 0) {
    console.log('No articles-cn_*.json found, nothing to import');
    return;
  }

  // 汇总并去重（同 slug 保留 publishedAt 最新的一条）
  const bySlug = new Map();
  for (const file of files) {
    let items;
    try { items = JSON.parse(fs.readFileSync(file, 'utf-8')); }
    catch (e) { console.warn(`WARN: skip bad json ${file}: ${e.message}`); continue; }
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      if (!it.slug) continue;
      const prev = bySlug.get(it.slug);
      if (!prev) { bySlug.set(it.slug, it); continue; }
      const pt = it.publishedAt ? new Date(it.publishedAt).getTime() : 0;
      const pp = prev.publishedAt ? new Date(prev.publishedAt).getTime() : 0;
      if (pt >= pp) bySlug.set(it.slug, it);
    }
  }

  const slugs = [...bySlug.keys()];
  if (slugs.length === 0) { console.log('No valid articles to import'); return; }

  // 幂等：按 slug 删除当日/历史重复项后再写入
  await prisma.article.deleteMany({ where: { slug: { in: slugs } } });

  let ok = 0, err = 0;
  for (const it of bySlug.values()) {
    try {
      await prisma.article.create({ data: toData(it) });
      ok++;
    } catch (e) {
      console.error(`ERROR import ${it.slug}: ${e.message}`);
      err++;
    }
  }
  console.log(`Imported articles into .cn DB: ${ok} created, ${err} errors (from ${slugs.length} unique slugs across ${files.length} files)`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
