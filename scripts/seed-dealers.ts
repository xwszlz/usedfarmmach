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
 *
 * T06 增量（additive）：回填 Dealer 新增 8 列中的 5 个派生列
 *   country / city / contactPerson / role / sourcePage
 *   · priority / suggestedPrice **不写**（只由 LLM 判定或运营人工指定，seed 禁止编造；
 *     且 update 分支不赋值 ⇒ 重复跑不会擦掉人工值）
 *   · followStatus **不写**（交给 schema @default("未联系")，同样不覆盖运营已改的状态）
 *   · contentHash 参与字段与 CSV 列序零改动 ⇒ 回填天然幂等，不会造成孤儿记录
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
// ⚠️ 脚本内禁用 "@/..." 别名（tsx 与 tsconfig paths 解析不一致），一律相对路径
import { splitCountryCity } from "../src/lib/sales-strategy/derive";

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
// 2.5 T06 增量解析：country / city / contactPerson / role / sourcePage
// ───────────────────────────────────────────────

// 国家/城市拆分：**唯一实现**在 N02 的 derive.ts（arch §3.6），本脚本只 import 不复制实现。
// ⚠️ 脚本内禁用 "@/..." 别名（tsx 与 tsconfig paths 解析不一致），必须相对路径。
// import 已置于文件头：import { splitCountryCity } from "../src/lib/sales-strategy/derive";

/**
 * 从备注提取联系人：**只认显式标记**，绝不从公司名/邮箱前缀猜测。
 * 支持形态：`[联系人]张三`、`[联系人]张三｜…`、`联系人：张三`、`联系人: 张三`。
 * 无标记 → null。
 */
export function extractContactPerson(note: string): string | null {
  if (!note) return null;
  // ① 括号形态
  const bracket = extractBracket(note).find((b) => b.label === "联系人");
  if (bracket) {
    const v = bracket.value.replace(/^[:：\s]+/, "").trim();
    if (v) return v;
  }
  // ② 中文冒号形态（不含括号）
  const m = /联系人\s*[:：]\s*([^｜|\[［,，\n]+)/.exec(note);
  if (m) {
    const v = m[1].trim();
    if (v) return v;
  }
  return null;
}

/** 角色关键词 → 8 值枚举；先命中先定档，全部不命中 → null（不猜） */
const ROLE_RULES: ReadonlyArray<{ keywords: readonly string[]; role: string }> = [
  { keywords: ["生产厂商", "品牌总部", "原厂", "制造商"], role: "原厂" },
  { keywords: ["授权经销商", "授权经销", "总代理", "独家代理"], role: "授权经销" },
  { keywords: ["拍卖行", "拍卖平台"], role: "拍卖行" },
  { keywords: ["进口商", "进口贸易"], role: "进口商" },
  { keywords: ["二手商", "二手设备", "二手农机"], role: "二手商" },
  { keywords: ["物流", "货代", "报关", "清关"], role: "物流" },
  { keywords: ["政府", "农机局", "农业部门", "政府采购"], role: "政府" },
  { keywords: ["个人卖家", "终端用户", "终端客户", "农场主"], role: "终端" },
];

/**
 * 从 nature（性质）优先、note 兜底映射渠道角色。
 * 注意：「普通经销商」不含「授权」⇒ 不映射（保持 null，避免把非授权渠道包装成授权经销）。
 */
export function resolveRole(nature: string | null, note: string | null): string | null {
  const haystack = [nature ?? "", note ?? ""].join("｜");
  if (!haystack.trim()) return null;
  for (const rule of ROLE_RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) return rule.role;
  }
  return null;
}

/**
 * 溯源页：优先显式标记（`[来源页]` / `[溯源]` / `[来源]`），
 * 其次在备注里捞人工调研文件形态（`w1_europe.md ①官网imprint`）。无 → null。
 */
