// ───────────────────────────────────────────────
// 欧系农机具基准价种子导入（自包含版，供 ECS standalone 容器直接 node 跑）
// 与 src/lib/benchmark-engine.js 的 seedEuEvidence 逻辑一致，但只依赖
// @prisma/client（容器 npm ci --only=production 必有），不 require 引擎
// （standalone 镜像内无 src/lib 原路径）。
//
// 数据：scripts/eu-benchmark-evidence.json（53 条 WebSearch 逐条挂牌，公开行情）
// 合规：境外公开挂牌价，不含境内卖家 PII，可入 Neon 也可入 cn-postgres。
//
// 用法：
//   写 Neon(.com)：   node scripts/seed-eu-benchmark.js
//   写 cn-postgres：  SITE=cn node scripts/seed-eu-benchmark.js   （需 DATABASE_URL_CN）
// 幂等：按 brand+model+sourceSite upsert，重复运行无害。
// ───────────────────────────────────────────────

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const FX = { EUR: 7.8, GBP: 9.2, USD: 7.2, CNY: 1 };
const JSON_FILE = path.join(process.cwd(), "scripts", "eu-benchmark-evidence.json");

const isCn = process.env.SITE === "cn" || !!process.env.DATABASE_URL_CN;
const dbUrl = isCn
  ? process.env.DATABASE_URL_CN || process.env.DATABASE_URL
  : process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ 缺数据库连接串（写 Neon 需 DATABASE_URL；写 cn 需 SITE=cn + DATABASE_URL_CN）。");
  process.exit(2);
}
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

function regionOf(country) {
  return country && String(country).toUpperCase() === "USA" ? "US" : "EU";
}
function catOf(c) {
  const v = String(c || "").toLowerCase();
  return v === "plough" || v === "seed_drill" ? "soil" : v || "soil";
}
function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;

async function main() {
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`❌ 文件不存在: ${JSON_FILE}`);
    process.exit(2);
  }
  const doc = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  const records = Array.isArray(doc) ? doc : doc.records || [];

  // 按 brand+model+sourceSite 分组（同组合多条挂牌 → 一行基准价）
  const groups = new Map();
  for (const r of records) {
    const key = `${r.brand}||${r.model}||${r.source}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  let n = 0, err = 0;
  for (const list of groups.values()) {
    const first = list[0];
    try {
      const cnyList = list.map((r) => r.priceForeign * (FX[r.currency] || 1));
      const priceCny = round2(median(cnyList));

      // 主导币种
      const curCount = {};
      list.forEach((r) => (curCount[r.currency] = (curCount[r.currency] || 0) + 1));
      let domCur = first.currency, mx = 0;
      for (const [c, cnt] of Object.entries(curCount)) {
        if (cnt > mx) { mx = cnt; domCur = c; }
      }
      const foreignList = list.filter((r) => r.currency === domCur).map((r) => r.priceForeign);
      const priceForeign = round2(median(foreignList));
      const rate = FX[domCur] || 1;

      const row = {
        brand: first.brand,
        brandNameZh: first.brandNameZh,
        model: first.model,
        category: catOf(first.category),
        sourceSite: first.source,
        priceForeign,
        currency: domCur,
        priceCny,
        exchangeRate: round4(rate),
        sourceUrl: first.url,
        sourceDate: first.capturedAt || null,
        confidenceScore: 0.6,
        sampleSize: list.length,
        medianPrice: priceForeign,
        listingCount: list.length,
        priceType: "listing",
        region: regionOf(first.country),
        lastVerified: new Date(),
        isActive: true,
      };

      const existing = await prisma.brandBenchmark.findFirst({
        where: { brand: row.brand, model: row.model, sourceSite: row.sourceSite },
      });
      if (existing) await prisma.brandBenchmark.update({ where: { id: existing.id }, data: row });
      else await prisma.brandBenchmark.create({ data: row });
      n++;
    } catch (e) {
      err++;
      console.error(`  ✗ ${first.brand} ${first.model} @${first.source}: ${e.message}`);
    }
  }
  console.log(
    `🌱 欧系证据种子：${records.length} 条 → ${n} 行 BrandBenchmark（失败 ${err}），目标库=${isCn ? "cn-postgres" : "Neon"}`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
