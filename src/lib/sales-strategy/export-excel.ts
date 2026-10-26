/**
 * AI 销售策略 · Excel 经销商联系表渲染
 * ─────────────────────────────────────────────────────────
 * 双版式（`BuildExcelOptions.layout`）：
 *   - `1`（默认，legacy）：1 Sheet × 11 列 —— 即 T3 现状，**行为逐字节不变**。
 *     `__tests__/export.test.ts`（11 列表头 / `rowCount===1`）与
 *     `export/excel/__tests__/route.test.ts`（Sheet1 有微信列）共 20 个既有用例依赖它。
 *   - `2`（T11）：三 Sheet —— `渠道联系总表`(14) / `机型价格速查`(7 + 汇率基准行) / `必办清单`(5)。
 *     逐列规格 = PRD §4.0–§4.3，验收断言 = PRD §7 C1–C3'。
 *
 * 合规红线（PII 门禁不放宽）：
 *   - 明文唯一条件是 `dealer.id ∈ unlockedSet`（`unlockedSet` 由路由依据
 *     `PiiAuditLog.field = "unlock:dealer_<id>"` 构建）；
 *   - 未解锁行必须走统一出口 `@/lib/pii` 的 `maskPhone` / `maskEmail`，
 *     **禁止手写 slice / replace**；
 *   - 微信无公网标准 → 未解锁统一占位 `微信:********`；**layout 2 的微信列已移出主表**（PRD §4.4）；
 *   - `联系人`（自然人姓名）与电话/邮箱走**同一** `unlockedSet` 门禁（PRD §4.1.2，默认从严）。
 *
 * 降级唯一入口：Sheet2/Sheet3 的兜底一律来自 `derive.ts` 的 `normalizeDecisionFields`，
 * 本文件**不另造一套默认值**（PRD §1.4 硬约束），只做「归一化结果 → 单元格」的映射。
 */

import * as ExcelJS from "exceljs";
import { maskPhone, maskEmail } from "@/lib/pii";
import {
  DIRECTION_ORDER,
  gradeToPriority,
  normalizeDecisionFields,
  resolveDirection,
  type DecisionEnv,
  type DirectionBucket,
  type NormalizedStrategy,
} from "./derive";
import {
  COMPLIANCE_OWNERS,
  EMPTY_CELL,
  FX_BASE,
  NOT_FOUND,
  PRIORITIES,
  WEB_EVIDENCE_STATUSES,
  type ComplianceOwner,
  type ComplianceStatus,
  type MarketAxis,
  type Priority,
  type WebEvidenceStatus,
} from "./strategy-schema";
import type { BuildExcelLayout, ExcelDealerInput } from "./export-types";
import type { StrategyLlmResult } from "./prompt";

/** `buildExcel` 的可选参数（版式开关 + layout 2 的数据源）。 */
export interface BuildExcelOptions {
  /** 版式：`1` = legacy 单 Sheet（默认），`2` = 三 Sheet。缺省按 `1` 处理。 */
  layout?: BuildExcelLayout;
  /** Sheet2（机型价格速查）/ Sheet3（必办清单）的数据源；`layout 2` 下缺省则走降级文案。 */
  strategy?: StrategyLlmResult | null;
  /**
   * 外部检索状态（`strategy-schema.WebEvidenceStatus` 的字符串）。
   * 非 `ok` 时 Sheet2「备注」列追加 `外部检索未接入`；缺省视同 `ok`。
   */
  webStatus?: string;
}

// ═══════════════════════════════════════════════════════════
// 常量：Sheet 名 / 表头 / 配色 / 列宽
// ═══════════════════════════════════════════════════════════

/** Sheet1「渠道联系总表」14 列（PRD §4.1，逐字；半角括号、无空格） */
const SHEET1_HEADERS_ZH: readonly string[] = [
  "序号",
  "方向",
  "公司名",
  "国家地区",
  "城市",
  "联系人",
  "电话",
  "邮箱",
  "网址",
  "主营品牌/业务",
  "建议报价参考",
  "优先级",
  "跟进状态",
  "来源页",
];

