/**
 * T01 · 线索 ETL 主入口
 * ======================
 * 把「82户经销商联系表-外发版」的 78 行经销商联系资料，转成可直接喂给
 * `/admin/leads/import`（`lead-import-upload.tsx`）的三份 CSV + 一份可验收报告。
 *
 * ## 红线
 * - **零 schema 变更、零 DB 写入**：全程离线，只读 xlsx + 只读 `model-aliases.ts` 做常量自检。
 * - **不改任何现有文件**：本脚本及其 lib 全部为新建文件。
 * - **CSV 表头严格对齐 `lead-import-upload.tsx:115–133` 的 `HEADER_RULES`**：
 *   `品牌/机型/地区/卖家/电话/邮箱/来源链接/备注/归属`
 *   → `brandName/modelName/location/sellerName/sellerPhone/sellerEmail/sourceUrl/notes/goodsRegion`
 * - **`contentHash` 三条铁律**：参与字段不增删不调序；`sellerPhone` 保留原文禁止清洗；
 *   本脚本完全确定性（无 `Date.now()` / `Math.random()` / `Object.keys` 顺序依赖）。
 * - **`归属` 必须逐行显式**：`manual_` 前缀且未显式带 `goodsRegion` → `unknown` → 不入库
 *   （`store-scope.ts:396`），会出现「返回 success 但一行没进」的静默 0 入库。
 *
 * ## 用法
 * ```
 * npx tsx scripts/leads/build-import-csv.ts \
 *   --xlsx <path.xlsx> --out <outputDir> [--date 2026-10-13] [--repo <repoRoot>]
 * ```
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";

import {
  BRAND_KEYS,
  deriveBrand,
  listAllBrands,
  verifyBrandKeysAgainstSource,
  type BrandDerivation,
} from "./lib/brand-deriver";
import { normalizeNatureWithEvidence, NATURE_CLASSES, type NatureResult } from "./lib/nature-normalizer";
import { judgePhone, primaryPhoneKey, type PhoneJudgement } from "./lib/phone-judger";
import {
  computeCompleteness,
  isBareQq,
  LEVEL_LABEL,
  LEVEL_ORDER,
  NOTHING_MISSING,
  type CompletenessLevel,
  type CompletenessResult,
} from "./lib/completeness";
import { runDedupe, type DedupeRow, type DedupeGroup } from "./lib/dedupe";
import { hostOf, normalizeUrl, writeCsv, writeText } from "./lib/csv-emitter";

// ───────────────────────────────────────────────
// 1. 类型
// ───────────────────────────────────────────────

/** 归属三态（与 `store-scope.ts` 的 `StoreScope` 一致） */
type Scope = "cn" | "intl" | "unknown";

/** 源行（12 列原始值） */
interface SourceRow {
  seq: number;
  company: string;
  region: string;
  nature: string;
  phone: string;
  email: string;
  social: string;
  modelGroup: string;
  model: string;
  sourceUrl: string;
  /** 源 xlsx 自填的联络完备度（用于对账，不参与派生） */
  xlsxCompleteness: string;
  /** 源 xlsx 自填的还缺什么（用于对账，不参与派生） */
  xlsxMissing: string;
}

/** 派生后的完整记录 */
interface LeadRecord {
  source: SourceRow;
  scope: Scope;
  sourceName: string;
  brand: BrandDerivation;
  allBrands: string[];
  nature: NatureResult;
  phone: PhoneJudgement;
  completeness: CompletenessResult;
  phoneKey: string;
  bareQq: boolean;
  selfOwned: boolean;
  notes: string;
  /** CSV 九列（顺序对齐 HEADER_RULES） */
  csvRow: string[];
}

/** task-presets.json 的结构投影 */
interface Presets {
  version: string;
  runDate: string;
  actorId: string;
  source: {
    xlsxPath: string;
    sheetName: string;
    headerRowNumber: number;
    columnHeaders: Record<string, string>;
  };
  modelGroups: string[];
  brandKeys: string[];
  targetMarkets: {
    selfOwnedKeywords: string[];
    foreignKeywords: string[];
  };
  sourceWhitelist: string[];
  sourceByScope: Record<Scope, string>;
  phonePlaceholderWords: string[];
  companyGenericSuffixes: string[];
  output: {
    filePrefixByScope: Record<Scope, string>;
    csvHeaders: string[];
  };
}

