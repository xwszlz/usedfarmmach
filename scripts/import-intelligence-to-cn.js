/**
 * import-intelligence-to-cn.js — .cn 内容同步「导入端·市场情报」
 *
 * 在 .cn 容器内执行（docker exec cn-app node scripts/import-intelligence-to-cn.js）。
 * 读取镜像内 public/daily-reports/intelligence_*.json（由 export-cn-content.js 生成），
 * 按文件名中的日期区间删除后重建，幂等写入 cn-postgres（境内）。
 *
 * 幂等：每个文件对应一天，删除该日全部 marketIntel 再写入，重复部署不重复累积。
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_CN;
const prisma = new PrismaClient(dbUrl ? { datasources: { db: { url: dbUrl } } } : {});

const REPORTS_DIR = path.join(process.cwd(), 'public', 'daily-reports');

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

function toData(it) {
  const data = {};
  for (const f of INTEL_FIELDS) {
    if (it[f] === undefined) continue;
    if (f === 'date' && it[f]) data[f] = new Date(it[f]);
    else data[f] = it[f];
  }
  if (data.isActive === undefined) data.isActive = true;
  if (data.sortOrder === undefined) data.sortOrder = 0;
  return data;
}

function dateFromFilename(name) {
  const m = name.match(/intelligence_(\d{4}-\d{2}-\d{2})\.json$/);
  return m ? m[1] : null;
}

async function main() {
  if (!fs.existsSync(REPORTS_DIR)) {
    console.warn(`WARN: reports dir not found: ${REPORTS_DIR}`);
    return;
  }

  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => /^intelligence_\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map(f => path.join(REPORTS_DIR, f));

  if (files.length === 0) {
    console.log('No intelligence_*.json found, nothing to import');
    return;
  }

  let total = 0, err = 0;
  for (const file of files) {
    const dateStr = dateFromFilename(path.basename(file));
    let items;
    try { items = JSON.parse(fs.readFileSync(file, 'utf-8')); }
    catch (e) { console.warn(`WARN: skip bad json ${file}: ${e.message}`); continue; }
    if (!Array.isArray(items) || items.length === 0) continue;

    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    // 幂等：删除该日全部情报再写入
    await prisma.marketIntel.deleteMany({ where: { date: { gte: dayStart, lte: dayEnd } } });

    for (const it of items) {
      try {
        await prisma.marketIntel.create({ data: toData(it) });
        total++;
      } catch (e) {
        console.error(`ERROR import intel ${dateStr} #${it.sortOrder}: ${e.message}`);
        err++;
      }
    }
    console.log(`Imported ${items.length} intelligence for ${dateStr}`);
  }
  console.log(`Imported intelligence into .cn DB: ${total} created, ${err} errors`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
