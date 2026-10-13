"use client";

/**
 * 线索录入：上传/粘贴解析 + 列映射 UI + **归属逐行判定** + 预览 + 提交（client 组件）
 *
 * 两种输入：
 *  ① 上传 .xlsx/.csv —— 浏览器内用 `exceljs` 解析（原始文件不落服务器磁盘，PII 落地面最小）；
 *  ② 粘贴 TSV/CSV 文本 —— 原生 split 解析（零依赖，Excel 复制选区即 TSV）。
 *
 * 列映射：解析后取表头，做中文表头模糊匹配默认映射，用户可逐列改；
 * 必填 brandName/modelName 缺失 → 整行标红、禁止提交。预览 + 校验。
 * 提交 POST /api/admin/leads/import，body = { rows: 规范字段行数组 }。
 *
 * T3a 归属口径：
 *  - 归属 = **货物（机器）实际所在地**：cn → .cn 站；intl → .com 站；unknown → 不入库（待核）；
 *  - 每行展示**自动推断结果 + 判定依据来源**（地区文字 / 平台 hint / 未判出）；
 *  - 归属录入为**下拉**，人工改值即权威覆写（碾压自动推断）；
 *  - 一键把 `unknown` 行导出为 `待核队列-YYYY-MM-DD.csv`（列名与导入模板一致 + 空 `goodsRegion` 待填）。
 */
import { useMemo, useState } from "react";
import ExcelJS from "exceljs";
import {
  inferGoodsRegionWithBasis,
  normalizeGoodsRegion,
  STORE_SCOPE_BASIS_LABEL,
  STORE_SCOPE_LABEL,
  STORE_SCOPE_OPTIONS,
  type GoodsRegionInference,
  type StoreScope,
  type StoreScopeRow,
} from "@/lib/raw-listing/store-scope";

type CanonicalField =
  | "brandName"
  | "modelName"
  | "year"
  | "workingHours"
  | "condition"
  | "priceCny"
  | "priceRaw"
  | "currency"
  | "location"
  | "sellerName"
  | "sellerPhone"
  | "sellerWechat"
  | "sellerWhatsapp"
  | "sellerEmail"
  | "sourceUrl"
  | "notes"
  | "goodsRegion";

const FIELD_LABELS: Record<CanonicalField, string> = {
  brandName: "品牌",
  modelName: "机型/型号",
  year: "年份",
  workingHours: "工作小时",
  condition: "车况",
  priceCny: "人民币价",
  priceRaw: "原币价",
  currency: "币种",
  location: "地区/位置",
  sellerName: "卖家/联系人",
  sellerPhone: "电话/手机",
  sellerWechat: "微信",
  sellerWhatsapp: "WhatsApp",
  sellerEmail: "邮箱",
  sourceUrl: "来源链接",
  notes: "备注",
  goodsRegion: "归属(cn/intl/unknown)",
};

/** 预览展示的字段顺序 */
const PREVIEW_FIELDS: CanonicalField[] = [
  "brandName",
  "modelName",
  "year",
  "location",
  "priceCny",
  "sellerName",
  "sellerPhone",
];

/** 待核导出 CSV 的列顺序（= 导入模板字段 + 末尾空 goodsRegion 待人工回填） */
const EXPORT_FIELDS: CanonicalField[] = [
  "brandName",
  "modelName",
  "year",
  "workingHours",
  "condition",
  "priceCny",
  "priceRaw",
  "currency",
  "location",
  "sellerName",
  "sellerPhone",
  "sellerWechat",
  "sellerWhatsapp",
  "sellerEmail",
  "sourceUrl",
  "notes",
  "goodsRegion",
];

/** 预览表格最多渲染行数（再多就要卡 DOM 了；超出部分提示后仍可整体提交/导出） */
const PREVIEW_LIMIT = 200;

const NUMERIC_FIELDS = new Set<CanonicalField>(["year", "workingHours", "priceCny", "priceRaw"]);

interface HeaderRule {
  keywords: string[];
  field: CanonicalField;
}

