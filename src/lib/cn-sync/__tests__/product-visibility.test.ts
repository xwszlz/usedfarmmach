/**
 * 网站端可见性单元测试（scope-fix）
 *
 * 运行：npm run test:cn-sync-scope
 *       （等价：npx tsx src/lib/cn-sync/__tests__/product-visibility.test.ts）
 * （仓库未引入 vitest / jest，沿用 Stage1 同款「node:assert 断言脚本」，退出码非 0 即失败）
 *
 * ⚠️ 本测试**不触碰任何数据库 / 网络**：
 * - `buildWebsiteVisibleWhere` 为纯函数（只依赖 @prisma/client 的**类型**），直接断言其输出结构；
 * - 「SQL 三值逻辑」用零依赖的纯 TS 三值求值器复现（AND/OR/NOT 在 NULL 上的传播），
 *   并对照下方注释中**实测得到的 Prisma 生成 SQL**，证明旧口径会静默丢行、新口径不会。
 */
import assert from "node:assert/strict";
import {
  MINIAPP_SELLER_EMAIL,
  buildWebsiteVisibleWhere,
} from "@/lib/product-visibility";

let passed = 0;
const failures: string[] = [];

async function it(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`  \u2717 ${name}\n      ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ────────────────────────── SQL 三值逻辑纯函数求值器（依赖零） ──────────────────────────
// 复刻 SQL 标准三值逻辑：AND 有 false 则 false，否则有 null 则 null；
// OR 有 true 则 true，否则有 null 则 null；NOT null = null。
type Tri = boolean | null;

function triNot(v: Tri): Tri {
  return v === null ? null : !v;
}
function triAnd(...vals: Tri[]): Tri {
  if (vals.some((v) => v === false)) return false;
  if (vals.some((v) => v === null)) return null;
  return true;
}
function triOr(...vals: Tri[]): Tri {
  if (vals.some((v) => v === true)) return true;
  if (vals.some((v) => v === null)) return null;
  return false;
}
/** 仅当求值为 TRUE 时才算「命中」（NULL / FALSE 都不命中） */
function selected(v: Tri): boolean {
  return v === true;
}

/**
 * 旧口径（已实测的 Prisma 5.22 生成 SQL，来自 .prisma-proof 复现实验）：
 *   LEFT JOIN "User" AS j1 ON j1.id = Product.sellerId       -- 分支1 的卖家
 *   LEFT JOIN "User" AS j2 ON j2.id = Product.sellerId       -- 分支2 的卖家
 *   LEFT JOIN "Brand" AS j3 ON j3.id = Product.brandId
 *   WHERE (
 *     (Product.status = $1 AND (NOT (j1.email = $2 AND (j1.id IS NOT NULL))))
 *     OR
 *     (Product.status = $3 AND (j2.email = $4 AND (j2.id IS NOT NULL))
 *                          AND (j3.isImported = $5 AND (j3.id IS NOT NULL)))
 *   )
 * 当卖家 email 为 NULL 时：j1.email = $2 → NULL；NULL AND TRUE → NULL；NOT NULL → NULL。
 */
function oldClauseSelects(sellerEmail: string | null, isImported: boolean): boolean {
  const MINIAPP = MINIAPP_SELLER_EMAIL;
  const eqEmail: Tri = sellerEmail === null ? null : sellerEmail === MINIAPP;
  const sellerExists: Tri = true; // 关联卖家一定存在（sellerId 为必填外键）
  const branch1 = triAnd(true /*status=active*/, triNot(triAnd(eqEmail, sellerExists)));
  const branch2 = triAnd(true /*status=active*/, triAnd(eqEmail, sellerExists), isImported);
  return selected(triOr(branch1, branch2));
}

/**
 * 新口径（实测 Prisma 生成 SQL）：
 *   LEFT JOIN "Brand" AS j1 ON j1.id = Product.brandId
 *   WHERE (Product.status = $1 AND (Product.sellerId <> $2 OR (j1.isImported = $3 AND (j1.id IS NOT NULL))))
 * Product.sellerId 为 NOT NULL 列 → `sellerId <> $2` 只会是 TRUE/FALSE，永不为 NULL。
 */
function newClauseSelects(sellerIsMiniapp: boolean, isImported: boolean): boolean {
  const notMiniapp: Tri = !sellerIsMiniapp; // sellerId <> miniappId（NOT NULL → 二值）
  return selected(triAnd(true /*status=active*/, triOr(notMiniapp, isImported)));
}

async function main(): Promise<void> {
  console.log("product-visibility 单元测试（scope-fix）");

  // ── 1. 结构：使用 sellerId 标量比较，绝不再用嵌套 relation 的 seller.email ──
  await it("buildWebsiteVisibleWhere(id)：= status active AND (sellerId≠id OR isImported)", () => {
    const w = buildWebsiteVisibleWhere("cmut_min_id");
    assert.deepEqual(w, {
      status: "active",
      OR: [{ sellerId: { not: "cmut_min_id" } }, { brand: { isImported: true } }],
    });
  });

  await it("buildWebsiteVisibleWhere(id)：序列化后不含 seller / email（无三值逻辑入口）", () => {
    const json = JSON.stringify(buildWebsiteVisibleWhere("cmut_min_id"));
    assert.ok(!/"seller"\s*:/.test(json), `where 不应再含 seller relation：${json}`);
    assert.ok(!json.includes("email"), `where 不应再含 email 字段：${json}`);
    assert.ok(json.includes("sellerId"), `where 应使用 sellerId：${json}`);
  });

  // ── 2. 安全退化：查不到小程序账号 → 不排除任何人（绝不静默丢产品） ──
  await it("buildWebsiteVisibleWhere(null)：安全退化为 { status:'active' }（不排除任何人）", () => {
    const w = buildWebsiteVisibleWhere(null);
    assert.deepEqual(w, { status: "active" });
    const json = JSON.stringify(w);
    assert.ok(!json.includes("sellerId"), "退化时不应存在 sellerId 排除条件");
    assert.ok(!json.includes("OR"), "退化时不应存在 OR 排除条件");
  });

  await it("buildWebsiteVisibleWhere(\"\")：空串同样安全退化", () => {
    assert.deepEqual(buildWebsiteVisibleWhere(""), { status: "active" });
  });

  // ── 3. SQL 三值逻辑：证明旧口径丢弃 email IS NULL 的产品、新口径不丢 ──
  await it("旧口径：卖家 email=NULL 的进口品牌产品被静默丢弃（NULL 非 TRUE）", () => {
    // 这正是 .cn 上 19 台「卖家非小程序账号」产品从可见集消失的机制
    assert.equal(oldClauseSelects(null, true), false, "email=NULL 时旧口径不应命中");
    assert.equal(oldClauseSelects(null, false), false);
  });

  await it("新口径：卖家 email=NULL 的进口品牌产品被正确纳入", () => {
    assert.equal(newClauseSelects(false /*非小程序账号*/, true), true);
  });

  // ── 4. 其余组合：新旧口径语义一致（三值逻辑修复不改判定语义） ──
  await it("两类口径在 {小程序,进口} 组合上语义一致（唯一差异在 email=NULL 行）", () => {
    // 小程序账号
    assert.equal(oldClauseSelects(MINIAPP_SELLER_EMAIL, true), true);
    assert.equal(newClauseSelects(true, true), true);
    assert.equal(oldClauseSelects(MINIAPP_SELLER_EMAIL, false), false);
    assert.equal(newClauseSelects(true, false), false);
    // 普通卖家（email 非空、非小程序）
    assert.equal(oldClauseSelects("someone@example.com", true), true);
    assert.equal(newClauseSelects(false, true), true);
    assert.equal(oldClauseSelects("someone@example.com", false), true);
    assert.equal(newClauseSelects(false, false), true);
  });

  console.log(`\n结果：${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.error("失败用例：", failures.join(" | "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
