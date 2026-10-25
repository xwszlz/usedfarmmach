/**
 * scripts/seed-dealers.ts — AI 销售策略 · 渠道经销商池幂等种子（T1）
 * ─────────────────────────────────────────────────────────
 * 数据源（人工整理、公开渠道，见 scratch/leads/round1/）：
 *   - 境内-2026-10-13.csv  → partition=cn   （约 58 户）
 *   - 境外-2026-10-13.csv  → partition=intl （约 36 户）
 *   - 待核-2026-10-13.csv  → 归属 unknown，不入库（转人工核实）
 *
 * 运行（在「迁移窗口」由运维/部署侧执行；本脚本绝不自动连生产库）：
 *   # .cn 站（阿里云 RDS，DATABASE_URL_CN）：境内 58 + 境外快照 36
 *   SITE=cn DATABASE_URL_CN='postgresql://USER:PASS@host:5432/cn_db' \
 *     npx tsx scripts/seed-dealers.ts --scope=cn
 *   # .com 站（Neon，DATABASE_URL）：仅境外 36
 *   SITE=com DATABASE_URL='postgresql://USER:PASS@host:5432/com_db' \
 *     npx tsx scripts/seed-dealers.ts --scope=intl
 *   # 本地开发全量（写入当前 SITE 对应库）
 *   npx tsx scripts/seed-dealers.ts --scope=all
 *   # 仅解析并预览（不连库）
 *   npx tsx scripts/seed-dealers.ts --dry-run
 *
 * 幂等：以 contentHash 为唯一键 upsert，可重复执行。
 * 合规红线：仅按 --scope 选库；.cn 库同时承载 cn + intl 快照（inbound，数据不出境），
 *          .com 库不写入任何境内 PII。本脚本不引入任何 CSV 解析依赖（内联最小解析器）。
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// ───────────────────────────────────────────────
// 0. 参数 / 常量
// ───────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const SCOPE = (() => {
  for (const a of args) {
    const m = /^--scope=(cn|intl|all)$/.exec(a);
    if (m) return m[1] as "cn" | "intl" | "all";
  }
  return "all" as const;
})();

/** 对齐 store-scope.ts 的 source 命名 */
const SOURCE_MANUAL_DEALER = "manual_dealer";
const SOURCE_MANUAL_DEALER_INTL = "manual_dealer_intl";

const REPO_ROOT = path.resolve(__dirname, "..");
const DOMESTIC_CSV = path.join(REPO_ROOT, "scratch", "leads", "round1", "境内-2026-10-13.csv");
const INTL_CSV = path.join(REPO_ROOT, "scratch", "leads", "round1", "境外-2026-10-13.csv");

// ───────────────────────────────────────────────
// 1. 最小 CSV 解析（支持引号转义、BOM、嵌入逗号）
// ───────────────────────────────────────────────

/**
 * 解析标准 CSV 文本为二维字符串数组。
 * 处理：首行 BOM、双引号包裹字段、"" 转义、字段内逗号/换行。
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  // 去除 UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // 收尾最后一行（若文件未以换行结尾）
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ───────────────────────────────────────────────
// 2. 字段解析工具
// ───────────────────────────────────────────────

/** 形如 [标签]值 或 [标签]值｜后续 —— 取「标签」与「紧随其后的内容（到 ｜ 或 [ 或结尾）」 */
function extractBracket(note: string): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  const re = /\[([^\]]+)\]([^［［]*?)(?=｜|\[|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(note)) !== null) {
    out.push({ label: m[1].trim(), value: m[2].trim() });
  }
  return out;
}

/** 从备注取 [性质] 值 */
function extractNature(note: string): string | null {
  const hit = extractBracket(note).find((b) => b.label === "性质");
  return hit && hit.value ? hit.value : null;
}

/**
 * 解析 tags：元数据标签（import / 性质 / 机型组 / 来源）丢弃（已映射到独立字段），
 * 合规关键标签（电话占位 / 自家·禁外呼 / 弱价值）保留标签名，
 * 其余（补全 → 值、同号·关联 → 值）取「值或标签」。
 */
