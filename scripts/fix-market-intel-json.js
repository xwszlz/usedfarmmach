// 神雕农机 MarketIntel 脏数据回填修复脚本（幂等）
//
// 功能：扫描所有 MarketIntel 行，把 JSON 字段中「不是合法 JSON」的值修复为合法 JSON
//       （纯文本 → JSON.stringify；对象/数组 → JSON.stringify）。使数据符合 schema，
//        API 永不因脏数据 500。重跑找到 0 条脏数据即幂等。
//
// 运行：DATABASE_URL="postgresql://<neon-url>" node scripts/fix-market-intel-json.js --dry-run
// 修复：DATABASE_URL="postgresql://<neon-url>" node scripts/fix-market-intel-json.js --apply
//
// 说明：
//   - 默认 --dry-run：只统计并打印脏行样本，不修改任何数据。
//   - --apply：对确有脏字段的行执行 prisma.marketIntel.update。
//   - 连接串从环境变量 DATABASE_URL 读取，禁止硬编码密码。

const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  console.error('❌ 缺少环境变量 DATABASE_URL，请先设置后重试。');
  console.error('   示例：DATABASE_URL="postgresql://<neon-url>" node scripts/fix-market-intel-json.js --dry-run');
  process.exit(1);
}

const prisma = new PrismaClient();

// 需要保证为合法 JSON 字符串的字段
const JSON_FIELDS = ['dataSummary', 'actionTips', 'tags', 'tagsEn', 'tagsRu'];

// 把任意值归一化为合法 JSON 字符串
function normalize(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    try { JSON.parse(t); return t; } catch { return JSON.stringify(t); }
  }
  return JSON.stringify(v);
}

// 判断字段当前值是否为非法的 JSON（需要修复）
function isDirtyJsonField(v) {
  if (v === null || v === undefined) return false;
  if (typeof v !== 'string') return true; // 非字符串（对象/数组）→ 视为脏
  const t = v.trim();
  if (t === '') return false;
  try { JSON.parse(t); return false; } catch { return true; }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const mode = apply ? 'APPLY' : 'DRY-RUN';

  console.log(`[fix-market-intel-json] 模式：${mode}`);
  console.log(`[fix-market-intel-json] 扫描字段：${JSON_FIELDS.join(', ')}`);

  let totalRows = 0;
  let dirtyRows = 0;
  let fixedRows = 0;

  const rows = await prisma.marketIntel.findMany({
    select: { id: true, dataSummary: true, actionTips: true, tags: true, tagsEn: true, tagsRu: true }
  });

  totalRows = rows.length;

  for (const row of rows) {
    const dirtyFields = {};
    for (const field of JSON_FIELDS) {
      const v = row[field];
      if (isDirtyJsonField(v)) {
        dirtyFields[field] = normalize(v);
      }
    }

    if (Object.keys(dirtyFields).length === 0) continue;

    dirtyRows++;
    console.log(`\n[脏行] id=${row.id}`);
    for (const field of Object.keys(dirtyFields)) {
      const original = row[field];
      const preview = typeof original === 'string' ? original : JSON.stringify(original);
      console.log(`  - ${field}: ${preview.slice(0, 80)}${preview.length > 80 ? '…' : ''} → ${dirtyFields[field].slice(0, 80)}`);
    }

    if (apply) {
      await prisma.marketIntel.update({
        where: { id: row.id },
        data: dirtyFields
      });
      fixedRows++;
    }
  }

  console.log(`\n==== 汇总 ====`);
  console.log(`总行数：${totalRows}`);
  console.log(`脏行数：${dirtyRows}`);
  console.log(apply ? `已修复行数：${fixedRows}` : `待修复行数：${dirtyRows}（dry-run 未修改）`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('❌ 修复失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
