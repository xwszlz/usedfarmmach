// ───────────────────────────────────────────────
// #1 卖方采集 Agent — 国际卖家数据导入脚本（多源）
// 将各采集器产出的 JSON 统一导入 RawListing 表（按 contentHash 去重）
// 数据源: agriaffaires_data.json / agroline_data.json / mascus_data.json / search_api_data.json
//   （缺哪个就跳过哪个，不算错）
// 用法: tsx scripts/import-seller-scout.ts
// ───────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const prisma = new PrismaClient();
const EXCHANGE_RATE_EUR_CNY = 7.91; // 与国内导入脚本、爬虫保持一致

/** 国际数据源文件清单（按顺序导入；缺失的文件直接跳过，不算错误） */
const SOURCE_FILES = [
  "agriaffaires_data.json",
  "agroline_data.json",
  "mascus_data.json",
  "search_api_data.json",
];

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

interface IntlListing {
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
  sellerEmail?: string;
  source: string;
  sourceDate: string;
  sourceUrl?: string;
}

interface IntlOutput {
  scrapedAt: string;
  source: string;
  totalListings: number;
  withPrice: number;
  priceOnRequest: number;
  platformStats?: Record<string, number>;
  listings: IntlListing[];
}

function generateContentHash(listing: IntlListing): string {
  const key = `${listing.brand}|${listing.modelName}|${listing.year || ""}|${listing.location}|${listing.priceCny || listing.priceEur || ""}`;
  return crypto.createHash("md5").update(key).digest("hex");
}

/**
 * 将采集日期稳健解析为 Date。
 * 兼容 "YYYYMMDD"（爬虫输出）与 "YYYY-MM-DD"（ISO）两种格式，
 * 避免 new Date("20260813") 产生 Invalid Date。
 */
function parseScrapeDate(sourceDate?: string, fallback?: string): Date {
  const tryParse = (s?: string): Date | null => {
    if (!s) return null;
    let d: Date;
    if (/^\d{8}$/.test(s)) {
      const y = s.slice(0, 4), m = s.slice(4, 6), day = s.slice(6, 8);
      d = new Date(`${y}-${m}-${day}`);
    } else {
      d = new Date(s);
    }
    return isNaN(d.getTime()) ? null : d;
  };
  return tryParse(sourceDate) || tryParse(fallback) || new Date();
}

async function importFromJson(jsonPath: string): Promise<ImportResult> {
  console.log(`📂 读取国际采集数据: ${jsonPath}`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ 文件不存在: ${jsonPath}`);
    return { imported: 0, skipped: 0, errors: 1 };
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: IntlOutput = JSON.parse(raw);

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
    .map((l) => {
      const priceCny = l.item.priceCny || (l.item.priceEur ? Math.round(l.item.priceEur * EXCHANGE_RATE_EUR_CNY) : null);
      return {
        // 🔧 修复：此前硬编码 "agriaffaires"，会把 agroline/mascus/search_api 的数据全部错标成国际源
        source: l.item.source || "agriaffaires", // 以条目自带 source 为准，便于运营按源区分
        sourceUrl: l.item.sourceUrl || "",
        brandName: l.item.brand,
        modelName: l.item.modelName,
        year: l.item.year,
        workingHours: l.item.engineHours,
        condition: null,
        priceRaw: l.item.priceEur || l.item.priceCny || null,
        currency: l.item.priceEur ? "EUR" : l.item.priceCny ? "CNY" : null,
        priceCny,
        // 多源下不再默认 "France"：优先 location，其次 country，最后留空（不误标国别）
        location: l.item.location || l.item.country || "",
        sellerName: l.item.sellerName || null,
        sellerPhone: l.item.sellerPhone || null,
        sellerWechat: null,
        sellerWhatsapp: null,
        sellerEmail: l.item.sellerEmail || null,
        images: null,
        contentHash: l.hash,
        scrapedAt: parseScrapeDate(l.item.sourceDate, data.scrapedAt),
      };
    });

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
  console.log("=".repeat(60));
  console.log("🌍 #1 卖方采集 Agent — 国际卖家导入（多源）");
  console.log("=".repeat(60));

  let totalImported = 0;
  let totalSkipped = 0;
  const details: string[] = [];

  for (const fname of SOURCE_FILES) {
    const jsonPath = path.join(__dirname, fname);
    if (!fs.existsSync(jsonPath)) {
      console.log(`⏭️  跳过（文件不存在）: ${fname}`);
      continue;
    }
    const result = await importFromJson(jsonPath);
    if (result.errors > 0) {
      details.push(`  • ${fname}: ⚠️ 解析/导入异常，跳过`);
      continue;
    }
    details.push(`  • ${fname}: 新增 ${result.imported} 条 / 跳过 ${result.skipped} 条`);
    totalImported += result.imported;
    totalSkipped += result.skipped;
  }

  console.log("─".repeat(50));
  console.log("📊 各源明细:");
  for (const line of details) console.log(line);
  console.log("─".repeat(50));
  console.log(`✅ 总计新增: ${totalImported} 条`);
  console.log(`⏭️  总计跳过重复: ${totalSkipped} 条`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
