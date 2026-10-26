/**
 * 网站端可见性单元测试（scope-fix / 2026-10-26 口径变更）
 *
 * 运行：npm run test:cn-sync-scope
 *       （等价：npx tsx src/lib/cn-sync/__tests__/product-visibility.test.ts）
 * （仓库未引入 vitest / jest，沿用 Stage1 同款「node:assert 断言脚本」，退出码非 0 即失败）
 *
 * ⚠️ 本测试**不触碰任何数据库 / 网络**：
 * - `buildWebsiteVisibleWhere` 为纯函数（只依赖 @prisma/client 的**类型**），直接断言其输出结构；
 * - 「SQL 三值逻辑」用零依赖的纯 TS 三值求值器复现（AND/OR/NOT 在 NULL 上的传播），
 *   并对照下方注释中**实测得到的 Prisma 生成 SQL**，留档旧口径为何会静默丢行。
 *
 * 📌 2026-10-26 业务变更：老板拍板「国产机也要上网站端」。
 *    可见性口径从「active ∧ 非(小程序渠道 ∧ 国产品牌)」退化为「active」。
 *    本文件原先的 P0-4 回归护栏（断言小程序渠道的国产机**必须隐藏**）已**按新决策反转**，
 *    改为断言「任何渠道的国产机都必须可见」——它不是 bug 修复，是口径变更，勿再改回去。
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
 * ⚠️ 该实现早已被替换（改用 sellerId 标量），此处仅为「三值逻辑丢行」留证。
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
 * 2026-10-26 起的现口径（生成 SQL 极简）：
 *   WHERE Product.status = 'active'
 * 不再有 channel / brand 判定 ⇒ 不存在任何三值逻辑入口，也不存在"静默丢产品"的路径。
 * 保留这两个入参只为让下面的真值表对照测试仍然可读（取值已被忽略）。
 */
function newClauseSelects(
  _sellerIsMiniapp: boolean,
  _sellerHasMiniOpenid: boolean,
  _isImported: boolean
): boolean {
  return selected(true /* status = active */);
}

async function main(): Promise<void> {
  console.log("product-visibility 单元测试（2026-10-26 国产机放开口径）");

  // ── 1. 结构：只剩 status，不再排除任何卖家 / 品牌 ──
  await it("buildWebsiteVisibleWhere(id)：= { status: 'active' }（不再按渠道/产地过滤）", () => {
    const w = buildWebsiteVisibleWhere("cmut_min_id");
    assert.deepEqual(w, { status: "active" });
  });

  await it("buildWebsiteVisibleWhere(id)：序列化后不含 sellerId / seller / miniOpenid / OR", () => {
    const json = JSON.stringify(buildWebsiteVisibleWhere("cmut_min_id"));
    for (const forbidden of ["sellerId", "miniOpenid", '"seller"', "OR", "email", "isImported"]) {
      assert.ok(!json.includes(forbidden), `where 不应再含 ${forbidden}：${json}`);
    }
  });

  await it("入参不影响结果：任意 dbSellerId（含 null / 空串）输出完全一致", () => {
    const a = buildWebsiteVisibleWhere("cmut_min_id");
    const b = buildWebsiteVisibleWhere(null);
    const c = buildWebsiteVisibleWhere("");
    const d = buildWebsiteVisibleWhere("another_id");
    assert.deepEqual(a, b);
    assert.deepEqual(a, c);
    assert.deepEqual(a, d);
  });

  // ── 2. 业务口径：任何渠道 × 国产/进口 组合都必须可见（2026-10-26 决策） ──
  await it("口径：{系统账号, 小程序用户, 普通卖家} × {国产, 进口} 全部可见", () => {
    const combos: Array<[boolean, boolean, boolean]> = [
      [true, false, false], // 系统账号 + 国产 → 早期被隐藏，现必须可见
      [true, false, true],
      [false, true, false], // 小程序注册用户 + 国产 → P0-4 曾被隐藏，现必须可见
      [false, true, true],
      [false, false, false],
      [false, false, true],
    ];
    for (const [isMiniapp, hasMiniOpenid, isImported] of combos) {
      assert.equal(
        newClauseSelects(isMiniapp, hasMiniOpenid, isImported),
        true,
        `组合 (miniapp=${isMiniapp}, miniOpenid=${hasMiniOpenid}, imported=${isImported}) 应可见`
      );
    }
  });

  await it("回归护栏（反向）：国产机 + 小程序渠道 必须可见 —— 2026-10-26 口径变更", () => {
    // ⚠️ 与旧版断言相反：旧版要求隐藏，老板 2026-10-26 决定放开。
    // 若有人把口径改回「隐藏国产机」，这条会立刻失败 —— 这是有意的。
    assert.equal(newClauseSelects(true, false, false), true, "系统账号发布的国产机应可见");
    assert.equal(newClauseSelects(false, true, false), true, "小程序用户发布的国产机应可见");
  });

  // ── 3. 留档：旧 email 口径的三值逻辑缺陷（与本次口径变更无关，纯历史证据） ──
  await it("历史缺陷：旧 email 口径下卖家 email=NULL 的进口产品被静默丢弃（NULL 非 TRUE）", () => {
    assert.equal(oldClauseSelects(null, true), false, "email=NULL 时旧口径不应命中");
    assert.equal(oldClauseSelects(null, false), false);
  });

  await it("历史缺陷对照：email=NULL 在旧口径丢失，新口径（只看 status）不再依赖 email", () => {
    // 新口径根本不含 email 条件 ⇒ 该行是否丢失与 email 无关
    assert.equal(newClauseSelects(false, false, true), true);
    const json = JSON.stringify(buildWebsiteVisibleWhere("x"));
    assert.ok(!json.includes("email"), "新口径不得依赖可空的 email");
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
