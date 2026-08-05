// ───────────────────────────────────────────────
// #1 卖方采集 Agent — 国内卖家数据导入脚本
// 将 seller_scout_domestic_scraper.py 采集的 JSON
// 导入 RawListing 表（去重）
// 用法: tsx scripts/import-seller-scout-domestic.ts
// ───────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const prisma = new PrismaClient();
const EXCHANGE_RATE_EUR_CNY = 7.91;

interface DomesticListing {
  brand: string;
  modelName: string;
  year: number | null;
  engineHours: number | null;
  priceCny: number | null;
  priceEur: number | null;
  country: string;
  location: string;
  sellerName?: string;
  sellerPhone?: string;
  source: string;
  sourceDate: string;
  sourceUrl?: string;
}

interface DomesticOutput {
  scrapedAt: string;
  source: string;
  totalListings: number;
  withPrice: number;
  priceOnRequest: number;
  platformStats?: Record<string, number>;
  listings: DomesticListing[];
}

function generateContentHash(listing: DomesticListing): string {
  const key = `${listing.brand}|${listing.modelName}|${listing.year || ""}|${listing.location}|${listing.priceCny || listing.priceEur || ""}`;
  return crypto.createHash("md5").update(key).digest("hex");
}

async function importFromJson(jsonPath: string) {
  console.log(`📂 读取采集数据: ${jsonPath}`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ 文件不存在: ${jsonPath}`);
    return { imported: 0, skipped: 0, errors: 1 };
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: DomesticOutput = JSON.parse(raw);

  console.log(`📊 采集概览: ${data.totalListings} 条 (${data.withPrice} 有价格)`);
  if (data.platformStats) {
    for (const [platform, count] of Object.entries(data.platformStats)) {
      console.log(`   ${platform}: ${count} 条`);
    }
  }
  console.log("─".repeat(50));

  const listingsWithHash = data.listings.map((item) => ({
    item,
    hash: generateContentHash(item),
  }));

  const hashes = listingsWithHash.map((l) => l.hash);
  const existingRecords = await prisma.rawListing.findMany({
    where: { contentHash: { in: hashes } },
    select: { contentHash: true },
  });
  const existingSet = new Set(existingRecords.map((r) => r.contentHash));
  console.log(`🔍 已有记录: ${existingSet.size} 条`);

  const toInsert = listingsWithHash
    .filter((l) => !existingSet.has(l.hash))
    .map((l) => ({
      source: `domestic_${l.item.source.replace(/[^a-zA-Z0-9]/g, "_")}`,
      sourceUrl: l.item.sourceUrl || "",
      brandName: l.item.brand,
      modelName: l.item.modelName,
      year: l.item.year,
      workingHours: l.item.engineHours,
      condition: null,
      priceRaw: l.item.priceEur || l.item.priceCny || null,
      currency: l.item.priceEur ? "EUR" : l.item.priceCny ? "CNY" : null,
      priceCny: l.item.priceCny || (l.item.priceEur ? Math.round(l.item.priceEur * EXCHANGE_RATE_EUR_CNY) : null),
      location: l.item.location || "中国",
      sellerName: l.item.sellerName || null,
      sellerPhone: l.item.sellerPhone || null,
      sellerWechat: null,
      sellerWhatsapp: null,
      images: null,
      contentHash: l.hash,
      scrapedAt: new Date(l.item.sourceDate || data.scrapedAt),
    }));

  console.log(`📝 待插入: ${toInsert.length} 条`);

  if (toInsert.length === 0) {
    return { imported: 0, skipped: data.listings.length, errors: 0 };
  }

  try {
    const result = await prisma.rawListing.createMany({
      data: toInsert,
      skipDuplicates: true,
    });
    console.log(`✅ 成功插入: ${result.count} 条`);
    return { imported: result.count, skipped: data.listings.length - result.count, errors: 0 };
  } catch (err) {
    console.error("❌ 批量插入失败:", err);
    return { imported: 0, skipped: 0, errors: 1 };
  }
}

async function main() {
  const jsonPath = path.join(__dirname, "domestic_sellers_data_v2.json");

  console.log("=".repeat(60));
  console.log("🚜 #1 卖方采集 Agent — 国内卖家导入");
  console.log("=".repeat(60));

  const result = await importFromJson(jsonPath);
  console.log("─".repeat(50));
  console.log(`✅ 导入完成: ${result.imported} 条新增`);
  console.log(`⏭️  跳过重复: ${result.skipped} 条`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
