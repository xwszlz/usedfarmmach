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
  blocked: number;
  blockedByReason: Record<string, number>;
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
 * 🔴 合规闸门（P0-4 止血，2026-10-20）：本脚本把「国际采集」数据写入 Neon（境外库）。
 * 2026-10-17 实测：agroline 源有 55 行含中国大陆手机号（6 个不同号码）落入境外库，
 * 违反「数据不出境」红线。命中「中国 PII」或「中国地区」的行拒绝写入境外库，仅计数留痕。
 * ⚠️ 必须按行判定：agroline.cn 多为欧洲经销商挂牌，若按域名整源拦截会误杀约 1100 条合法数据。
 * 返回拦截原因字符串；未命中返回 null。
 */
function detectCnPii(listing: IntlListing): string | null {
  const phone = (listing.sellerPhone ?? "").replace(/[\s\-()]/g, "");
  if (/^(\+?86)?1[3-9]\d{9}$/.test(phone)) return "cn_mobile_phone";
  if (/@(qq|163|126|sina|sohu|aliyun|foxmail|139|189)\.com$/i.test(listing.sellerEmail ?? "")) return "cn_email";
  const wechat = (listing as { sellerWechat?: string }).sellerWechat?.replace(/\s/g, "") ?? "";
  if (wechat.length > 0) return "cn_wechat";
  if (/中国|china/i.test(`${listing.location ?? ""} ${listing.country ?? ""}`)) return "cn_location";
  return null;
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
    return { imported: 0, skipped: 0, errors: 1, blocked: 0, blockedByReason: {} };
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

  // 🔴 P0-4 合规闸门：按行判定中国 PII/中国地区，命中即拒绝写入 Neon（境外库），不落库
  const blockedByReason: Record<string, number> = {};
  let blocked = 0;
  const allowed = listingsWithHash.filter((l) => {
    const reason = detectCnPii(l.item);
    if (!reason) return true;
    blockedByReason[reason] = (blockedByReason[reason] || 0) + 1;
    blocked++;
    return false;
  });
  if (blocked > 0) {
    const summary = Object.entries(blockedByReason).map(([r, c]) => `${r}×${c}`).join(", ");
    console.warn(`🔴 合规闸门拦截: ${summary}`);
  }

  const hashes = allowed.map((l) => l.hash);
  const existingRecords = await prisma.rawListing.findMany({
    where: { contentHash: { in: hashes } },
    select: { contentHash: true },
  });
  const existingSet = new Set(existingRecords.map((r) => r.contentHash));
  console.log(`🔍 已有记录: ${existingSet.size} 条`);

  const toInsert = allowed
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
    return { imported: 0, skipped: data.listings.length, errors: 0, blocked, blockedByReason };
  }

  try {
    const result = await prisma.rawListing.createMany({
      data: toInsert,
      skipDuplicates: true,
    });
    console.log(`✅ 成功插入: ${result.count} 条`);
    return { imported: result.count, skipped: data.listings.length - result.count, errors: 0, blocked, blockedByReason };
  } catch (err) {
    console.error("❌ 批量插入失败:", err);
    return { imported: 0, skipped: 0, errors: 1, blocked, blockedByReason };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🌍 #1 卖方采集 Agent — 国际卖家导入（多源）");
  console.log("=".repeat(60));

  let totalImported = 0;
  let totalSkipped = 0;
  let totalBlocked = 0;
  const totalBlockedByReason: Record<string, number> = {};
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
    totalBlocked += result.blocked;
    for (const [reason, count] of Object.entries(result.blockedByReason)) {
      totalBlockedByReason[reason] = (totalBlockedByReason[reason] || 0) + count;
    }
  }

  console.log("─".repeat(50));
  console.log("📊 各源明细:");
  for (const line of details) console.log(line);
  console.log("─".repeat(50));
  console.log(`✅ 总计新增: ${totalImported} 条`);
  console.log(`⏭️  总计跳过重复: ${totalSkipped} 条`);

  if (totalBlocked > 0) {
    console.log(`🔴 合规闸门：本次共拦截 ${totalBlocked} 条中国 PII/中国地区数据，未写入 Neon（境外库）`);
    for (const [reason, count] of Object.entries(totalBlockedByReason)) {
      console.log(`   • ${reason}: ${count} 条`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
