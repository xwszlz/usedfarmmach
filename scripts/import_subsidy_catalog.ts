// ───────────────────────────────────────────────
// 国内农机补贴库 —— 入库器骨架（.cn 境内专用，绝不执行灌库）
// ───────────────────────────────────────────────
//
// ⚠️ 本文件【只写骨架、绝不执行】。AI 只改代码 + 推分支，不灌库、不连生产库。
// 真正入库只在境内 ECS（SITE=cn / DATABASE_URL_CN）由人工/定时任务触发。
//
// 职责：
//   1. fail-closed SITE 闸门（仅 .cn 或 DATABASE_URL_CN 才准入，否则 exit(2)）；
//   2. 读取 import_subsidy_catalog.py 产出的 catalog.jsonl / raw.jsonl；
//   3. 用 contentHash + skipDuplicates 幂等写入 SubsidyCatalog / SubsidyRecordRaw；
//   4. 强制 goodsRegion="cn"；
//   5. 入库后行数对账断言（防 store-scope.ts:396 静默 0 入库却返回 success）。

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ── 合规护栏：补贴 PII 必须写入境内 cn-postgres（数据不出境红线）──
const isCnSite = process.env.SITE === "cn" || !!process.env.DATABASE_URL_CN;
const dbUrl =
  process.env.DATABASE_URL_CN || (isCnSite ? process.env.DATABASE_URL : null);
if (!dbUrl) {
  console.error(
    "❌ 合规拦截：补贴数据必须写入境内 cn-postgres（数据不出境红线）。"
  );
  console.error(
    "   当前环境未设置 DATABASE_URL_CN 且非 .cn 站点，已拒绝入库，以免 PII 出境。"
  );
  process.exit(2);
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

const OUT_DIR = process.env.SUBSIDY_OUT_DIR || path.join(__dirname, "subsidy-out");
const BATCH_CODE = process.env.SUBSIDY_BATCH || "domestic-seed-2026-11";

interface CatalogSeed {
  batchCode: string;
  policyYear: number;
  province: string;
  category: string;
  brandName: string;
  modelName: string;
  machineryType: string | null;
  manufacturer: string;
  medianPriceCny: number;
  p25PriceCny: number | null;
  p75PriceCny: number | null;
  medianCentralSubsidy: number | null;
  medianTotalSubsidy: number | null;
  sampleSize: number;
  contentHash: string;
}

interface RawSeed {
  batchCode: string;
  sourceFile: string;
  province: string;
  county: string;
  township: string;
  buyerName: string;
  manufacturer: string;
  category: string;
  productName: string;
  modelName: string;
  quantity: number;
  dealer: string;
  purchaseDate: string;
  salePriceCny: number;
  centralSubsidyCny: number | null;
  totalSubsidyCny: number | null;
  serialNo: string;
  status: string;
  goodsRegion: string;
  contentHash: string;
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}（请先运行 import_subsidy_catalog.py）`);
    return [];
  }
  const text = fs.readFileSync(filePath, "utf-8");
  const out: T[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    out.push(JSON.parse(t) as T);
  }
  return out;
}

async function importCatalog(): Promise<{ attempted: number; inserted: number }> {
  const seeds = readJsonl<CatalogSeed>(path.join(OUT_DIR, "catalog.jsonl"));
  if (seeds.length === 0) return { attempted: 0, inserted: 0 };

  const data = seeds.map((s) => ({
    batchCode: s.batchCode,
    policyYear: s.policyYear,
    province: s.province,
    category: s.category,
    brandName: s.brandName,
    modelName: s.modelName,
    machineryType: s.machineryType,
    manufacturer: s.manufacturer,
    medianPriceCny: s.medianPriceCny,
    p25PriceCny: s.p25PriceCny,
    p75PriceCny: s.p75PriceCny,
    medianCentralSubsidy: s.medianCentralSubsidy,
    medianTotalSubsidy: s.medianTotalSubsidy,
    sampleSize: s.sampleSize,
    contentHash: s.contentHash,
    isActive: true,
  }));

  try {
    const result = await prisma.subsidyCatalog.createMany({
      data,
      skipDuplicates: true,
    });
    // 对账：本批次入库后，库中该批次行数必须 ≥ 本次种子数（防静默 0 入库）
    const after = await prisma.subsidyCatalog.count({
      where: { batchCode: BATCH_CODE },
    });
    if (after < data.length) {
      throw new Error(
        `补贴目录对账失败：期望 ≥ ${data.length} 行，实际库中存在 ${after} 行（疑似静默丢行）`
      );
    }
    return { attempted: data.length, inserted: result.count };
  } catch (err) {
    console.error("❌ 补贴目录写入失败:", err);
    throw err;
  }
}

async function importRaw(): Promise<{ attempted: number; inserted: number }> {
  const seeds = readJsonl<RawSeed>(path.join(OUT_DIR, "raw.jsonl"));
  if (seeds.length === 0) return { attempted: 0, inserted: 0 };

  const data = seeds.map((s) => ({
    batchCode: s.batchCode,
    sourceFile: s.sourceFile,
    province: s.province,
    county: s.county,
    township: s.township,
    buyerName: s.buyerName,
    manufacturer: s.manufacturer,
    category: s.category,
    productName: s.productName,
    modelName: s.modelName,
    quantity: s.quantity,
    dealer: s.dealer,
    purchaseDate: new Date(s.purchaseDate),
    salePriceCny: s.salePriceCny,
    centralSubsidyCny: s.centralSubsidyCny,
    totalSubsidyCny: s.totalSubsidyCny,
    serialNo: s.serialNo,
    status: s.status,
    goodsRegion: "cn", // 强制境内，杜绝误写境外
    contentHash: s.contentHash,
  }));

  try {
    const result = await prisma.subsidyRecordRaw.createMany({
      data,
      skipDuplicates: true,
    });
    const after = await prisma.subsidyRecordRaw.count({
      where: { batchCode: BATCH_CODE },
    });
    if (after < data.length) {
      throw new Error(
        `补贴明细对账失败：期望 ≥ ${data.length} 行，实际库中存在 ${after} 行（疑似静默丢行）`
      );
    }
    return { attempted: data.length, inserted: result.count };
  } catch (err) {
    console.error("❌ 补贴明细写入失败:", err);
    throw err;
  }
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("🚜 国内农机补贴库 —— 入库器（.cn 境内专用）");
  console.log("=".repeat(60));
  console.log(`批次: ${BATCH_CODE}`);

  const cat = await importCatalog();
  const raw = await importRaw();

  console.log("─".repeat(50));
  console.log(`📊 目录：尝试 ${cat.attempted} 条，新增 ${cat.inserted} 条`);
  console.log(`🔒 明细：尝试 ${raw.attempted} 条，新增 ${raw.inserted} 条`);
  console.log("✅ 入库完成（幂等：重复 contentHash 自动跳过）");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect().finally(() => process.exit(1));
  });
