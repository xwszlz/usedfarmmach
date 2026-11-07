/**
 * .cn 补贴库 C 档明文 —— 展示层白名单裁剪（纯函数，零 IO）
 * ===========================================================================
 * 这里是「raw 行 → 可序列化视图行」的 **PII 安全边界**：
 *   - 只按 §3.1 白名单逐字段挑取，**绝不 spread 整个 row**；
 *   - 未核实的「25 字段」差额 3 个一律不入库、不展示，禁止虚构字段；
 *   - `id / goodsRegion / contentHash / createdAt` 四个不展示字段绝不进 RSC 序列化；
 *   - `null → "—"`；`salePriceCny` 列头标「单条成交价」，`purchaseDate` 列头标
 *     「购机日期（精确到日）」，与公开聚合层的「中位数 / 政策年份」显式区分；
 *   - `sourceFile` 默认折叠，`serialNo` 展示（顶部 PII 警示由页面/表格负责，§10 Q3）。
 *
 * 本模块属于 **C 档独立通道**：只依赖 raw-detail.ts（同一独立通道），
 * 绝不跨通道引入公开聚合层的任何护栏符号或错误类型。
 *
 * 零 IO：@/lib/db 只在 raw-detail.ts 的 queryRawDetail() 函数内动态 import；
 * 本模块与 loadRawDetailRows() 的默认查询出口都不在加载期触碰数据库。
 */

import { queryRawDetail } from "./raw-detail";
import type {
  RawDetailQuery,
  RawDetailResult,
  RawDetailRow,
  RawGateDecision,
} from "./raw-detail";

/* ─────────────────────────── 白名单常量（§3.1） ─────────────────────────── */

/** 16 个默认展示字段（顺序即列顺序）。 §3.1 展示项，逐字对齐 PRD §3.1 表。 */
export const RAW_DETAIL_DISPLAY_FIELDS: readonly string[] = [
  "batchCode",
  "province",
  "county",
  "township",
  "buyerName",
  "manufacturer",
  "category",
  "productName",
  "modelName",
  "quantity",
  "dealer",
  "purchaseDate",
  "salePriceCny",
  "centralSubsidyCny",
  "totalSubsidyCny",
  "status",
];

/** 2 个条件展示字段：sourceFile 默认折叠、serialNo 展示 + 顶部警示（§10 Q3）。 */
export const RAW_DETAIL_CONDITIONAL_FIELDS: readonly string[] = [
  "sourceFile",
  "serialNo",
];

/** 4 个绝不展示字段：不得进入 RSC 序列化 / HTML（§3.1 不展示项）。 */
export const RAW_DETAIL_HIDDEN_FIELDS: readonly string[] = [
  "id",
  "goodsRegion",
  "contentHash",
  "createdAt",
];

/* ─────────────────────────── 契约类型 ─────────────────────────── */

export interface RawDetailViewOptions {
  showSerialNo: boolean;
  showSourceFile: boolean;
  locale: "zh" | "en";
}

export interface RawDetailViewCell {
  /** §3.1 白名单字段名；绝不出现 4 个不展示字段。 */
  readonly key: string;
  /** 已按 locale 翻译的列头（含口径标注）。 */
  readonly label: string;
  /** 已格式化、可直接安全序列化的展示值（null → "—"）。 */
  readonly value: string;
}

export interface RawDetailViewRow {
  /** 主表可见列（16 项 + 可选 serialNo）。 */
  readonly cells: readonly RawDetailViewCell[];
  /** 折叠区列（可选 sourceFile），由 Server Component 放进 <details>。 */
  readonly collapsedCells: readonly RawDetailViewCell[];
  readonly locale: "zh" | "en";
}

/* ─────────────────────────── 列头文案（内联 t(zh,en)，零 messages 改动） ─────────────────────────── */

const LABELS_ZH: Readonly<Record<string, string>> = {
  batchCode: "数据批次",
  province: "省份",
  county: "县",
  township: "乡镇",
  buyerName: "购机者姓名（个人信息）",
  manufacturer: "生产厂家",
  category: "品类",
  productName: "产品名称",
  modelName: "型号",
  quantity: "购买数量（台）",
  dealer: "经销商",
  purchaseDate: "购机日期（精确到日）",
  salePriceCny: "单条成交价（元）",
  centralSubsidyCny: "单条中央补贴（元）",
  totalSubsidyCny: "单条总补贴（元）",
  status: "兑付状态",
  sourceFile: "原始数据文件",
  serialNo: "出厂编号（个人信息）",
};