/** 英文站 Sheet1 表头（同列同序） */
const SHEET1_HEADERS_EN: readonly string[] = [
  "#",
  "Direction",
  "Company",
  "Country",
  "City",
  "Contact",
  "Phone",
  "Email",
  "Website",
  "Brands / Business",
  "Price Reference",
  "Priority",
  "Follow-up",
  "Source Page",
];

/** Sheet1 列宽（电话/序号按 PRD §4.0 取 ≥16） */
const SHEET1_WIDTHS: readonly number[] = [16, 14, 32, 14, 14, 16, 22, 28, 24, 32, 28, 10, 12, 28];

/**
 * Sheet2 的 4 个价格列 ↔ 价格轴（顺序即列序；`新机对标` 不在价格列，下沉到「备注」）。
 * 表头用**半角括号**，与样板 `高端圆捆机4台-全球渠道联系表` 逐字一致。
 */
const PRICE_COLUMNS: ReadonlyArray<{ zh: string; en: string; axis: MarketAxis }> = [
  { zh: "国内(二手估)", en: "China (used est.)", axis: "国内" },
  { zh: "欧洲(二手净价)", en: "Europe (used net)", axis: "欧洲" },
  { zh: "中亚(FOB建议)", en: "Central Asia (FOB)", axis: "中亚" },
  { zh: "非洲中东澳新", en: "Africa / ME / SA / ANZ", axis: "非洲中东澳新" },
];

/** Sheet2 列宽（对齐样板：30/18/20/18/30/20/30） */
const SHEET2_WIDTHS: readonly number[] = [30, 18, 20, 18, 30, 20, 30];

/** Sheet3「必办清单」5 列（PRD §4.3，逐字） */
const SHEET3_HEADERS_ZH: readonly string[] = ["#", "事项", "负责", "时限", "状态"];
const SHEET3_HEADERS_EN: readonly string[] = ["#", "Task", "Owner", "Deadline", "Status"];
const SHEET3_WIDTHS: readonly number[] = [8, 58, 12, 14, 12];

/** 表头浅灰底 / S 行浅红底（PRD §4.0「表头加粗 + 浅灰底；仅优先级 S 整行浅红底」） */
const HEADER_FILL_ARGB = "FFEEEEEE";
const PRIORITY_S_FILL_ARGB = "FFFFE5E5";

/** 汇率基准行 A 列文案（PRD §4.2） */
const FX_ROW_LABEL = "汇率基准";
const FX_ROW_LABEL_EN = "FX basis";

/** 币种识别（注意：`¥` 是人民币符号，**不得**据此判定 JPY） */
const FX_CURRENCY_RE: Readonly<Record<keyof typeof FX_BASE, RegExp>> = {
  EUR: /€|\bEUR\b/i,
  USD: /\$|\bUSD\b/i,
  JPY: /\bJPY\b|日元|円/,
};

// ═══════════════════════════════════════════════════════════
// 通用工具（纯函数，可单测）
// ═══════════════════════════════════════════════════════════

/** 空值统一 `—`（PRD §4.0：不用空串，空串无法区分「没数据」和「漏填」） */
function cellOf(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  return s || EMPTY_CELL;
}

