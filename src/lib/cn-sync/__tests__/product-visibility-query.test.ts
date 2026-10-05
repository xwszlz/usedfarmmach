/**
 * 可见性 × 搜索 组合单元测试（fix/product-visibility-followups）
 *
 * 运行：npm run test:product-visibility-query
 *       （或 npm run test:cn-sync-scope —— 先跑 product-visibility.test.ts，再跑本文件）
 * （仓库未引入 vitest / jest，沿用同目录 product-visibility.test.ts 的「node:assert 断言脚本」，退出码非 0 即失败）
 *
 * ⚠️ 本测试**不触碰任何数据库 / 网络**：
 * - `buildWebsiteVisibleWhere` / `applySearchQueryToWhere` 均为**纯函数**（只依赖 @prisma/client 的**类型**）；
 * - 用一个零依赖的「内存 where 求值器」复现 Prisma 对 `AND` / `OR` / `contains` / `not` / 关系字段（brand）
 *   的匹配语义，进而在**纯内存夹具**上证明：
 *     ① 修复后：靠「可见性 OR 第二支（小程序账号 ∧ 国际品牌）」才可见的产品，带搜索参数时**仍被返回**；
 *     ② 修复后：本该隐藏的产品（小程序账号 ∧ 国产），带搜索参数时**仍被隐藏**；
 *     ③ 旧写法（把搜索条件**整体赋值**给 `where.OR`）会把 ② 泄漏出来 —— 复现被修掉的 bug。
 */
import assert from "node:assert/strict";
import {
  buildWebsiteVisibleWhere,
  applySearchQueryToWhere,
  buildSearchOrConditions,
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

/* ─────────────────────── 零依赖「内存 where 求值器」 ───────────────────────
 * 仅实现本测试用到的 Prisma 子集：
 *   - 顶层隐式 AND（各 key 之间）
 *   - 逻辑算子 AND / OR / NOT
 *   - 标量算子 equals / not / contains(insensitive) / 字面量相等
 *   - 关系字段 brand / category（嵌套对象按字段逐一匹配）
 * 语义与 Prisma 一致：只有求值为 true 的产品才「命中」（无 SQL 三值逻辑入口）。
 */
type Json = any;

function matchScalar(actual: Json, cond: Json): boolean {
  if (cond === null) return actual === null;
  if (typeof cond !== "object") return actual === cond;
  if ("equals" in cond) return matchScalar(actual, cond.equals);
  if ("not" in cond) return !matchScalar(actual, cond.not);
  if ("contains" in cond) {
    if (actual === null || actual === undefined) return false;
    return String(actual).toLowerCase().includes(String(cond.contains).toLowerCase());
  }
  if ("is" in cond) return matchRelation(actual, cond.is);
  throw new Error(`unsupported scalar condition: ${JSON.stringify(cond)}`);
}

function matchRelation(rel: Json, cond: Json): boolean {
  if (cond === null) return rel === null || rel === undefined;
  if (rel === null || rel === undefined) return false;
  for (const key of Object.keys(cond)) {
    const v = cond[key];
    if (key === "is") {
      if (!matchRelation(rel, v)) return false;
      continue;
    }
    if (key === "isNot") {
      if (matchRelation(rel, v)) return false;
      continue;
    }
    if (!matchScalar(rel[key], v)) return false;
  }
  return true;
}

function evalWhere(where: Json, p: Json): boolean {
  if (where === undefined || where === null) return true;
  for (const key of Object.keys(where)) {
    const val = where[key];
    if (key === "AND") {
      const arr = Array.isArray(val) ? val : [val];
      if (!arr.every((w: Json) => evalWhere(w, p))) return false;
    } else if (key === "OR") {
      const arr = Array.isArray(val) ? val : [val];
      if (!arr.some((w: Json) => evalWhere(w, p))) return false;
    } else if (key === "NOT") {
      const arr = Array.isArray(val) ? val : [val];
      if (arr.every((w: Json) => evalWhere(w, p))) return false; // NOT(a AND b)
    } else if (key === "brand" || key === "category") {
      if (!matchRelation(p[key], val)) return false;
    } else if (!matchScalar(p[key], val)) {
      return false;
    }
  }
  return true;
}

/* ───────────────────────────── 内存夹具 ───────────────────────────── */
const MINIAPP_ID = "cmut_miniapp_seller_id"; // 由 MINIAPP_SELLER_EMAIL 解析而来的小程序系统账号 id
const OTHER_ID = "cmut_other_seller_id";

interface Fixture {
  id: string;
  status: string;
  sellerId: string;
  modelName: string;
  descriptionZh: string;
  descriptionEn: string;
  location: string;
  brand: { isImported: boolean; nameZh: string; nameEn: string } | null;
  category: { nameZh: string; nameEn: string } | null;
}

const active = (
  id: string,
  sellerId: string,
  modelName: string,
  isImported: boolean,
  nameZh: string,
  nameEn: string
): Fixture => ({
  id,
  status: "active",
  sellerId,
  modelName,
  descriptionZh: "",
  descriptionEn: "",
  location: "河北 石家庄",
  brand: { isImported, nameZh, nameEn },
  category: { nameZh: "拖拉机", nameEn: "Tractor" },
});

/** 全部 modelName 均含 "1204" → 用 "1204" 搜索时「搜索条件对所有夹具都命中」，从而单独暴露可见性差异 */
const PRODUCTS: Fixture[] = [
  active("cn-imported-miniapp", MINIAPP_ID, "6J-1204", true, "约翰迪尔", "John Deere"), // 靠可见性 OR 第二支可见
  active("cn-domestic-miniapp", MINIAPP_ID, "东方红LX1204", false, "东方红", "Dongfanghong"), // 必须隐藏
  active("cn-imported-other", OTHER_ID, "雷沃1204", true, "雷沃", "Lovol"), // 可见（OR 第一支）
  active("cn-domestic-other", OTHER_ID, "五征1204", false, "五征", "Wuzheng"), // 可见（非小程序账号）
  { ...active("cn-draft-miniapp", MINIAPP_ID, "草稿1204", true, "凯斯", "Case IH"), status: "draft" }, // status 过滤
];

const byId = (id: string): Fixture => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`fixture not found: ${id}`);
  return p;
};

