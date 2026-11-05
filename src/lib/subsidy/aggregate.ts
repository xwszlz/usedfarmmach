/**
 * 国内农机补贴库 —— 聚合与脱敏纯函数层
 * ===========================================================================
 *
 * 本文件是补贴公开层（SubsidyCatalog）的数据安全核心，**不依赖 Prisma / 数据库 /
 * 任何 IO**，仅做三件事：
 *   1. CSV 解析：quote-aware（含逗号的字段不撕裂），按**表头名**取列（不按列序号），
 *      兼容 7 种表头变体（17/18/19/20/22/23 列），多出的「省市县级补贴/贴息」列忽略。
 *   2. 聚合：价格只用语义稳健的 中位数 + p25/p75 + Tukey 截尾，**严禁均值**；
 *      品牌保留厂家法人全称，**禁止 `[:4]` 截断**；contentHash **绑定 batchCode**。
 *   3. 脱敏护栏：assertPublicSafe 在每一个公开出口被调用（fail-closed）。
 *
 * 所有补贴公开数据都必须先经 `toPublicCatalog`（白名单字段）再经 `assertPublicSafe`
 * （最小样本量 k-匿名 + PII 字段名黑名单 + 禁单条原始行 + 禁县乡下钻）后才可出站。
 *
 * 与 Brand / Category / Product / ModelDictionary / RawListing / ShowcaseItem
 * 完全解耦，无任何外键、无任何引用。
 *
 * 合规红线（与 schema 两表注释一致）：
 *   - 本表在 .com（境外）库中应始终为 0 行；若发现数据即为合规事故。
 *   - 公开层绝不返回购机者姓名 / 身份证 / 出厂编号 / 经销商 / 县乡地址 / 单条成交价。
 */

import { createHash } from "crypto";

/* ───────────────────────────── 常量 ───────────────────────────── */

/** 公开层最小样本量（k-匿名门槛）：n < 10 不得公开任何聚合数值，否则可能唯一识别到人。 */
export const MIN_SAMPLE_SIZE = 10;

/** 公开层白名单字段：外层 SubsidyCatalog 出站响应只允许出现这些键。 */
export const PUBLIC_FIELDS = [
  "province",
  "policyYear",
  "category",
  "brandName",
  "modelName",
  "medianPriceCny",
  "p25PriceCny",
  "p75PriceCny",
  "medianCentralSubsidy",
  "medianTotalSubsidy",
  "sampleSize",
] as const;

export type PublicField = (typeof PUBLIC_FIELDS)[number];

/**
 * PII / 单条原始行 字段名黑名单（大小写不敏感，已 normalize）。
 * 公开响应、查询参数中出现这些键名即视为违规（可能反推到自然人）。
 */
export const PII_FIELD_DENYLIST = [
  "county", // 县
  "township", // 乡/镇
  "buyername", // 购机者姓名
  "buyer", // 购机人
  "serialno", // 出厂编号
  "serial", // 出厂编号缩写
  "dealer", // 经销商
  "phone", // 手机/电话
  "mobile", // 手机号
  "sellername", // 卖方姓名
  "seller", // 卖方
  "idcard", // 身份证
  "idnumber", // 证件号
  "idno", // 证件号缩写
  "address", // 地址
  "contact", // 联系方式
  "wechat", // 微信
  "qq", // QQ
  "email", // 邮箱
  "purchasedate", // 精确购机日期
  "salepricecny", // 单条成交价
  "centralsubsidycny", // 单条中央补贴额
  "totalsubsidycny", // 单条总补贴额
  "quantity", // 购买数量（单条）
  "productname", // 产品名称（单条）
  "sourcefile", // 来源文件（溯源用，禁止出站）
] as const;

/* ───────────────────────────── 类型 ───────────────────────────── */

/** 一条经解析后的原始补贴记录（内层 PII，绝不公开）。 */
export interface SubsidyRow {
  province: string;
  county: string;
  township: string;
  buyerName: string;
  manufacturer: string;
  category: string;
  productName: string;
  modelName: string;
  quantity: number;
  dealer: string;
  purchaseDate: Date;
  salePriceCny: number;
  centralSubsidyCny: number | null;
  totalSubsidyCny: number | null;
  serialNo: string;
  status: string;
  sourceFile: string;
}

