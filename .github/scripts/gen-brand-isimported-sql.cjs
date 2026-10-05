#!/usr/bin/env node
/* .github/scripts/gen-brand-isimported-sql.cjs
 * ============================================================================
 * 生成 `.cn` 生产库「Brand.isImported 一次性修正」的 SQL 三件套（dry / verify / apply）。
 *
 * 背景（bug·条件 B）：
 *   `.cn` 的 `Brand` 表存在一批「重复行」，重复行的 `isImported` 被错误置为 false
 *   （进口品牌被标成国产）。后果：
 *     ① 导出接口 `src/app/api/internal/products/export/route.ts` 要求
 *        `brand.isImported = true`，挂在这些 brandId 上的产品永远同步不到 `.com`；
 *     ② 前端品牌筛选下拉出现同名双选项。
 *
 * 设计要点（照抄 .github/workflows/ops-backfill-4.yml 的安全机制）：
 *   - 本脚本**不连任何数据库**：全部候选行 / 计数都在 `.cn` 库上由生成的 SQL 自行计算
 *     （自包含）—— 因为执行者（GitHub Actions runner）无法直连未对公网暴露的 `.cn` 库。
 *   - dry    : **只读**。输出已知候选 + 发现查询（不写死 id）+ 预期影响精确数字 + 全表基线。
 *   - verify : **只读复核**（apply 之后跑）。断言目标行已为 true，且无多余改动。
 *   - apply  : **单事务**内逐行 UPDATE。每句精确 WHERE + `GET DIAGNOSTICS` 行数断言（严格 UPDATE 1）；
 *              并在事务内用「恰好 N 行 false→true」「0 行 true→false」「Brand 总行数不变」
 *              三重断言保证零误伤、零增删。任何断言失败 → 抛异常 → ON_ERROR_STOP 下整体回滚。
 *
 * 说明（v2）：apply 作用集 = CONFIRMED（当前 7 行：5 个同名重复行 + 2 个 Agronic 重复对）。
 *             行数全部由 `CONFIRMED.length` 推导，**不写死**；预期指标随之外同步。
 *
 * 硬性红线：
 *   - ⛔ 绝不删除任何 Brand 行（决策 #10：品牌归一 = B，只归一/映射，不删除既有 Brand 行）。
 *   - ⛔ 绝不改 `Product.brandId`（不迁移产品到别的品牌行）。
 *   - 本任务**只改 `Brand.isImported` 一个字段**。
 *
 * 用法：OUT_DIR=/tmp/out node .github/scripts/gen-brand-isimported-sql.cjs
 * 产出：$OUT_DIR/brandfix.sql         ← apply（含 BEGIN/COMMIT + 断言）
 *       $OUT_DIR/brandfix.pre.sql     ← dry（只读，物理上不含任何写语句）
 *       $OUT_DIR/brandfix.verify.sql  ← verify（只读复核）
 *       $OUT_DIR/SHA                  ← brandfix.sql 的 sha256（供 ECS 侧校验）
 * ============================================================================
 */
"use strict";

const fs = require("fs");
const path = require("path");

const OUT_DIR = process.env.OUT_DIR || "/tmp/out";

/** 闸门口令：与 workflow / 闸门文件内容保持一致（见 .github/ops/brand-isimported-apply）。 */
const APPLY_TOKEN = "FIX-BRAND-ISIMPORTED";

/* ---------------------------------------------------------------------------
 * 已确认应改为 `isImported = true` 的行 —— apply **唯一**作用对象（行数 = CONFIRMED.length）。
 * 判据：
 *   a) 与某个 isImported=true 的正牌品牌同名（nameEn 大小写/空格不敏感）；或
 *   b) 明显错别字重复行（麦塞福格森 vs 麦赛福格森）；或
 *   c) 已拍板的进口品牌重复行（Agronic / AGRONIC —— 无同名 true 正牌行，一并置 true）。
 * ------------------------------------------------------------------------- */