const LABELS_EN: Readonly<Record<string, string>> = {
  batchCode: "Data batch",
  province: "Province",
  county: "County",
  township: "Township",
  buyerName: "Buyer name (personal information)",
  manufacturer: "Manufacturer",
  category: "Category",
  productName: "Product name",
  modelName: "Model",
  quantity: "Quantity (units)",
  dealer: "Dealer",
  purchaseDate: "Purchase date (exact day)",
  salePriceCny: "Single transaction price (CNY)",
  centralSubsidyCny: "Single central subsidy (CNY)",
  totalSubsidyCny: "Single total subsidy (CNY)",
  status: "Payout status",
  sourceFile: "Source data file",
  serialNo: "Serial no. (personal information)",
};

const MONEY_FIELDS: readonly string[] = [
  "salePriceCny",
  "centralSubsidyCny",
  "totalSubsidyCny",
];

/* ─────────────────────────── 纯函数 ─────────────────────────── */

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** 只做展示格式化，不做任何字段枚举；枚举权完全在白名单常量。 */
function toDisplayValue(field: string, value: unknown, locale: "zh" | "en"): string {
  if (isBlank(value)) return "—";
  if (MONEY_FIELDS.includes(field)) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return "—";
    const amount = Math.round(numeric).toLocaleString("zh-CN");
    return locale === "zh" ? `¥${amount}` : `CNY ${amount}`;
  }
  if (field === "quantity") {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? String(numeric) : String(value);
  }
  return String(value);
}

function buildCell(
  field: string,
  source: Readonly<Record<string, unknown>>,
  labels: Readonly<Record<string, string>>,
  locale: "zh" | "en"
): RawDetailViewCell {
  return {
    key: field,
    label: labels[field] ?? field,
    value: toDisplayValue(field, source[field], locale),
  };
}

/**
 * 白名单裁剪：把一条 raw 明细转成可安全序列化的视图行。
 *
 * 🔴 实现要点：`source` 只被按白名单常量逐字段读取，**从不枚举入参的键集合，
 * 也从不整体展开入参对象**。因此即便调用方传入带技术主键 / 去重哈希 / 未知字段的
 * 脏对象，这些字段及其值都绝不会出现在返回对象里（单测用脏入参做负向硬断言）。
 */
export function toRawDetailView(
  row: RawDetailRow,
  opts: RawDetailViewOptions
): RawDetailViewRow {
  const labels = opts.locale === "zh" ? LABELS_ZH : LABELS_EN;
  const source = row as unknown as Readonly<Record<string, unknown>>;

  const cells: RawDetailViewCell[] = [];
  for (const field of RAW_DETAIL_DISPLAY_FIELDS) {
    cells.push(buildCell(field, source, labels, opts.locale));
  }

  const collapsedCells: RawDetailViewCell[] = [];
  if (opts.showSourceFile) {
    collapsedCells.push(buildCell("sourceFile", source, labels, opts.locale));
  }
  if (opts.showSerialNo) {
    cells.push(buildCell("serialNo", source, labels, opts.locale));
  }

  return { cells, collapsedCells, locale: opts.locale };
}

/**
 * 页面唯一的 raw 查询出口（可注入 query 便于单测做调用计数）。
 *
 * 门禁决策为 denied 时**直接返回 null、一次都不调用 queryRawDetail**：
 * 这是 off 态 / 匿名 / 校验失败「不查 raw」的机器可验证保证。默认实现就是上游
 * raw-detail.ts 的 queryRawDetail({ key, expectedSampleSize, page, pageSize })。
 * 严格计数断言 total === expectedSampleSize 由 queryRawDetail 内部保持，本层不加容差。
 */
export async function loadRawDetailRows(
  decision: RawGateDecision,
  q: RawDetailQuery,
  query: (q: RawDetailQuery) => Promise<RawDetailResult> = queryRawDetail
): Promise<RawDetailResult | null> {
  if (decision.showRaw !== true) return null;
  return query(q);
}