function selectIds(where: Json): string[] {
  return PRODUCTS.filter((p) => evalWhere(where, p)).map((p) => p.id);
}

/* ───────────────────────────── 测试 ───────────────────────────── */
async function main(): Promise<void> {
  console.log("product-visibility × search 组合单元测试（fix/product-visibility-followups）");

  // ── A. 组合结构：搜索 OR 必须作为子条件进 AND，绝不覆盖可见性顶层 OR ──
  await it("结构：applySearchQueryToWhere 保留可见性顶层 OR，把搜索 OR push 进 AND", () => {
    const w: Json = applySearchQueryToWhere(buildWebsiteVisibleWhere(MINIAPP_ID), "abc");
    assert.equal(w.status, "active");
    assert.deepEqual(w.OR, [
      { sellerId: { not: MINIAPP_ID } },
      { brand: { isImported: true } },
    ]);
    assert.ok(Array.isArray(w.AND) && w.AND.length === 1, "应恰好新增 1 个 AND 子条件");
    assert.deepEqual(w.AND[0], { OR: buildSearchOrConditions("abc") });
  });

  await it("结构：不覆盖 / 不丢失既有 AND 子条件（brand/category/province 等）", () => {
    const base: Json = { status: "active", AND: [{ country: "CN" }] };
    const merged: Json = applySearchQueryToWhere(base, "abc");
    assert.deepEqual(merged.AND, [
      { country: "CN" },
      { OR: buildSearchOrConditions("abc") },
    ]);
    assert.deepEqual(base.AND, [{ country: "CN" }], "入参对象不应被修改");
  });

  await it("结构：空 query 原样返回（不做任何改动）", () => {
    const v = buildWebsiteVisibleWhere(MINIAPP_ID);
    assert.equal(applySearchQueryToWhere(v, ""), v);
    assert.equal(applySearchQueryToWhere(v, null), v);
    assert.equal(applySearchQueryToWhere(v, undefined), v);
  });

  // ── B. 行为：修复后「可见性」与「搜索」同时生效 ──
  const visible = buildWebsiteVisibleWhere(MINIAPP_ID);
  const combined1204 = applySearchQueryToWhere(visible, "1204");

  await it("带搜索：靠 OR 第二支（小程序账号 ∧ 国际品牌）可见的产品仍被返回", () => {
    const ids = selectIds(combined1204);
    assert.ok(
      ids.includes("cn-imported-miniapp"),
      `应返回 cn-imported-miniapp，实际：${ids.join(", ")}`
    );
  });

  await it("带搜索：应隐藏的产品（小程序账号 ∧ 国产）仍被隐藏", () => {
    const ids = selectIds(combined1204);
    assert.ok(
      !ids.includes("cn-domestic-miniapp"),
      `不应返回 cn-domestic-miniapp，实际：${ids.join(", ")}`
    );
  });

  await it("带搜索：非小程序账号 / status≠active 的既有语义不变", () => {
    const ids = selectIds(combined1204);
    assert.deepEqual(
      ids.slice().sort(),
      ["cn-domestic-other", "cn-imported-miniapp", "cn-imported-other"].sort(),
      `可见集合应恰为 {国产普通卖家, 进口小程序, 进口普通卖家}，实际：${ids.join(", ")}`
    );
    assert.ok(!ids.includes("cn-draft-miniapp"), "draft 产品不应可见");
  });

  await it("带品牌名搜索（John Deere）：命中 OR 第二支产品，且不泄漏隐藏产品", () => {
    const w = applySearchQueryToWhere(visible, "John Deere");
    assert.ok(evalWhere(w, byId("cn-imported-miniapp")), "品牌名命中的进口小程序产品应可见");
    assert.ok(!evalWhere(w, byId("cn-domestic-miniapp")), "隐藏产品不应因搜索而泄漏");
  });

  // ── C. 反证：复现旧写法（where.OR 整体赋值）的泄漏 bug ──
  await it("旧写法（where.OR = 搜索条件）会把隐藏产品泄漏 —— 复现被修复的缺陷", () => {
    const oldWhere: Json = { ...visible, OR: buildSearchOrConditions("1204") };
    const ids = selectIds(oldWhere);
    assert.ok(
      ids.includes("cn-domestic-miniapp"),
      "旧写法应泄漏 cn-domestic-miniapp（这正是修复动机）"
    );
  });

  await it("新旧对照：新写法不泄漏，旧写法泄漏", () => {
    const oldWhere: Json = { ...visible, OR: buildSearchOrConditions("1204") };
    assert.ok(!selectIds(combined1204).includes("cn-domestic-miniapp"));
    assert.ok(selectIds(oldWhere).includes("cn-domestic-miniapp"));
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
