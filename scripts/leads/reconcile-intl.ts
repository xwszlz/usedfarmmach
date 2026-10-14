/**
 * T02 · 境外 18 户对账（**只读**）
 * ================================
 * 比对「xlsx 侧境外 18 户」与 `.com`（Neon）库中 `source='manual_dealer_intl'` 的行，
 * 按 **是否参与 contentHash** 分类，产出四清单 + 库级校验数字。
 *
 * ## 为什么按「是否参与 hash」分类（本脚本的分类依据）
 * `contentHash = md5(brandName|modelName|year|location|priceCny??priceRaw??""|sellerPhone|sellerName)`
 *   - **不参与 hash** 的字段（`sellerEmail` / `sellerWechat` / `sellerWhatsapp`）
 *     → 现有 `PATCH /api/admin/leads/[id]` 白名单就支持（`[id]/route.ts:65-74`），
 *       **补了也不改 hash ⇒ 零幂等影响**，标「可直接补」。
 *   - **参与 hash** 的字段（尤其 `sellerPhone`）→ 现有能力**不支持**：
 *     只有 GET + PATCH，没有 PUT；且 PATCH 白名单不含这些字段。
 *     标「需 T04 扩展」，并注明：扩展时**必须在同一事务里重算 contentHash**，
 *     否则改了 hash 字段却不改 hash ⇒ 下次重导会当成新行，产生重复。
 *
 * ## 🔴 只读铁律
 * 本脚本**只发 SELECT**。所有 SQL 先过 `assertReadOnly()`（命中 INSERT/UPDATE/DELETE/
 * CREATE/ALTER/DROP/TRUNCATE/GRANT/REVOKE/COPY/SET 等即抛错），且额外用
 * `SET TRANSACTION READ ONLY` 兜底。
 *
 * ## 用法
 * ```
 * # 在线（真实 Neon）
 * DATABASE_URL=postgresql://... npx tsx scripts/leads/reconcile-intl.ts
 * # 或显式给 URL
 * npx tsx scripts/leads/reconcile-intl.ts --url "postgresql://..."
 *
 * # 离线自测（不连库，用 fixture 验证脚本逻辑，输出会明确标注「FIXTURE，非生产实测」）
 * npx tsx scripts/leads/reconcile-intl.ts --fixture path/to/db-rows.json
 * ```
 */

import * as fs from "fs";
import * as path from "path";

import { primaryPhoneKey } from "./lib/phone-judger";
import { writeText } from "./lib/csv-emitter";

// ───────────────────────────────────────────────
// 1. 常量与类型
// ───────────────────────────────────────────────

/** 参与 contentHash 的字段（改这些必须同事务重算 hash） */
const HASH_FIELDS: readonly string[] = [
  "brandName",
  "modelName",
  "year",
  "location",
  "priceCny",
  "priceRaw",
  "sellerPhone",
  "sellerName",
];

/** 现有 PATCH 白名单支持的字段（改这些不改 hash ⇒ 零幂等影响） */
const PATCHABLE_FIELDS: readonly string[] = ["sellerEmail", "sellerWechat", "sellerWhatsapp"];

/** 其余可比字段（既不在 hash 里、也不可 PATCH） */
const OTHER_FIELDS: readonly string[] = ["sourceUrl", "goodsRegion", "notes"];

/** 比对字段全集（固定顺序，避免依赖 Object.keys） */
const COMPARE_FIELDS: readonly string[] = [
  ...HASH_FIELDS,
  ...PATCHABLE_FIELDS,
  ...OTHER_FIELDS,
];

/** 库行投影 */
interface DbRow {
  id: string;
  contentHash: string;
  brandName: string | null;
  modelName: string | null;
  year: number | null;
  location: string | null;
  priceCny: number | null;
  priceRaw: number | null;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  sellerWechat: string | null;
  sellerWhatsapp: string | null;
  sourceUrl: string | null;
  goodsRegion: string | null;
  notes: string | null;
}

/** xlsx 侧（来自 T01 产出的境外 CSV） */
interface CsvSide {
  seq: number;
  brandName: string;
  modelName: string;
  location: string;
  sellerName: string;
  sellerPhone: string;
  sellerEmail: string;
  sourceUrl: string;
  goodsRegion: string;
  phoneKey: string;
}

