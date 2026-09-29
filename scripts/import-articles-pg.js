// 用 pg 驱动把 articles_*.json 导入 Article 表（绕过 Prisma Rust 引擎的 DNS 问题）
// 2026-09-29：改用 bootstrapAsync()（DoH 取真 IP + 逐个 TCP 探活），
// 原同步 bootstrap() 只装快照劫持、不探活，实测出现 `Connection terminated unexpectedly`。
const { bootstrapAsync } = require('./lib/neon-connect');
const { Client } = require('pg');
const fs = require('fs');
const crypto = require('crypto');

const JSON_PATH = process.argv[2] || 'D:/神雕农机/神雕日报/articles_2026-09-14.json';
const DRY = process.argv.includes('--dry');

// Prisma 风格 cuid
function cuid() {
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(12).toString('base64url').replace(/[-_]/g, '').slice(0, 16).toLowerCase();
  return 'c' + ts + rnd;
}

const COLS = [
  'id', 'slug', 'titleZh', 'titleEn', 'titleRu',
  'contentZh', 'contentEn', 'contentRu',
  'excerptZh', 'excerptEn', 'excerptRu',
  'coverImage', 'status', 'category', 'tags', 'tagsEn', 'tagsRu',
  'sourcePlatform', 'sourceUrl', 'metaTitle', 'metaDesc', 'keywords',
  'publishedAt', 'createdAt', 'updatedAt',
];

(async () => {
  await bootstrapAsync();
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const arts = JSON.parse(raw);
  console.log('JSON = ' + JSON_PATH);
  console.log('ARTICLES = ' + arts.length);

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('CONNECTED');

  let ins = 0, upd = 0;
  for (const a of arts) {
    const now = new Date();
    const row = {
      slug: a.slug,
      titleZh: a.titleZh || '', titleEn: a.titleEn || null, titleRu: a.titleRu || null,
      contentZh: a.contentZh || '', contentEn: a.contentEn || null, contentRu: a.contentRu || null,
      excerptZh: a.excerptZh || null, excerptEn: a.excerptEn || null, excerptRu: a.excerptRu || null,
      coverImage: a.coverImage || null,
      status: a.status || 'published',
      category: a.category || null,
      tags: a.tags || null, tagsEn: a.tagsEn || null, tagsRu: a.tagsRu || null,
      sourcePlatform: a.sourcePlatform || null, sourceUrl: a.sourceUrl || null,
      metaTitle: a.metaTitle || null, metaDesc: a.metaDesc || null, keywords: a.keywords || null,
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : now,
      createdAt: now, updatedAt: now,
    };

    if (DRY) {
      const ex = await c.query('SELECT id, status FROM "Article" WHERE slug=$1', [row.slug]);
      console.log('  [DRY] ' + row.slug + ' | ' + (ex.rowCount ? 'EXISTS id=' + ex.rows[0].id + ' status=' + ex.rows[0].status : 'NEW'));
      continue;
    }

    const ex = await c.query('SELECT id FROM "Article" WHERE slug=$1', [row.slug]);
    if (ex.rowCount) {
      // 更新（不动 createdAt / viewCount / id）
      row.id = ex.rows[0].id;
      const sets = COLS.filter(k => k !== 'id' && k !== 'createdAt').map((k, i) => k + '=$' + (i + 1)).join(',');
      const vals = COLS.filter(k => k !== 'id' && k !== 'createdAt').map(k => row[k]);
      vals.push(row.id);
      await c.query('UPDATE "Article" SET ' + sets + ' WHERE id=$' + vals.length, vals);
      upd++;
      console.log('  UPD ' + row.slug);
    } else {
      row.id = cuid();
      const ph = COLS.map((_, i) => '$' + (i + 1)).join(',');
      await c.query('INSERT INTO "Article" (' + COLS.map(x => '"' + x + '"').join(',') + ') VALUES (' + ph + ')',
        COLS.map(k => row[k]));
      ins++;
      console.log('  INS ' + row.slug + ' id=' + row.id);
    }
  }

  console.log('DONE ins=' + ins + ' upd=' + upd);
  const after = await c.query('SELECT count(*)::int AS n FROM "Article"');
  console.log('Article total = ' + after.rows[0].n);
  for (const a of arts) {
    const r = await c.query('SELECT slug, status, "publishedAt" FROM "Article" WHERE slug=$1', [a.slug]);
    r.rows.forEach(x => console.log('  verify ' + x.slug + ' | ' + x.status + ' | ' + (x.publishedAt ? new Date(x.publishedAt).toISOString() : 'null')));
  }
  await c.end();
})().catch(e => { console.log('FATAL ' + e.code + ' ' + e.message); process.exit(1); });