export function extractSourcePage(note: string): string | null {
  if (!note) return null;
  const bracket = extractBracket(note).find(
    (b) => b.label === "来源页" || b.label === "溯源" || b.label === "来源"
  );
  if (bracket && bracket.value) return bracket.value.trim() || null;
  // 形如 w1_europe.md ①官网imprint（允许 ②/③… 与标题尾随，到分隔符为止）
  const m = /w\d+_[A-Za-z0-9_]+\.md(?:\s*[①-⑳][^｜|\[［,，\n]*)?/.exec(note);
  if (m) return m[0].trim();
  return null;
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
  // ── T06 增量派生列（additive，均不参与 contentHash）──
  /** 国家/地区（location 解析；境内恒「中国」） */
  country: string | null;
  /** 城市/省州（location 解析；多数行只写国别 ⇒ null） */
  city: string | null;
  /** 联系人（仅 note 显式标记；当前 CSV 无此标记 ⇒ 基本为 null） */
  contactPerson: string | null;
  /** 渠道角色枚举（nature/note 关键词映射） */
  role: string | null;
  /** 溯源页（note 的 [来源] / 调研文件串） */
  sourcePage: string | null;
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
  const noteText = note.trim();
  const nature = extractNature(noteText);
  const grade = precomputeGrade(nature, hasContact);

  const { country, city } = splitCountryCity(region.trim() || null, partition);

  const record: DealerSeedRecord = {
    name: seller.trim() || null,
    phone,
    wechat: null,
    email,
    brands: brand.trim() ? [brand.trim().toLowerCase()] : [],
    models: extractModels(machine, noteText),
    regions: region.trim() ? [region.trim()] : [],
    location: region.trim() || null,
    source: partition === "intl" ? SOURCE_MANUAL_DEALER_INTL : SOURCE_MANUAL_DEALER,
    partition,
    nature,
    grade,
    sourceUrl: sourceUrl.trim() || null,
    note: noteText,
    tags: extractTags(noteText),
    // 幂等键：行内容签名
    // 🔴 红线：参与 hash 的 8 个值（brand/machine/region/seller/phoneRaw/emailRaw/sourceUrl/scope）
    //         一个都不能改，新增 8 列一个都不能进 —— 否则全部记录会新增一套、旧记录变孤儿。
    contentHash: createHash("sha256")
      .update([brand, machine, region, seller, phoneRaw, emailRaw, sourceUrl, scope].join("|"))
      .digest("hex"),
    // ── T06 增量派生列（不参与 hash，重复执行只是把同样的派生值再写一遍）──
    country,
    city,
    contactPerson: extractContactPerson(noteText),
    role: resolveRole(nature, noteText),
    sourcePage: extractSourcePage(noteText),
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

/**
 * dry-run 报告：打印前 3 行含新增列的解析结果 + 各派生列命中率。
 * 输出内电话/邮箱一律脱敏（脚本是公开日志，避免 PII 二次扩散）。
 */
function printDryRunReport(records: DealerSeedRecord[]): void {
  const total = records.length;
  // 样本：前 3 行 + 境外前 2 行（境外才是 country/city 拆分的主战场，必须人工核验）
  const head = records.slice(0, 3);
  const intlHead = records.filter((r) => r.partition === "intl").slice(0, 2);
  const samples: DealerSeedRecord[] = [];
  for (const r of [...head, ...intlHead]) {
    if (!samples.includes(r)) samples.push(r);
  }

  console.log(`[dry-run] 新列解析样本（${samples.length} 行，电话/邮箱已脱敏）：`);
  samples.forEach((r, i) => {
    console.log(
      `  #${i + 1} partition=${r.partition} name=${r.name ?? "—"} location=${r.location ?? "—"}` +
        ` → country=${r.country ?? "null"} city=${r.city ?? "null"} role=${r.role ?? "null"}` +
        ` contactPerson=${r.contactPerson ?? "null"} sourcePage=${r.sourcePage ?? "null"}` +
        ` priority=null suggestedPrice=null followStatus="未联系"`
    );
    console.log(
      `      phone=${maskPhoneText(r.phone)} email=${maskEmailText(r.email)} nature=${r.nature ?? "null"}`
    );
  });

  const count = (fn: (r: DealerSeedRecord) => boolean): number => records.filter(fn).length;
  const pct = (n: number): string => (total === 0 ? "0.0%" : `${((n / total) * 100).toFixed(1)}%`);
  const hitCountry = count((r) => !!r.country);
  const hitCity = count((r) => !!r.city);
  const hitRole = count((r) => !!r.role);
  const hitSource = count((r) => !!r.sourcePage);
  const hitContact = count((r) => !!r.contactPerson);

  console.log("[dry-run] 派生列命中率：");
  console.log(`  country      ${hitCountry}/${total} (${pct(hitCountry)})`);
  console.log(`  city         ${hitCity}/${total} (${pct(hitCity)})`);
  console.log(`  role         ${hitRole}/${total} (${pct(hitRole)})`);
  console.log(`  sourcePage   ${hitSource}/${total} (${pct(hitSource)})`);
  console.log(`  contactPerson ${hitContact}/${total} (${pct(hitContact)})  ← 只认 [联系人] 显式标记，故预期≈0`);

  // role 未命中的性质分布（便于判断是"词表缺词"还是"确实无法归类"）
  const roleMissNatures = Array.from(
    new Set(records.filter((r) => !r.role).map((r) => r.nature ?? "(无 nature)"))
  );
  console.log(`  role 未命中的 nature 取值：${roleMissNatures.length ? roleMissNatures.join(" / ") : "无"}`);
  console.log(
    "[dry-run] priority / suggestedPrice 恒不写（LLM 判定 + 运营覆盖）；followStatus 走 schema 默认值。"
  );
  console.log("[seed-dealers] DRY-RUN 完成，未写入任何数据库。");
}

/** 电话脱敏：取首个号码的纯数字，保留前缀 3 位 + 末 2 位（彻底丢弃括号里的人名等） */
function maskPhoneText(phone: string | null): string {
  if (!phone) return "—";
  const first = phone.split(/[；;,，]/)[0] ?? "";
  const digits = first.replace(/\D/g, "");
  if (digits.length <= 5) return "***";
  return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
}

/** 邮箱脱敏：首字符 + *** + 域名 */
function maskEmailText(email: string | null): string {
  if (!email) return "—";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
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

  // 预览模式：不连库（dry-run 必须先于 resolveTargetDb 返回，避免误连生产库）
  if (DRY_RUN) {
    printDryRunReport(records);
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
        // ── T06 增量派生列（additive）──
        country: r.country,
        city: r.city,
        sourcePage: r.sourcePage,
        // 联系人/角色：仅当本次解析出值时才覆盖，避免重复执行擦掉运营人工补录
        ...(r.contactPerson ? { contactPerson: r.contactPerson } : {}),
        ...(r.role ? { role: r.role } : {}),
        // priority / suggestedPrice / followStatus 一律不赋值：
        // priority 只由 LLM 判定或运营人工指定，seed 不得编造；followStatus 走 @default("未联系")。
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
        // ── T06 增量派生列（additive）；priority/suggestedPrice 恒 null，followStatus 走默认 ──
        country: r.country,
        city: r.city,
        contactPerson: r.contactPerson,
        role: r.role,
        sourcePage: r.sourcePage,
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