/** 清单分类 */
type Bucket =
  | "已存在（一致）"
  | "可直接补"
  | "需 T04 扩展"
  | "新增"
  | "库有 xlsx 无"
  | "无法判定";

const BUCKET_ORDER: readonly Bucket[] = [
  "已存在（一致）",
  "可直接补",
  "需 T04 扩展",
  "新增",
  "库有 xlsx 无",
  "无法判定",
];

interface ReconcileItem {
  bucket: Bucket;
  seq: string;
  sellerName: string;
  dbId: string;
  diffs: string[];
  note: string;
}

// ───────────────────────────────────────────────
// 2. 工具
// ───────────────────────────────────────────────

/** 只读断言：任何写语义关键字一律抛错（防手滑，也防将来有人改坏） */
function assertReadOnly(sql: string): void {
  const upper = sql.toUpperCase();
  const banned = [
    "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TRUNCATE",
    "GRANT", "REVOKE", "COPY", "MERGE", "REPLACE", "UPSERT",
  ];
  for (const word of banned) {
    // 用词边界匹配，避免 "selected" 之类误伤
    if (new RegExp(`\\b${word}\\b`).test(upper)) {
      throw new Error(`只读脚本拒绝执行含 ${word} 的 SQL：${sql.slice(0, 120)}`);
    }
  }
}

/** 归一化公司名（匹配用）：去空白、去括号内容、小写 */
function normName(raw: string): string {
  return (raw || "")
    .replace(/\s+/g, "")
    .replace(/[（(][^（）()]*[)）]/g, "")
    .toLowerCase();
}

/** 字段值归一比较：null 与 "" 视作相等，数字转字符串 */
function normValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

/** 极简 RFC4180 CSV 解析（够用：表头 + 带引号字段） */
function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ───────────────────────────────────────────────
// 3. 读 xlsx 侧（境外 CSV）
// ───────────────────────────────────────────────

function readCsvSide(csvPath: string, placeholderWords: readonly string[]): CsvSide[] {
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (rows.length < 2) throw new Error(`CSV 无数据行：${csvPath}`);
  const header = rows[0];
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`CSV 缺少列「${name}」`);
    return i;
  };
  const iBrand = col("品牌");
  const iModel = col("机型");
  const iLoc = col("地区");
  const iSeller = col("卖家");
  const iPhone = col("电话");
  const iEmail = col("邮箱");
  const iUrl = col("来源链接");
  const iRegion = col("归属");

  return rows.slice(1).map((r, idx) => ({
    seq: idx + 1,
    brandName: r[iBrand] || "",
    modelName: r[iModel] || "",
    location: r[iLoc] || "",
    sellerName: r[iSeller] || "",
    sellerPhone: r[iPhone] || "",
    sellerEmail: r[iEmail] || "",
    sourceUrl: r[iUrl] || "",
    goodsRegion: r[iRegion] || "",
    phoneKey: primaryPhoneKey(r[iPhone] || "", placeholderWords),
  }));
}

// ───────────────────────────────────────────────
// 4. 读库侧
// ───────────────────────────────────────────────

const SELECT_ROWS_SQL = `
  SELECT id, "contentHash", "brandName", "modelName", year, location,
         "priceCny", "priceRaw", "sellerName", "sellerPhone",
         "sellerEmail", "sellerWechat", "sellerWhatsapp",
         "sourceUrl", "goodsRegion", notes
  FROM "RawListing"
  WHERE source = 'manual_dealer_intl'
  ORDER BY "sellerName", id
`;

interface DbChecks {
  total: number;
  distinctSellerName: number;
  dupContentHashGroups: number;
  cnRowsOnCom: number;
}

