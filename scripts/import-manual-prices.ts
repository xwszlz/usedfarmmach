/**
 * 人工补录国际价入库 —— 人工补录流程第 3 步
 *
 * 输入：运营填好的 CSV（列顺序见 manual-prices-template.csv）
 * 输出：逐行匹配站内 Product（用 ModelAlias 归一化）→ upsert 到 InternationalPrice
 *      - 必须带 sourceUrl，才算"真实硬配对"（不带链接的按 AI 估算处理，置信度低）
 *      - source 记为 `manual:<源站>`，与自动抓取区分，便于追溯
 *
 * 运行（先 dry-run 看命中情况，再加 --write 落库）：
 *   DATABASE_URL="..." npx tsx scripts/import-manual-prices.ts <csv路径>
 *   DATABASE_URL="..." npx tsx scripts/import-manual-prices.ts <csv路径> --write
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import { resolveModelCandidates, normalizeModel } from "../src/lib/model-alias";

const prisma = new PrismaClient();
const DEFAULT_EUR_CNY = 7.91;
const DEFAULT_USD_CNY = 7.25;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    // 极简 CSV：支持双引号包裹含逗号字段
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i];
      if (ch === '"') {
        if (inQ && rawLine[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
}

async function main() {
  const csvPath = process.argv[2];
  const doWrite = process.argv.includes("--write");
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error("用法: npx tsx scripts/import-manual-prices.ts <csv路径> [--write]");
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf-8"));
  const header = rows.shift();
  console.log(`读取 ${rows.length} 行 | 表头: ${header?.slice(0, 6).join("/")}...`);
  console.log(`模式: ${doWrite ? "写入数据库" : "DRY-RUN（只预览，加 --write 才落库）"}\n`);

  let matched = 0, unmatched = 0, written = 0, updated = 0, skipped = 0;

  for (const r of rows) {
    const [brandZh, brandEn, model, yearStr, , , priceStr, currency, site, url, note] = r;
    const price = parseFloat(String(priceStr || "").replace(/,/g, ""));
    if (!brandZh || !model || !price) { skipped++; continue; }

    // 1) 品牌 → brandId
    const brand = await prisma.brand.findFirst({
      where: { OR: [{ nameZh: brandZh }, { nameEn: brandEn || brandZh }] },
      select: { id: true, nameZh: true },
    });
    if (!brand) { console.log(`  ✗ 品牌未识别: ${brandZh}`); unmatched++; continue; }

    // 2) 型号 → Product（ModelAlias 归一化候选，优先同年）
    const year = parseInt(yearStr, 10) || null;
    const candidates = resolveModelCandidates(brand.id, model);
    let product: { id: string; modelName: string } | null = null;
    for (const c of candidates) {
      const p = await prisma.product.findFirst({
        where: {
          brandId: brand.id,
          modelName: { startsWith: c, mode: "insensitive" },
          ...(year ? { year } : {}),
        },
        select: { id: true, modelName: true },
      });
      if (p) { product = p; break; }
    }
    if (!product) {
      // 退一步：不带年份再找
      for (const c of candidates) {
        const p = await prisma.product.findFirst({
          where: { brandId: brand.id, modelName: { startsWith: c, mode: "insensitive" } },
          select: { id: true, modelName: true },
        });
        if (p) { product = p; break; }
      }
    }
    if (!product) { console.log(`  ✗ 无匹配库存: ${brandZh} ${model}`); unmatched++; continue; }

    matched++;
    const cur = (currency || "EUR").toUpperCase();
    const rate = cur === "USD" ? DEFAULT_USD_CNY : DEFAULT_EUR_CNY;
    const priceCny = Math.round(price * rate);
    const source = `manual:${(site || "unknown").toLowerCase()}`;
    const confidence = url ? 0.9 : 0.4; // 有链接才算硬配对

    console.log(
      `  ✓ ${brand.nameZh} ${model} → 库存[${product.modelName}] ${cur} ${price} ≈ ¥${(priceCny / 10000).toFixed(1)}万 ` +
      `${url ? "(有链接)" : "(⚠️无链接=低置信)"}`
    );

    if (!doWrite) continue;

    const existing = await prisma.internationalPrice.findFirst({
      where: { productId: product.id, source },
    });
    const data = {
      productId: product.id,
      priceForeignCny: priceCny,
      priceForeignRaw: price,
      currency: cur,
      exchangeRate: rate,
      source,
      sourceUrl: url || null,
      sourceDate: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
      country: cur === "USD" ? "US" : "DE",
      confidenceScore: confidence,
      isActive: true,
      lastVerified: new Date(),
      notes: note ? `manual:${note}` : "manual:人工补录",
    };
    if (existing) {
      await prisma.internationalPrice.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.internationalPrice.create({ data });
      written++;
    }
  }

  console.log("\n=== 汇总 ===");
  console.log(`匹配库存：${matched} 行 | 未匹配：${unmatched} 行 | 跳过（缺字段）：${skipped} 行`);
  if (doWrite) console.log(`新建 ${written} 条 / 更新 ${updated} 条 InternationalPrice`);
  else console.log("（DRY-RUN，未写库）");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
