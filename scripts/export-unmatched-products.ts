/**
 * 导出「国际价待补录清单」CSV —— 人工补录流程第 1 步
 *
 * 输出：还没有任何国际比价的库存机型，按国内售价降序（高价值优先补）。
 * 运营拿到这份清单，去 Agroline / e-farm / Mascus 搜同型号，
 * 把「价格 + 币种 + 源站 + 链接」填进 manual-prices-template.csv。
 *
 * 运行：
 *   DATABASE_URL="..." npx tsx scripts/export-unmatched-products.ts [输出路径]
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

const OUT =
  process.argv[2] ||
  "D:/神雕农机/神雕日报/国际价待补录清单.csv";

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: {
      id: true, modelName: true, year: true, priceCny: true,
      brand: { select: { nameZh: true, nameEn: true } },
      category: { select: { nameZh: true } },
      internationalPrices: { select: { id: true, sourceUrl: true } },
    },
    orderBy: { priceCny: "desc" },
  });

  // 只导出"一条国际价都没有"的产品（有价的不重复劳动）
  const unmatched = products.filter((p) => p.internationalPrices.length === 0);
  const total = products.length;
  const matched = total - unmatched.length;

  const header = [
    "品牌(中文)", "英文品牌", "型号", "年份", "国内售价(万元)",
    "品类", "国际价格", "币种", "源站", "源链接(sourceUrl)", "备注",
  ];
  const lines = [header.join(",")];
  for (const p of unmatched) {
    lines.push(
      [
        p.brand?.nameZh || "",
        p.brand?.nameEn || "",
        p.modelName || "",
        p.year ?? "",
        (p.priceCny / 10000).toFixed(1),
        p.category?.nameZh || "",
        "", // 国际价格：运营填
        "EUR", // 币种：默认 EUR，美元源改 USD
        "agroline", // 源站：agroline / efarm / mascus / tractorhouse
        "", // 源链接：必填（不填不计入"真实配对"）
        "",
      ]
        .map((v) => (String(v).includes(",") ? `"${v}"` : String(v)))
        .join(",")
    );
  }

  fs.writeFileSync(OUT, "\uFEFF" + lines.join("\n"), { encoding: "utf-8" });

  console.log("=== 国际价待补录清单已导出 ===");
  console.log(`在库总台数：${total}`);
  console.log(`已有国际比价：${matched} 台（${((matched / total) * 100).toFixed(1)}%）`);
  console.log(`待补录：${unmatched.length} 台（${((unmatched.length / total) * 100).toFixed(1)}%）`);
  console.log(`输出：${OUT}`);
  console.log("\n（已按国内售价降序 = 高价值机型优先补，先补前 20 台收益最大）");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