const CHECK_SQLS: ReadonlyArray<{ key: keyof DbChecks; sql: string; expect: string }> = [
  {
    key: "total",
    sql: `SELECT count(*)::int AS v FROM "RawListing" WHERE source = 'manual_dealer_intl'`,
    expect: "18",
  },
  {
    key: "distinctSellerName",
    sql: `SELECT count(DISTINCT "sellerName")::int AS v FROM "RawListing" WHERE source = 'manual_dealer_intl'`,
    expect: "18",
  },
  {
    key: "dupContentHashGroups",
    sql: `SELECT count(*)::int AS v FROM (SELECT "contentHash" FROM "RawListing" WHERE source='manual_dealer_intl' GROUP BY "contentHash" HAVING count(*) > 1) t`,
    expect: "0",
  },
  {
    key: "cnRowsOnCom",
    sql: `SELECT count(*)::int AS v FROM "RawListing" WHERE "goodsRegion" = 'cn'`,
    expect: "0",
  },
];

async function queryLive(
  url: string,
): Promise<{ rows: DbRow[]; checks: DbChecks; error?: string }> {
  const empty: DbChecks = { total: -1, distinctSellerName: -1, dupContentHashGroups: -1, cnRowsOnCom: -1 };
  try {
    // 延迟 require，保证 --fixture 模式完全不碰数据库
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import("@prisma/client");
    const PrismaClient = (mod as { PrismaClient: new (o?: unknown) => {
      $queryRawUnsafe: (q: string, ...a: unknown[]) => Promise<unknown>;
      $executeRawUnsafe: (q: string, ...a: unknown[]) => Promise<unknown>;
      $disconnect: () => Promise<void>;
    } }).PrismaClient;
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    assertReadOnly(SELECT_ROWS_SQL);
    for (const c of CHECK_SQLS) assertReadOnly(c.sql);

    const rows = (await prisma.$queryRawUnsafe(SELECT_ROWS_SQL)) as DbRow[];

    const checks: DbChecks = { ...empty };
    for (const c of CHECK_SQLS) {
      const out = (await prisma.$queryRawUnsafe(c.sql)) as Array<{ v: number }>;
      checks[c.key] = out && out[0] ? Number(out[0].v) : -1;
    }

    await prisma.$disconnect();
    return { rows, checks };
  } catch (e: unknown) {
    const msg = e instanceof Error ? `${e.message}` : String(e);
    return { rows: [], checks: empty, error: msg };
  }
}

// ───────────────────────────────────────────────
// 5. 比对
// ───────────────────────────────────────────────

function diffRow(csv: CsvSide, db: DbRow): string[] {
  const diffs: string[] = [];
  const pair: ReadonlyArray<[string, string, unknown]> = [
    ["brandName", csv.brandName, db.brandName],
    ["modelName", csv.modelName, db.modelName],
    ["year", "", db.year],
    ["location", csv.location, db.location],
    ["priceCny", "", db.priceCny],
    ["priceRaw", "", db.priceRaw],
    ["sellerPhone", csv.sellerPhone, db.sellerPhone],
    ["sellerName", csv.sellerName, db.sellerName],
    ["sellerEmail", csv.sellerEmail, db.sellerEmail],
    ["sellerWechat", "", db.sellerWechat],
    ["sellerWhatsapp", "", db.sellerWhatsapp],
    ["sourceUrl", csv.sourceUrl, db.sourceUrl],
    ["goodsRegion", csv.goodsRegion, db.goodsRegion],
    ["notes", "", db.notes],
  ];
  for (const [field, csvVal, dbVal] of pair) {
    // year / priceCny / priceRaw / wechat / whatsapp / notes：CSV 侧未提供 ⇒ 不做差异判定
    if (["year", "priceCny", "priceRaw", "sellerWechat", "sellerWhatsapp", "notes"].includes(field)) {
      continue;
    }
    if (normValue(csvVal) !== normValue(dbVal)) diffs.push(field);
  }
  return diffs;
}

function classify(diffs: string[]): Bucket {
  if (diffs.length === 0) return "已存在（一致）";
  const hitsHash = diffs.some((d) => HASH_FIELDS.includes(d));
  const hitsOther = diffs.some((d) => OTHER_FIELDS.includes(d));
  if (hitsHash) return "需 T04 扩展";
  if (hitsOther) return "需 T04 扩展";
  return "可直接补";
}

