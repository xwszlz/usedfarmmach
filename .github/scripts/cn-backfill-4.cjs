/* 由 .com(Neon) 实时读取 4 台产品的完整数据，生成「保留 cuid 的幂等迁移 SQL」。
 *
 * 运行环境：GitHub Actions runner（一次性运维用）。数据只存在于 runner 内存/临时文件，
 *           绝不写入仓库、绝不打印到日志（含坐标）。
 *
 * 用法：NEON_DATABASE_URL=... OUT_DIR=/tmp/out node cn-backfill-4.cjs
 * 产出：$OUT_DIR/m4.sql  +  $OUT_DIR/COUNT  +  $OUT_DIR/SHA
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

const IDS = [
  "cmt8118vg0001jhumfgdnpu8g", // 900  ASA-Lift
  "cmtl8qfaj0001gwhn8unknfs6", // 2204 CLAAS
  "cmtl8vec1000112latf9umzj2", // VbP3165 Kuhn
  "cmtlcygjh000l12lamht6peta", // F125xc Krone
];
const SELLER_EMAIL = "miniprogram@shendiao.com";
const OUT_DIR = process.env.OUT_DIR || "/tmp/out";

/* ---------- SQL 字面量 ---------- */
const quote = (s) => "'" + String(s).replace(/'/g, "''") + "'";
function q(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (v instanceof Date) return quote(v.toISOString());
  return quote(v);
}
const ts = (v) => (v === null || v === undefined ? "NULL" : quote(v instanceof Date ? v.toISOString() : String(v)) + "::timestamptz");
const ident = (n) => '"' + String(n).replace(/"/g, '""') + '"';

/* ---------- 品牌 / 分类：按名解析（不照搬 .com 的 id） ---------- */
function brandConds(b) {
  const conds = [`"nameZh" = ${quote(b.nameZh)}`];
  if (b.nameEn) conds.push(`lower("nameEn") = ${quote(String(b.nameEn).toLowerCase())}`);
  if (b.expoSlug) conds.push(`"expoSlug" = ${quote(b.expoSlug)}`); // 唯一约束，必须复用
  return conds.join(" OR ");
}
const brandLookupExpr = (b) => `(SELECT id FROM "Brand" WHERE (${brandConds(b)}) ORDER BY "isImported" DESC, id LIMIT 1)`;
function categoryLookupExpr(c) {
  const conds = [`"nameZh" = ${quote(c.nameZh)}`];
  if (c.nameEn) conds.push(`lower("nameEn") = ${quote(String(c.nameEn).toLowerCase())}`);
  return `(SELECT id FROM "Category" WHERE (${conds.join(" OR ")}) ORDER BY id LIMIT 1)`;
}
const BRAND_COLS = ["nameZh","nameEn","originCountry","isImported","nameRu","nameEs","namePt","nameAr","nameFr","nameHi","brandTier","establishedYear","expoCoverUrl","expoLogoUrl","expoSlug","expoStory","exportVolume","isChineseBrand","officialWebsite"];
const CATEGORY_COLS = ["nameZh","nameEn","nameRu","nameEs","namePt","nameAr","nameFr","nameHi","viewCount"];

function brandEnsureSql(b) {
  const cols = ["id", ...BRAND_COLS];
  const vals = ["'cnb' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)", ...BRAND_COLS.map((c) => q(b[c]))];
  return `INSERT INTO "Brand" (${cols.map(ident).join(",")})\n  SELECT ${vals.join(",")}\n  WHERE NOT EXISTS (${brandLookupExpr(b)});`;
}
function categoryEnsureSql(c) {
  const cols = ["id", "nameZh", "nameEn", "parentId", "nameRu", "nameEs", "namePt", "nameAr", "nameFr", "nameHi", "viewCount"];
  const vals = [
    "'cnc' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)",
    q(c.nameZh), q(c.nameEn), "NULL",
    q(c.nameRu), q(c.nameEs), q(c.namePt), q(c.nameAr), q(c.nameFr), q(c.nameHi), q(c.viewCount),
  ];
  return `INSERT INTO "Category" (${cols.map(ident).join(",")})\n  SELECT ${vals.join(",")}\n  WHERE NOT EXISTS (${categoryLookupExpr(c)});`;
}
function sellerEnsureSql() {
  return `INSERT INTO "User" ("id","email","passwordHash","role","companyName","country","preferredLanguage","credits","isActive","username")\n`
    + `  SELECT 'cnsys' || substr(md5(random()::text || clock_timestamp()::text), 1, 24), ${quote(SELLER_EMAIL)},\n`
    + `         'x', 'seller', '小程序发布', 'CN', 'zh', 999999, true, 'miniprogram'\n`
    + `  WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = ${quote(SELLER_EMAIL)});`;
}

/* ---------- 产品 / 图片 / 视频 ---------- */
const PRODUCT_SKIP = new Set(["id", "brand", "category", "images", "videos", "seller"]);
const TS_FIELDS = new Set(["createdAt", "updatedAt", "promotedUntil", "promotedAt", "refreshedAt"]);

function productInsertSql(p) {
  const cols = ["id", "sellerId", "brandId", "categoryId"];
  const vals = [
    quote(p.id),
    `(SELECT id FROM "User" WHERE "email" = ${quote(SELLER_EMAIL)} LIMIT 1)`,
    brandLookupExpr(p.brand),
    categoryLookupExpr(p.category),
  ];
  for (const k of Object.keys(p)) {
    if (PRODUCT_SKIP.has(k) || k === "sellerId" || k === "brandId" || k === "categoryId") continue;
    cols.push(k);
    vals.push(TS_FIELDS.has(k) ? ts(p[k]) : q(p[k]));
  }
  return `INSERT INTO "Product" (${cols.map(ident).join(",")})\n  VALUES (${vals.join(",")})\n  ON CONFLICT ("id") DO NOTHING;`;
}
function imageInsertSql(p) {
  return (p.images || []).map((im) => {
    const cols = ["id", "productId", "url", "sortOrder", "isPrimary", "angleLabel"];
    const vals = [quote(im.id), quote(p.id), quote(im.url), q(im.sortOrder), q(im.isPrimary), q(im.angleLabel)];
    return `INSERT INTO "ProductImage" (${cols.map(ident).join(",")}) VALUES (${vals.join(",")}) ON CONFLICT ("id") DO NOTHING;`;
  });
}
function videoInsertSql(p) {
  return (p.videos || []).map((v) => {
    const cols = ["id", "productId", "url", "sortOrder", "title", "duration", "fileSize", "moderatedAt", "moderationStatus", "playCount"];
    const vals = [quote(v.id), quote(p.id), quote(v.url), q(v.sortOrder), q(v.title), q(v.duration), q(v.fileSize), ts(v.moderatedAt), q(v.moderationStatus), q(v.playCount)];
    return `INSERT INTO "ProductVideo" (${cols.map(ident).join(",")}) VALUES (${vals.join(",")}) ON CONFLICT ("id") DO NOTHING;`;
  });
}

/* ---------- 主流程 ---------- */
function cleanUrl(raw) {
  let s = String(raw).trim().replace(/^["']|["']$/g, "");
  const u = new URL(s);
  u.searchParams.delete("schema");
  return u.toString();
}

(async () => {
  const client = new Client({
    connectionString: cleanUrl(process.env.NEON_DATABASE_URL || ""),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: products } = await client.query(
    `SELECT p.*, row_to_json(b) AS __brand, row_to_json(c) AS __category
       FROM "Product" p
       JOIN "Brand" b ON b.id = p."brandId"
       JOIN "Category" c ON c.id = p."categoryId"
      WHERE p.id = ANY($1::text[])`,
    [IDS]
  );
  const { rows: images } = await client.query(
    `SELECT * FROM "ProductImage" WHERE "productId" = ANY($1::text[]) ORDER BY "sortOrder" ASC`,
    [IDS]
  );
  const { rows: videos } = await client.query(
    `SELECT * FROM "ProductVideo" WHERE "productId" = ANY($1::text[]) ORDER BY "sortOrder" ASC`,
    [IDS]
  );
  await client.end();

  if (products.length !== IDS.length) {
    throw new Error(`expected ${IDS.length} products, got ${products.length}`);
  }

  const out = products.map((row) => {
    const { __brand, __category, ...rest } = row;
    return {
      ...rest,
      brand: __brand,
      category: __category,
      images: images.filter((i) => i.productId === row.id),
      videos: videos.filter((v) => v.productId === row.id),
    };
  });

  const idList = out.map((p) => quote(p.id)).join(",");
  const L = [];
  L.push("-- .cn 反向迁移：把 4 台「只在 .com」的国际品牌产品补进 .cn（保留 cuid，幂等）");
  L.push(`-- 生成时间：${new Date().toISOString()}`);
  L.push("");
  L.push("-- ===== 预检（只读）=====");
  L.push("\\echo '--- P1 这 4 个 id 在 .cn 是否已存在（期望 0）---'");
  L.push(`SELECT count(*) AS already_exist FROM "Product" WHERE id IN (${idList});`);
  L.push("\\echo '--- P2 系统卖家（期望 1 行）---'");
  L.push(`SELECT id, email FROM "User" WHERE email = ${quote(SELLER_EMAIL)};`);
  L.push("\\echo '--- P3 相关品牌（期望按名命中；未命中会自动补建）---'");
  for (const p of out) {
    L.push(`SELECT ${quote(p.modelName)} AS for_model, id, "nameZh", "isImported" FROM "Brand" WHERE (${brandConds(p.brand)});`);
  }
  L.push("\\echo '--- P4 .cn 当前 Product 是否具备本脚本用到的全部列（期望 0 行 = 无缺失）---'");
  const colNames = out[0]
    ? Object.keys(out[0]).filter((k) => !["brand", "category", "images", "videos"].includes(k))
    : [];
  L.push(
    `SELECT c AS missing_column FROM unnest(ARRAY[${colNames.map(quote).join(",")}]::text[]) AS c` +
    ` WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns` +
    ` WHERE table_schema='public' AND table_name='Product' AND column_name = c);`
  );
  L.push("");
  L.push("-- ===== 正式迁移（单事务，出错全回滚）=====");
  L.push("BEGIN;");
  L.push(sellerEnsureSql());
  for (const p of out) {
    L.push("");
    L.push(`-- ===== ${p.modelName} / ${p.year} =====`);
    L.push(brandEnsureSql(p.brand));
    L.push(categoryEnsureSql(p.category));
    L.push(productInsertSql(p));
    for (const s of imageInsertSql(p)) L.push(s);
    for (const s of videoInsertSql(p)) L.push(s);
  }
  L.push("COMMIT;");
  L.push("");
  L.push("-- ===== 核对（期望 4 行）=====");
  L.push(
    `SELECT p.id, p."modelName", p.year, p.status, b."nameZh" AS brand_zh, c."nameZh" AS cat_zh,` +
    ` (SELECT count(*) FROM "ProductImage" i WHERE i."productId"=p.id) AS imgs,` +
    ` (SELECT count(*) FROM "ProductVideo" v WHERE v."productId"=p.id) AS vids,` +
    ` (p."brandId" IS NULL OR p."categoryId" IS NULL OR p."sellerId" IS NULL) AS has_null_fk` +
    ` FROM "Product" p LEFT JOIN "Brand" b ON b.id=p."brandId" LEFT JOIN "Category" c ON c.id=p."categoryId"` +
    ` WHERE p.id IN (${idList}) ORDER BY p.id;`
  );

  const sql = L.join("\n") + "\n";
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "m4.sql"), sql, "utf8");

  // dry-run 用片段：只保留 BEGIN 之前的只读预检（全部是 SELECT，零写入）。
  const MARK = "-- ===== 正式迁移（单事务，出错全回滚）=====";
  const cut = L.findIndex((ln) => ln === MARK);
  const pre = (cut > 0 ? L.slice(0, cut) : L).join("\n") + "\n";
  if (cut <= 0) throw new Error("未找到事务分界标记，拒绝产出 dry-run 片段");
  fs.writeFileSync(path.join(OUT_DIR, "m4.pre.sql"), pre, "utf8");

  fs.writeFileSync(path.join(OUT_DIR, "SHA"), crypto.createHash("sha256").update(sql, "utf8").digest("hex"), "utf8");

  // 只打印「可公开」的摘要：id / 机型 / 年份 / 品牌名 / 分类名 / 图片视频数 / 字节数 / sha
  console.log("products=" + out.length + " bytes=" + Buffer.byteLength(sql, "utf8"));
  for (const p of out) {
    console.log(`  ${p.id} | ${p.modelName} | ${p.year} | ${p.brand.nameZh}(${p.brand.isImported}) | ${p.category.nameZh} | imgs=${p.images.length} vids=${p.videos.length} | status=${p.status}`);
  }
  console.log("sha256=" + fs.readFileSync(path.join(OUT_DIR, "SHA"), "utf8"));
  console.log("coord_present=" + out.filter((p) => p.latitude !== null && p.longitude !== null).length);
})().catch((e) => {
  console.error("FAILED: " + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
