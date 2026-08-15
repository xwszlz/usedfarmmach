/**
 * 灌数脚本：将 deliverables/machine-parts-layer-2026-08-14.csv
 * （97 台二手农机 × 适配配件，1173 行配对）写入 MachinePart 表。
 *
 * 解析规则：
 *  - partSource = 'Part'      → 用 sku 关联 Part 表
 *  - partSource = 'part_legacy' → 用 (nameZh, brand) 关联 PartLegacy 表（legacy 无 sku）
 *
 * 执行（需 DATABASE_URL）：
 *   npx prisma generate
 *   npx prisma db execute --file prisma/machine-part-create-table.sql
 *   npx tsx prisma/seed-machine-parts.ts
 *
 * 幂等：每次先清空 MachinePart 再全量插入。
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// CSV 可能位于：① 仓库内 deliverables/（随仓库分发）；② 仓库上级 deliverables/（神雕农机/deliverables，脚本生成处）
const CSV_CANDIDATES = [
  path.resolve(__dirname, "..", "deliverables", "machine-parts-layer-2026-08-14.csv"),
  path.resolve(__dirname, "..", "..", "deliverables", "machine-parts-layer-2026-08-14.csv"),
];
function resolveCsv(): string {
  for (const p of CSV_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `CSV not found. Tried:\n - ${CSV_CANDIDATES.join("\n - ")}`
  );
}
const CSV_PATH = resolveCsv();

/** 简易 CSV 行解析（支持引号包裹、字段内逗号、空引号字段） */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  // CSV_PATH 已在模块加载时解析（resolveCsv 找不到会直接抛错）
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]);
  // machineId,brand,model,origin,partName,matchType,partSource,sku,oemNumber,price
  const idx = (name: string) => header.indexOf(name);
  const iMachine = idx("machineId");
  const iName = idx("partName");
  const iMatch = idx("matchType");
  const iSource = idx("partSource");
  const iSku = idx("sku");
  const iBrand = idx("brand");

  // 预加载关联表，内存解析（避免逐行查库）
  const parts = await prisma.part.findMany({ select: { id: true, sku: true } });
  const skuMap = new Map<string, string>();
  for (const p of parts) skuMap.set(p.sku, p.id);

  const legacies = await prisma.partLegacy.findMany({
    select: { id: true, nameZh: true, brand: true },
  });
  const legacyMap = new Map<string, string>();
  for (const p of legacies) legacyMap.set(`${p.nameZh}||${p.brand}`, p.id);

  const data: {
    machineId: string;
    partId: string;
    partSource: string;
    matchType: string;
    rank: number;
  }[] = [];

  let skippedPart = 0;
  let skippedLegacy = 0;
  const rankCounter = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    const machineId = c[iMachine];
    const partName = c[iName];
    const matchType = c[iMatch];
    const partSource = c[iSource];
    const sku = c[iSku];
    const brand = c[iBrand];

    let partId: string | undefined;
    if (partSource === "Part") {
      partId = sku ? skuMap.get(sku) : undefined;
      if (!partId) skippedPart++;
    } else {
      // part_legacy：先按 (nameZh, brand)，否则仅按 nameZh 兜底
      partId = legacyMap.get(`${partName}||${brand}`);
      if (!partId) {
        const fallback = legacies.find((p) => p.nameZh === partName);
        partId = fallback?.id;
      }
      if (!partId) skippedLegacy++;
    }
    if (!partId) continue;

    const rank = (rankCounter.get(machineId) ?? 0) + 1;
    rankCounter.set(machineId, rank);

    data.push({ machineId, partId, partSource, matchType, rank });
  }

  // 幂等：先清空再全量插入
  const before = await prisma.machinePart.count();
  await prisma.machinePart.deleteMany({});
  // 分批插入（每 500 条），降低单次事务压力
  const BATCH = 500;
  for (let i = 0; i < data.length; i += BATCH) {
    await prisma.machinePart.createMany({ data: data.slice(i, i + BATCH) });
  }

  console.log("=== MachinePart 灌数完成 ===");
  console.log(`CSV 数据行（不含表头）: ${lines.length - 1}`);
  console.log(`本次插入: ${data.length}`);
  console.log(`清空前已有: ${before}`);
  console.log(`跳过-Part(sku未匹配): ${skippedPart}`);
  console.log(`跳过-Legacy(名称未匹配): ${skippedLegacy}`);
  console.log(`覆盖机器数: ${rankCounter.size}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