/** 一条聚合后的公开目录种子（对应 SubsidyCatalog 的可写字段）。 */
export interface SubsidyCatalogSeed {
  batchCode: string;
  policyYear: number;
  province: string;
  category: string;
  brandName: string;
  modelName: string;
  machineryType: string | null;
  manufacturer: string;
  medianPriceCny: number;
  p25PriceCny: number | null;
  p75PriceCny: number | null;
  medianCentralSubsidy: number | null;
  medianTotalSubsidy: number | null;
  sampleSize: number;
  contentHash: string;
}

/** 公开层白名单响应负载。 */
export type PublicCatalogPayload = Partial<Record<PublicField, string | number | null>>;

/** 脱敏校验失败专用错误。 */
export class PublicSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicSafetyError";
  }
}

/* ───────────────────────────── 表头别名映射 ───────────────────────────── */

type RowField = keyof SubsidyRow;
/** CSV 表头可对应的字段（sourceFile 为注入字段，不出现在 CSV 表头）。 */
type CsvField = Exclude<RowField, "sourceFile">;

/**
 * 表头别名表：真实 CSV 的表头写法多变（半/全角括号、空格、是否带「（元）」等）。
 * 解析时统一 normalize 后匹配。
 */
const HEADER_ALIASES: Record<CsvField, string[]> = {
  province: ["省", "省份", "省别"],
  county: ["县", "县市", "县市区", "县（市、区）"],
  township: [
    "所在乡(镇)",
    "所在乡（镇）",
    "所在乡镇",
    "乡镇",
    "乡(镇)",
    "乡（镇）",
  ],
  buyerName: [
    "购机者姓名",
    "购机者",
    "购机人",
    "购机人姓名",
    "受益人姓名",
    "受益人或组织名称",
  ],
  manufacturer: [
    "生产厂家",
    "生产企业",
    "厂家",
    "生产企业名称",
    "生产企业（组织）名称",
  ],
  category: ["机具品目", "品目", "机具类别", "机具类型", "补贴品目"],
  productName: ["产品名称", "产品"],
  modelName: ["购买机型", "机型", "型号", "购买型号", "机具型号"],
  quantity: ["购买数量(台)", "购买数量（台）", "购买数量", "数量", "台数"],
  dealer: ["经销商", "销售商", "经销商名称", "销售企业名称"],
  purchaseDate: ["购机日期", "购机时间", "购买日期", "购买时间"],
  salePriceCny: [
    "单台销售价格(元)",
    "单台销售价格（元）",
    "单台销售价格",
    "销售价格(元)",
    "销售价格（元）",
    "销售价格",
    "单台售价(元)",
    "单台售价",
    "售价(元)",
    "售价",
  ],
  centralSubsidyCny: [
    "单台中央补贴额(元)",
    "单台中央补贴额（元）",
    "单台中央补贴额",
    "中央补贴额(元)",
    "中央补贴额（元）",
    "中央补贴",
    "中央补贴额",
  ],
  totalSubsidyCny: [
    "总补贴额(元)",
    "总补贴额（元）",
    "总补贴",
    "总补贴额",
    "补贴总额(元)",
    "补贴总额（元）",
    "补贴总额",
    "补贴额(元)",
    "补贴额",
  ],
  serialNo: [
    "出厂编号",
    "出厂编号（底盘号）",
    "出厂编号(底盘号)",
    "底盘号",
    "机架号",
  ],
  status: ["状态", "补贴状态", "兑付状态", "资金状态"],
};

/** 归一化表头：去空白、去半/全角括号、去斜杠、转小写。 */
function normalizeHeader(s: string): string {
  return s
    .replace(/[（）()\s]/g, "")
    .replace(/[／/]/g, "")
    .toLowerCase();
}

/** 构建 字段 → 列索引 映射（首个匹配列优先）。 */
function buildHeaderMap(header: string[]): Partial<Record<CsvField, number>> {
  const aliasToField = new Map<string, CsvField>();
  (Object.keys(HEADER_ALIASES) as CsvField[]).forEach((field) => {
    HEADER_ALIASES[field].forEach((alias) => {
      aliasToField.set(normalizeHeader(alias), field);
    });
  });

  const map: Partial<Record<RowField, number>> = {};
  header.forEach((h, idx) => {
    const field = aliasToField.get(normalizeHeader(h));
    if (field && map[field] == null) {
      map[field] = idx;
    }
  });
  return map;
}