/** 多电话统一用全角 `；` 保留主次（样板：`+49 40 5729 0308；+49 15888 279050`） */
function joinPhones(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return EMPTY_CELL;
  const parts = s
    .split(/[/、,，;；]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return EMPTY_CELL;
  return parts.join("；");
}

/** 多邮箱统一用 ` / ` 分隔（样板：`info@e-farm.com / sales@e-farm.com`） */
function joinEmails(raw: string | null | undefined): string {
  const parts = splitEmailList(raw);
  if (parts.length === 0) return EMPTY_CELL;
  return parts.join(" / ");
}

/** 拆分多邮箱（`/`、逗号、分号、全角标点均视为分隔符） */
function splitEmailList(raw: string | null | undefined): string[] {
  const s = (raw ?? "").trim();
  if (!s) return [];
  return s
    .split(/[/,，;；]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * 脱敏多邮箱：**逐个地址**走 `maskEmail` 再拼回。
 *
 * ⚠️ 安全要点（这不是「脱敏强度不够」，是「根本没脱敏」）：
 * `maskEmail` 只处理第一个 `@`，`"zhangsan@a.com / lisi@b.com"` 会被整体脱成
 * `"zh***@a.com / lisi@b.com"` —— **第二个及以后地址的本地部分与域名全裸**。
 * 一行多邮箱是本项目的数据常态（seed 里同一经销商挂 2–3 个邮箱很常见），
 * 故必须拆开逐个脱敏。**legacy(layout 1) 与 v2(layout 2) 共用本函数**：
 * legacy 曾经的 `maskEmail(d.email)` 已被判定为线上正在发生的 PII 泄漏，于 T11 修复。
 *
 * @returns 空输入 → `""`（legacy 语义：空单元格）；否则各地址脱敏后以 ` / ` 连接
 */
function maskEmailAddresses(raw: string | null | undefined): string {
  const parts = splitEmailList(raw);
  if (parts.length === 0) return "";
  return parts
    .map((p) => maskEmail(p))
    .filter(Boolean)
    .join(" / ");
}

/** v2 语义的脱敏多邮箱：空输入统一 `—`（PRD §4.0 空值口径） */
function maskEmailList(raw: string | null | undefined): string {
  return maskEmailAddresses(raw) || EMPTY_CELL;
}

/**
 * `sourceUrl` → 去协议取域名（PRD §4.1 第 9 列）。
 *
 * `https://en.tec24.com/zh/contact` → `en.tec24.com`（保留子域，仅剥 `www.`）。
 */
function toDomain(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return EMPTY_CELL;
  const withoutScheme = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "").replace(/^\/\//, "");
  const host = withoutScheme.split(/[/?#]/)[0].trim();
  if (!host) return EMPTY_CELL;
  return host.replace(/^www\./i, "") || EMPTY_CELL;
}

/** `brands.join(" / ")` + ` · ` + `nature`；两者皆空 → `—`（PRD §4.1 第 10 列） */
function brandsAndBusiness(brands: string[] | undefined, nature: string | null | undefined): string {
  const list = Array.isArray(brands) ? brands.map((b) => (b ?? "").trim()).filter(Boolean) : [];
  const nat = (nature ?? "").trim();
  if (list.length === 0 && !nat) return EMPTY_CELL;
  if (list.length === 0) return nat;
  if (!nat) return list.join(" / ");
  return `${list.join(" / ")} · ${nat}`;
}

/** 公司名兜底：`未命名渠道 <id 前 6 位>`（PRD §4.1 第 3 列） */
function companyName(name: string | null | undefined, id: string): string {
  const s = (name ?? "").trim();
  if (s) return s;
  return `未命名渠道 ${(id ?? "").slice(0, 6) || "??????"}`;
}

/** 优先级：`Dealer.priority` → 非法/空则 `gradeToPriority(grade)`（**永不自动生成 S**） */
function resolvePriority(d: ExcelDealerInput): Priority {
  const raw = (d.priority ?? "").trim().toUpperCase();
  const hit = PRIORITIES.find((p) => p === raw);
  return hit ?? gradeToPriority(d.grade);
}

/** 跟进状态：`Dealer.followStatus`，缺省 `未联系`（PRD §4.1 第 13 列） */
function resolveFollowStatus(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  return s || "未联系";
}

/** 把 `opts.webStatus` 归一到合法枚举；`error` 视为 `disabled`（不可用），缺省视同 `ok` */
function normalizeWebStatus(raw: string | undefined): WebEvidenceStatus {
  const v = (raw ?? "").trim();
  if (v === "error") return "disabled";
  return WEB_EVIDENCE_STATUSES.find((s) => s === v) ?? "ok";
}

/**
 * 汇率基准文案：按本策略**实际出现**的币种动态裁剪（PRD §4.2）。
 *
 * 全部币种都没识别到时回落完整文案，保证该行永远不为空。
 */
function buildFxNote(priceTexts: readonly string[]): string {
  const all = priceTexts.join(" ");
  const keys = Object.keys(FX_BASE) as Array<keyof typeof FX_BASE>;
  const present = keys.filter((k) => FX_CURRENCY_RE[k].test(all));
  const picked = present.length > 0 ? present : keys;
  return picked.map((k) => `1 ${k}≈${FX_BASE[k]}元`).join("、");
}

/** 表头样式：加粗 + 浅灰底 + 首行冻结 + 自动筛选盖住全部列（PRD §4.0） */
function applyTableShell(ws: ExcelJS.Worksheet, columnCount: number): void {
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true };
  for (let c = 1; c <= columnCount; c += 1) {
    const cell = headerRow.getCell(c);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL_ARGB } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  }
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount },
  };
}

/** 文本列：整列 + 每个数据格都设 `numFmt='@'`（防号码变科学计数法，PRD §4.0） */
function applyTextFormat(ws: ExcelJS.Worksheet, columnIndex: number, rowCount: number): void {
  ws.getColumn(columnIndex).numFmt = "@";
  for (let r = 2; r <= rowCount; r += 1) {
    ws.getRow(r).getCell(columnIndex).numFmt = "@";
  }
}

// ═══════════════════════════════════════════════════════════
// buildExcel —— 对外唯一入口（双版式）
// ═══════════════════════════════════════════════════════════

/**
 * 生成经销商联系表（Excel）。PII 门禁：
 *   dealer.id ∈ unlockedSet → 明文电话/微信/邮箱/联系人；否则 maskPhone/maskEmail 脱敏。
 *
 * @param dealers      经销商输入（携带明文联系方式，由路由安全读取）
 * @param unlockedSet  本用户已解锁的经销商 id 集合（`unlock:dealer_<id>` 剥前缀后）
 * @param locale       语言，`zh`（默认）/ `en`
 * @param opts         版式与数据源；`{ layout?: 1 | 2; strategy?; webStatus? }`，默认 `1`
 * @returns xlsx 字节（Node `Buffer`）
 */
export async function buildExcel(
  dealers: ExcelDealerInput[],
  unlockedSet: Set<string>,
  locale: "zh" | "en" = "zh",
  opts?: BuildExcelOptions
): Promise<Buffer> {
  // 版式解析：缺省 / 非法值一律回落 legacy(1)，保证旧客户端与既有断言行为不变。
  const layout: BuildExcelLayout = opts?.layout === 2 ? 2 : 1;
  if (layout === 2) {
    // T11：三 Sheet 版式（渠道联系总表 14 列 / 机型价格速查 7 列 / 必办清单 5 列）。
    // 独立函数实现，**不复用**下方 legacy 代码路径，确保 layout 1 行为逐字节不变。
    return buildExcelSheets(dealers, unlockedSet, locale === "en" ? "en" : "zh", opts);
  }

  const zh = locale !== "en";
  const wb = new ExcelJS.Workbook();
  wb.creator = "usedfarmmach";
  wb.created = new Date();
  const ws = wb.addWorksheet(zh ? "经销商联系表" : "Dealer Contacts");

  const headers = zh
    ? ["分区", "分级", "品牌", "机型组", "地区", "性质", "名称", "电话", "微信", "邮箱", "来源链接"]
    : ["Partition", "Grade", "Brand", "Models", "Region", "Nature", "Name", "Phone", "WeChat", "Email", "Source"];
  ws.columns = headers.map((h) => ({ header: h, width: 18 }));

  const partitionLabel = (p: "cn" | "intl") => (p === "cn" ? (zh ? "境内" : "Domestic") : zh ? "跨境" : "Intl");

  for (const d of dealers) {
    const unlocked = unlockedSet.has(d.id);
    const phoneCell = unlocked ? d.phone || "" : maskPhone(d.phone);
    // PII 修复（T11 裁决）：改为**逐地址**脱敏；单邮箱输出与旧实现逐字相同，
    // 多邮箱不再泄漏第二个及以后的完整地址。空值仍保持空串（不改 legacy 单元格口径）。
    const emailCell = unlocked ? d.email || "" : maskEmailAddresses(d.email);
    const wechatCell = unlocked ? d.wechat || "" : d.wechat ? (zh ? "微信:********" : "WeChat:********") : "";

    ws.addRow([
      partitionLabel(d.partition),
      d.grade ?? "",
      (d.brands || []).join(" / "),
      (d.models || []).join(" / "),
      (d.regions || []).join(" / "),
      d.nature ?? "",
      d.name ?? "",
      phoneCell,
      wechatCell,
      emailCell,
      d.sourceUrl ?? "",
    ]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ═══════════════════════════════════════════════════════════
// layout 2：三 Sheet
// ═══════════════════════════════════════════════════════════

/**
 * 三 Sheet 版式的实现（layout = 2）。
 *
 * Sheet 顺序（PRD §4.0）：1 渠道联系总表 → 2 机型价格速查 → 3 必办清单。
 *
 * @param dealers      经销商输入
 * @param unlockedSet  已解锁经销商 id 集合（PII 门禁唯一依据）
 * @param locale       `zh` / `en`
 * @param opts         `strategy` / `webStatus` 数据源
 */
async function buildExcelSheets(
  dealers: ExcelDealerInput[],
  unlockedSet: Set<string>,
  locale: "zh" | "en",
  opts?: BuildExcelOptions
): Promise<Buffer> {
  const zh = locale !== "en";
  const strategy = opts?.strategy ?? null;
  const webStatus = normalizeWebStatus(opts?.webStatus);

  const wb = new ExcelJS.Workbook();
  wb.creator = "usedfarmmach";
  wb.created = new Date();

  // ── Sheet 1：渠道联系总表（14 列）─────────────────────────
  const ws1 = wb.addWorksheet(zh ? "渠道联系总表" : "Dealer Contacts");
  ws1.columns = (zh ? SHEET1_HEADERS_ZH : SHEET1_HEADERS_EN).map((h, i) => ({
    header: h,
    width: SHEET1_WIDTHS[i] ?? 18,
  }));
  const sheet1Rows = buildChannelRows(dealers, unlockedSet, zh);
  for (const row of sheet1Rows) ws1.addRow(row.cells);

  applyTableShell(ws1, SHEET1_HEADERS_ZH.length);
  // 序号（第 1 列）/ 电话（第 7 列）设文本格式，防科学计数法
  applyTextFormat(ws1, 1, sheet1Rows.length + 1);
  applyTextFormat(ws1, 7, sheet1Rows.length + 1);
  // 仅优先级 = S 整行浅红底（其他档不着色，避免与 grade 色阶打架）
  sheet1Rows.forEach((row, index) => {
    if (row.priority !== "S") return;
    const excelRow = ws1.getRow(index + 2);
    for (let c = 1; c <= SHEET1_HEADERS_ZH.length; c += 1) {
      excelRow.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: PRIORITY_S_FILL_ARGB },
      };
    }
  });

  // ── Sheet 2：机型价格速查（7 列 + 汇率基准行）──────────────
  const norm = normalizeStrategyForSheets(strategy, dealers, webStatus);
  const ws2 = wb.addWorksheet(zh ? "机型价格速查" : "Price Quick Reference");
  const sheet2Headers = zh
    ? ["机型", ...PRICE_COLUMNS.map((c) => c.zh), "最优去向", "备注"]
    : ["Equipment", ...PRICE_COLUMNS.map((c) => c.en), "Best Destination", "Note"];
  ws2.columns = sheet2Headers.map((h, i) => ({ header: h, width: SHEET2_WIDTHS[i] ?? 20 }));

  const sheet2 = buildPriceRows(norm, zh, webStatus);
  for (const row of sheet2.rows) ws2.addRow(row);
  // 汇率基准行：A = 汇率基准，B = 服务端常量（按实际币种裁剪），其余列留空（PRD §4.2）
  const fxRow = new Array<string>(sheet2Headers.length).fill("");
  fxRow[0] = zh ? FX_ROW_LABEL : FX_ROW_LABEL_EN;
  fxRow[1] = buildFxNote(sheet2.priceTexts);
  ws2.addRow(fxRow);

  applyTableShell(ws2, sheet2Headers.length);

  // ── Sheet 3：必办清单（5 列）──────────────────────────────
  const ws3 = wb.addWorksheet(zh ? "必办清单" : "Action Checklist");
  ws3.columns = (zh ? SHEET3_HEADERS_ZH : SHEET3_HEADERS_EN).map((h, i) => ({
    header: h,
    width: SHEET3_WIDTHS[i] ?? 14,
  }));
  const sheet3 = buildChecklistRows(norm, strategy, zh);
  for (const row of sheet3.rows) ws3.addRow(row);
  applyTableShell(ws3, SHEET3_HEADERS_ZH.length);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Sheet1 的一行（`priority`/`direction` 保留供排序与 S 高亮，不重复出现在 cells 里） */
interface ChannelRow {
  direction: DirectionBucket;
  priority: Priority;
  id: string;
  cells: string[];
}

/**
 * Sheet1「渠道联系总表」行构造 + 排序。
 *
 * 排序键（PRD §4.1 第 1 列）：方向分组序（`DIRECTION_ORDER`）→ `priority`(S>A>B>C) → `id`；
 * `序号` 为排序后的**全局连续** 1..N。
 *
 * PII 门禁：电话 / 邮箱 / 联系人 三列同源于 `unlockedSet`，无例外。
 */
function buildChannelRows(
  dealers: ExcelDealerInput[],
  unlockedSet: Set<string>,
  zh: boolean
): ChannelRow[] {
  const rows: ChannelRow[] = dealers.map((d) => {
    const unlocked = unlockedSet.has(d.id);

    // 方向：**必须同时传 regions 与 country**（只传 country 会把无 country 的行全归「其他」，
    // regions 正则才是兜底关键 —— 架构师实测结论）。
    const direction = resolveDirection({
      partition: d.partition === "cn" ? "cn" : "intl",
      country: d.country,
      regions: d.regions,
    });
    const priority = resolvePriority(d);

    // 联系人：纳入 PII 门禁。未解锁且有值 → 已隐藏；本来就没值 → —（不谎报「有但隐藏」）。
    const contactRaw = (d.contactPerson ?? "").trim();
    const contactCell = !contactRaw
      ? EMPTY_CELL
      : unlocked
        ? contactRaw
        : zh
          ? "已隐藏"
          : "Hidden";

    // 电话 / 邮箱：同一门禁；无值 → —
    const phoneRaw = (d.phone ?? "").trim();
    const emailRaw = (d.email ?? "").trim();
    const phoneCell = !phoneRaw
      ? EMPTY_CELL
      : unlocked
        ? joinPhones(d.phone)
        : maskPhone(d.phone) || EMPTY_CELL;
    const emailCell = !emailRaw
      ? EMPTY_CELL
      : unlocked
        ? joinEmails(d.email)
        : maskEmailList(d.email);

    return {
      direction,
      priority,
      id: d.id,
      cells: [
        "", // 序号占位，排序后再填
        direction,
        companyName(d.name, d.id),
        cellOf(d.country),
        cellOf(d.city),
        contactCell,
        phoneCell,
        emailCell,
        toDomain(d.sourceUrl),
        brandsAndBusiness(d.brands, d.nature),
        cellOf(d.suggestedPrice),
        priority,
        resolveFollowStatus(d.followStatus),
        cellOf(d.sourcePage),
      ],
    };
  });

  const dirIndex = (b: DirectionBucket): number => {
    const i = DIRECTION_ORDER.indexOf(b);
    return i < 0 ? DIRECTION_ORDER.length : i;
  };
  const priIndex = (p: Priority): number => {
    const i = PRIORITIES.indexOf(p);
    return i < 0 ? PRIORITIES.length : i;
  };

  rows.sort((a, b) => {
    const byDir = dirIndex(a.direction) - dirIndex(b.direction);
    if (byDir !== 0) return byDir;
    const byPri = priIndex(a.priority) - priIndex(b.priority);
    if (byPri !== 0) return byPri;
    // 纯字符串比较（不用 localeCompare：结果受 ICU/locale 影响，跨环境不稳定）
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });

  rows.forEach((row, i) => {
    row.cells[0] = String(i + 1);
  });
  return rows;
}

/**
 * Sheet2 行构造（含降级）。
 *
 * 价格四列：只收 `axisResidual === false` 且 `axis` 命中的锚点；
 * `axisResidual === true` 的锚点**绝不进价格列**，一律写进「备注」并加 `未归类市场：` 前缀。
 */
function buildPriceRows(
  norm: NormalizedStrategy,
  zh: boolean,
  webStatus: WebEvidenceStatus
): { rows: string[][]; priceTexts: string[] } {
  // 机型清单：tldr → 画像 → 锚点 → 最优去向 → 排名（去重保序），全空才用占位名
  const equipmentOrder: string[] = [];
  const pushEq = (name: string | null | undefined): void => {
    const s = (name ?? "").trim();
    if (s && !equipmentOrder.includes(s)) equipmentOrder.push(s);
  };
  for (const row of norm.tldr) pushEq(row.equipment);
  for (const p of norm.equipmentProfiles) pushEq(p.name);
  for (const a of norm.marketAnchors) pushEq(a.equipment);
  for (const d of norm.bestDestinations) pushEq(d.equipment);
  for (const r of norm.marketRanking) pushEq(r.equipment);
  if (equipmentOrder.length === 0) equipmentOrder.push(zh ? "本批机型" : "This batch");

  const rows: string[][] = [];
  const priceTexts: string[] = [];

  for (const eq of equipmentOrder) {
    const anchors = norm.marketAnchors.filter((a) => a.equipment === eq);
    for (const a of anchors) priceTexts.push(a.priceText);

    // 4 个价格列：真归桶的锚点，多值用 `；` 拼接
    const priceCells = PRICE_COLUMNS.map((col) => {
      const hits = anchors.filter((a) => !a.axisResidual && a.axis === col.axis).map((a) => a.priceText);
      return hits.length > 0 ? hits.join("；") : EMPTY_CELL;
    });

    // 最优去向：bestDestinations[].market[0] → 回落 marketRanking 首位 → —
    const dest = norm.bestDestinations.find((d) => d.equipment === eq);
    let best = "";
    if (dest && dest.market.length > 0 && dest.market[0] !== NOT_FOUND) {
      best = dest.market[0];
    } else {
      const ranked = norm.marketRanking
        .filter((r) => !r.equipment || r.equipment === eq)
        .sort((a, b) => a.rank - b.rank);
      if (ranked.length > 0 && ranked[0].market !== NOT_FOUND) {
        best = ranked[0].market;
      } else if (dest && dest.market.length > 0) {
        best = dest.market[0];
      }
    }

    // 备注：降级标记 + 洞察 + 新机对标 + 残差市场 + 检索降级
    const notes: string[] = [];
    if (anchors.length === 0) notes.push("价格锚点未生成");
    if (norm.keyInsight?.headline) notes.push(norm.keyInsight.headline);
    const newMachine = anchors
      .filter((a) => a.axis === "新机对标")
      .map((a) => `${zh ? "新机对标" : "New"} ${a.priceText}`);
    if (newMachine.length > 0) notes.push(newMachine.join("；"));
    // 🔴 axisResidual 的锚点只能落在这里，绝不进价格列
    const residual = anchors
      .filter((a) => a.axisResidual)
      .map((a) => `${a.market} ${a.priceText}`);
    if (residual.length > 0) {
      notes.push(`${zh ? "未归类市场：" : "Unclassified: "}${residual.join("；")}`);
    }
    if (webStatus !== "ok") notes.push(zh ? "外部检索未接入" : "Web retrieval unavailable");

    rows.push([
      eq,
      ...priceCells,
      best || EMPTY_CELL,
      notes.length > 0 ? notes.join("；") : EMPTY_CELL,
    ]);
  }

  return { rows, priceTexts };
}

/**
 * Sheet3 行构造（含降级）。
 *
 * 降级：`complianceTasks` 原字段为空 ⇒ `normalizeDecisionFields` 已按 §2 ⑩ 转换出 ≥3 行，
 * 此处再补一行 `（自动转换）` 标记行，提示人工复核。
 */
function buildChecklistRows(
  norm: NormalizedStrategy,
  strategy: StrategyLlmResult | null,
  zh: boolean
): { rows: (string | number)[][]; autoConverted: boolean } {
  const rawTasks = Array.isArray(strategy?.complianceTasks) ? strategy.complianceTasks : [];
  const autoConverted = rawTasks.length === 0;

  const rows: (string | number)[][] = norm.complianceTasks.map((t, i) => [
    i + 1,
    cellOf(t.item),
    cellOf(t.owner as ComplianceOwner),
    cellOf(t.deadline),
    cellOf((t.status ?? "未开始") as ComplianceStatus),
  ]);

  if (autoConverted) {
    rows.push([
      zh ? "（自动转换）" : "(auto)",
      zh ? "合规清单未生成，已由合规提示自动转换，建议人工复核" : "Auto-converted from compliance notes; please review",
      EMPTY_CELL,
      EMPTY_CELL,
      EMPTY_CELL,
    ]);
  }

  return { rows, autoConverted };
}

// ═══════════════════════════════════════════════════════════
// 策略归一化（降级全部交给 derive.ts，本文件不造默认值）
// ═══════════════════════════════════════════════════════════

/**
 * 把 `opts.strategy` 归一化成 `NormalizedStrategy`。
 *
 * 入口唯一：`derive.normalizeDecisionFields`（PRD §1.4：兜底只允许写在 derive.ts）。
 * Excel 侧拿不到完整的 `DecisionEnv`（无 Product、无检索证据），故只填能确定的部分；
 * 其余留空由 derive 走通用降级文案，**绝不编造**。
 */
function normalizeStrategyForSheets(
  strategy: StrategyLlmResult | null,
  dealers: ExcelDealerInput[],
  webStatus: WebEvidenceStatus
): NormalizedStrategy {
  const firstEquipment =
    (Array.isArray(strategy?.tldr) ? strategy?.tldr?.[0]?.equipment : "") ||
    (Array.isArray(strategy?.equipmentProfiles) ? strategy?.equipmentProfiles?.[0]?.name : "") ||
    "";

  const priceRange = strategy?.priceRange ?? null;
  const priceRangeText =
    priceRange && (priceRange.suggestedMinCny != null || priceRange.suggestedMaxCny != null)
      ? `¥${priceRange.suggestedMinCny ?? "?"}–¥${priceRange.suggestedMaxCny ?? "?"}`
      : null;

  const env: DecisionEnv = {
    productName: firstEquipment,
    brandName: "",
    priceMinCny: priceRange?.suggestedMinCny ?? null,
    priceMaxCny: priceRange?.suggestedMaxCny ?? null,
    webStatus,
    webNote: "",
    hasPriorStrategy: false,
    candidateCount: dealers.length,
    evidenceUrls: [],
    summary: strategy?.summary ?? null,
    priceRange: priceRangeText,
    compliance: strategy?.compliance
      ? {
          dataExport: strategy.compliance.dataExport ?? null,
          crossBorder: strategy.compliance.crossBorder ?? null,
          note: strategy.compliance.notes ?? null,
        }
      : null,
  };

  return normalizeDecisionFields(strategy as StrategyLlmResult | null | undefined, env);
}

/** 供测试与上层复用的导出（列定义即契约，改它等于改验收） */
export const EXCEL_SHEET_LAYOUT2 = {
  sheetNamesZh: ["渠道联系总表", "机型价格速查", "必办清单"] as const,
  sheetNamesEn: ["Dealer Contacts", "Price Quick Reference", "Action Checklist"] as const,
  sheet1HeadersZh: SHEET1_HEADERS_ZH,
  sheet2HeadersZh: ["机型", ...PRICE_COLUMNS.map((c) => c.zh), "最优去向", "备注"] as const,
  sheet3HeadersZh: SHEET3_HEADERS_ZH,
  fxRowLabel: FX_ROW_LABEL,
} as const;

/** 合规责任方枚举透出（供测试断言 `负责` 列取值域；避免测试自己维护一份常量） */
export const EXCEL_COMPLIANCE_OWNERS = COMPLIANCE_OWNERS;
