/**
 * 将导出的 JSON 数据导入到 PostgreSQL（通过 Prisma）
 * 使用方式：DATABASE_URL="postgresql://..." node scripts/import-to-postgres.js
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

async function main() {
  const dataPath = path.join(__dirname, "..", "data-export.json");
  if (!fs.existsSync(dataPath)) {
    console.error("data-export.json not found. Run export-sqlite-data.js first.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const prisma = new PrismaClient();

  // SQLite → PostgreSQL 类型转换
  const booleanFields = new Set([
    'Brand.isImported',
    'Product.aiGenerated',
    'ProductImage.isPrimary',
  ]);
  const dateFields = new Set(['createdAt', 'updatedAt']);
  function convertRow(table, row) {
    const converted = { ...row };
    for (const key of Object.keys(converted)) {
      if (booleanFields.has(`${table}.${key}`)) {
        converted[key] = converted[key] === 1;
      } else if (dateFields.has(key) && typeof converted[key] === 'number') {
        converted[key] = new Date(converted[key]).toISOString();
      }
    }
    return converted;
  }

  console.log("Starting import to PostgreSQL...\n");

  // 1. Brands (no dependencies)
  console.log(`Importing ${data.Brand.length} brands...`);
  for (const row of data.Brand) {
    const c = convertRow('Brand', row);
    await prisma.brand.upsert({ where: { id: c.id }, update: c, create: c });
  }

  // 2. Categories (self-referencing, upsert without parentId first, then update)
  console.log(`Importing ${data.Category.length} categories...`);
  for (const row of data.Category) {
    const c = convertRow('Category', row);
    await prisma.category.upsert({
      where: { id: c.id },
      update: { nameZh: c.nameZh, nameEn: c.nameEn, parentId: c.parentId },
      create: { id: c.id, nameZh: c.nameZh, nameEn: c.nameEn },
    });
  }
  // Update parentId references
  for (const row of data.Category) {
    if (row.parentId) {
      await prisma.category.update({
        where: { id: row.id },
        data: { parentId: row.parentId },
      });
    }
  }

  // 3. Users
  console.log(`Importing ${data.User.length} users...`);
  for (const row of data.User) {
    const c = convertRow('User', row);
    await prisma.user.upsert({ where: { id: c.id }, update: c, create: c });
  }

  // 4. Products
  console.log(`Importing ${data.Product.length} products...`);
  for (const row of data.Product) {
    const c = convertRow('Product', row);
    await prisma.product.upsert({ where: { id: c.id }, update: c, create: c });
  }

  // 5. Product Images
  console.log(`Importing ${data.ProductImage.length} product images...`);
  for (const row of data.ProductImage) {
    const c = convertRow('ProductImage', row);
    await prisma.productImage.upsert({ where: { id: c.id }, update: c, create: c });
  }

  // 6. Product Videos
  console.log(`Importing ${data.ProductVideo.length} product videos...`);
  for (const row of data.ProductVideo) {
    const c = convertRow('ProductVideo', row);
    await prisma.productVideo.upsert({ where: { id: c.id }, update: c, create: c });
  }

  // 7. International Prices
  console.log(`Importing ${data.InternationalPrice.length} international prices...`);
  for (const row of data.InternationalPrice) {
    const c = convertRow('InternationalPrice', row);
    await prisma.internationalPrice.upsert({ where: { id: c.id }, update: c, create: c });
  }

  // 8. Remaining tables (if any data)
  if (data.Demand?.length) {
    console.log(`Importing ${data.Demand.length} demands...`);
    for (const row of data.Demand) {
      const c = convertRow('Demand', row);
      await prisma.demand.upsert({ where: { id: c.id }, update: c, create: c });
    }
  }
  if (data.Inquiry?.length) {
    console.log(`Importing ${data.Inquiry.length} inquiries...`);
    for (const row of data.Inquiry) {
      const c = convertRow('Inquiry', row);
      await prisma.inquiry.upsert({ where: { id: c.id }, update: c, create: c });
    }
  }
  if (data.Valuation?.length) {
    console.log(`Importing ${data.Valuation.length} valuations...`);
    for (const row of data.Valuation) {
      const c = convertRow('Valuation', row);
      await prisma.valuation.upsert({ where: { id: c.id }, update: c, create: c });
    }
  }

  console.log("\n✅ Import completed successfully!");

  // Verify counts
  const counts = {
    brands: await prisma.brand.count(),
    categories: await prisma.category.count(),
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    images: await prisma.productImage.count(),
    videos: await prisma.productVideo.count(),
    prices: await prisma.internationalPrice.count(),
  };
  console.log("\nVerification:");
  console.table(counts);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