const CONFIRMED = [
  {
    id: "cmut9ecre000kuy82z1gv1rxp",
    nameZh: "CLAAS",
    nameEn: "CLAAS",
    note: "重复行；同名正牌 claas（克拉斯）已 isImported=true",
  },
  {
    id: "cmuticogi003jyjpc8xsuh3ds",
    nameZh: "NEW HOLLAND",
    nameEn: "NEW HOLLAND",
    note: "重复行；同名正牌 new-holland（纽荷兰）已 isImported=true",
  },
  {
    id: "cmrvbl1qk0000i9ud71mynv2b",
    nameZh: "John Deere",
    nameEn: "John Deere",
    note: "重复行；同名正牌 john-deere（约翰迪尔）已 isImported=true",
  },
  {
    id: "cmuthrf930028yjpcd4ncifhn",
    nameZh: "Krone",
    nameEn: "Krone",
    note: "重复行；同名正牌 krone（科罗尼）已 isImported=true",
  },
  {
    id: "cmr34lal3000058eh35hayu4e",
    nameZh: "麦塞福格森",
    nameEn: "麦塞福格森",
    note: "错别字重复行（「塞」vs「赛」）；正牌 massey-ferguson（麦赛福格森）已 isImported=true",
  },
  {
    id: "cmu1bgyf2000fp7snncnxvah",
    nameZh: "Agronic",
    nameEn: "Agronic",
    note: "进口品牌（芬兰 Agronic Oy）；与下一行 AGRONIC 互为重复、均为 false，且**没有**同名 isImported=true 的正牌行 → 一并置 true",
  },
  {
    id: "cmutjcl7c006hyjpcvv9sba7d",
    nameZh: "AGRONIC",
    nameEn: "AGRONIC",
    note: "进口品牌（芬兰 Agronic Oy）；与上一行 Agronic 互为重复、均为 false → 一并置 true",
  },
];

/* ---------------------------------------------------------------------------
 * 待人工确认 / 已判定的行 —— 只出现在 dry 报告里，**绝不**被 apply 触碰（行数 = PENDING.length）。
 * 说明：以下 id 原样复制自任务清单；dry 的 `found` 列会逐一确认其存在性，
 *       若某行 found=0 说明 id 需校正（dry 为只读，重跑无副作用）。
 * ------------------------------------------------------------------------- */
const PENDING = [
  {
    id: "cmutjj8xt008byjpc7b60dkbb",
    nameZh: "世达尔",
    nameEn: "世达尔",
    note: "已查证为国产（上海世达尔 Modern Agricultural Machinery，IHI Agri-Tech 51% + 上海电气 49%，注册地上海、在华生产，2023-12 已注销）→ 保持 false，不改",
  },
];

/* ---------------------------------------------------------------------------
 * SQL 字面量 / 片段工具
 * ------------------------------------------------------------------------- */