/* ───────────────────────────── CSV 解析（quote-aware） ───────────────────────────── */

/**
 * 极简但正确的 CSV 解析器：
 *  - 支持双引号包裹字段；字段内双引号用 "" 转义；
 *  - 支持字段内换行（引号内）；逗号分隔；CRLF / LF 兼容。
 *  - 自动剥离 UTF-8 BOM。
 */
function parseCsv(text: string): string[][] {
  let s = text;
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1); // 剥离 UTF-8 BOM（实测 128 个 CSV 纯 UTF-8 无 BOM，此处防御性处理）
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const n = s.length;

  for (let i = 0; i < n; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (c === "\r") {
      // 裸 \r 或 \r\n 的前半，交给后续的 \n 收尾
      continue;
    }
    field += c;
  }

  // 收尾最后一段（文件不以换行结尾时）
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // 去掉末尾的空行
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    const isEmpty = last.length === 1 && last[0].trim() === "";
    if (!isEmpty) break;
    rows.pop();
  }
  return rows;
}

function cell(row: string[], idx: number | undefined): string {
  if (idx == null || idx < 0 || idx >= row.length) return "";
  const v = row[idx];
  return v == null ? "" : v;
}

/* ───────────────────────────── 基础值解析 ───────────────────────────── */

/** 解析日期：支持 yyyy-MM-dd / yyyy/M/d / yyyyMMdd / 其它可被 Date 解析的格式。 */
function parseDate(s: string): Date | null {
  if (!s) return null;
  const cleaned = s.trim().replace(/\s+/g, "").replace(/\//g, "-");

  let m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  m = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const fallback = new Date(cleaned);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

/** 解析数值：去千分位逗号、去货币符号与空白；非法返回 null。 */
function parseNumber(s: string): number | null {
  if (s == null) return null;
  const cleaned = s.trim().replace(/,/g, "").replace(/[¥￥\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return n;
}

/* ───────────────────────────── 解析入口 ───────────────────────────── */

export interface ParseOptions {
  /**
   * 当 CSV 表头无「省」列时（17 列基础表头即无省列），由调用方按所在目录/文件名
   * 提供的省份。缺失则该行 province 置空并在聚合前被丢弃。
   */
  defaultProvince?: string;
  /** 来源文件名（仅用于溯源审计，不写入公开层）。 */
  sourceFile?: string;
}

/**
 * 将一份 CSV 文本解析为 SubsidyRow[]。
 *
 * 规则（对齐《建设方案》§3 数据口径）：
 *  - 按表头名取列（兼容 7 种变体，多出的省市县级补贴/贴息列忽略）；
 *  - 只保留 `状态 === "资金已兑付"`；
 *  - 剔除购机日期年份 < 1980 或 > 当前年+1 的异常行；
 *  - 机龄按 `购机日期` 字段算，不按文件名年份；
 *  - 跳过仅表头的空壳文件。
 */
export function parseSubsidyRows(
  csvText: string,
  options: ParseOptions = {}
): SubsidyRow[] {
  const allRows = parseCsv(csvText);
  if (allRows.length === 0) return [];

  const headerMap = buildHeaderMap(allRows[0]);
  // 去掉表头，并剔除完全空白的中间行
  const dataRows = allRows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""));
  if (dataRows.length === 0) return []; // 空壳文件

  const nowYear = new Date().getFullYear();
  const rows: SubsidyRow[] = [];

  for (const r of dataRows) {
    const status = cell(r, headerMap.status).trim();
    if (status !== "资金已兑付") continue; // 只取已兑付

    const date = parseDate(cell(r, headerMap.purchaseDate));
    if (!date) continue;
    const year = date.getFullYear();
    if (year < 1980 || year > nowYear + 1) continue; // 异常年份剔除

    const salePrice = parseNumber(cell(r, headerMap.salePriceCny));
    if (salePrice == null) continue;

    const province = (
      headerMap.province != null
        ? cell(r, headerMap.province)
        : options.defaultProvince ?? ""
    ).trim();
    const manufacturer = (
      headerMap.manufacturer != null ? cell(r, headerMap.manufacturer) : ""
    ).trim();
    const category = (
      headerMap.category != null ? cell(r, headerMap.category) : ""
    ).trim();
    const modelName = (
      headerMap.modelName != null ? cell(r, headerMap.modelName) : ""
    ).trim();

    // 必要维度缺失（多为脏数据或省列缺失）直接跳过，不污染聚合
    if (!province || !manufacturer || !category || !modelName) continue;

    rows.push({
      province,
      county: headerMap.county != null ? cell(r, headerMap.county).trim() : "",
      township:
        headerMap.township != null ? cell(r, headerMap.township).trim() : "",
      buyerName:
        headerMap.buyerName != null ? cell(r, headerMap.buyerName).trim() : "",
      manufacturer,
      category,
      productName:
        headerMap.productName != null
          ? cell(r, headerMap.productName).trim()
          : "",
      modelName,
      quantity: parseNumber(cell(r, headerMap.quantity)) ?? 1,
      dealer: headerMap.dealer != null ? cell(r, headerMap.dealer).trim() : "",
      purchaseDate: date,
      salePriceCny: salePrice,
      centralSubsidyCny: parseNumber(cell(r, headerMap.centralSubsidyCny)),
      totalSubsidyCny: parseNumber(cell(r, headerMap.totalSubsidyCny)),
      serialNo:
        headerMap.serialNo != null ? cell(r, headerMap.serialNo).trim() : "",
      status,
      sourceFile: options.sourceFile ?? "",
    });
  }

  return rows;
}

/* ───────────────────────────── 稳健统计（禁均值） ───────────────────────────── */

/** 百分位：线性插值。base 必须已排序。 */
function percentile(sorted: number[], p: number): number {
  const m = sorted.length;
  if (m === 0) return 0;
  if (m === 1) return sorted[0];
  const idx = p * (m - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

interface RobustStats {
  median: number;
  p25: number | null;
  p75: number | null;
}

/**
 * 计算 中位数 + p25 + p75，并用 Tukey fence（Q1-1.5·IQR, Q3+1.5·IQR）做截尾，
 * 去掉 ¥17,894,606 这类极端值，避免污染分位数。
 * 若截尾过狠（剩 < 2 个）则回退全量，保证统计可用。
 */
function computeRobustStats(values: number[]): RobustStats {
  if (values.length === 0) return { median: 0, p25: null, p75: null };
  const sorted = [...values].sort((a, b) => a - b);

  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const trimmed = sorted.filter((v) => v >= lower && v <= upper);
  const base = trimmed.length >= 2 ? trimmed : sorted;

  return {
    median: percentile(base, 0.5),
    p25: percentile(base, 0.25),
    p75: percentile(base, 0.75),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ───────────────────────────── 聚合 ───────────────────────────── */

/**
 * 将一批已解析的原始行聚合成 SubsidyCatalogSeed[]。
 *
 * 聚合键 = 厂家 + 品目 + 机型 + 省 + 购机年份 + **batchCode**（按月/批次重导互不吞）。
 * 价格只用中位数+p25/p75（禁均值）；品牌保留厂家法人全称（禁止 [:4] 截断）；
 * contentHash 必须**包含 batchCode**（否则不同批次被 skipDuplicates 全跳过）。
 */
export function aggregateCatalog(
  rows: SubsidyRow[],
  batchCode: string
): SubsidyCatalogSeed[] {
  const groups = new Map<string, SubsidyRow[]>();

  for (const row of rows) {
    const policyYear = row.purchaseDate.getFullYear();
    const key = [
      row.manufacturer,
      row.category,
      row.modelName,
      row.province,
      policyYear,
      batchCode,
    ].join("|");
    const arr = groups.get(key);
    if (arr) arr.push(row);
    else groups.set(key, [row]);
  }

  const result: SubsidyCatalogSeed[] = [];

  for (const groupRows of groups.values()) {
    const first = groupRows[0];
    const policyYear = first.purchaseDate.getFullYear();

    const prices = groupRows
      .map((r) => r.salePriceCny)
      .filter((v): v is number => v != null);
    const central = groupRows
      .map((r) => r.centralSubsidyCny)
      .filter((v): v is number => v != null);
    const total = groupRows
      .map((r) => r.totalSubsidyCny)
      .filter((v): v is number => v != null);

    const priceStats = computeRobustStats(prices);
    const centralStats = central.length ? computeRobustStats(central) : null;
    const totalStats = total.length ? computeRobustStats(total) : null;

    // contentHash 绑定 batchCode：相同数据不同批次 → 不同 hash → 不会被 skipDuplicates 误吞
    const contentHash = createHash("md5")
      .update(
        [
          batchCode,
          first.manufacturer,
          first.category,
          first.modelName,
          first.province,
          policyYear,
        ].join("|")
      )
      .digest("hex");

    result.push({
      batchCode,
      policyYear,
      province: first.province,
      category: first.category,
      brandName: first.manufacturer, // 品牌 = 厂家法人全称，禁止 [:4] 截断
      modelName: first.modelName,
      machineryType: null,
      manufacturer: first.manufacturer,
      medianPriceCny: round2(priceStats.median),
      p25PriceCny: priceStats.p25 == null ? null : round2(priceStats.p25),
      p75PriceCny: priceStats.p75 == null ? null : round2(priceStats.p75),
      medianCentralSubsidy: centralStats ? round2(centralStats.median) : null,
      medianTotalSubsidy: totalStats ? round2(totalStats.median) : null,
      sampleSize: groupRows.length,
      contentHash,
    });
  }

  return result;
}

/* ───────────────────────────── 脱敏护栏 ───────────────────────────── */

/**
 * 白名单字段响应：只保留 PUBLIC_FIELDS 中的键，其余（PII / 单条标识）一律剔除。
 * 即使传入的记录含 buyerName / serialNo 等，也不会出现在出站负载里。
 */
export function toPublicCatalog(record: Record<string, unknown>): PublicCatalogPayload {
  const out: PublicCatalogPayload = {};
  for (const field of PUBLIC_FIELDS) {
    const v = record[field];
    out[field] = (v as string | number | null) ?? null;
  }
  return out;
}

/**
 * 聚合脱敏校验（fail-closed）。在每一个公开出口（页面 / API）渲染或返回前调用：
 *   ① 最小样本量门槛（k-匿名）：sampleSize < MIN_SAMPLE_SIZE 直接拒绝；
 *   ② 字段名黑名单：响应中不得出现任何 PII / 单条原始行 字段名；
 *   ③ 拒绝单条原始行（含 id / sourceFile 等单条标识）；
 *   ④ 禁县乡级下钻维度（county / township）。
 * 违反即 throw PublicSafetyError，绝不让可疑数据出站。
 */
export function assertPublicSafe(payload: PublicCatalogPayload): void {
  // ① 最小样本量（k-匿名门槛）
  const sampleSize = typeof payload.sampleSize === "number" ? payload.sampleSize : 0;
  if (sampleSize < MIN_SAMPLE_SIZE) {
    throw new PublicSafetyError(
      `拒绝公开：样本量 ${sampleSize} < 最小门槛 ${MIN_SAMPLE_SIZE}（k-匿名）`
    );
  }

  const keys = Object.keys(payload).map((k) => k.toLowerCase());

  // ② PII / 单条原始行 字段名黑名单
  for (const deny of PII_FIELD_DENYLIST) {
    if (keys.includes(deny)) {
      throw new PublicSafetyError(
        `拒绝公开：响应包含被禁字段名 "${deny}"（可能反推自然人）`
      );
    }
  }

  // ③ 拒绝单条原始行：公开层只应是聚合行，不得携带 id / sourceFile
  if (keys.includes("id") || keys.includes("sourcefile")) {
    throw new PublicSafetyError(`拒绝公开：响应疑似单条原始行（含 id/sourceFile）`);
  }

  // ④ 禁县乡级下钻维度
  if (keys.includes("county") || keys.includes("township")) {
    throw new PublicSafetyError(`拒绝公开：含县/乡级下钻维度（county/township）`);
  }
}

/**
 * 查询参数下钻守卫（fail-closed）：禁止县/乡级或 PII 维度的下钻参数。
 * 用于列表页与 API 入口，防止通过参数把粒度拉到可识别个人的级别。
 */
export function assertNoPiiDrillDown(
  params: Record<string, unknown>
): void {
  const keys = Object.keys(params).map((k) => k.toLowerCase());
  const forbidden = [
    "county",
    "township",
    "buyername",
    "serialno",
    "dealer",
    "phone",
    "idcard",
  ];
  for (const deny of forbidden) {
    if (keys.includes(deny)) {
      throw new PublicSafetyError(
        `拒绝查询：禁止县/乡级或 PII 下钻参数 "${deny}"`
      );
    }
  }
}
