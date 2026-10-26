/**
 * 可见性 × 搜索 组合单元测试（fix/product-visibility-followups / 2026-10-26 口径变更）
 *
 * 运行：npm run test:product-visibility-query
 *       （或 npm run test:cn-sync-scope —— 先跑 product-visibility.test.ts，再跑本文件）
 * （仓库未引入 vitest / jest，沿用同目录 product-visibility.test.ts 的「node:assert 断言脚本」，退出码非 0 即失败）
 *
 * ⚠️ 本测试**不触碰任何数据库 / 网络**：
 * - `buildWebsiteVisibleWhere` / `applySearchQueryToWhere` 均为**纯函数**（只依赖 @prisma/client 的**类型**）；
 * - 用一个零依赖的「内存 where 求值器」复现 Prisma 对 `AND` / `OR` / `contains` / `not` / 关系字段（brand）
 *   的匹配语义，进而在**纯内存夹具**上证明：
 *     ① 搜索条件必须以 **AND 子条件**叠加，不得覆盖调用方既有的 `AND`（brand / category / country …）；
 *     ② `status='active'` 始终生效，draft 等非上架商品不会因搜索而泄漏；
 *     ③ 2026-10-26 口径变更后，国产机（含小程序渠道）带搜索参数时仍**必须返回**。
 *
 * 📌 2026-10-26 业务变更：老板拍板「国产机也要上网站端」。可见性从
 *    「active ∧ 非(小程序渠道 ∧ 国产品牌)」退化为「active」。
 *    本文件原先「小程序账号 ∧ 国产必须隐藏」的断言已按新决策**反转**，勿再改回去。
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
    } else if (key === "brand" || key === "category" || key === "seller") {
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
const MINIAPP_USER_ID = "cmut_miniapp_registered_user_id"; // P0-4 后：小程序注册用户（有 miniOpenid）

interface Fixture {
  id: string;
  status: string;
  sellerId: string;
  seller: { miniOpenid: string | null };
  modelName: string;
  descriptionZh: string;
  descriptionEn: string;
  location: string;
  country: string;
  brand: { isImported: boolean; nameZh: string; nameEn: string } | null;
  category: { nameZh: string; nameEn: string } | null;
}

const active = (
  id: string,
  sellerId: string,
  modelName: string,
  isImported: boolean,
  nameZh: string,
  nameEn: string,
  miniOpenid: string | null = null
): Fixture => ({
  id,
  status: "active",
  sellerId,
  seller: { miniOpenid },
  modelName,
  descriptionZh: "",
  descriptionEn: "",
  location: "河北 石家庄",
  country: "CN",
  brand: { isImported, nameZh, nameEn },
  category: { nameZh: "拖拉机", nameEn: "Tractor" },
});

/** 全部 modelName 均含 "1204" → 用 "1204" 搜索时「搜索条件对所有夹具都命中」，从而单独暴露可见性差异 */
const PRODUCTS: Fixture[] = [
  active("cn-imported-miniapp", MINIAPP_ID, "6J-1204", true, "约翰迪尔", "John Deere"),
  active("cn-domestic-miniapp", MINIAPP_ID, "东方红LX1204", false, "东方红", "Dongfanghong"), // 2026-10-26 起必须可见
  active("cn-imported-other", OTHER_ID, "雷沃1204", true, "雷沃", "Lovol"),
  active("cn-domestic-other", OTHER_ID, "五征1204", false, "五征", "Wuzheng"),
  active("cn-domestic-miniappuser", MINIAPP_USER_ID, "泰山1204", false, "泰山", "Taishan", "oXyz_miniapp_openid"), // 必须可见
  active("cn-imported-miniappuser", MINIAPP_USER_ID, "迪尔1204", true, "迪尔", "Deere", "oXyz_miniapp_openid"),
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
  console.log("product-visibility × search 组合单元测试（2026-10-26 国产机放开口径）");

  // ── A. 组合结构：搜索 OR 必须作为子条件进 AND，不得触碰顶层其它条件 ──
  await it("结构：可见性 where 只剩 status，搜索 OR 被 push 进 AND", () => {
    const w: Json = applySearchQueryToWhere(buildWebsiteVisibleWhere(MINIAPP_ID), "abc");
    assert.equal(w.status, "active");
    assert.equal(w.OR, undefined, "顶层不应出现 OR（可见性已无 OR 分支）");
    assert.ok(Array.isArray(w.AND) && w.AND.length === 1, "应恰好新增 1 个 AND 子条件");
    assert.deepEqual(w.AND[0], { OR: buildSearchOrConditions("abc") });
  });

  await it("结构：不覆盖 / 不丢失既有 AND 子条件（brand/category/country 等）", () => {
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

  // ── B. 行为：可见性（status）与搜索同时生效 ──
  const visible = buildWebsiteVisibleWhere(MINIAPP_ID);
  const combined1204 = applySearchQueryToWhere(visible, "1204");

  await it("带搜索：2026-10-26 起国产机（含小程序渠道）全部返回", () => {
    const ids = selectIds(combined1204);
    for (const id of ["cn-domestic-miniapp", "cn-domestic-miniappuser", "cn-domestic-other"]) {
      assert.ok(ids.includes(id), `应返回 ${id}，实际：${ids.join(", ")}`);
    }
  });

  await it("带搜索：进口机与普通卖家的既有语义不变", () => {
    const ids = selectIds(combined1204);
    for (const id of ["cn-imported-miniapp", "cn-imported-other", "cn-imported-miniappuser"]) {
      assert.ok(ids.includes(id), `应返回 ${id}，实际：${ids.join(", ")}`);
    }
  });

  await it("带搜索：可见集合恰为全部 active（6 台），draft 仍被排除", () => {
    const ids = selectIds(combined1204).slice().sort();
    assert.deepEqual(
      ids,
      [
        "cn-domestic-miniapp",
        "cn-domestic-miniappuser",
        "cn-domestic-other",
        "cn-imported-miniapp",
        "cn-imported-miniappuser",
        "cn-imported-other",
      ].sort(),
      `实际：${ids.join(", ")}`
    );
    assert.ok(!ids.includes("cn-draft-miniapp"), "draft 产品不应可见");
  });

  await it("带品牌名搜索（John Deere）：命中目标且不泄漏 draft", () => {
    const w = applySearchQueryToWhere(visible, "John Deere");
    assert.ok(evalWhere(w, byId("cn-imported-miniapp")), "品牌名命中的进口机应可见");
    assert.ok(!evalWhere(w, byId("cn-draft-miniapp")), "draft 不应因搜索而泄漏");
  });

  await it("带国产机型搜索（东方红）：口径放开后应命中", () => {
    const w = applySearchQueryToWhere(visible, "东方红");
    assert.ok(evalWhere(w, byId("cn-domestic-miniapp")), "国产机应可被搜索到");
  });

  // ── C. 反证：「覆盖」而非「叠加」会丢调用方既有条件 ──
  await it("反证：把搜索条件整体赋值给 where.AND（覆盖既有 AND）会丢掉 country", () => {
    const base: Json = {
      status: "active",
      AND: [{ country: "CN" }],
    };
    const good: Json = applySearchQueryToWhere(base, "1204");
    // 错误写法：直接覆盖 AND，只剩搜索条件 ⇒ country 过滤消失
    const bad: Json = { ...base, AND: [{ OR: buildSearchOrConditions("1204") }] };
    const seaProduct = { ...byId("cn-domestic-other"), id: "sea-1204", country: "SE" };
    assert.equal(evalWhere(good, seaProduct), false, "正确写法应被 country 过滤掉");
    assert.equal(evalWhere(bad, seaProduct), true, "覆盖写法会绕过 country（这正是必须用 AND 叠加的原因）");
  });

  await it("对照：applySearchQueryToWhere 与手写覆盖写法结果不同", () => {
    const base: Json = { status: "active", AND: [{ country: "CN" }] };
    const good: Json = applySearchQueryToWhere(base, "1204");
    const bad: Json = { ...base, AND: [{ OR: buildSearchOrConditions("1204") }] };
    const sea = { ...byId("cn-domestic-other"), country: "SE" };
    assert.notEqual(evalWhere(good, sea), evalWhere(bad, sea));
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