function extractTags(note: string): string[] {
  const META_SKIP = new Set(["import", "性质", "机型组", "来源"]);
  const COMPLIANCE_TAG = new Set(["电话占位", "自家·禁外呼", "弱价值"]);
  const out: string[] = [];
  for (const { label, value } of extractBracket(note)) {
    if (META_SKIP.has(label)) continue; // 元数据，丢弃
    if (COMPLIANCE_TAG.has(label)) {
      out.push(label); // 合规关键标签保留标签名
      continue;
    }
    out.push(value || label); // 补全→原始/T2·高；同号·关联→值
  }
  // 去重
  return Array.from(new Set(out.map((t) => t.trim()).filter(Boolean)));
}

/** 是否有「像电话」的内容（含 3 位以上连续数字） */
function isPhoneLike(v: string): boolean {
  return /\d{3,}/.test(v);
}

/** 从 机型 列 + 备注[机型组] 提取机型组 token 列表（去重、限量） */
function extractModels(machine: string, note: string): string[] {
  const out: string[] = [];
  // 1) 机型列：去掉【】、（）内注释，再按常见分隔符拆分
  const cleaned = machine
    .replace(/【[^】]*】/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "");
  const toks = cleaned
    .split(/[／/|｜、,，+\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[A-Za-z0-9]/.test(s));
  out.push(...toks);
  // 2) 备注 [机型组]850+2504/2204
  const mg = note.match(/\[机型组\]([^｜\[]*)/);
  if (mg) {
    mg[1]
      .split(/[+/、]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => out.push(s));
  }
  // 去重（大小写不敏感），限量 15
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of out) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(t);
    if (result.length >= 15) break;
  }
  return result;
}

// ───────────────────────────────────────────────
// 3. 行 → Dealer 记录映射
// ───────────────────────────────────────────────

export interface DealerSeedRecord {
  name: string | null;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  brands: string[];
  models: string[];
  regions: string[];
  location: string | null;
  source: string;
  partition: "cn" | "intl";
  nature: string | null;
  grade: "A" | "B" | "C";
  sourceUrl: string | null;
  note: string;
  tags: string[];
  contentHash: string;
}

/** 按 §3.4（T5 grading 规则的预填版）推导 grade */
function precomputeGrade(nature: string | null, hasContact: boolean): "A" | "B" | "C" {
  if (nature && nature.includes("授权经销商")) return "A";
  if (hasContact) return "B";
  return "C";
}

function mapRow(cols: string[], fallbackPartition: "cn" | "intl"): DealerSeedRecord | null {
  // 列序：品牌,机型,地区,卖家,电话,邮箱,来源链接,备注,归属
  if (cols.length < 9) return null;
  const [brand, machine, region, seller, phoneRaw, emailRaw, sourceUrl, note, scope] = cols;

  // 归属（最后一列）决定分区；未知归属的行直接跳过（不入库）
  const partition: "cn" | "intl" = scope.trim() === "intl" ? "intl" : scope.trim() === "cn" ? "cn" : fallbackPartition;
  if (partition !== "cn" && partition !== "intl") return null;

  const phone = isPhoneLike(phoneRaw) ? phoneRaw.trim() : null;
  const email = emailRaw.includes("@") ? emailRaw.trim() : null;
  const hasContact = !!phone || !!email;
  const nature = extractNature(note);
  const grade = precomputeGrade(nature, hasContact);

  const record: DealerSeedRecord = {
    name: seller.trim() || null,
    phone,
    wechat: null,
    email,
    brands: brand.trim() ? [brand.trim().toLowerCase()] : [],
    models: extractModels(machine, note),
    regions: region.trim() ? [region.trim()] : [],
    location: region.trim() || null,
    source: partition === "intl" ? SOURCE_MANUAL_DEALER_INTL : SOURCE_MANUAL_DEALER,
    partition,
    nature,
    grade,
    sourceUrl: sourceUrl.trim() || null,
    note: note.trim(),
    tags: extractTags(note),
    // 幂等键：行内容签名
    contentHash: createHash("sha256")
      .update([brand, machine, region, seller, phoneRaw, emailRaw, sourceUrl, scope].join("|"))
      .digest("hex"),
  };
  return record;
}

