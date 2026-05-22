/**
 * 从神雕日报/套利报告数据导入国外市场价
 * 数据源：套利报告 JSON + 神雕日报 Markdown
 * 
 * 执行：tsx scripts/import-international-prices.ts
 * 前置：npm run db:seed + import-real-data 已执行
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// 神雕日报目录
const DAILY_DIR = "D:/神雕农机/套利报告";

interface SnapshotItem {
  serial: string;
  machine_type: string;
  brand: string;
  model: string;
  year: number | null;
  domestic_price: number | null;
  best_foreign_price_cny: number | null;
  best_foreign_source: string;
  best_foreign_url: string;
  best_foreign_title: string;
  total_landed_cost: number | null;
  gross_profit: number | null;
  gross_margin_pct: number | null;
  opportunity_level: string;
  opportunity_score: number;
}

interface BriefTopOpportunity {
  machine_type: string;
  brand: string;
  model: string;
  year: number;
  domestic_price_wan: number;
  best_foreign_price_wan: number;
  total_landed_cost_wan: number;
  gross_profit_wan: number;
  gross_margin_pct: number;
  source: string;
  url: string;
  opportunity_level?: string;
}

// 品牌+型号匹配映射（日报模型名 → 网站模型名）
const MODEL_ALIASES: Record<string, string[]> = {
  "970": ["970（欧版）", "970(欧版)", "970"],
  "980": ["980（美版)", "980(美版)", "980"],
  "850": ["850"],
  "900": ["900"],
  "695": ["695"],
  "5300RC大方捆": ["5300RC", "5300RC大方捆"],
  "FR450": ["FR450"],
  "FR500": ["FR500(9040)", "FR500"],
  "9080": ["9080"],
  "8400": ["8400"],
  "7250": ["7250"],
  "BigM 420": ["BigM 420", "big420割草机"],
};

function matchProduct(modelName: string, brand: string, year: number | null): string | null {
  // Try exact match on modelName
  const aliases = MODEL_ALIASES[modelName];
  if (aliases) {
    // Will match below
  }

  // Try to find product by brand and model
  // This is a simplified matching - in production you'd want fuzzy matching
  return null; // We'll do the matching in the main function
}

async function importFromSnapshot(snapshotPath: string) {
  console.log(`\n📄 Processing snapshot: ${path.basename(snapshotPath)}`);
  
  const raw = fs.readFileSync(snapshotPath, "utf-8");
  const items: SnapshotItem[] = JSON.parse(raw);
  
  let imported = 0;
  let skipped = 0;
  
  for (const item of items) {
    if (!item.best_foreign_price_cny || item.best_foreign_price_cny <= 0) {
      skipped++;
      continue;
    }
    
    // Find matching product in DB
    const product = await findMatchingProduct(item.brand, item.model, item.year);
    if (!product) {
      skipped++;
      continue;
    }
    
    // Check if we already have a price for this product from this source
    const existing = await prisma.internationalPrice.findFirst({
      where: {
        productId: product.id,
        source: item.best_foreign_source || "unknown",
      },
    });
    
    if (existing) {
      // Update if the new data is more recent
      const snapshotDate = path.basename(snapshotPath).match(/(\d{8})/)?.[1];
      if (snapshotDate && snapshotDate > (existing.sourceDate || "0")) {
        await prisma.internationalPrice.update({
          where: { id: existing.id },
          data: {
            priceForeignCny: item.best_foreign_price_cny * 10000, // 万元 → 元
            source: item.best_foreign_source || "unknown",
            sourceUrl: item.best_foreign_url || null,
            sourceDate: snapshotDate,
            notes: `${item.opportunity_level} | 毛利率${item.gross_margin_pct ? (item.gross_margin_pct * 100).toFixed(1) + "%" : "N/A"}`,
          },
        });
        imported++;
      }
      continue;
    }
    
    // Create new price record
    const snapshotDate = path.basename(snapshotPath).match(/(\d{8})/)?.[1] || new Date().toISOString().slice(0, 10).replace(/-/g, "");
    
    await prisma.internationalPrice.create({
      data: {
        productId: product.id,
        priceForeignCny: item.best_foreign_price_cny * 10000, // 万元 → 元
        source: item.best_foreign_source || "unknown",
        sourceUrl: item.best_foreign_url || null,
        sourceDate: snapshotDate,
        currency: "EUR",
        notes: `${item.opportunity_level} | 毛利率${item.gross_margin_pct ? (item.gross_margin_pct * 100).toFixed(1) + "%" : "N/A"}`,
      },
    });
    imported++;
  }
  
  console.log(`  ✅ Imported: ${imported}, Skipped: ${skipped}`);
  return imported;
}

async function importFromBrief(briefPath: string) {
  console.log(`\n📊 Processing brief: ${path.basename(briefPath)}`);
  
  const raw = fs.readFileSync(briefPath, "utf-8");
  const brief = JSON.parse(raw);
  
  if (!brief.top_arbitrage_opportunities) {
    console.log("  ⏭️ No top_arbitrage_opportunities found");
    return 0;
  }
  
  let imported = 0;
  
  for (const item of brief.top_arbitrage_opportunities as BriefTopOpportunity[]) {
    if (!item.best_foreign_price_wan || item.best_foreign_price_wan <= 0) continue;
    
    const product = await findMatchingProduct(item.brand, item.model, item.year);
    if (!product) continue;
    
    const briefDate = brief.generated_at?.slice(0, 10).replace(/-/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");
    
    // Upsert: prefer latest data
    const existing = await prisma.internationalPrice.findFirst({
      where: { productId: product.id },
      orderBy: { sourceDate: "desc" },
    });
    
    if (existing && existing.sourceDate && existing.sourceDate >= briefDate) continue;
    
    if (existing) {
      await prisma.internationalPrice.update({
        where: { id: existing.id },
        data: {
          priceForeignCny: item.best_foreign_price_wan * 10000,
          source: item.source || "unknown",
          sourceUrl: item.url || null,
          sourceDate: briefDate,
          currency: item.source?.includes("TractorHouse") ? "USD" : "EUR",
          notes: `${item.opportunity_level || ""} | 毛利${item.gross_profit_wan?.toFixed(1) || "N/A"}万 | 毛利率${(item.gross_margin_pct * 100).toFixed(1)}%`,
        },
      });
    } else {
      await prisma.internationalPrice.create({
        data: {
          productId: product.id,
          priceForeignCny: item.best_foreign_price_wan * 10000,
          source: item.source || "unknown",
          sourceUrl: item.url || null,
          sourceDate: briefDate,
          currency: item.source?.includes("TractorHouse") ? "USD" : "EUR",
          notes: `${item.opportunity_level || ""} | 毛利${item.gross_profit_wan?.toFixed(1) || "N/A"}万 | 毛利率${(item.gross_margin_pct * 100).toFixed(1)}%`,
        },
      });
    }
    imported++;
  }
  
  console.log(`  ✅ Imported: ${imported}`);
  return imported;
}

// 神雕日报Markdown中的国外价格解析（Agroline数据等）
async function importFromDailyMarkdown(mdPath: string) {
  console.log(`\n📝 Processing daily: ${path.basename(mdPath)}`);
  
  const content = fs.readFileSync(mdPath, "utf-8");
  const dateMatch = path.basename(mdPath).match(/(\d{4}-\d{2}-\d{2})/);
  const reportDate = dateMatch?.[1]?.replace(/-/g, "") || "";
  
  // Parse Agroline price table from daily report
  // Looking for patterns like: €320,000, €461,438 etc.
  const pricePatterns = [
    // CLAAS Jaguar specific prices from Agroline
    /(\d{3,4})[^|]*\|[^|]*\|[^|]*\|[^|]*(€[\d,]+)[^|]*\|[^|]*(~?[\d.]+万RMB)/g,
  ];
  
  // Simpler approach: extract known price entries from daily reports
  // Pattern: "克拉斯 Jaguar 970 ... €320,000（约253万RMB）"
  const jaguarPriceRegex = /克拉斯\s+Jaguar\s+(\d{3})[^€]*€([\d,]+)/g;
  const matches = [...content.matchAll(jaguarPriceRegex)];
  
  let imported = 0;
  
  for (const match of matches) {
    const modelNum = match[1]; // e.g. "970", "980", "850"
    const priceEur = parseInt(match[2].replace(/,/g, ""), 10);
    
    if (!priceEur) continue;
    
    // Find matching product
    const product = await findMatchingProduct("克拉斯", modelNum, null);
    if (!product) continue;
    
    // EUR/CNY conversion (approximate from report context)
    const eurCny = 7.91; // Default from recent reports
    const priceCny = Math.round(priceEur * eurCny);
    
    const existing = await prisma.internationalPrice.findFirst({
      where: { productId: product.id },
      orderBy: { sourceDate: "desc" },
    });
    
    if (existing && existing.sourceDate && existing.sourceDate >= reportDate && existing.source === "Agroline") continue;
    
    if (existing && existing.source === "Agroline") {
      await prisma.internationalPrice.update({
        where: { id: existing.id },
        data: {
          priceForeignCny: priceCny,
          priceForeignRaw: priceEur,
          currency: "EUR",
          exchangeRate: eurCny,
          source: "Agroline",
          sourceDate: reportDate,
          notes: `Agroline实时报价 | EUR ${priceEur.toLocaleString()} → ¥${priceCny.toLocaleString()}`,
        },
      });
    } else {
      await prisma.internationalPrice.create({
        data: {
          productId: product.id,
          priceForeignCny: priceCny,
          priceForeignRaw: priceEur,
          currency: "EUR",
          exchangeRate: eurCny,
          source: "Agroline",
          sourceDate: reportDate,
          country: "DE",
          notes: `Agroline实时报价 | EUR ${priceEur.toLocaleString()} → ¥${priceCny.toLocaleString()}`,
        },
      });
    }
    imported++;
  }
  
  console.log(`  ✅ Imported: ${imported}`);
  return imported;
}

// Match product in DB by brand + model
async function findMatchingProduct(brandName: string, modelName: string, year: number | null) {
  // Normalize brand name
  const brandMap: Record<string, string> = {
    "克拉斯": "claas",
    "克罗尼": "krone",
    "纽荷兰": "new-holland",
    "迪尔": "john-deere",
    "约翰迪尔": "john-deere",
    "凯斯": "case-ih",
    "库恩": "kuhn",
    "格兰": "grain",
    "奥库": "orke",
    "格立莫": "grimme",
    "康斯凯尔": "kongskilde",
    "Kongskilde\n康斯凯尔": "kongskilde",
    "都麦": "dormoy",
    "arcusln": "arcusin",
    "arcusin": "arcusin",
    "爱科\n麦赛弗格森": "massey-ferguson",
    "麦赛弗格森": "massey-ferguson",
    "爱科MF": "massey-ferguson",
    "东洋": "toyo",
    "马赛": "massey",
  };
  
  const brandId = brandMap[brandName];
  if (!brandId) return null;
  
  // Normalize model name - strip qualifiers like (欧版), (美版)
  const cleanModel = modelName.replace(/[（(].*?[)）]/g, "").trim();
  
  // Try exact match
  const where: Record<string, unknown> = { brandId };
  if (cleanModel) where.modelName = cleanModel;
  if (year) where.year = year;
  
  let product = await prisma.product.findFirst({ where });
  
  // If no match with year, try without year
  if (!product && year) {
    const whereNoYear: Record<string, unknown> = { brandId };
    if (cleanModel) whereNoYear.modelName = cleanModel;
    product = await prisma.product.findFirst({ where: whereNoYear });
  }
  
  // If still no match, try partial model match
  if (!product && cleanModel) {
    product = await prisma.product.findFirst({
      where: {
        brandId,
        modelName: { contains: cleanModel },
      },
    });
  }
  
  return product;
}

async function main() {
  console.log("🌍 开始导入国外市场价数据...\n");
  
  // 1. Import from snapshot JSON files
  const snapshotFiles = fs.readdirSync(DAILY_DIR)
    .filter(f => f.startsWith("snapshot_") && f.endsWith(".json") && !f.includes("dryrun"))
    .sort()
    .reverse(); // Latest first
  
  console.log(`Found ${snapshotFiles.length} snapshot files`);
  
  for (const file of snapshotFiles.slice(0, 3)) { // Process latest 3
    await importFromSnapshot(path.join(DAILY_DIR, file));
  }
  
  // 2. Import from brief JSON files
  const briefFiles = fs.readdirSync(DAILY_DIR)
    .filter(f => f.startsWith("智能体简报_") && f.endsWith(".json") && !f.includes("dryrun"))
    .sort()
    .reverse();
  
  console.log(`Found ${briefFiles.length} brief files`);
  
  for (const file of briefFiles.slice(0, 3)) {
    await importFromBrief(path.join(DAILY_DIR, file));
  }
  
  // 3. Import from daily markdown reports
  const dailyDir = "D:/神雕农机/神雕日报";
  if (fs.existsSync(dailyDir)) {
    const mdFiles = fs.readdirSync(dailyDir)
      .filter(f => f.endsWith("_跨境套利日报.md"))
      .sort()
      .reverse();
    
    console.log(`Found ${mdFiles.length} daily markdown files`);
    
    for (const file of mdFiles.slice(0, 5)) { // Process latest 5
      await importFromDailyMarkdown(path.join(dailyDir, file));
    }
  }
  
  // 4. Manual high-confidence price data from latest daily report (hardcoded for reliability)
  await importManualPrices();
  
  // Summary
  const total = await prisma.internationalPrice.count();
  console.log(`\n🎉 完成！数据库中共有 ${total} 条国外市场价记录`);
  
  await prisma.$disconnect();
}

// Manual import of known high-confidence prices from latest 神雕日报
async function importManualPrices() {
  console.log("\n📋 Importing manual high-confidence prices from 神雕日报...");
  
  const manualPrices = [
    // From 2026-05-20 daily report - Agroline data
    { brandId: "claas", model: "970", year: 2017, priceEur: 320000, source: "Agroline", country: "DE", note: "2019款 约253万RMB" },
    { brandId: "claas", model: "980", year: 2016, priceEur: 461438, source: "Agroline", country: "DE", note: "2022款 T4/E5 约365万RMB" },
    { brandId: "claas", model: "980", year: 2015, priceEur: 220000, source: "Agroline", country: "DE", note: "2014旧款 ~174万RMB" },
    { brandId: "claas", model: "850", year: 2020, priceEur: 250000, source: "Agroline", country: "DE", note: "准新机 ~197万RMB" },
    // From套利报告
    { brandId: "new-holland", model: "FR450", year: 2013, priceUsd: 30000, source: "TractorHouse", country: "US", note: "同类参考 $3-4万" },
    { brandId: "new-holland", model: "FR500", year: 2014, priceUsd: 45000, source: "TractorHouse", country: "US", note: "同类参考 $4-5万" },
    { brandId: "new-holland", model: "9080", year: null, priceUsd: 95000, source: "TractorHouse", country: "US", note: "740马力卡特发动机" },
    { brandId: "john-deere", model: "8400", year: 2016, priceUsd: 90000, source: "TractorHouse", country: "US", note: "中东线主力" },
    { brandId: "claas", model: "5300RC", year: 2022, priceEur: 75000, source: "e-farm", country: "DE", note: "全新大方捆 ~59万RMB" },
  ];
  
  const EUR_CNY = 7.91;
  const USD_CNY = 7.25;
  let imported = 0;
  
  for (const mp of manualPrices) {
    const where: Record<string, unknown> = { brandId: mp.brandId, modelName: mp.model };
    if (mp.year) where.year = mp.year;
    
    const product = await prisma.product.findFirst({ where });
    if (!product) {
      console.log(`  ⏭️ No matching product: ${mp.brandId} ${mp.model} ${mp.year || ""}`);
      continue;
    }
    
    const isEur = !!mp.priceEur;
    const priceRaw = isEur ? mp.priceEur! : mp.priceUsd!;
    const rate = isEur ? EUR_CNY : USD_CNY;
    const priceCny = Math.round(priceRaw * rate);
    
    const existing = await prisma.internationalPrice.findFirst({
      where: { productId: product.id, source: mp.source },
    });
    
    const data = {
      priceForeignCny: priceCny,
      priceForeignRaw: priceRaw,
      currency: isEur ? "EUR" : "USD",
      exchangeRate: rate,
      source: mp.source,
      sourceDate: "20260520",
      country: mp.country,
      notes: mp.note,
    };
    
    if (existing) {
      await prisma.internationalPrice.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.internationalPrice.create({
        data: { productId: product.id, ...data },
      });
    }
    imported++;
    console.log(`  ✅ ${mp.brandId} ${mp.model}: ${isEur ? "€" : "$"}${priceRaw.toLocaleString()} → ¥${priceCny.toLocaleString()}`);
  }
  
  console.log(`  📊 Manual import: ${imported} records`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
