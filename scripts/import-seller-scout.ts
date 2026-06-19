// ───────────────────────────────────────────────
// #1 卖方采集 Agent — 导入脚本
// 将采集到的 JSON 数据导入 RawListing 表（去重）
// 用法: tsx scripts/import-seller-scout.ts
// ───────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const prisma = new PrismaClient();

const EXCHANGE_RATE_EUR_CNY = 7.91; // 欧元→人民币汇率

interface ScrapedListing {
  brand: string;
  modelName: string;
  category?: string;
  modelDetail?: string;
  year: number | null;
  engineHours: number | null;
  priceEur: number | null;
  isOnRequest: boolean;
  country: string;
  location: string;
  source: string;
  sourceDate: string;
  sourceUrl?: string;
}

interface ScrapedOutput {
  scrapedAt: string;
  source: string;
  category?: string;
  totalListings: number;
  withPrice: number;
  priceOnRequest: number;
  notes?: string;
  listings: ScrapedListing[];
}

function generateContentHash(listing: ScrapedListing): string {
  const key = `${listing.brand}|${listing.modelName}|${listing.year || ""}|${listing.location}|${listing.priceEur || ""}`;
  return crypto.createHash("md5").update(key).digest("hex");
}

async function importFromJson(jsonPath: string) {
  console.log(`📂 读取采集数据: ${jsonPath}`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ 文件不存在: ${jsonPath}`);
    return { imported: 0, skipped: 0, errors: 1 };
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: ScrapedOutput = JSON.parse(raw);

  console.log(`📊 采集概览: ${data.totalListings} 条 (${data.withPrice} 有价格, ${data.priceOnRequest} 面议)`);
  console.log(`📅 采集日期: ${data.scrapedAt}`);
  console.log("─".repeat(50));

  // 预生成所有 contentHash
  const listingsWithHash = data.listings.map((item) => ({
    item,
    hash: generateContentHash(item),
  }));

  // 批量查询已存在的记录
  const hashes = listingsWithHash.map((l) => l.hash);
  const existingRecords = await prisma.rawListing.findMany({
    where: { contentHash: { in: hashes } },
    select: { contentHash: true },
  });
  const existingSet = new Set(existingRecords.map((r) => r.contentHash));

  console.log(`🔍 已有记录: ${existingSet.size} 条`);

  // 准备插入数据
  const toInsert = listingsWithHash
    .filter((l) => !existingSet.has(l.hash))
    .map((l) => ({
      source: l.item.source.toLowerCase(),
      sourceUrl: l.item.sourceUrl || "",
      brandName: l.item.brand,
      modelName: l.item.modelName,
      year: l.item.year,
      workingHours: l.item.engineHours,
      condition: null,
      priceRaw: l.item.priceEur,
      currency: "EUR",
      priceCny: l.item.priceEur ? Math.round(l.item.priceEur * EXCHANGE_RATE_EUR_CNY) : null,
      location: l.item.location,
      sellerName: null,
      sellerPhone: null,
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

  // 批量插入
  try {
    const result = await prisma.rawListing.createMany({
      data: toInsert,
      skipDuplicates: true,
    });
    console.log(`✅ 成功插入: ${result.count} 条`);
    return {
      imported: result.count,
      skipped: data.listings.length - result.count,
      errors: 0,
    };
  } catch (err) {
    console.error("❌ 批量插入失败:", err);
    return { imported: 0, skipped: 0, errors: 1 };
  }
}

async function main() {
  const jsonPath = path.join(__dirname, "..", "..", "scripts", "agriaffaires_data.json");

  console.log("=".repeat(60));
  console.log("🚜 #1 卖方采集 Agent — 导入脚本");
  console.log("=".repeat(60));

  const result = await importFromJson(jsonPath);

  console.log("─".repeat(50));
  console.log(`✅ 导入完成: ${result.imported} 条新增`);
  console.log(`⏭️  跳过重复: ${result.skipped} 条`);
  if (result.errors > 0) console.log(`⚠️  错误: ${result.errors} 条`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  prisma.$disconnect();
  process.exit(1);
});
