/**
 * 一次性数据迁移脚本：从 Product.location 文本智能提取 country/province/city
 *
 * 运行方式：npx tsx scripts/migrate-product-locations.ts
 *
 * 迁移逻辑：
 * 1. 查询所有 location 非空但 country 为 null 的产品
 * 2. 使用 parseLocationText 解析 location 文本
 * 3. 批量更新结构化字段
 * 4. 输出统计信息
 */

import { PrismaClient } from "@prisma/client";
import { parseLocationText, isInvalidLocation } from "../src/lib/location-parser";

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  updated: number;
  domestic: number;
  international: number;
  unrecognized: number;
  skipped: number;
  errors: number;
}

async function migrateProductLocations(): Promise<void> {
  console.log("=".repeat(60));
  console.log("产品产地结构化迁移脚本");
  console.log("=".repeat(60));
  console.log();

  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    domestic: 0,
    international: 0,
    unrecognized: 0,
    skipped: 0,
    errors: 0,
  };

  // 查询所有 location 非空但 country 为 null 的产品
  const products = await prisma.product.findMany({
    where: {
      AND: [
        { location: { not: "" } },
        { country: null },
      ],
    },
    select: { id: true, location: true },
  });

  stats.total = products.length;
  console.log(`找到 ${stats.total} 条待迁移产品记录`);
  console.log();

  if (products.length === 0) {
    console.log("没有需要迁移的记录，退出。");
    return;
  }

  // 批量处理（每批 100 条）
  const batchSize = 100;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(products.length / batchSize);
    console.log(`处理批次 ${batchNumber}/${totalBatches} (${batch.length} 条)...`);

    for (const product of batch) {
      try {
        // 过滤无效地名
        if (isInvalidLocation(product.location)) {
          stats.skipped++;
          continue;
        }

        const parsed = parseLocationText(product.location);

        if (!parsed.country) {
          stats.unrecognized++;
          continue;
        }

        // 更新产品记录
        await prisma.product.update({
          where: { id: product.id },
          data: {
            country: parsed.country,
            province: parsed.province,
            city: parsed.city,
          },
        });

        stats.updated++;
        if (parsed.country === "CN") {
          stats.domestic++;
        } else {
          stats.international++;
        }
      } catch (error) {
        console.error(`  ❌ 产品 ${product.id} 迁移失败:`, error);
        stats.errors++;
      }
    }
  }

  // 输出统计
  console.log();
  console.log("=".repeat(60));
  console.log("迁移完成，统计信息：");
  console.log("=".repeat(60));
  console.log(`  总记录数:     ${stats.total}`);
  console.log(`  成功更新:     ${stats.updated}`);
  console.log(`    - 国内:     ${stats.domestic}`);
  console.log(`    - 国际:     ${stats.international}`);
  console.log(`  跳过(无效):   ${stats.skipped}`);
  console.log(`  未识别:       ${stats.unrecognized}`);
  console.log(`  错误:         ${stats.errors}`);
  console.log();
}

// 主函数
async function main(): Promise<void> {
  try {
    await migrateProductLocations();
  } catch (error) {
    console.error("迁移脚本执行失败:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