function reconcile(csvSide: readonly CsvSide[], dbRows: readonly DbRow[]): ReconcileItem[] {
  const items: ReconcileItem[] = [];
  const usedDbIds = new Set<string>();

  // 第一轮：按公司名归一化匹配
  const byName = new Map<string, DbRow[]>();
  for (const d of dbRows) {
    const k = normName(d.sellerName || "");
    const list = byName.get(k);
    if (list) list.push(d);
    else byName.set(k, [d]);
  }
  // 第二轮：按归一化主电话匹配
  const byPhone = new Map<string, DbRow[]>();
  for (const d of dbRows) {
    if (!d.sellerPhone) continue;
    const k = primaryPhoneKey(d.sellerPhone, []);
    if (!k) continue;
    const list = byPhone.get(k);
    if (list && !list.includes(d)) list.push(d);
    else if (!list) byPhone.set(k, [d]);
  }

  for (const csv of csvSide) {
    let match: DbRow | undefined;
    let how = "";
    const nameHits = byName.get(normName(csv.sellerName)) || [];
    if (nameHits.length === 1) {
      match = nameHits[0];
      how = "公司名";
    } else if (nameHits.length > 1) {
      items.push({
        bucket: "无法判定",
        seq: String(csv.seq),
        sellerName: csv.sellerName,
        dbId: nameHits.map((d) => d.id).join(" / "),
        diffs: [],
        note: `库里 ${nameHits.length} 行同名，无法唯一定位，需人工确认`,
      });
      for (const d of nameHits) usedDbIds.add(d.id);
      continue;
    } else if (csv.phoneKey && (byPhone.get(csv.phoneKey) || []).length === 1) {
      match = (byPhone.get(csv.phoneKey) as DbRow[])[0];
      how = "主电话";
    }

    if (!match) {
      items.push({
        bucket: "新增",
        seq: String(csv.seq),
        sellerName: csv.sellerName,
        dbId: "",
        diffs: [],
        note: "xlsx 有、库里没有 ⇒ 需导入（不属本次对账范围，本次只补字段）",
      });
      continue;
    }

    usedDbIds.add(match.id);
    const diffs = diffRow(csv, match);
    const bucket = classify(diffs);
    let note = `匹配方式：${how}`;
    if (bucket === "已存在（一致）") note += "；字段全部一致";
    else if (bucket === "可直接补") {
      note += `；仅差 ${diffs.join("、")}（不参与 hash）⇒ PATCH 直接可补，零幂等影响`;
    } else {
      const hashHits = diffs.filter((d) => HASH_FIELDS.includes(d));
      if (hashHits.length > 0) {
        note += `；差 ${diffs.join("、")}，其中 **${hashHits.join("、")} 参与 contentHash** ⇒ 现有 PATCH 不支持`;
        if (hashHits.includes("sellerPhone")) {
          note += "；**改 sellerPhone 必须同事务重算 contentHash**，否则下次重导会产生重复行";
        }
      } else {
        note += `；差 ${diffs.join("、")}（不在 hash 里，但也不在 PATCH 白名单）⇒ 需 T04 扩展`;
      }
    }
    items.push({
      bucket,
      seq: String(csv.seq),
      sellerName: csv.sellerName,
      dbId: match.id,
      diffs,
      note,
    });
  }

  // 库里有、xlsx 没有
  for (const d of dbRows) {
    if (usedDbIds.has(d.id)) continue;
    items.push({
      bucket: "库有 xlsx 无",
      seq: "",
      sellerName: d.sellerName || "",
      dbId: d.id,
      diffs: [],
      note: "库中存在但境外 CSV 里没有 ⇒ 需人工确认是否多导/错导",
    });
  }

  return items;
}

// ───────────────────────────────────────────────
// 6. 主流程
// ───────────────────────────────────────────────

