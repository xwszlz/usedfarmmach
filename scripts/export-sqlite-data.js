/**
 * 从 SQLite 导出所有数据为 JSON，用于迁移到 PostgreSQL
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

// 临时用 SQLite 连接
process.env.DATABASE_URL = "file:./prisma/dev.db";

async function main() {
  // 需要 SQLite 版本的 Prisma Client，先切换回 sqlite schema
  // 直接用 better-sqlite3 原生查询
  const Database = require("better-sqlite3");
  const dbPath = path.join(__dirname, "..", "prisma", "dev.db");
  
  if (!fs.existsSync(dbPath)) {
    console.error("SQLite database not found at:", dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  const tables = [
    "User",
    "Brand",
    "Category",
    "Product",
    "ProductImage",
    "ProductVideo",
    "InternationalPrice",
    "Demand",
    "Inquiry",
    "Valuation",
    "_prisma_migrations",
  ];

  const exportData = {};

  for (const table of tables) {
    try {
      const rows = db.prepare(`SELECT * FROM "${table}"`).all();
      exportData[table] = rows;
      console.log(`${table}: ${rows.length} rows`);
    } catch (e) {
      console.log(`${table}: skipped (not found or error)`);
    }
  }

  db.close();

  const outPath = path.join(__dirname, "..", "data-export.json");
  fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2), "utf-8");
  console.log(`\nExported to: ${outPath}`);
  console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
