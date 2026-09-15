/**
 * sync-prices-from-neon.js — .cn 国际价 / 基准价定时同步（线程2 路线 B）
 *
 * 在 cn-scout 容器内由 cron 每日调用：
 *   30 9 * * * node /app/scripts/sync-prices-from-neon.js >> /var/log/price-sync.log 2>&1
 *
 * 作用：将 .com (Neon) 的公开国际价 / 全品牌基准价，幂等同步进 cn-postgres。
 *
 * 背景（根因）：.cn 的 InternationalPrice 长期停更（实测 max(createdAt) = 2026-08-09）。
 *   因 .com 的 vercel cron 只写 Neon、deploy-cn.sh 不跑价格种子、export-cn-content.js 不含价格表
 *   —— 即"构建期冻结快照 + 无刷新链路"这类 stale-data 第二类根因。本脚本补齐这条刷新链路。
 *
 * 数据合规：InternationalPrice / BrandBenchmark 均为境外公开行情，合规可双库，
 *   不触碰"数据不出境"红线（写入目标仍是境内 cn-postgres）。
 *
 * 幂等策略：按主键 id upsert（沿用 Neon 的 cuid id），重复运行安全。
 *   - InternationalPrice 有外键 productId → Product，cn 库 Product 比 Neon 少，
 *     故跳过 productId 在 cn 不存在的行（避免 FK 拒绝），并记入 skipped。
 *   - 不做 deleteMany：保留 cn 侧可能存在的手动价格行，仅增量同步 Neon 的权威公开价。
 *
 * 环境变量（ECS 主机 /opt/cn/.env.cn 提供，scout 容器经 env_file 注入）：
 *   NEON_DATABASE_URL : Neon(.com) 只读连接串（必填，读源）
 *   DATABASE_URL_CN   : cn-postgres 连接串（写目标；缺省回退 DATABASE_URL）
 */

// 可选补丁：仅 .com fake-ip 环境有意义，容器内不存在则正常跳过
try { require('./lib/neon-connect').bootstrap(); } catch (_) { /* 无补丁环境：正常继续 */ }

const { PrismaClient } = require('@prisma/client');

const IP_FIELDS = [
  'id', 'productId', 'priceForeignCny', 'priceForeignRaw', 'currency',
  'exchangeRate', 'source', 'sourceUrl', 'sourceDate', 'country', 'notes',
  'confidenceScore', 'isActive', 'lastVerified', 'createdAt',
];
const BB_FIELDS = [
  'id', 'brand', 'brandNameZh', 'model', 'category', 'sourceSite',
  'priceForeign', 'currency', 'priceCny', 'exchangeRate', 'sourceUrl',
  'sourceDate', 'confidenceScore', 'sampleSize', 'medianPrice',
  'listingCount', 'priceType', 'region', 'lastVerified', 'isActive', 'createdAt',
];

// create 保留 id + createdAt（沿用 Neon 原始时间）；update 剔除 id / createdAt / updatedAt（由 Prisma 托管）
function toCreate(r) { const { updatedAt, ...d } = r; return d; }
function toUpdate(r) { const { id, createdAt, updatedAt, ...d } = r; return d; }

const NEON_URL = process.env.NEON_DATABASE_URL;
if (!NEON_URL) {
  console.error('FATAL: NEON_DATABASE_URL 未设置（应在 /opt/cn/.env.cn 配置 Neon 只读串）');
  process.exit(1);
}
const CN_URL = process.env.DATABASE_URL_CN || process.env.DATABASE_URL;
if (!CN_URL) {
  console.error('FATAL: 写目标库未配置（需要 DATABASE_URL_CN 或 DATABASE_URL）');
  process.exit(1);
}

const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } });   // 读源
const cn = new PrismaClient({ datasources: { db: { url: CN_URL } } });       // 写目标

async function syncInternationalPrice() {
  const rows = await neon.internationalPrice.findMany({
    select: Object.fromEntries(IP_FIELDS.map(f => [f, true])),
  });
  console.log(`[InternationalPrice] Neon 源行数: ${rows.length}`);

  const products = await cn.product.findMany({ select: { id: true } });
  const cnProductIds = new Set(products.map(p => p.id));
  console.log(`[InternationalPrice] cn Product 数: ${cnProductIds.size}`);

  let created = 0, updated = 0, skipped = 0, errors = 0;
  for (const r of rows) {
    if (!cnProductIds.has(r.productId)) {
      console.warn(`  SKIP(FK) productId=${r.productId} 不在 cn 库，跳过`);
      skipped++;
      continue;
    }
    try {
      const exists = await cn.internationalPrice.findUnique({ where: { id: r.id }, select: { id: true } });
      if (exists) {
        await cn.internationalPrice.update({ where: { id: r.id }, data: toUpdate(r) });
        updated++;
      } else {
        await cn.internationalPrice.create({ data: toCreate(r) });
        created++;
      }
    } catch (e) {
      console.error(`  ERROR id=${r.id}: ${e.message}`);
      errors++;
    }
  }
  console.log(`[InternationalPrice] 完成: created=${created} updated=${updated} skipped=${skipped} errors=${errors}`);
  return { created, updated, skipped, errors };
}

async function syncBrandBenchmark() {
  const rows = await neon.brandBenchmark.findMany({
    select: Object.fromEntries(BB_FIELDS.map(f => [f, true])),
  });
  console.log(`[BrandBenchmark] Neon 源行数: ${rows.length}`);

  let created = 0, updated = 0, errors = 0;
  for (const r of rows) {
    try {
      const exists = await cn.brandBenchmark.findUnique({ where: { id: r.id }, select: { id: true } });
      if (exists) {
        await cn.brandBenchmark.update({ where: { id: r.id }, data: toUpdate(r) });
        updated++;
      } else {
        await cn.brandBenchmark.create({ data: toCreate(r) });
        created++;
      }
    } catch (e) {
      console.error(`  ERROR id=${r.id}: ${e.message}`);
      errors++;
    }
  }
  console.log(`[BrandBenchmark] 完成: created=${created} updated=${updated} errors=${errors}`);
  return { created, updated, errors };
}

async function main() {
  const t0 = Date.now();
  const ip = await syncInternationalPrice();
  const bb = await syncBrandBenchmark();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== price-sync 完成 (${secs}s) ===`);
  console.log(`InternationalPrice: +${ip.created} ~${ip.updated} skip=${ip.skipped} err=${ip.errors}`);
  console.log(`BrandBenchmark:    +${bb.created} ~${bb.updated} err=${bb.errors}`);
  const fatal = ip.errors > 0 || bb.errors > 0;
  if (fatal) process.exitCode = 1;
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(async () => {
    await neon.$disconnect().catch(() => {});
    await cn.$disconnect().catch(() => {});
  });