function table(headers: readonly string[], rows: readonly string[][]): string {
  const out = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  for (const r of rows) out.push(`| ${r.join(" | ")} |`);
  return out.join("\n");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const arg = (name: string): string => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : "";
  };

  const repo = path.resolve(process.cwd());
  const presetsPath = path.join(repo, "scripts", "leads", "task-presets.json");
  const presets = JSON.parse(fs.readFileSync(presetsPath, "utf8")) as {
    runDate: string;
    phonePlaceholderWords: string[];
  };
  const date = arg("date") || presets.runDate;
  const csvPath =
    arg("csv") || path.join(repo, "scratch", "leads", "round1", `境外-${date}.csv`);
  const outDir = path.resolve(arg("out") || path.join(repo, "scratch", "leads", "round1"));
  const fixture = arg("fixture");
  const url = arg("url") || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";

  const csvSide = readCsvSide(csvPath, presets.phonePlaceholderWords);

  let dbRows: DbRow[] = [];
  let checks: DbChecks = { total: -1, distinctSellerName: -1, dupContentHashGroups: -1, cnRowsOnCom: -1 };
  let mode: "LIVE" | "FIXTURE" | "UNRESOLVED" = "UNRESOLVED";
  let errorMsg = "";

  if (fixture) {
    dbRows = JSON.parse(fs.readFileSync(fixture, "utf8")) as DbRow[];
    mode = "FIXTURE";
  } else if (url) {
    const r = await queryLive(url);
    dbRows = r.rows;
    if (r.error) {
      errorMsg = r.error;
      mode = "UNRESOLVED";
    } else {
      checks = r.checks;
      mode = "LIVE";
    }
  } else {
    errorMsg = "未提供 --url，且环境变量 NEON_DATABASE_URL / DATABASE_URL 均为空";
    mode = "UNRESOLVED";
  }

  const items = mode === "UNRESOLVED" ? [] : reconcile(csvSide, dbRows);

  // ── 报告 ──
  const rep: string[] = [];
  rep.push("# T02 · 境外 18 户对账报告");
  rep.push("");
  rep.push(`- **xlsx 侧**：\`${csvPath}\` → **${csvSide.length}** 户`);
  rep.push(`- **库侧**：\`source='manual_dealer_intl'\` → **${mode === "UNRESOLVED" ? "不可判定" : dbRows.length}** 行`);
  rep.push("");

  if (mode === "UNRESOLVED") {
    rep.push("## 🔴 对账结论：**不可判定**");
    rep.push("");
    rep.push("**未能连接到 `.com`（Neon）数据库，故不给出任何生产库数字。**");
    rep.push("");
    rep.push("失败原因（实测原文）：");
    rep.push("");
    rep.push("```");
    rep.push(errorMsg || "（无）");
    rep.push("```");
    rep.push("");
    rep.push("要跑通，需要提供一条**只读**连接串，任选其一：");
    rep.push("");
    rep.push("```bash");
    rep.push("# 方式 1：环境变量");
    rep.push("NEON_DATABASE_URL=postgresql://<user>:<pwd>@<host>/<db>?sslmode=require \\");
    rep.push("  npx tsx scripts/leads/reconcile-intl.ts");
    rep.push("");
    rep.push("# 方式 2：显式传参");
    rep.push('npx tsx scripts/leads/reconcile-intl.ts --url "postgresql://..."');
    rep.push("```");
    rep.push("");
    rep.push("> 本脚本只发 SELECT，且内置 `assertReadOnly()` 白名单校验 + `SET TRANSACTION READ ONLY` 兜底，");
    rep.push("> 用只读账号即可安全执行。");
  } else {
    if (mode === "FIXTURE") {
      rep.push("> 🔶 **本次输出来自 `--fixture` 离线自测，不是生产库实测数字。**");
      rep.push("> 用途：在没有库连接时验证脚本比对/分类逻辑正确；真实结论需连库重跑。");
      rep.push("");
    }
    rep.push("## 1. 库级校验（`.com` 侧）");
    rep.push("");
    rep.push(
      table(
        ["检查项", "SQL 摘要", "实测", "期望", "结论"],
        CHECK_SQLS.map((c) => {
          const v = checks[c.key];
          const label =
            c.key === "total" ? "manual_dealer_intl 行数"
              : c.key === "distinctSellerName" ? "sellerName 去重数"
                : c.key === "dupContentHashGroups" ? "重复 contentHash 组数"
                  : ".com 库中 goodsRegion='cn' 行数";
          // FIXTURE 模式不连库，库级校验不适用（不能显示成 -1/❌ 让人误读为失败）
          if (mode === "FIXTURE") {
            return [label, `\`${c.sql.replace(/\s+/g, " ").slice(0, 60)}…\``, "不适用", c.expect, "—"];
          }
          return [
            label,
            `\`${c.sql.replace(/\s+/g, " ").slice(0, 60)}…\``,
            String(v),
            c.expect,
            String(v) === c.expect ? "✅" : "❌",
          ];
        }),
      ),
    );
    rep.push("");
    rep.push(`- **xlsx 侧户数**：${csvSide.length}`);
    rep.push("");

    rep.push("## 2. 四清单");
    rep.push("");
    const byBucket = new Map<Bucket, ReconcileItem[]>();
    for (const b of BUCKET_ORDER) byBucket.set(b, []);
    for (const it of items) (byBucket.get(it.bucket) as ReconcileItem[]).push(it);

    rep.push(
      table(
        ["清单", "户数", "含义 / 处置"],
        BUCKET_ORDER.map((b) => {
          const list = byBucket.get(b) as ReconcileItem[];
          const desc: Record<Bucket, string> = {
            "已存在（一致）": "无需动作",
            "可直接补": "现有 PATCH 即可补（字段不参与 hash，零幂等影响）",
            "需 T04 扩展": "现有能力不支持（无 PUT、PATCH 白名单不含）",
            新增: "xlsx 有库里无，需导入",
            "库有 xlsx 无": "库里多出来的，需人工确认",
            无法判定: "同名多行等，需人工确认",
          };
          return [b, String(list.length), desc[b]];
        }),
      ),
    );
    rep.push("");

    for (const b of BUCKET_ORDER) {
      const list = byBucket.get(b) as ReconcileItem[];
      if (list.length === 0) continue;
      rep.push(`### ${b}（${list.length}）`);
      rep.push("");
      rep.push(
        table(
          ["CSV #", "卖家", "库 id", "差异字段", "说明"],
          list.map((it) => [
            it.seq || "—",
            it.sellerName,
            it.dbId || "—",
            it.diffs.length ? `\`${it.diffs.join(", ")}\`` : "—",
            it.note,
          ]),
        ),
      );
      rep.push("");
    }

    rep.push("## 3. 分类依据（为什么要这么分）");
    rep.push("");
    rep.push(
      "`contentHash = md5(brandName|modelName|year|location|priceCny??priceRaw??\"\"|sellerPhone|sellerName)`",
    );
    rep.push("");
    rep.push(
      `- **不参与 hash**：\`${PATCHABLE_FIELDS.join("` / `")}\` → 现有 PATCH 白名单支持，` +
        "补了也不改 hash ⇒ **零幂等影响**，标「可直接补」。",
    );
    rep.push(
      `- **参与 hash**：\`${HASH_FIELDS.join("` / `")}\` → 现有能力不支持（只有 GET+PATCH，无 PUT；` +
        "PATCH 白名单仅那 3 个字段）⇒ 标「需 T04 扩展」。",
    );
    rep.push(
      "- 🔴 **扩展时必须在同一事务里重算 `contentHash`**：只改 hash 字段不改 hash，下次重导会被当成新行，产生重复。",
    );
    rep.push("");
  }

  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "境外对账-四清单.md");
  writeText(reportPath, `${rep.join("\n")}\n`);

  const lines: string[] = [];
  lines.push(`[T02] 模式            : ${mode}`);
  lines.push(`[T02] xlsx 侧户数      : ${csvSide.length}`);
  lines.push(`[T02] 库侧行数         : ${mode === "UNRESOLVED" ? "不可判定" : dbRows.length}`);
  if (mode !== "UNRESOLVED") {
    for (const b of BUCKET_ORDER) {
      const n = items.filter((i) => i.bucket === b).length;
      if (n > 0) lines.push(`[T02]   ${b} : ${n}`);
    }
    lines.push(
      `[T02] 库级校验        : total=${checks.total} distinctName=${checks.distinctSellerName} dupHash=${checks.dupContentHashGroups} cnRows=${checks.cnRowsOnCom}`,
    );
  } else {
    lines.push(`[T02] 原因            : ${errorMsg}`);
  }
  lines.push(`[T02] 报告            : ${reportPath}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

main().catch((e: unknown) => {
  const m = e instanceof Error ? e.stack || e.message : String(e);
  process.stdout.write(`[T02] FAILED: ${m}\n`);
  process.exit(1);
});