/** 中文表头 → 规范字段 模糊匹配规则 */
const HEADER_RULES: HeaderRule[] = [
  { keywords: ["品牌", "brandname", "brand"], field: "brandName" },
  { keywords: ["机型", "型号", "modelname", "model"], field: "modelName" },
  { keywords: ["年份", "年款", "year"], field: "year" },
  { keywords: ["工作小时", "小时", "hours", "workinghours"], field: "workingHours" },
  { keywords: ["归属", "所在地", "国别", "goodsregion"], field: "goodsRegion" },
  { keywords: ["价格", "人民币", "cny", "价", "pricecny"], field: "priceCny" },
  { keywords: ["原价", "外币", "原币", "priceraw"], field: "priceRaw" },
  { keywords: ["币种", "货币", "currency"], field: "currency" },
  { keywords: ["车况", "成色", "condition"], field: "condition" },
  { keywords: ["地区", "位置", "地点", "location", "省份", "城市"], field: "location" },
  { keywords: ["卖家", "联系人", "姓名", "contact", "sellername"], field: "sellerName" },
  { keywords: ["电话", "手机", "phone", "tel", "sellerphone"], field: "sellerPhone" },
  { keywords: ["微信", "wechat", "sellerwechat"], field: "sellerWechat" },
  { keywords: ["whatsapp", "sellerwhatsapp"], field: "sellerWhatsapp" },
  { keywords: ["邮箱", "邮件", "email", "mail", "selleremail"], field: "sellerEmail" },
  { keywords: ["来源", "链接", "网址", "url", "sourceurl"], field: "sourceUrl" },
  { keywords: ["备注", "说明", "note"], field: "notes" },
];

/** 根据中文表头推断规范字段（模糊匹配），无匹配返回 ""（忽略列） */
function guessField(header: string): CanonicalField | "" {
  const h = header.trim().toLowerCase();
  if (!h) return "";
  for (const rule of HEADER_RULES) {
    if (rule.keywords.some((k) => h.includes(k.toLowerCase()))) return rule.field;
  }
  return "";
}

interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

/** 用 exceljs 在浏览器内解析 .xlsx；若非 xlsx（如 .csv）则退化为文本解析 */
async function parseWorkbook(buffer: ArrayBuffer): Promise<ParsedTable> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    // xlsx 解析失败（如 CSV 文件）→ 退化为文本解析（浏览器内无 Node stream，不走 wb.csv.read）
    const text = new TextDecoder().decode(buffer);
    return parseDelimited(text);
  }

  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, col: number) => {
    headers[col - 1] = (cell.text ?? "").trim();
  });
  while (headers.length > 0 && !headers[headers.length - 1]) headers.pop();

  const rows: Record<string, string>[] = [];
  const rowCount = ws.rowCount;
  for (let r = 2; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, string> = {};
    let hasValue = false;
    for (let c = 1; c <= headers.length; c++) {
      const val = (row.getCell(c).text ?? "").trim();
      obj[headers[c - 1]] = val;
      if (val) hasValue = true;
    }
    if (hasValue) rows.push(obj);
  }
  return { headers, rows };
}

/** 粘贴路径：原生 split 解析 TSV（Excel 复制）/ CSV 文本，零依赖 */
function parseDelimited(text: string): ParsedTable {
  const trimmed = text.trim();
  if (!trimmed) return { headers: [], rows: [] };
  // 首行探测分隔符：含制表符优先 TSV，否则 CSV
  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : ",";
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== "");
  const headers = (lines[0] ?? "").split(delim).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim);
    const obj: Record<string, string> = {};
    let hasValue = false;
    for (let c = 0; c < headers.length; c++) {
      const val = (cells[c] ?? "").trim();
      obj[headers[c]] = val;
      if (val) hasValue = true;
    }
    if (hasValue) rows.push(obj);
  }
  return { headers, rows };
}

interface BuiltRow {
  row: Record<string, unknown>;
  valid: boolean;
  errors: string[];
}

/** 将已映射的行投影为 `store-scope` 所需的最小字段（避免 Record<string, unknown> 强转） */
function toScopeRow(row: Record<string, unknown>): StoreScopeRow {
  const pick = (key: string): string | null => {
    const v = row[key];
    return typeof v === "string" || typeof v === "number" ? String(v) : null;
  };
  return {
    goodsRegion: pick("goodsRegion"),
    source: pick("source"),
    sourceUrl: pick("sourceUrl"),
    location: pick("location"),
    locationCode: pick("locationCode"),
  };
}

/** 按 mapping 将原始行映射为规范字段行，并做必填/类型校验 */
function buildMappedRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string>,
): BuiltRow[] {
  return rawRows.map((raw) => {
    const out: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const value = (raw[header] ?? "").toString().trim();
      if (!value) continue;
      if (NUMERIC_FIELDS.has(field as CanonicalField)) {
        const n =
          field === "year" || field === "workingHours"
            ? parseInt(value, 10)
            : parseFloat(value);
        if (Number.isNaN(n)) {
          errors.push(`${FIELD_LABELS[field as CanonicalField]}「${value}」不是合法数字`);
          continue;
        }
        out[field] = n;
      } else {
        out[field] = value;
      }
    }
    if (!out.brandName) errors.push("缺少必填字段：品牌(brandName)");
    if (!out.modelName) errors.push("缺少必填字段：机型(modelName)");
    return { row: out, valid: errors.length === 0, errors };
  });
}

