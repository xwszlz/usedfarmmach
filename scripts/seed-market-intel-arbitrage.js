// ───────────────────────────────────────────────
// 套利情报 MarketIntel 种子导入（境外公开行情 + 套利分析，合规可双库）
// 读仓库根 market_intel_arbitrage_2026-08-16.json，幂等 upsert 进 MarketIntel。
//
// 合规说明：内容为境外农机公开挂牌价 + 套利分析，不含境内卖家 PII，
//           可入 Neon(.com) 也可复制进 cn-postgres(.cn)。
//
// 用法：
//   写 Neon(.com)：   node scripts/seed-market-intel-arbitrage.js
//   写 cn-postgres：  SITE=cn node scripts/seed-market-intel-arbitrage.js   （需 DATABASE_URL_CN）
// 幂等：固定 id，重复运行无害。
// ───────────────────────────────────────────────

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const FIXED_ID = "arb-report-2026-08-16";
const JSON_FILE = path.join(process.cwd(), "market_intel_arbitrage_2026-08-16.json");

// SITE-aware：境外公开数据可双库；cn 站写 cn-postgres，否则写 Neon
const isCn = process.env.SITE === "cn" || !!process.env.DATABASE_URL_CN;
const dbUrl = isCn
  ? process.env.DATABASE_URL_CN || process.env.DATABASE_URL
  : process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    "❌ 未设置数据库连接串（写 Neon 需 DATABASE_URL；写 cn 需 SITE=cn + DATABASE_URL_CN）。"
  );
  process.exit(2);
}
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

function str(v) {
  return v == null ? null : String(v);
}

async function main() {
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`❌ 情报 JSON 不存在: ${JSON_FILE}`);
    process.exit(2);
  }
  const d = JSON.parse(fs.readFileSync(JSON_FILE, "utf-8"));

  const data = {
    date: new Date(d.date),
    icon: str(d.icon),
    region: str(d.region),
    tags: JSON.stringify(d.tags || []),
    text: str(d.text),
    url: str(d.url),
    detailedContent: str(d.detailedContent),
    dataSummary: str(d.dataSummary),
    actionTips: str(d.actionTips),
    sortOrder: 0,
    isActive: true,
    textEn: str(d.textEn),
    textRu: str(d.textRu),
    regionEn: str(d.regionEn),
    regionRu: str(d.regionRu),
    tagsEn: JSON.stringify(d.tagsEn || []),
    tagsRu: JSON.stringify(d.tagsRu || []),
    detailedContentEn: str(d.detailedContentEn),
    detailedContentRu: str(d.detailedContentRu),
  };

  const existing = await prisma.marketIntel.findUnique({ where: { id: FIXED_ID } });
  if (existing) {
    await prisma.marketIntel.update({ where: { id: FIXED_ID }, data });
    console.log(`✅ 已更新 MarketIntel 套利情报（id=${FIXED_ID}，目标库=${isCn ? "cn-postgres" : "Neon"}）`);
  } else {
    await prisma.marketIntel.create({ data: { id: FIXED_ID, ...data } });
    console.log(`✅ 已写入 MarketIntel 套利情报（id=${FIXED_ID}，目标库=${isCn ? "cn-postgres" : "Neon"}）`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ 导入失败:", e);
  process.exit(1);
});