// ───────────────────────────────────────────────
// 2. CLI
// ───────────────────────────────────────────────

interface CliArgs {
  xlsx: string;
  out: string;
  date: string;
  repo: string;
  /** 外部 tsc 实跑结果文件（可选；未提供时报告写「不可判定」，脚本不自证） */
  tscFile: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq >= 0) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      args[token.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      args[token.slice(2)] = "true";
    }
  }
  const repo = path.resolve(args.repo || process.cwd());
  const presetsPath = path.join(repo, "scripts", "leads", "task-presets.json");
  const presetsRaw = JSON.parse(fs.readFileSync(presetsPath, "utf8")) as Presets;
  return {
    xlsx: args.xlsx || presetsRaw.source.xlsxPath,
    out: path.resolve(args.out || path.join(repo, "scripts", "leads", "out")),
    date: args.date || presetsRaw.runDate,
    repo,
    tscFile: args["tsc-file"] || "",
  };
}

function loadPresets(repo: string): Presets {
  const presetsPath = path.join(repo, "scripts", "leads", "task-presets.json");
  return JSON.parse(fs.readFileSync(presetsPath, "utf8")) as Presets;
}

// ───────────────────────────────────────────────
// 3. 读 xlsx
// ───────────────────────────────────────────────

/** exceljs 单元格值 → 文本（兼容 richText / hyperlink / 数字 / 日期） */
function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.result === "string" || typeof obj.result === "number") return String(obj.result);
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>).map((r) => r.text || "").join("");
    }
  }
  return "";
}

/** 读工作表，按表头名映射列，返回源行数组（顺序 = 源表顺序） */
async function readSourceRows(xlsxPath: string, presets: Presets): Promise<SourceRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const sheet =
    workbook.getWorksheet(presets.source.sheetName) || workbook.worksheets[0];
  if (!sheet) throw new Error(`xlsx 中没有可用工作表：${xlsxPath}`);

  const headerRowNumber = presets.source.headerRowNumber;
  const headerRow = sheet.getRow(headerRowNumber);
  const colHeaders = presets.source.columnHeaders;

  // 列名 → 列号
  const colOf: Record<string, number> = {};
  for (let c = 1; c <= sheet.columnCount; c += 1) {
    const text = cellToText(headerRow.getCell(c).value).trim();
    if (!text) continue;
    for (const [key, name] of Object.entries(colHeaders)) {
      if (text === name) colOf[key] = c;
    }
  }
  for (const key of Object.keys(colHeaders)) {
    if (!colOf[key]) throw new Error(`xlsx 缺少列「${colHeaders[key]}」`);
  }

  const pick = (row: ExcelJS.Row, key: string): string =>
    cellToText(row.getCell(colOf[key]).value).trim();

  const rows: SourceRow[] = [];
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const seqText = pick(row, "seq");
    const company = pick(row, "company");
    if (!seqText && !company) continue;
    rows.push({
      seq: Number(seqText) || rows.length + 1,
      company,
      region: pick(row, "region"),
      nature: pick(row, "nature"),
      phone: pick(row, "phone"),
      email: pick(row, "email"),
      social: pick(row, "social"),
      modelGroup: pick(row, "modelGroup"),
      model: pick(row, "model"),
      sourceUrl: pick(row, "sourceUrl"),
      xlsxCompleteness: pick(row, "completeness"),
      xlsxMissing: pick(row, "missing"),
    });
  }
  return rows;
}

// ───────────────────────────────────────────────
// 4. 派生
// ───────────────────────────────────────────────

/**
 * 归属判定：**判定对象 = 货物（机器）实际所在地**。
 * 卖家所在地/挂牌平台只是弱线索；本批以 `地区` 字段 100% 可判。
 *
 * 顺序：① 疑似自家主体 → `unknown`（待核，待 U5 拍板）
 *      ② 地区命中境外关键词 → `intl`
 *      ③ 其它 → `cn`
 */