/** 一行的归属判定结果（自动推断 + 最终生效值） */
interface ScopedRow extends BuiltRow {
  /** 弱线索自动推断（含依据） */
  inference: GoodsRegionInference;
  /** 最终生效归属：人工下拉覆写 > 文件里的 goodsRegion 列 > 自动推断 */
  scope: StoreScope;
  /** 是否已人工覆写 */
  overridden: boolean;
}

interface RowIssue {
  lineNo: number;
  identity: string;
  scope: StoreScope;
  reason: string;
}

interface ImportResponse {
  success: boolean;
  imported?: number;
  skipped?: number;
  errors?: number;
  sampleErrors?: string[];
  error?: string;
  code?: string;
  site?: string;
  siteScope?: string;
  message?: string;
  total?: number;
  rejected?: RowIssue[];
  rejectedCount?: number;
  pending?: number;
  pendingDetail?: RowIssue[];
}

/** CSV 单元格转义（RFC 4180：含逗号/引号/换行则加引号，内部引号翻倍） */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 触发浏览器下载（Blob 本地生成，不落服务器） */
function downloadCsv(filename: string, content: string): void {
  // BOM：保证 Excel 打开中文不乱码
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** YYYY-MM-DD（本地时区） */
function todayStamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function LeadImportUpload() {
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<ImportResponse | null>(null);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  /** 逐行归属人工覆写：行索引（0 基）→ StoreScope */
  const [regionOverrides, setRegionOverrides] = useState<Record<number, StoreScope>>({});

  /** 载入解析结果：自动推断列映射并重置提交状态 */
  const applyParsed = (h: string[], r: Record<string, string>[]) => {
    const m: Record<string, string> = {};
    for (const header of h) {
      m[header] = guessField(header);
    }
    setHeaders(h);
    setRawRows(r);
    setMapping(m);
    setSubmitResult(null);
    setClientErrors([]);
    setRegionOverrides({});
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseWorkbook(buf);
      applyParsed(parsed.headers, parsed.rows);
    } catch (err) {
      setClientErrors([`解析文件失败：${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setParsing(false);
    }
  };

  const onPasteParse = () => {
    const parsed = parseDelimited(pasteText);
    applyParsed(parsed.headers, parsed.rows);
  };

  const built = useMemo(() => buildMappedRows(rawRows, mapping), [rawRows, mapping]);
  const invalidCount = built.filter((b) => !b.valid).length;

  /** 逐行归属判定（自动推断 + 人工覆写） */
  const scoped = useMemo<ScopedRow[]>(
    () =>
      built.map((b, index) => {
        const inference = inferGoodsRegionWithBasis(toScopeRow(b.row));
        const fromFile = normalizeGoodsRegion(b.row.goodsRegion);
        const override = regionOverrides[index];
        const scope: StoreScope = override ?? fromFile ?? inference.scope;
        return {
          ...b,
          inference,
          scope,
          overridden: override != null && override !== inference.scope,
        };
      }),
    [built, regionOverrides],
  );

  const scopeStats = useMemo(() => {
    const stats: Record<StoreScope, number> = { cn: 0, intl: 0, unknown: 0 };
    for (const s of scoped) stats[s.scope] += 1;
    return stats;
  }, [scoped]);

  const preview = scoped.slice(0, PREVIEW_LIMIT);
  const pendingRows = scoped.filter((s) => s.scope === "unknown");

  /** 导出待核清单（unknown 行，goodsRegion 列留空待人工回填） */
  const exportPendingCsv = () => {
    const rows = pendingRows.length > 0 ? pendingRows : scoped;
    if (rows.length === 0) return;
    const headerLine = EXPORT_FIELDS.join(",");
    const bodyLines = rows.map((s) =>
      EXPORT_FIELDS.map((field) =>
        // goodsRegion 列刻意留空：待人工核实货物所在地后回填
        csvCell(field === "goodsRegion" ? "" : s.row[field]),
      ).join(","),
    );
    downloadCsv(`待核队列-${todayStamp()}.csv`, [headerLine, ...bodyLines].join("\r\n"));
  };

  const handleSubmit = async () => {
    const invalid = built.filter((b) => !b.valid);
    if (invalid.length > 0) {
      const errs: string[] = [];
      invalid.slice(0, 20).forEach((b, i) => errs.push(`第 ${i + 1} 行：${b.errors.join("；")}`));
      setClientErrors(errs);
      return;
    }
    const rows = scoped.map((s) => ({ ...s.row, goodsRegion: s.scope }));
    if (rows.length === 0) {
      setClientErrors(["没有可提交的有效行"]);
      return;
    }
    setSubmitting(true);
    setClientErrors([]);
    try {
      const res = await fetch("/api/admin/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = (await res.json()) as ImportResponse;
      setSubmitResult(data);
    } catch (err) {
      setSubmitResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = rawRows.length > 0 && invalidCount === 0 && !submitting;

  return (
    <div className="space-y-6">
      {/* 输入方式切换 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${mode === "file" ? "border-primary-600 bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50"}`}
        >
          上传 Excel / CSV
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${mode === "paste" ? "border-primary-600 bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50"}`}
        >
          粘贴文本（TSV / CSV）
        </button>
      </div>

      {/* 方式①：文件上传 */}
      {mode === "file" && (
        <div className="rounded-lg border p-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            选择 .xlsx / .csv 文件（表头行在第一行）
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFileChange}
            className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary-700"
          />
          {parsing && <p className="mt-2 text-sm text-gray-400">解析中…</p>}
        </div>
      )}

      {/* 方式②：粘贴 */}
      {mode === "paste" && (
        <div className="rounded-lg border p-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            粘贴表格（Excel 复制选区 = TSV，或纯 CSV 文本）
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder={"品牌\t机型\t年份\t地区\t价格\t卖家\t电话\nCLAAS\t2504\t2020\t河北\t850000\t张三\t13800000000"}
            className="w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={onPasteParse}
            className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            解析
          </button>
        </div>
      )}

      {/* 列映射 UI */}
      {headers.length > 0 && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 text-base font-semibold text-gray-800">列映射（请核对，必填：品牌 / 机型）</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {headers.map((header) => (
              <div key={header} className="flex items-center gap-2">
                <span className="w-28 truncate text-sm text-gray-600" title={header}>
                  {header || "（空表头）"}
                </span>
                <select
                  value={mapping[header] ?? ""}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [header]: e.target.value }))
                  }
                  className="flex-1 rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— 忽略 —</option>
                  {(Object.keys(FIELD_LABELS) as CanonicalField[]).map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 归属判定口径说明 + 统计 */}
      {rawRows.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-base font-semibold text-gray-800">归属判定（货物所在地）</h2>
          <p className="mt-1 text-sm text-gray-600">
            口径：货在<b>境内</b> → <code>cn</code>（入 .cn 站）；货在<b>境外</b> → <code>intl</code>（入 .com 站）；
            <b>判不出</b> → <code>unknown</code>，<b>不入库</b>，转待核队列。
            卖家所在地与挂牌平台<b>只是弱线索</b>，不作判定依据 —— 请逐行下拉确认。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
              境内 cn：{scopeStats.cn} 条
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
              境外 intl：{scopeStats.intl} 条
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
              待核 unknown：{scopeStats.unknown} 条（不入库）
            </span>
            <button
              type="button"
              onClick={exportPendingCsv}
              disabled={scoped.length === 0}
              className="rounded-lg border bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
            >
              导出待核清单（待核队列-{todayStamp()}.csv）
            </button>
          </div>
        </div>
      )}

      {/* 预览 + 校验 + 逐行归属 */}
      {rawRows.length > 0 && (
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">
              预览（共 {rawRows.length} 行{rawRows.length > PREVIEW_LIMIT ? `，下表渲染前 ${PREVIEW_LIMIT} 行，导出/提交仍按全部行` : ""}）
            </h2>
            {invalidCount > 0 ? (
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                {invalidCount} 行校验不通过（禁止提交）
              </span>
            ) : (
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                全部通过校验
              </span>
            )}
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="border px-2 py-1 text-left">#</th>
                  {PREVIEW_FIELDS.map((f) => (
                    <th key={f} className="border px-2 py-1 text-left">
                      {FIELD_LABELS[f]}
                    </th>
                  ))}
                  <th className="border px-2 py-1 text-left">归属</th>
                  <th className="border px-2 py-1 text-left">判定依据</th>
                  <th className="border px-2 py-1 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((b, i) => {
                  const rowIndex = i;
                  return (
                    <tr key={i} className={b.valid ? "" : "bg-red-50"}>
                      <td className="border px-2 py-1">{i + 1}</td>
                      {PREVIEW_FIELDS.map((f) => (
                        <td key={f} className="border px-2 py-1">
                          {b.row[f] == null || b.row[f] === "" ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            String(b.row[f])
                          )}
                        </td>
                      ))}
                      <td className="border px-2 py-1">
                        <select
                          value={b.scope}
                          onChange={(e) =>
                            setRegionOverrides((prev) => ({
                              ...prev,
                              [rowIndex]: e.target.value as StoreScope,
                            }))
                          }
                          className={`rounded border px-1 py-0.5 text-xs ${
                            b.scope === "unknown"
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-gray-300 bg-white text-gray-700"
                          }`}
                          title={STORE_SCOPE_LABEL[b.scope]}
                        >
                          {STORE_SCOPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {STORE_SCOPE_LABEL[opt]}
                            </option>
                          ))}
                        </select>
                        {b.overridden && (
                          <span className="ml-1 text-[10px] font-medium text-primary-600">已覆写</span>
                        )}
                      </td>
                      <td className="border px-2 py-1 text-xs text-gray-500">
                        <span title={b.inference.reason}>
                          {STORE_SCOPE_BASIS_LABEL[b.inference.basis]}
                          {b.inference.evidence ? ` · ${b.inference.evidence}` : ""}
                        </span>
                      </td>
                      <td className="border px-2 py-1">
                        {b.valid ? (
                          <span className={b.scope === "unknown" ? "text-amber-600" : "text-green-600"}>
                            {b.scope === "unknown" ? "待核（不入库）" : "OK"}
                          </span>
                        ) : (
                          <span className="text-red-600" title={b.errors.join("；")}>
                            缺失/错误
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`mt-4 rounded-lg px-5 py-2 text-sm font-medium text-white ${canSubmit ? "bg-primary-600 hover:bg-primary-700" : "cursor-not-allowed bg-gray-300"}`}
          >
            {submitting ? "提交中…" : `提交 ${built.length} 条线索`}
          </button>
          {scopeStats.unknown > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              ⚠ 其中 {scopeStats.unknown} 行归属为 unknown，提交后<b>不会入库</b>，而是进入待核队列（可导出后回填再导）。
            </p>
          )}
        </div>
      )}

      {/* 提交结果 */}
      {submitResult && (
        <div
          className={`rounded-lg border p-4 ${submitResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          {submitResult.success ? (
            <div className="text-sm text-green-800">
              <p className="font-semibold">导入完成</p>
              {submitResult.message && <p className="mt-1">{submitResult.message}</p>}
              <p>成功导入：{submitResult.imported ?? 0} 条</p>
              <p>跳过（重复/已存在）：{submitResult.skipped ?? 0} 条</p>
              <p>校验失败：{submitResult.errors ?? 0} 条</p>
              <p>拒收（归属与本站点不符）：{submitResult.rejectedCount ?? submitResult.rejected?.length ?? 0} 条</p>
              <p>待人工核实（未入库）：{submitResult.pending ?? 0} 条</p>
              {submitResult.sampleErrors && submitResult.sampleErrors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-red-700">
                  {submitResult.sampleErrors.slice(0, 10).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
              {submitResult.rejected && submitResult.rejected.length > 0 && (
                <div className="mt-3">
                  <p className="font-semibold text-amber-800">被拒收的行（前 10 条）：</p>
                  <ul className="mt-1 list-disc pl-5 text-amber-800">
                    {submitResult.rejected.slice(0, 10).map((r, i) => (
                      <li key={i}>
                        第 {r.lineNo} 行 · {r.identity} —— {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {submitResult.pendingDetail && submitResult.pendingDetail.length > 0 && (
                <div className="mt-3">
                  <p className="font-semibold text-gray-700">待人工核实的行（前 10 条）：</p>
                  <ul className="mt-1 list-disc pl-5 text-gray-700">
                    {submitResult.pendingDetail.slice(0, 10).map((r, i) => (
                      <li key={i}>
                        第 {r.lineNo} 行 · {r.identity} —— {r.reason}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={exportPendingCsv}
                    className="mt-2 rounded-lg border bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    导出待核清单
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-red-700">
              <p className="font-semibold">导入失败</p>
              <p>{submitResult.error}</p>
              {submitResult.code === "SCHEMA_NOT_READY" && (
                <p className="mt-2">
                  👉 这是 <code>goodsRegion</code> 列未落库的自检提示：请先在服务器执行
                  <code> npx prisma db push</code> 后重试本次导入（本次一条都没写）。
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 客户端校验错误 */}
      {clientErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-1 text-sm font-semibold text-red-800">请修正以下问题：</p>
          <ul className="list-disc pl-5 text-sm text-red-700">
            {clientErrors.slice(0, 20).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
