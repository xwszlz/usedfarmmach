/**
 * import-intelligence-to-cn.js — .cn 内容同步「导入端·市场情报」
 *
 * 在 .cn 容器内执行（docker exec cn-app node scripts/import-intelligence-to-cn.js）。
 * 读取镜像内 public/daily-reports/intelligence_*.json（由 export-cn-content.js 生成），
 * 按文件名中的日期区间删除后重建，幂等写入 cn-postgres（境内）。
 *
 * 幂等：每个文件对应一天，删除该日全部 marketIntel 再写入，重复部署不重复累积。
 */

// 本机开发者可选：scripts/lib/ 被 .gitignore 排除，远端/容器内并不存在。
// 该补丁只对 .com 侧的 fake-ip 环境有意义，.cn 容器直连境内库无需它，
// 因此必须是「可选依赖」——硬 require 会让容器内脚本直接 MODULE_NOT_FOUND 崩溃。
try { require('./lib/neon-connect').bootstrap(); } catch (_) { /* 无补丁环境：正常继续 */ }
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

// 标量必填字段：Prisma schema 中无 `?` 且无 @default，传 null 会直接报
// 「Argument `xxx` must not be null」。合成产物里若写成 null，必须在入库前清洗。
// 注意：其余 String? 字段收 null 是合法的，不能一刀切把 null 全删。
const REQUIRED_SCALARS = ['date', 'icon', 'region', 'tags', 'text'];

function toData(it) {
  const data = {};
  for (const f of INTEL_FIELDS) {
    if (it[f] === undefined) continue;
    if (it[f] === null && REQUIRED_SCALARS.includes(f)) continue;
    if (f === 'date' && it[f]) data[f] = new Date(it[f]);
    else data[f] = it[f];
  }
  if (data.isActive === undefined || data.isActive === null) data.isActive = true;
  if (data.sortOrder === undefined || data.sortOrder === null) data.sortOrder = 0;
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

    // ── 幂等删除（2026-10-05 修复）──
    // 历史 bug：原先按「文件名日期 00:00Z~23:59Z」删除，但文件内 date 字段实际是
    // 北京时间 00:00 的 UTC 表示（2026-10-05 → 2026-10-04T16:00:00Z），两者错位 8 小时
    // ⇒ deleteMany 命中 0 行 ⇒ 每次部署都重复追加。实测 main 当日 9 次部署后，
    // 同一批 10 条情报被插 9 次（.com/Neon 与 .cn 双站均中招）。
    // 现改为「本批 text 业务键 + 目标日 ±14 小时宽窗」删除：
    //   - ±14h 覆盖一切可能的时区偏移植（地球上最大 UTC 偏移为 ±14h），
    //     既能命中「本日但被时区错位写入」的历史行、并顺带清掉存量重复行，
    //     又绝不会误伤相邻日期（相邻日与之相距 24h，落在窗口之外）；
    //   - text 限定进一步保证不会误删其它日期的不同情报。
    const targetStart = new Date(`${dateStr}T00:00:00.000Z`);
    const winStart = new Date(targetStart.getTime() - 14 * 3600 * 1000);
    const winEnd = new Date(targetStart.getTime() + 14 * 3600 * 1000);
    const texts = items.map((i) => i.text).filter(Boolean);
    const del = await prisma.marketIntel.deleteMany({
      where: texts.length
        ? { text: { in: texts }, date: { gte: winStart, lte: winEnd } }
        : { date: { gte: winStart, lte: winEnd } },
    });
    if (del.count) console.log(`  [dedupe] ${dateStr} 清除旧行 ${del.count} 条`);

    for (const it of items) {
      try {
        // date 归一化到「文件名日期 00:00Z」，保证页面「最新更新」与实际期数一致
        await prisma.marketIntel.create({ data: { ...toData(it), date: targetStart } });
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