/** 把 JS 字符串安全转成 SQL 单引号字面量（转义单引号）。 */
function sqlText(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

/**
 * 已知候选行明细查询（LEFT JOIN，未命中的 id 会以 found=false 暴露出来）。
 * 输出：brandId / nameZh / nameEn / isImported / originCountry / 挂载产品数 / active 数 / 是否命中。
 */
function knownCandidatesQuery(rows, seqStart) {
  const values = rows
    .map((r, i) => `    (${seqStart + i}, ${sqlText(r.id)}, ${sqlText(r.note)})`)
    .join(",\n");
  return [
    "SELECT c.seq,",
    '       c.id            AS brand_id,',
    '       (b.id IS NOT NULL) AS found,',
    '       b."nameZh",',
    '       b."nameEn",',
    '       b."isImported",',
    '       b."originCountry",',
    '       (SELECT count(*) FROM "Product" p WHERE p."brandId" = c.id) AS products,',
    `       (SELECT count(*) FROM "Product" p WHERE p."brandId" = c.id AND p.status = 'active') AS active_products,`,
    "       c.note",
    "FROM (VALUES",
    values,
    ") AS c(seq, id, note)",
    'LEFT JOIN "Brand" b ON b.id = c.id',
    "ORDER BY c.seq;",
  ].join("\n");
}

/**
 * 发现查询（**只读、不写死 id**）：扫出「与某个 isImported=true 的品牌同名
 * （lower(trim(nameEn)) 或 lower(trim(nameZh)) 相同）但自身 isImported=false」的所有行。
 * 归一化：大小写不敏感 + 首尾空白忽略；排除空名，避免空串互相误匹配。
 */
function discoveryQuery() {
  return [
    'SELECT dup.id            AS dup_id,',
    '       dup."nameZh"       AS dup_zh,',
    '       dup."nameEn"       AS dup_en,',
    '       dup."isImported"   AS dup_is_imported,',
    '       imp.id            AS canonical_id,',
    '       imp."nameZh"       AS canonical_zh,',
    '       imp."nameEn"       AS canonical_en,',
    '       (SELECT count(*) FROM "Product" p WHERE p."brandId" = dup.id) AS products,',
    `       (SELECT count(*) FROM "Product" p WHERE p."brandId" = dup.id AND p.status = 'active') AS active_products`,
    'FROM "Brand" dup',
    'JOIN "Brand" imp',
    '  ON imp."isImported" = true',
    ' AND imp.id <> dup.id',
    ' AND btrim(dup."nameEn") <> \'\'',
    ' AND btrim(dup."nameZh") <> \'\'',
    ' AND ( lower(btrim(dup."nameEn")) = lower(btrim(imp."nameEn"))',
    '    OR lower(btrim(dup."nameZh")) = lower(btrim(imp."nameZh")) )',
    'WHERE dup."isImported" = false',
    'ORDER BY lower(btrim(dup."nameEn")), dup.id;',
  ].join("\n");
}

/** 预期影响（仅针对 CONFIRMED，即 apply 作用集）——精确数字。 */
function expectedImpactQuery() {
  const ids = CONFIRMED.map((r) => r.id);
  return [
    "WITH confirmed(id) AS (",
    "  VALUES " + ids.map((id) => "(" + sqlText(id) + ")").join(", "),
    ")",
    "SELECT",
    "  (SELECT count(*) FROM confirmed)                                   AS confirmed_ids,",
    '  (SELECT count(*) FROM confirmed c JOIN "Brand" b ON b.id = c.id)   AS confirmed_found,',
    '  (SELECT count(*) FROM confirmed c JOIN "Brand" b ON b.id = c.id',
    '     WHERE b."isImported" = false)                                   AS will_flip_false_to_true,',
    '  (SELECT count(*) FROM confirmed c JOIN "Brand" b ON b.id = c.id',
    '     WHERE b."isImported" = true)                                    AS already_true,',
    '  (SELECT count(*) FROM "Product" p WHERE p."brandId" IN (SELECT id FROM confirmed))',
    "                                                                     AS products_on_confirmed,",
    '  (SELECT count(*) FROM "Product" p WHERE p."brandId" IN (SELECT id FROM confirmed)',
    "     AND p.status = 'active')                                        AS active_products_on_confirmed;",
  ].join("\n");
}

/** 全表基线（apply 前后应恰好相差 confirmed 行数）。 */
function baselineQuery() {
  return [
    "SELECT",
    '  count(*) FILTER (WHERE "isImported")     AS imported_true_total,',
    '  count(*) FILTER (WHERE NOT "isImported") AS imported_false_total,',
    "  count(*)                                 AS brand_total",
    'FROM "Brand";',
  ].join("\n");
}

/* ---------------------------------------------------------------------------
 * 三段 SQL 组装
 * ------------------------------------------------------------------------- */

/** 公共头部注释。 */
function header(kind) {
  return [
    "-- ============================================================================",
    "-- .cn 生产库 · Brand.isImported 一次性修正 · 模式：" + kind,
    "-- 生成时间：" + new Date().toISOString(),
    "-- 生成器：.github/scripts/gen-brand-isimported-sql.cjs（无 DB 依赖，自包含）",
    "-- 红线：只改 Brand.isImported（false→true）；绝不删除 Brand 行；绝不改 Product.brandId。",
    "-- ============================================================================",
    "",
  ].join("\n");
}

/** dry（只读）SQL。 */
function buildDry() {
  const L = [];
  L.push(header("DRY（只读，零写入）"));
  L.push("\\echo '=== 0. 连接与库身份 ==='");
  L.push("SELECT current_database() AS db, current_user AS usr;");
  L.push("");
  L.push(
    "\\echo '=== 1. 已知候选行（CONFIRMED=" + CONFIRMED.length +
      ", PENDING=" + PENDING.length + "；found=false 表示 id 不存在）==='"
  );
  L.push(knownCandidatesQuery(CONFIRMED, 1));
  L.push("");
  L.push(knownCandidatesQuery(PENDING, 100));
  L.push("");
  L.push("\\echo '=== 2. 发现查询：同名却 isImported=false 的重复行（只读，未写死 id）==='");
  L.push("\\echo '    （命中即为「与某个 true 品牌同名、自身 false」的追加候选，需并入人工复核）'");
  L.push(discoveryQuery());
  L.push("");
  L.push("\\echo '=== 3. 预期影响（apply 作用集 = CONFIRMED，精确数字）==='");
  L.push(
    "\\echo '    期望：confirmed_ids=" + CONFIRMED.length + ", confirmed_found=" + CONFIRMED.length +
      ", will_flip_false_to_true=" + CONFIRMED.length + ", already_true=0'"
  );
  L.push(
    "\\echo '    若 will_flip < " + CONFIRMED.length + " 或 found < " + CONFIRMED.length +
      "：先查因（id 笔误 / 已被手工改过），不要 apply。'"
  );
  L.push(expectedImpactQuery());
  L.push("");
  L.push(
    "\\echo '=== 4. 全表基线（记住这三个数，apply 后 brand_total 应不变、imported_true_total 应 +" +
      CONFIRMED.length + "）==='"
  );
  L.push(baselineQuery());
  L.push("");
  L.push("\\echo '=== DRY 完成：本模式未写入任何数据 ==='");
  return L.join("\n") + "\n";
}

/** verify（只读复核）SQL。 */
function buildVerify() {
  const ids = CONFIRMED.map((r) => r.id);
  const L = [];
  L.push(header("VERIFY（只读复核，apply 之后跑）"));
  L.push("\\echo '=== V0. 连接与库身份 ==='");
  L.push("SELECT current_database() AS db, current_user AS usr;");
  L.push("");
  L.push("\\echo '=== V1. 断言：CONFIRMED " + CONFIRMED.length + " 行均存在且 isImported=true（失败即抛异常）==='");
  L.push("DO $$");
  L.push("DECLARE bad integer;");
  L.push("BEGIN");
  L.push("  SELECT count(*) INTO bad");
  L.push("  FROM (VALUES " + ids.map((id) => "(" + sqlText(id) + ")").join(", ") + ") AS c(id)");
  L.push('  LEFT JOIN "Brand" b ON b.id = c.id');
  L.push('  WHERE b.id IS NULL OR b."isImported" IS DISTINCT FROM true;');
  L.push("  IF bad <> 0 THEN");
  L.push("    RAISE EXCEPTION 'VERIFY FAIL: % 个目标行未变为 true 或不存在', bad;");
  L.push("  END IF;");
  L.push("  RAISE NOTICE 'VERIFY OK: 全部 " + CONFIRMED.length + " 个目标行 isImported=true';");
  L.push("END $$;");
  L.push("");
  L.push("\\echo '=== V2. 目标行现状（逐个核对；全部应为 t）==='");
  L.push(knownCandidatesQuery(CONFIRMED, 1));
  L.push("");
  L.push("\\echo '=== V3. 残余「同名却 false」重复行（理想为 0；若非 0 属追加候选，人工复核）==='");
  L.push(discoveryQuery());
  L.push("");
  L.push(
    "\\echo '=== V4. 全表基线（与 dry 的 §4 对比：brand_total 必须相等、imported_true_total 应 +" +
      CONFIRMED.length + "）==='"
  );
  L.push(baselineQuery());
  L.push("");
  L.push("\\echo '=== VERIFY 完成：只读，未改动任何数据 ==='");
  return L.join("\n") + "\n";
}

/** apply（单事务写入）SQL。 */
function buildApply() {
  const L = [];
  L.push(header("APPLY（单事务；逐行断言；出错整体回滚）"));
  L.push("\\echo '>>> APPLY：即将修正 .cn 库 Brand.isImported（仅 " + CONFIRMED.length + " 行，单事务）'");
  L.push("BEGIN;");
  L.push("");
  L.push("-- 事务内基线快照：用于「恰好 N 行翻转 / 0 行反向翻转 / 行数不变」的收尾断言");
  L.push('CREATE TEMP TABLE _bi_before ON COMMIT DROP AS SELECT id, "isImported" FROM "Brand";');
  L.push("");

  CONFIRMED.forEach((r, i) => {
    L.push(`-- [${i + 1}/${CONFIRMED.length}] ${r.nameZh} / ${r.nameEn}  (${r.id})`);
    L.push(`--   ${r.note}`);
    L.push("DO $$");
    L.push("DECLARE n integer; m integer;");
    L.push("BEGIN");
    L.push(`  SELECT count(*) INTO m FROM "Brand" WHERE id = ${sqlText(r.id)};`);
    L.push(
      `  IF m <> 1 THEN RAISE EXCEPTION 'ASSERT FAIL: ${r.id} 不存在或重复 (count=%) — 疑似 id 笔误或数据已变更', m; END IF;`
    );
    L.push(
      `  UPDATE "Brand" SET "isImported" = true WHERE id = ${sqlText(r.id)} AND "isImported" = false;`
    );
    L.push("  GET DIAGNOSTICS n = ROW_COUNT;");
    L.push(
      `  IF n <> 1 THEN RAISE EXCEPTION 'ASSERT FAIL: ${r.id} 期望 UPDATE 1 实得 % — 该行当前可能已为 true', n; END IF;`
    );
    L.push("END $$;");
    L.push("");
  });

  L.push("-- 全局收尾断言：恰好 " + CONFIRMED.length + " 行 false→true、0 行 true→false、Brand 行数不变");
  L.push("DO $$");
  L.push("DECLARE n_new_true integer; n_new_false integer; n_before integer; n_after integer;");
  L.push("BEGIN");
  L.push('  SELECT count(*) INTO n_new_true  FROM "Brand" b JOIN _bi_before o ON o.id = b.id');
  L.push('    WHERE o."isImported" = false AND b."isImported" = true;');
  L.push('  SELECT count(*) INTO n_new_false FROM "Brand" b JOIN _bi_before o ON o.id = b.id');
  L.push('    WHERE o."isImported" = true  AND b."isImported" = false;');
  L.push("  SELECT count(*) INTO n_before FROM _bi_before;");
  L.push('  SELECT count(*) INTO n_after  FROM "Brand";');
  L.push("  IF n_new_true <> " + CONFIRMED.length + " THEN");
  L.push(
    "    RAISE EXCEPTION 'ASSERT FAIL: 期望恰好 " + CONFIRMED.length + " 行 false->true，实际 %', n_new_true;"
  );
  L.push("  END IF;");
  L.push("  IF n_new_false <> 0 THEN");
  L.push("    RAISE EXCEPTION 'ASSERT FAIL: 出现 true->false % 行（绝不允许）', n_new_false;");
  L.push("  END IF;");
  L.push("  IF n_after <> n_before THEN");
  L.push("    RAISE EXCEPTION 'ASSERT FAIL: Brand 总行数变化 % -> %（严禁增删）', n_before, n_after;");
  L.push("  END IF;");
  L.push("  RAISE NOTICE '全局断言通过：+% false->true, 0 true->false, 行数不变', n_new_true;");
  L.push("END $$;");
  L.push("");
  L.push("COMMIT;");
  L.push("");
  L.push("\\echo '=== 提交后核对（只读） ==='");
  L.push(knownCandidatesQuery(CONFIRMED, 1));
  L.push("SELECT '全局唯一性自检（期望 brand_total 与 apply 前一致）' AS label;");
  L.push(baselineQuery());
  L.push("\\echo '=== APPLY 完成 ==='");
  return L.join("\n") + "\n";
}

/* ---------------------------------------------------------------------------
 * 安全检查：dry 必须物理上不含任何写语句
 * ------------------------------------------------------------------------- */
function assertReadOnly(sql, label) {
  // 去掉 `--` 行注释与 `\echo '...'` 内容后再检索写关键字，避免注释误判。
  const stripped = sql
    .split("\n")
    .filter((ln) => !ln.trimStart().startsWith("--"))
    .join("\n")
    .replace(/\\echo\s+'(?:[^']|'')*'/g, "");
  const WRITE_RE = /\b(INSERT|UPDATE|DELETE|ALTER|TRUNCATE|DROP|GRANT|REVOKE|CREATE|COPY)\b/i;
  const m = stripped.match(WRITE_RE);
  if (m) {
    throw new Error(`${label} 的 SQL 中检测到写语句关键字「${m[0]}」，拒绝产出（只读模式必须零写语句）`);
  }
}

/* ---------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------- */
(function main() {
  const applySql = buildApply();
  const drySql = buildDry();
  const verifySql = buildVerify();

  assertReadOnly(drySql, "dry");
  assertReadOnly(verifySql, "verify");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "brandfix.sql"), applySql, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "brandfix.pre.sql"), drySql, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "brandfix.verify.sql"), verifySql, "utf8");

  const sha = require("crypto").createHash("sha256").update(applySql, "utf8").digest("hex");
  fs.writeFileSync(path.join(OUT_DIR, "SHA"), sha, "utf8");

  // 只打印可公开摘要（无 PII：品牌名非个人信息）。
  console.log("mode=generate token=" + APPLY_TOKEN);
  console.log("confirmed=" + CONFIRMED.length + " pending=" + PENDING.length);
  console.log("apply_bytes=" + Buffer.byteLength(applySql, "utf8"));
  console.log("dry_bytes=" + Buffer.byteLength(drySql, "utf8"));
  console.log("verify_bytes=" + Buffer.byteLength(verifySql, "utf8"));
  console.log("sha256=" + sha);
})();