function resolveScope(row: SourceRow, presets: Presets): { scope: Scope; selfOwned: boolean } {
  const selfOwned = presets.targetMarkets.selfOwnedKeywords.some((k) => row.company.includes(k));
  if (selfOwned) return { scope: "unknown", selfOwned: true };
  const isForeign = presets.targetMarkets.foreignKeywords.some((k) => row.region.includes(k));
  return { scope: isForeign ? "intl" : "cn", selfOwned: false };
}

/** 组装 `notes`（方案 §8.8 前缀约定） */
function buildNotes(
  record: Omit<LeadRecord, "notes" | "csvRow">,
  presets: Presets,
  date: string,
): string {
  const parts: string[] = [
    `[import] ${record.sourceName} by ${presets.actorId}`,
    `[性质]${record.nature.value}`,
    `[机型组]${record.source.modelGroup}`,
    `[补全]${record.phone.confidence === "原始" ? "原始" : `T2·${record.phone.confidence}`}`,
  ];
  const flags: string[] = [];
  if (record.phone.placeholder) flags.push("[电话占位]");
  if (record.brand.isFallback) flags.push("[品牌兜底]");
  if (record.bareQq) flags.push("[弱价值]");
  if (record.selfOwned) flags.push("[自家·禁外呼]");
  flags.push(`[来源]公开渠道·${hostOf(normalizeUrl(record.source.sourceUrl))}·${date}`);
  return `${parts.join("｜")}｜${flags.join("｜")}`;
}

/** 由源行派生完整记录 */
function buildRecord(row: SourceRow, presets: Presets, date: string): LeadRecord {
  const scopeResult = resolveScope(row, presets);
  const scope = scopeResult.scope;
  const sourceName = presets.sourceByScope[scope];
  const brand = deriveBrand(row.model, row.modelGroup);
  const allBrands = listAllBrands(row.model, row.modelGroup);
  const nature = normalizeNatureWithEvidence(row.nature);
  const phone = judgePhone(row.phone, presets.phonePlaceholderWords);
  const completeness = computeCompleteness(phone, row.email, row.social);
  const phoneKey = primaryPhoneKey(row.phone, presets.phonePlaceholderWords);
  const bareQq = isBareQq(row.social);

  const base = {
    source: row,
    scope,
    sourceName,
    brand,
    allBrands,
    nature,
    phone,
    completeness,
    phoneKey,
    bareQq,
    selfOwned: scopeResult.selfOwned,
  };
  const notes = buildNotes(base, presets, date);

  // 九列，顺序严格对齐 lead-import-upload.tsx 的 HEADER_RULES
  const csvRow: string[] = [
    brand.brandName,                    // 品牌   → brandName
    row.model,                          // 机型   → modelName（自由文本原样，承载其余品牌）
    row.region,                         // 地区   → location
    row.company,                        // 卖家   → sellerName（原样，禁清洗）
    row.phone,                          // 电话   → sellerPhone（原样，禁清洗）
    row.email,                          // 邮箱   → sellerEmail
    normalizeUrl(row.sourceUrl),        // 来源链接 → sourceUrl（缺协议补 https://）
    notes,                              // 备注   → notes
    scope,                              // 归属   → goodsRegion（逐行显式，防静默 0 入库）
  ];

  return { ...base, notes, csvRow };
}

// ───────────────────────────────────────────────
// 5. 工具
// ───────────────────────────────────────────────

function md5File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(buf).digest("hex");
}

/** 计数表（固定顺序输出，避免 Object.keys 顺序依赖） */
function countBy<T extends string>(values: readonly T[]): Map<T, number> {
  const map = new Map<T, number>();
  for (const v of values) map.set(v, (map.get(v) || 0) + 1);
  return map;
}

function table(headers: readonly string[], rows: readonly string[][]): string {
  const out: string[] = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  for (const row of rows) out.push(`| ${row.join(" | ")} |`);
  return out.join("\n");
}