function parseFile(filePath: string, fallbackPartition: "cn" | "intl"): DealerSeedRecord[] {
  const raw = readFileSync(filePath, "utf-8");
  const rows = parseCsv(raw);
  // 跳过表头（首行含「品牌」）
  const dataRows = rows.filter((r) => r[0] && r[0] !== "品牌");
  const records: DealerSeedRecord[] = [];
  for (const r of dataRows) {
    const rec = mapRow(r, fallbackPartition);
    if (rec) records.push(rec);
  }
  return records;
}

// ───────────────────────────────────────────────
// 4. 选库 + 主流程
// ───────────────────────────────────────────────

function resolveTargetDb(scope: "cn" | "intl" | "all"): { url: string; label: string } {
  const site = (process.env.SITE ?? "com").toLowerCase();
  if (scope === "cn") {
    const url = process.env.DATABASE_URL_CN;
    if (!url) throw new Error("[seed-dealers] scope=cn 需要设置 DATABASE_URL_CN（.cn 站数据库）");
    return { url, label: ".cn (DATABASE_URL_CN)" };
  }
  if (scope === "intl") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("[seed-dealers] scope=intl 需要设置 DATABASE_URL（.com 站数据库）");
    return { url, label: ".com (DATABASE_URL)" };
  }
  // all：写入当前 SITE 对应库（本地开发用）
  if (site === "cn") {
    const url = process.env.DATABASE_URL_CN;
    if (!url) throw new Error("[seed-dealers] SITE=cn 需要设置 DATABASE_URL_CN");
    return { url, label: ".cn (DATABASE_URL_CN)" };
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("[seed-dealers] SITE=com 需要设置 DATABASE_URL");
  return { url, label: ".com (DATABASE_URL)" };
}

async function main() {
  const scope = SCOPE;
  const site = (process.env.SITE ?? "com").toLowerCase();

  // 决定要入库哪些分区
  let wantCn = false;
  let wantIntl = false;
  if (scope === "cn") {
    wantCn = true;
    wantIntl = true;
  } else if (scope === "intl") {
    wantIntl = true;
  } else {
    // all
    if (site === "cn") {
      wantCn = true;
      wantIntl = true;
    } else {
      wantIntl = true;
    }
  }

  const domestic = wantCn ? parseFile(DOMESTIC_CSV, "cn") : [];
  const intl = wantIntl ? parseFile(INTL_CSV, "intl") : [];
  const records = [...domestic, ...intl];

  console.log(
    `[seed-dealers] scope=${scope} site=${site} → 解析到 cn=${domestic.length} 户, intl=${intl.length} 户`
  );

  // 预览模式：不连库
  if (DRY_RUN) {
    // 抽样打印前 2 条，便于核对字段映射
    for (const sample of records.slice(0, 2)) {
      console.log("[dry-run] sample:", JSON.stringify(sample, null, 2));
    }
    console.log("[seed-dealers] DRY-RUN 完成，未写入任何数据库。");
    return;
  }

  const { url, label } = resolveTargetDb(scope);
  console.log(`[seed-dealers] 目标库：${label}`);

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  let upserted = 0;
  let updated = 0;
  for (const r of records) {
    const existing = await prisma.dealer.findUnique({ where: { contentHash: r.contentHash } });
    await prisma.dealer.upsert({
      where: { contentHash: r.contentHash },
      update: {
        name: r.name,
        phone: r.phone,
        wechat: r.wechat,
        email: r.email,
        brands: r.brands,
        models: r.models,
        regions: r.regions,
        location: r.location,
        source: r.source,
        partition: r.partition,
        nature: r.nature,
        grade: r.grade,
        sourceUrl: r.sourceUrl,
        note: r.note,
        tags: r.tags,
      },
      create: {
        name: r.name,
        phone: r.phone,
        wechat: r.wechat,
        email: r.email,
        brands: r.brands,
        models: r.models,
        regions: r.regions,
        location: r.location,
        source: r.source,
        partition: r.partition,
        nature: r.nature,
        grade: r.grade,
        sourceUrl: r.sourceUrl,
        note: r.note,
        tags: r.tags,
        contentHash: r.contentHash,
        productId: null,
      },
    });
    if (existing) updated++;
    else upserted++;
  }

  console.log(
    `[seed-dealers] 完成：新增 ${upserted} 户，更新 ${updated} 户，合计 ${records.length} 户（幂等键 contentHash）。`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[seed-dealers] 失败：", err);
  process.exit(1);
});