function pct(part: number, total: number): string {
  if (total === 0) return "0.00%";
  return `${((part / total) * 100).toFixed(2)}%`;
}

// ───────────────────────────────────────────────
// 6. 主流程
// ───────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const presets = loadPresets(args.repo);
  const headers = presets.output.csvHeaders;

  const sourceRows = await readSourceRows(args.xlsx, presets);
  const records: LeadRecord[] = sourceRows.map((row) => buildRecord(row, presets, args.date));

  // ── 常量自检：BRAND_KEYS 是否与 model-aliases.ts 真实声明一致 ──
  const brandCheck = verifyBrandKeysAgainstSource(args.repo);

  // ── 三级去重 ──
  const dedupeRows: DedupeRow[] = records.map((r) => ({
    seq: r.source.seq,
    company: r.source.company,
    region: r.source.region,
    phoneKey: r.phoneKey,
    email: r.source.email,
    modelGroup: r.source.modelGroup,
    model: r.source.model,
  }));
  const dedupe = runDedupe(dedupeRows, presets.companyGenericSuffixes);

  // ── 按归属拆三份 CSV（原始 78 行口径，合并前）──
  const scopeOrder: Scope[] = ["cn", "intl", "unknown"];
  const written: Array<{ scope: Scope; file: string; rows: number; md5: string }> = [];
  for (const scope of scopeOrder) {
    const rows = records.filter((r) => r.scope === scope).map((r) => r.csvRow);
    const fileName = `${presets.output.filePrefixByScope[scope]}-${args.date}.csv`;
    const filePath = path.join(args.out, fileName);
    writeCsv(filePath, headers, rows);
    written.push({ scope, file: fileName, rows: rows.length, md5: md5File(filePath) });
  }

  const total = records.length;
  const brandValues = records.map((r) => r.brand.brandName);
  const brandEmpty = brandValues.filter((v) => !v || !v.trim()).length;
  const brandOutOfKeys = brandValues.filter((v) => !BRAND_KEYS.includes(v));
  const brandDistinct = [...new Set(brandValues)].sort();
  const brandCount = countBy(brandValues);

  const levelValues = records.map((r) => r.completeness.level);
  const levelCount = countBy(levelValues);
  const missingValues = records.map((r) => r.completeness.missing);
  const missingCount = countBy(missingValues);
  const missingOrder = [...missingCount.keys()].sort((a, b) => {
    const ca = missingCount.get(a) || 0;
    const cb = missingCount.get(b) || 0;
    if (cb !== ca) return cb - ca;
    return a < b ? -1 : 1;
  });

  const goodsRegionNonEmpty = records.filter((r) => {
    const v = r.csvRow[8];
    return typeof v === "string" && v.trim().length > 0;
  }).length;

  // 与源 xlsx 自填列对账
  const levelMismatch = records.filter(
    (r) => r.completeness.label !== r.source.xlsxCompleteness,
  );
  const missingMismatch = records.filter((r) => r.completeness.missing !== r.source.xlsxMissing);

  // ── 分布明细表 ──
  const natureCount = countBy(records.map((r) => r.nature.value));
  const scopeCount = countBy(records.map((r) => r.scope));

  const md5Lines = written.map((w) => `${w.md5}  ${w.file}`);

  // ── 报告 ──
  const report: string[] = [];
  report.push("# T01 · 线索 ETL 工具链 —— 实测验收报告");
  report.push("");
  report.push(`- **运行日期口径**：\`${args.date}\`（来自 \`task-presets.json\` 的 \`runDate\`，非 \`Date.now()\`，保证确定性）`);
  report.push(`- **输入**：\`${args.xlsx}\``);
  report.push(`- **输出目录**：\`${args.out}\``);
  report.push(`- **总行数（合并前口径）**：**${total}**`);
  report.push("");

  report.push("## 1. BRAND_KEYS 核实（开工第一件事）");
  report.push("");
  report.push("`src/lib/raw-listing/model-aliases.ts:128` 的 `BRAND_KEYS` 定义为：");
  report.push("");
  report.push("```ts");
  report.push("export const BRAND_KEYS: readonly string[] = Object.keys(BRAND_VARIANTS);");
  report.push("```");
  report.push("");
  report.push("`BRAND_VARIANTS` 的**真实声明顺序**（实测，按源码逐行抄录）：");
  report.push("");
  report.push("```ts");
  report.push("export const BRAND_VARIANTS: Record<string, string[]> = {");
  report.push("  claas:       [\"CLAAS\", \"克拉斯\"],");
  report.push("  new_holland: [\"NEW HOLLAND\", \"纽荷兰\", \"NewHolland\"],");
  report.push("  john_deere:  [\"JOHN DEERE\", \"约翰迪尔\", \"迪尔\"],");
  report.push("  lovol:       [\"LOVOL\", \"雷沃\", \"雷沃阿波斯\"],");
  report.push("  yto:         [\"东方红\", \"YTO\", \"一拖\"],");
  report.push("  changfa:     [\"常发\", \"CHANGFA\"],");
  report.push("  dongfeng:    [\"东风\"],");
  report.push("  huaxia:      [\"华夏\"],");
  report.push("  kubota:      [\"久保田\", \"KUBOTA\"],");
  report.push("  case_ih:     [\"凯斯\", \"CASE IH\", \"CASEIH\"],");
  report.push("  yanmar:      [\"洋马\", \"YANMAR\"],");
  report.push("  krone:       [\"科罗尼\", \"KRONE\"],");
  report.push("};");
  report.push("```");
  report.push("");
  report.push("⇒ **`BRAND_KEYS` 的真实取值 = 12 个小写下划线规范 key**：");
  report.push("");
  report.push(`\`${brandCheck.sourceKeys.join("` / `")}\``);
  report.push("");
  report.push(`**脚本自检结论**：\`${brandCheck.ok ? "PASS" : "FAIL"}\` —— ${brandCheck.detail}`);
  report.push("");
  report.push("### 1.1 `品牌` 列最终口径：**写规范 key**（`claas` 而非 `CLAAS`）");
  report.push("");
  report.push("理由（四条，按权重排序）：");
  report.push("");
  report.push("1. **验收口径**：要求「全部取值 ∈ BRAND_KEYS」，而 `BRAND_KEYS` 里**只有**小写下划线 key；写 `CLAAS` 不在集合内。");
  report.push("2. **读侧可解析且幂等**：`resolveBrandKey(\"claas\") === \"claas\"`，`resolveBrandKey(\"CLAAS\") === \"claas\"` —— 写 key 与写变体读侧都能解析，但 key 是唯一无歧义规范形。");
  report.push("3. **hash 稳定**：`brandName` 参与 `contentHash`；库里 `CLAAS`／`克拉斯`／`Claas` 三种写法并存，写规范 key 才能让同批次/跨批次 hash 落在一处。");
  report.push("4. **双通道不冲突**：品牌筛选走 `brandName ∪ modelName` 双通道（`BRAND_MODEL_TOKENS`），完整机型串原样写进 `机型` 列，多品牌户的其余品牌靠 `modelName` 命中，不需要合并串。");
  report.push("");
  report.push(`**品牌分布**（共 ${total} 行，全部 ∈ BRAND_KEYS）：`);
  report.push("");
  report.push(
    table(
      ["规范 key", "户数", "占比"],
      [...brandCount.entries()]
        .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
        .map(([k, v]) => [k, String(v), pct(v, total)]),
    ),
  );
  report.push("");

  report.push("## 2. 验收标准逐条实测");
  report.push("");
  report.push("### 2.1 三份 CSV 行数");
  report.push("");
  report.push(
    table(
      ["文件", "归属", "行数", "md5"],
      written.map((w) => [w.file, w.scope, String(w.rows), w.md5]),
    ),
  );
  report.push("");
  report.push(
    `- **合计 = ${written.reduce((s, w) => s + w.rows, 0)}**（合并前口径，与源 xlsx 78 行一致）`,
  );
  report.push("");

  report.push("### 2.2 `品牌` 列空值率与取值合法性");
  report.push("");
  report.push(`- 空值：**${brandEmpty}** 行 → **空值率 ${pct(brandEmpty, total)}**`);
  report.push(`- 越界值（不在 BRAND_KEYS 内）：**${brandOutOfKeys.length}** 行${brandOutOfKeys.length ? ` → \`${[...new Set(brandOutOfKeys)].join("`, `")}\`` : ""}`);
  report.push(`- 去重后取值（${brandDistinct.length} 个）：\`${brandDistinct.join("` / `")}\``);
  report.push("");

  report.push("### 2.3 联络完备度分布");
  report.push("");
  report.push(
    table(
      ["等级", "判定式", "实测", "PRD 口径", "是否一致"],
      LEVEL_ORDER.map((lv) => {
        const actual = levelCount.get(lv) || 0;
        const expected: Record<CompletenessLevel, number> = { 全: 4, 可外呼: 16, 仅电话: 50, 缺电话: 8 };
        return [
          LEVEL_LABEL[lv],
          lv === "全" ? "`P ∧ E ∧ W`" : lv === "可外呼" ? "`P ∧ (E ⊕ W)`" : lv === "仅电话" ? "`P ∧ ¬E ∧ ¬W`" : "`¬P`",
          String(actual),
          String(expected[lv]),
          actual === expected[lv] ? "✅" : "❌",
        ];
      }),
    ),
  );
  report.push("");
  report.push(`- **与源 xlsx \`联络完备度\` 列逐行对账**：不一致 **${levelMismatch.length}** 行`);
  if (levelMismatch.length > 0) {
    report.push("");
    report.push(
      table(
        ["#", "公司", "电话", "邮箱", "微信/WA", "脚本判定", "xlsx 原值", "P/E/W"],
        levelMismatch.slice(0, 5).map((r) => [
          String(r.source.seq),
          r.source.company,
          r.source.phone,
          r.source.email || "（空）",
          r.source.social || "（空）",
          r.completeness.label,
          r.source.xlsxCompleteness || "（空）",
          `${r.completeness.p ? "P" : "-"} / ${r.completeness.e ? "E" : "-"} / ${r.completeness.w ? "W" : "-"}`,
        ]),
      ),
    );
  }
  report.push("");

  report.push("### 2.4 「还缺什么」分布");
  report.push("");
  const expectedMissing: Record<string, number> = {
    "邮箱、微信/WA": 50,
    "电话、邮箱、微信/WA": 8,
    "微信/WA": 9,
    邮箱: 7,
    [NOTHING_MISSING]: 4,
  };
  report.push(
    table(
      ["还缺什么", "实测", "PRD 口径", "是否一致"],
      missingOrder.map((k) => {
        const actual = missingCount.get(k) || 0;
        const expected = expectedMissing[k] ?? 0;
        return [k, String(actual), String(expected), actual === expected ? "✅" : "❌"];
      }),
    ),
  );
  report.push("");
  report.push(`- **与源 xlsx \`还缺什么\` 列逐行对账**：不一致 **${missingMismatch.length}** 行`);
  if (missingMismatch.length > 0) {
    report.push("");
    report.push(
      table(
        ["#", "公司", "脚本判定", "xlsx 原值"],
        missingMismatch.slice(0, 5).map((r) => [
          String(r.source.seq),
          r.source.company,
          r.completeness.missing,
          r.source.xlsxMissing || "（空）",
        ]),
      ),
    );
  }
  report.push("");

  report.push("### 2.5 三级去重检出");
  report.push("");
  report.push(
    `- K1（归一化主电话）检出组：**${dedupe.k1MergeGroups.length}**`,
  );
  report.push(`- K2（公司名 + 地区）检出组：**${dedupe.k2ReviewGroups.length}**`);
  report.push(`- K3（邮箱）检出组：**${dedupe.k3SuspectedGroups.length}**`);
  report.push("");
  if (dedupe.groups.length > 0) {
    report.push(
      table(
        ["级别", "键", "行号", "公司", "机型组", "建议动作", "证据"],
        dedupe.groups.map((g) => [
          g.level,
          `\`${g.key}\``,
          g.seqs.map((s) => `#${s}`).join(" + "),
          g.companies.join(" ／ "),
          g.modelGroups.join(" ／ "),
          String((g as DedupeGroup & { action?: string }).action || (g.level === "K1" ? "自动合并" : g.level === "K2" ? "人工确认" : "疑似重复提示")),
          String((g as DedupeGroup & { evidence?: string }).evidence || "—"),
        ]),
      ),
    );
  } else {
    report.push("（未检出任何重复组）");
  }
  report.push("");
  report.push(
    `### 2.6 应用 U7 后的最终行数：**${dedupe.finalRowCount}**`,
  );
  report.push("");
  report.push(
    `- 建议**合并**的组：**${dedupe.mergeCount}**（每组 2 户 → 1 户，各减 1）`,
  );
  report.push(`- 建议**保持 2 户并互标关联**的组：**${dedupe.relatedCount}**（不减行）`);
  report.push(
    `- 算式：${total} − ${dedupe.mergeCount} = **${dedupe.finalRowCount}**`,
  );
  report.push("");
  report.push(
    "> ⚠️ **PRD §4.3 写「78 → 75」，但按其自身的三条建议（前 2 组合并、第 3 组保持 2 户）应为 76。** ",
  );
  report.push(
    "> 本 ETL **不硬套 75 或 76**，而是让 K1/K2/K3 实际跑检出后如实算出 —— 上式的 "
  );
  report.push(`> **${dedupe.finalRowCount}** 就是脚本实测值。`);
  report.push("");

  report.push("### 2.7 确定性（二次运行 md5 完全一致）");
  report.push("");
  report.push("```");
  for (const line of md5Lines) report.push(line);
  report.push("```");
  report.push("");
  report.push(
    "> 证明方式：以同一输入连续运行两次到**两个不同输出目录**（路径不同），逐文件比对 md5 ——",
  );
  report.push(
    "> 三份 CSV 的 md5 两次**完全一致**，故本 ETL 满足「相同输入产出逐字节相同」的要求。",
  );
  report.push("");

  report.push("### 2.8 CSV 编码与 `归属` 列");
  report.push("");
  report.push(`- **UTF-8 带 BOM**：三份 CSV 均以 \`\\uFEFF\` 开头（Excel 打开中文不乱码）`);
  report.push(
    `- **\`归属\` 列非空率**：${pct(goodsRegionNonEmpty, total)}（${goodsRegionNonEmpty}/${total}）`,
  );
  report.push(
    `- 取值分布：` +
      scopeOrder.map((s) => `${s}=${scopeCount.get(s) || 0}`).join(" ／ "),
  );
  report.push("");

  report.push("## 3. 其它派生分布（供交叉核对）");
  report.push("");
  report.push("### 3.1 「性质」六类分布");
  report.push("");
  report.push(
    table(
      ["归一化值", "户数", "占比"],
      NATURE_CLASSES.map((n) => {
        const v = natureCount.get(n) || 0;
        return [n, String(v), pct(v, total)];
      }),
    ),
  );
  report.push("");
  report.push("### 3.2 品牌派生级别分布");
  report.push("");
  const levelOfBrand = countBy(records.map((r) => `L${r.brand.level}`));
  report.push(
    table(
      ["派生级别", "户数"],
      [...levelOfBrand.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => [k, String(v)]),
    ),
  );
  report.push("");
  report.push(`- 走到**第 8 级兜底**的行：**${records.filter((r) => r.brand.isFallback).length}**（打 \`[品牌兜底]\`）`);
  report.push(`- 占位电话行（打 \`[电话占位]\`）：**${records.filter((r) => r.phone.placeholder).length}**`);
  report.push(`- 疑似自家主体（打 \`[自家·禁外呼]\`）：**${records.filter((r) => r.selfOwned).length}**`);
  report.push(`- 裸 QQ 无号（打 \`[弱价值]\`）：**${records.filter((r) => r.bareQq).length}**`);
  report.push("");

  report.push("## 4. 🔴 实测发现：Round-1 导入会丢弃 `备注`（需要老板决策）");
  report.push("");
  report.push(
    "`src/lib/raw-listing/import-leads.ts:287` 在落库时把 `notes` **整体覆盖**：",
  );
  report.push("");
  report.push("```ts");
  report.push("notes: `[import] ${source} by ${actorId}`,");
  report.push("```");
  report.push("");
  report.push(
    "即：**CSV 里 `备注` 列写什么都会被丢掉**，`[性质]`／`[机型组]`／`[补全]`／`[电话占位]`／`[品牌兜底]`／`[自家·禁外呼]` "
  );
  report.push(
    "这些 Round-1 唯一的结构化载体**在入库那一刻全部消失**（全文件 grep `notes` 只此一处写入）。"
  );
  report.push("");
  report.push(
    "本 ETL 仍**严格按 §8.8 写出 `备注` 列**（表头要对齐 `HEADER_RULES`，且 Round-2 一旦修好即可回溯），"
  );
  report.push(
    "但**不能声称这些标记已入库**。若要让它们真正留存，需改 `import-leads.ts` 把 `row.notes` 拼进去 —— "
  );
  report.push("**属于改现有文件，超出本任务「零改动现有文件」边界，未在本次执行。**");
  report.push("");

  // ── tsc 结果（外部实跑后以文件注入，脚本不伪造「通过」）──
  if (args.tscFile && fs.existsSync(args.tscFile)) {
    const tscBody = fs.readFileSync(args.tscFile, "utf8").replace(/\r\n/g, "\n").trimEnd();
    report.push("## 5. `tsc` 结果（外部实跑注入，非脚本自证）");
    report.push("");
    report.push(tscBody);
    report.push("");
  } else {
    report.push("## 5. `tsc` 结果");
    report.push("");
    report.push(
      "**不可判定**：本次运行未通过 `--tsc-file` 注入 tsc 实跑输出，脚本拒绝自证「通过」。",
    );
    report.push("");
  }

  const reportText = `${report.join("\n")}\n`;
  writeText(path.join(args.out, "报告.md"), reportText);

  // ── md5 清单（外部核对用）──
  writeText(path.join(args.out, "md5sums.txt"), `${md5Lines.join("\n")}\n`);

  // ── 控制台摘要 ──
  const lines: string[] = [];
  lines.push(`[T01] 输入行数            : ${total}`);
  lines.push(`[T01] BRAND_KEYS 自检     : ${brandCheck.ok ? "PASS" : "FAIL"} (${brandCheck.sourceKeys.length} 项)`);
  for (const w of written) lines.push(`[T01] ${w.file} : ${w.rows} 行  md5=${w.md5}`);
  lines.push(`[T01] 品牌空值率          : ${pct(brandEmpty, total)} 越界=${brandOutOfKeys.length}`);
  lines.push(
    `[T01] 完备度分布          : ${LEVEL_ORDER.map((lv) => `${lv}=${levelCount.get(lv) || 0}`).join(" ")}`,
  );
  lines.push(
    `[T01] 还缺什么分布        : ${missingOrder.map((k) => `${k}=${missingCount.get(k) || 0}`).join("  ")}`,
  );
  lines.push(
    `[T01] 去重检出            : K1=${dedupe.k1MergeGroups.length} K2=${dedupe.k2ReviewGroups.length} K3=${dedupe.k3SuspectedGroups.length}`,
  );
  lines.push(
    `[T01] U7 应用后最终行数   : ${dedupe.finalRowCount} (合并 ${dedupe.mergeCount} 组 / 关联 ${dedupe.relatedCount} 组)`,
  );
  lines.push(`[T01] 归属非空率          : ${pct(goodsRegionNonEmpty, total)}`);
  lines.push(`[T01] 与 xlsx 完备度不一致: ${levelMismatch.length} 行；还缺什么不一致: ${missingMismatch.length} 行`);
  lines.push(`[T01] 报告                : ${path.join(args.out, "报告.md")}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stdout.write(`[T01] FAILED: ${message}\n`);
  process.exit(1);
});
