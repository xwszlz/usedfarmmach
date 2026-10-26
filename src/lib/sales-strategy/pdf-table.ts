/**
 * AI 销售策略 · PDF 表格渲染基建（T09）
 * ─────────────────────────────────────────────────────────
 * **存在理由**：现有 `export.ts` 的 `buildPdf` 只会「画段落」，画不了表格，而
 * 黄金样板的灵魂就是表格（TL;DR 4 列、价格锚点矩阵、市场排名、今天该打的电话…）。
 * 本文件把「表格绘制」从 `buildPdf` 里**彻底剥离**成一份零业务依赖的基建：
 *   - `drawTable`          就地推进 `state.y` 画一张可用表格（含跨页续排表头）
 *   - `measureTableHeight` 只算高度、不画（供 T10 预判「第 0 章能否一页看完」）
 *   - `wrapCjk`            CJK 按字符换行（**语义与 `export.ts` 的 `wrapText` 一致**）
 *   - `stripEmoji`         PDF 文本禁 emoji 的唯一闸门（Noto Sans SC 无 emoji 字形）
 *   - `renderStars`        星级渲染（「5 星」，不用 ★）
 *   - `A4_LAYOUT`          A4 版面常量（595×842，边距 40，内容宽 515）
 *
 * **向后兼容（硬约束，arch §1.4.1 / §5 T09 验收 ⑦）**
 *   `PdfTableState` 与 `export.ts` 的 `RenderState` **字段名/类型完全相同**（doc/page/font/y），
 *   TS 结构化类型下可直接互传 ⇒ T10 把 `RenderState` 实例丢进 `drawTable()` 即可，
 *   **不需要修改 `export.ts`**。`drawTable` 与 `drawParagraph` 一样「就地修改 state.y」，
 *   调用方画完表格后可以继续用同一个 state 画下一段。
 *
 * **渲染硬约定（arch §1.4.2 / §7#11）**
 *   1. 所有进入表格的文本**在函数内部**统一过 `stripEmoji`（调用方不必自己处理）；
 *      告警/红绿灯请用文本标记 `[告警] / [绿] / [黄] / [红]`。
 *   2. `★`/`☆`/`☐`/`☑`/`☒` 属「Noto Sans SC 可绘的常见符号」，**白名单保留**；
 *      星级统一走 `renderStars()` 输出中文「N 星」。
 *
 * **列宽策略（arch §1.4.1 + §3.4 补充约定）**
 *   调用方给**绝对 pt**；`sum(width) !== CONTENT_W(515)` 时**按比例缩放 + console.warn，绝不抛错**
 *   —— 避免某个章节因为 1pt 误差整份 PDF 500。
 *
 * **跨页续排表头（T09 核心，arch §1.4.3）**
 *   一行画不下 ⇒ `addPage` ⇒ 新页顶部**重画表头** ⇒ `pageBreaks++` ⇒ 写回 `state.page`。
 *   `state.page` 必须写回，否则后续段落会画到旧页上（静默丢内容）。
 */

import { rgb } from "pdf-lib";
import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";

// ═══════════════════════════════════════════════════════════
// 0. 契约（arch §1.4.1 逐字：签名不改、字段名不改）
// ═══════════════════════════════════════════════════════════

/** RGB 三元组，每个分量 0–1（pdf-lib 口径） */
export type RGBTuple = [number, number, number];

/**
 * 表格绘制状态。
 *
 * ⚠️ 与 `export.ts` 的 `RenderState`（doc/page/font/y 四字段）**结构完全一致**，
 *    故 `drawTable(state, ...)` 可直接接收 `buildPdf` 里的 state 对象。
 */
export interface PdfTableState {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  y: number;
}

/** 一列的定义 */
export interface TableColumn {
  /** 取值键（对应 `TableRow` 的 key） */
  key: string;
  /** 表头文案（zh/en 由调用方给，绘制前统一 `stripEmoji`） */
  header: string;
  /** 列宽（pt）；全部列之和应 === `A4_LAYOUT.CONTENT_W`(515)，不等则按比例缩放 */
  width: number;
  /** 水平对齐，默认 `left` */
  align?: "left" | "center" | "right";
  /**
   * 电话 / 序号列：等宽感，**禁用自动压缩**。
   * `false`（默认）时，若某行文本仍超出列宽会做「字距缩减」以塞进列内；
   * `true` 时不做字距缩减，改为截断加「…」（保证电话号码不被挤到变形）。
   */
  mono?: boolean;
}

/** 单元格（`string` 的富态写法） */
export interface TableCell {
  text: string;
  /** 加粗：单字体环境用「同一文本微偏移重绘一次」模拟粗体（无需第二套字体） */
  bold?: boolean;
  /** 文本颜色，默认 `[0.2, 0.2, 0.2]` */
  color?: RGBTuple;
}

/** 一行数据：`Record<列 key, 文本 | 富单元格>` */
export type TableRow = Record<string, string | TableCell>;

/**
 * `drawTable` 入参。
 *
 * 全部可选字段均已给出默认值（标注在注释里），调用方只需要 `columns` + `rows`。
 */
export interface DrawTableOptions {
  columns: TableColumn[];
  rows: TableRow[];
  /** 正文字号，默认 **8.5** */
  fontSize?: number;
  /** 表头字号，默认 **8.5** */
  headerFontSize?: number;
  /** 行高倍数（lineHeight × fontSize = 单行行高），默认 **1.35** */
  lineHeight?: number;
  /** 单元格左右内边距，默认 **4** */
  paddingX?: number;
  /** 单元格上下内边距（单侧），默认 **3** */
  paddingY?: number;
  /** 表头底色，默认 **[0.93, 0.96, 0.94]**（浅灰绿）；传 `null` 表示不铺底 */
  headerBg?: RGBTuple;
  /** 斑马纹底色，默认 **null**（不铺）；传值则索引为奇数的行铺底（表格 ≥8 行才建议开） */
  zebraBg?: RGBTuple | null;
  /**
   * 行底色回调（优先级着色，如 S 档浅红）。
   * 返回 `null` ⇒ **明确不铺底**（即使开了 `zebraBg` 也不铺）；
   * 返回 `undefined` ⇒ 交给斑马纹逻辑。
   */
  rowBg?: (rowIndex: number, row: TableRow) => RGBTuple | null;
  /** 边框颜色，默认 **[0.82, 0.82, 0.82]** */
  borderColor?: RGBTuple;
  /** ★ 跨页续排表头，默认 **true** */
  repeatHeaderOnPageBreak?: boolean;
  /** 单元格空值统一占位，默认 **"—"**（PRD §4.0 口径） */
  emptyText?: string;
}

// ═══════════════════════════════════════════════════════════
// 1. 版面常量与内部默认值
// ═══════════════════════════════════════════════════════════

/** A4 版面常量（与 `export.ts` 的 PAGE_W/PAGE_H/MARGIN/CONTENT_W 保持同一套数值） */
export const A4_LAYOUT = { PAGE_W: 595, PAGE_H: 842, MARGIN: 40, CONTENT_W: 515 } as const;

const DEFAULT_FONT_SIZE = 8.5;
const DEFAULT_HEADER_FONT_SIZE = 8.5;
const DEFAULT_LINE_HEIGHT = 1.35;
const DEFAULT_PADDING_X = 4;
const DEFAULT_PADDING_Y = 3;
const DEFAULT_HEADER_BG: RGBTuple = [0.93, 0.96, 0.94];
const DEFAULT_BORDER_COLOR: RGBTuple = [0.82, 0.82, 0.82];
const DEFAULT_TEXT_COLOR: RGBTuple = [0.2, 0.2, 0.2];
const HEADER_TEXT_COLOR: RGBTuple = [0.12, 0.12, 0.12];
const DEFAULT_EMPTY_TEXT = "—";

/** 表格画完后的额外留白（与 `drawSectionTitle` 的间距风格一致） */
const AFTER_TABLE_GAP = 8;
/** 单元格可用文本宽度下限：列宽过窄时避免 maxWidth ≤ 0 导致「一行一个字」的雪崩 */
const MIN_TEXT_WIDTH = 8;
/** 字距缩减的下限（低于此比例改为截断，防止文字糊成一团） */
const MIN_CONDENSE_SCALE = 0.7;
/** 粗体模拟的横向偏移量（pt） */
const BOLD_OFFSET = 0.22;
/** 基线系数：`baseline = lineTop - lineHeight/2 - fontSize * 0.36` 的近似形式，见 paintRow */
const BASELINE_FACTOR = 0.72;
/** 列宽校验容差（pt）：小于此值视为「相等」，不缩放不告警 */
const WIDTH_TOLERANCE = 0.01;
/** 告警容差（pt）：只有偏差大于此值才 console.warn，避免小数抖动刷日志 */
const WIDTH_WARN_TOLERANCE = 0.5;
/** 边框线宽 */
const BORDER_WIDTH = 0.6;
/** 表头行高告警阈值（超过视为调用方列宽给错） */
const HEADER_WARN_HEIGHT = 100;

// ═══════════════════════════════════════════════════════════
// 2. 文本基础能力：emoji 剥离 / 星级 / CJK 换行
// ═══════════════════════════════════════════════════════════

/**
 * 需要剥离的 emoji 码点区间（**显式列举，不用 `\p{Extended_Pictographic}`**）。
 *
 * 为什么不用 Unicode 属性转义：
 *   1. `tsconfig.target = ES2017`，属性转义在旧引擎上是 SyntaxError，显式区间零风险；
 *   2. `Extended_Pictographic` 会误伤 `★`(U+2605) —— 而 `★` 是 Noto Sans SC **可绘**的常见符号，
 *      按 arch §1.4.2 应保留。
 *
 * 覆盖清单（QA 可断言）：
 *   - U+1F000–U+1FAFF：🔴🟢🟡（U+1F534/1F7E2/1F7E1）、😀🚜📞、旗帜、肤色修饰、交通工具等全集
 *   - U+2300–U+23FF  ：⌚⏰⏳
 *   - U+2600–U+2605  ：☀☁☂…（`★` U+2605 由白名单救回）
 *   - U+2607–U+27BF  ：☑⚠(U+26A0)⚡⛔✅(U+2705)❌(U+274C)✔✖✨❤ 等
 *   - U+2B00–U+2BFF  ：⬛⬜⭐(U+2B50)⭕
 *   - U+FE00–U+FE0F  ：变体选择符（`⚠️` 的 U+FE0F 就在此处，不去掉会留一个孤儿字形）
 *   - U+200D         ：零宽连接符（👨‍👩‍👧 的粘合剂）
 *   - U+20E3         ：组合键帽（1️⃣）
 */
const EMOJI_STRIP_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1f000, 0x1faff],
  [0x2300, 0x23ff],
  [0x2600, 0x2605],
  [0x2607, 0x27bf],
  [0x2b00, 0x2bff],
  [0xfe00, 0xfe0f],
  [0x200d, 0x200d],
  [0x20e3, 0x20e3],
];

/**
 * 白名单：Noto Sans SC 有字形、且业务上要用的常见符号，**不剥离**。
 * `★`/`☆` 用于星级备用展示，`☐` 用于上架清单（既有 `export.ts` 已在画它）。
 */
const SAFE_SYMBOLS: ReadonlySet<string> = new Set(["★", "☆", "☐", "☑", "☒"]);

function isEmojiCodePoint(codePoint: number): boolean {
  for (const [lo, hi] of EMOJI_STRIP_RANGES) {
    if (codePoint >= lo && codePoint <= hi) return true;
  }
  return false;
}

/**
 * 剥离 emoji（PDF 文本禁 emoji 的唯一闸门，arch §1.4.2 硬约定 1）。
 *
 * `NotoSansSC-Regular.ttf` **不含 emoji 字形**，直接画 `⚠️/🔴/🟢/🟡` 只会得到空白或 .notdef。
 * 调用方请改用文本标记：`[告警]` / `[绿]友好` / `[黄]需许可` / `[红]禁入`。
 *
 * @param text 任意文本（非字符串 / 空值安全返回 `""`，永不抛错）
 * @returns 去掉 emoji 后的文本（`★☆☐☑☒` 保留）
 */
export function stripEmoji(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";
  let out = "";
  for (const ch of Array.from(text)) {
    if (SAFE_SYMBOLS.has(ch)) {
      out += ch;
      continue;
    }
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (isEmojiCodePoint(cp)) continue;
    out += ch;
  }
  return out;
}

/**
 * 星级渲染（arch §1.4.2 硬约定 2：**不用 ★**，用中文「N 星」）。
 *
 * - 越界 clamp 到 `[1, 5]`（`0 → "1 星"`、`9 → "5 星"`、`+Infinity → "5 星"`）
 * - 非数字 / NaN ⇒ 退化为 `"1 星"`（**不抛错**，QA D3 只校验区间）
 *
 * @param n 星级（LLM 给的 1–5；调用方已按 PRD 做过 clamp 亦可）
 * @returns 形如 `"5 星"`
 */
export function renderStars(n: number): string {
  // NaN / 非数字 ⇒ 退化为 1；±Infinity 交给 Math.round 后再由 clamp 收口
  const raw = typeof n === "number" && !Number.isNaN(n) ? Math.round(n) : 1;
  const clamped = Math.min(5, Math.max(1, raw));
  return `${clamped} 星`;
}

/** 单字符宽度（字体缺字形时退化为 0.5em，永不抛错） */
function safeCharWidth(font: PDFFont, ch: string, size: number): number {
  try {
    const w = font.widthOfTextAtSize(ch, size);
    return Number.isFinite(w) && w >= 0 ? w : size * 0.5;
  } catch {
    return size * 0.5;
  }
}

/** 整串宽度（异常时逐字累加，永不抛错） */
function safeTextWidth(font: PDFFont, text: string, size: number): number {
  if (!text) return 0;
  try {
    const w = font.widthOfTextAtSize(text, size);
    return Number.isFinite(w) && w >= 0 ? w : fallbackWidth(font, text, size);
  } catch {
    return fallbackWidth(font, text, size);
  }
}

function fallbackWidth(font: PDFFont, text: string, size: number): number {
  let total = 0;
  for (const ch of Array.from(text)) total += safeCharWidth(font, ch, size);
  return total;
}

/**
 * CJK 友好的按字符换行（**语义逐字复刻** `export.ts` 的 `wrapText`）。
 *
 * 为什么必须自己实现：中文没有空格，pdf-lib 原生只按空格断行，`pdf-lib` 会整段溢出。
 * 与 `wrapText` 的差异只有一处（不影响输出）：单字取宽包了 try/catch，
 * 遇到字体缺字形时退化为 0.5em 而不是抛异常。
 *
 * 行为约定（与 `wrapText` 一致）：
 *   - 按 `\n` 先做硬换行，硬换行产生的空串会被保留为 `[""]` 占位；
 *   - 超宽时在**字符边界**折行（`Array.from` 处理代理对，emoji 不会被劈成半个）；
 *   - 单个字符本身宽于 `maxWidth` 时，该字符独占一行（**绝不会死循环**）。
 *
 * @param text 文本（空值返回 `[]`）
 * @param font 已嵌入的字体
 * @param size 字号
 * @param maxWidth 单行可用宽度（pt）
 * @returns 折好的行数组
 */
export function wrapCjk(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const out: string[] = [];
  const hardLines = text.split(/\n/);
  for (const hard of hardLines) {
    if (hard === "") {
      out.push("");
      continue;
    }
    const chars = Array.from(hard);
    let line = "";
    let lineW = 0;
    for (const ch of chars) {
      const w = safeCharWidth(font, ch, size);
      if (lineW + w > maxWidth && line.length > 0) {
        out.push(line);
        line = ch;
        lineW = w;
      } else {
        line += ch;
        lineW += w;
      }
    }
    if (line.length > 0) out.push(line);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// 3. 内部结构：归一化列 / 预处理行
// ═══════════════════════════════════════════════════════════

interface NormalizedColumn {
  key: string;
  header: string;
  width: number;
  align: "left" | "center" | "right";
  mono: boolean;
  /** 该列左边界绝对 x（含 MARGIN） */
  x: number;
}

interface PreparedCell {
  x: number;
  width: number;
  align: "left" | "center" | "right";
  mono: boolean;
  bold: boolean;
  color: RGBTuple;
  lines: string[];
}

interface PreparedRow {
  cells: PreparedCell[];
  height: number;
  fontSize: number;
  lineHeight: number;
  paddingX: number;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function sanitizeColor(input: unknown): RGBTuple | null {
  if (!Array.isArray(input) || input.length < 3) return null;
  const [r, g, b] = input;
  if (![r, g, b].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  return [clamp01(r as number), clamp01(g as number), clamp01(b as number)];
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/** 正数兜底（非法值回落默认） */
function positiveOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** 非负数兜底（0 合法） */
function nonNegativeOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * 列宽归一化：把任意列宽按比例缩放到 `A4_LAYOUT.CONTENT_W`。
 * **绝不抛错**（arch §3.4）；异常输入降级为等分 + `console.warn`。
 */
function normalizeColumns(columns: TableColumn[]): NormalizedColumn[] {
  const list = Array.isArray(columns) ? columns.filter((c) => c != null) : [];
  if (list.length === 0) return [];

  const rawWidths = list.map((c) => {
    const w = Number(c.width);
    return Number.isFinite(w) && w > 0 ? w : 0;
  });
  const sum = rawWidths.reduce((acc, w) => acc + w, 0);

  let widths: number[];
  if (sum <= 0) {
    const even = A4_LAYOUT.CONTENT_W / list.length;
    console.warn(
      `[pdf-table] 列宽全部非法（≤0 或非数字），已按等分处理：每列 ${round2(even)}pt（不抛错）`
    );
    widths = list.map(() => even);
  } else {
    const diff = sum - A4_LAYOUT.CONTENT_W;
    if (Math.abs(diff) > WIDTH_WARN_TOLERANCE) {
      const scale = A4_LAYOUT.CONTENT_W / sum;
      console.warn(
        `[pdf-table] 列宽之和 ${round2(sum)}pt ≠ 内容区宽度 ${A4_LAYOUT.CONTENT_W}pt，` +
          `已按比例缩放 ×${scale.toFixed(4)}（不抛错）`
      );
    }
    const scale = Math.abs(diff) > WIDTH_TOLERANCE ? A4_LAYOUT.CONTENT_W / sum : 1;
    widths = rawWidths.map((w) => w * scale);
  }

  if (widths.some((w) => w < 1)) {
    console.warn("[pdf-table] 存在列宽 < 1pt 的列，单元格内容会严重换行，请检查 columns[].width");
  }

  let cursor = A4_LAYOUT.MARGIN;
  return list.map((c, i) => {
    const align =
      c.align === "center" || c.align === "right" || c.align === "left" ? c.align : "left";
    const width = widths[i] ?? 0;
    const column: NormalizedColumn = {
      key: String(c.key ?? ""),
      header: String(c.header ?? ""),
      width,
      align,
      mono: c.mono === true,
      x: cursor,
    };
    cursor += width;
    return column;
  });
}

/** 把单元格的 `string | TableCell` 读成规范结构（stripEmoji + emptyText 兜底） */
function readCell(
  row: TableRow,
  key: string,
  emptyText: string
): { text: string; bold: boolean; color: RGBTuple } {
  const raw: string | TableCell | undefined = row?.[key];
  let text = "";
  let bold = false;
  let color: RGBTuple = DEFAULT_TEXT_COLOR;

  if (typeof raw === "string") {
    text = raw;
  } else if (raw && typeof raw === "object") {
    text = typeof raw.text === "string" ? raw.text : "";
    bold = raw.bold === true;
    const c = sanitizeColor(raw.color);
    if (c) color = c;
  }

  const cleaned = stripEmoji(text).trim();
  const fallback = stripEmoji(emptyText).trim();
  return { text: cleaned.length > 0 ? cleaned : fallback, bold, color };
}

/** 行数截断（单行高超过可用页高时的兜底，保证「不得无限循环」） */
function truncateLines(lines: string[], allowed: number): string[] {
  if (lines.length <= allowed) return lines;
  const kept = lines.slice(0, allowed);
  if (kept.length === 0) return ["…"];
  kept[kept.length - 1] = `${kept[kept.length - 1]}…`;
  return kept;
}

/**
 * 预处理一行：算每格折行结果 + 行高。
 *
 * 行高公式（arch §1.4.3 ②）：`maxLines × fontSize × lineHeight + 2 × paddingY`
 */
function prepareRow(
  columns: NormalizedColumn[],
  cells: Array<{ text: string; bold: boolean; color: RGBTuple }>,
  font: PDFFont,
  fontSize: number,
  lineHeight: number,
  paddingX: number,
  paddingY: number
): PreparedRow {
  const lineH = fontSize * lineHeight;
  const prepared: PreparedCell[] = columns.map((col, i) => {
    const cell = cells[i] ?? { text: "", bold: false, color: DEFAULT_TEXT_COLOR };
    const innerW = Math.max(col.width - paddingX * 2, MIN_TEXT_WIDTH);
    const wrapped = wrapCjk(cell.text, font, fontSize, innerW);
    return {
      x: col.x,
      width: col.width,
      align: col.align,
      mono: col.mono,
      bold: cell.bold,
      color: cell.color,
      lines: wrapped.length > 0 ? wrapped : [""],
    };
  });

  let maxLines = prepared.reduce((m, c) => Math.max(m, c.lines.length), 1);
  const maxHeight = A4_LAYOUT.PAGE_H - A4_LAYOUT.MARGIN * 2;
  let height = maxLines * lineH + paddingY * 2;

  // 边界（arch §1.4.3）：单行高不可能超过整页可用高（列宽已限制字符数）⇒ 截断 + 「…」
  if (height > maxHeight) {
    const allowed = Math.max(1, Math.floor((maxHeight - paddingY * 2) / lineH));
    for (const c of prepared) c.lines = truncateLines(c.lines, allowed);
    maxLines = prepared.reduce((m, c) => Math.max(m, c.lines.length), 1);
    height = maxLines * lineH + paddingY * 2;
    console.warn(
      `[pdf-table] 单行高度 ${round2(height)}pt 超过可用页高 ${round2(maxHeight)}pt，` +
        `已截断为 ${maxLines} 行并追加「…」（请检查列宽是否过窄）`
    );
  }

  return { cells: prepared, height, fontSize, lineHeight, paddingX };
}

// ═══════════════════════════════════════════════════════════
// 4. 绘制原语
// ═══════════════════════════════════════════════════════════

function measureText(font: PDFFont, text: string, size: number, bold: boolean): number {
  return safeTextWidth(font, text, size) + (bold ? BOLD_OFFSET : 0);
}

/** 按宽度截断并追加「…」（先保证不溢出列，再谈美观） */
function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (safeTextWidth(font, text, size) <= maxWidth) return text;
  const ellipsis = "…";
  const ellipsisW = safeCharWidth(font, ellipsis, size);
  const chars = Array.from(text);
  let out = "";
  let width = 0;
  for (const ch of chars) {
    const cw = safeCharWidth(font, ch, size);
    if (width + cw + ellipsisW > maxWidth) break;
    out += ch;
    width += cw;
  }
  if (out.length === 0) out = chars[0] ?? "";
  return out + ellipsis;
}

/**
 * 落笔：整串一次性 `drawText`（`scale === 1`），或逐字缩排（`scale < 1`，字距缩减）。
 * 粗体通过「同文本右偏移 0.22pt 再画一次」模拟（单字体环境下最省事且视觉可辨）。
 */
function paintGlyphs(
  page: PDFPage,
  font: PDFFont,
  text: string,
  o: { x: number; y: number; size: number; color: RGBTuple; bold: boolean },
  scale: number
): void {
  const color = rgb(o.color[0], o.color[1], o.color[2]);
  if (Math.abs(scale - 1) < 1e-6) {
    page.drawText(text, { x: o.x, y: o.y, size: o.size, font, color });
    if (o.bold) page.drawText(text, { x: o.x + BOLD_OFFSET, y: o.y, size: o.size, font, color });
    return;
  }
  let cursor = o.x;
  for (const ch of Array.from(text)) {
    const w = safeCharWidth(font, ch, o.size);
    page.drawText(ch, { x: cursor, y: o.y, size: o.size, font, color });
    if (o.bold) page.drawText(ch, { x: cursor + BOLD_OFFSET, y: o.y, size: o.size, font, color });
    cursor += w * scale;
  }
}

/**
 * 画一行文本，超宽时的策略：
 *   - 不超宽 ⇒ 正常画；
 *   - 超宽且 `allowCondense`（非 mono 列）⇒ **字距缩减**到恰好塞进列内（下限 0.7）；
 *   - 超宽且 `!allowCondense`（mono 列：电话/序号）⇒ **不压缩**，截断加「…」。
 */
function drawFittedLine(
  page: PDFPage,
  font: PDFFont,
  text: string,
  o: {
    x: number;
    y: number;
    size: number;
    color: RGBTuple;
    bold: boolean;
    maxWidth: number;
    allowCondense: boolean;
  }
): void {
  const width = measureText(font, text, o.size, o.bold);
  if (width <= o.maxWidth + WIDTH_TOLERANCE) {
    paintGlyphs(page, font, text, o, 1);
    return;
  }
  if (o.allowCondense) {
    const scale = Math.max(MIN_CONDENSE_SCALE, o.maxWidth / width);
    if (scale > MIN_CONDENSE_SCALE + 1e-6) {
      paintGlyphs(page, font, text, o, scale);
      return;
    }
    const fitted = truncateToWidth(text, font, o.size, o.maxWidth / MIN_CONDENSE_SCALE);
    paintGlyphs(page, font, fitted, o, MIN_CONDENSE_SCALE);
    return;
  }
  paintGlyphs(page, font, truncateToWidth(text, font, o.size, o.maxWidth), o, 1);
}

/**
 * 画一整行（底色 + 边框 + 全部单元格文本）。
 *
 * @param topY 该行顶部 y（= 调用时的 `state.y`）
 */
function paintRow(
  page: PDFPage,
  font: PDFFont,
  row: PreparedRow,
  topY: number,
  o: { bg: RGBTuple | null; borderColor: RGBTuple; drawTopBorder: boolean }
): void {
  const bottomY = topY - row.height;
  const border = rgb(o.borderColor[0], o.borderColor[1], o.borderColor[2]);

  if (o.bg) {
    page.drawRectangle({
      x: A4_LAYOUT.MARGIN,
      y: bottomY,
      width: A4_LAYOUT.CONTENT_W,
      height: row.height,
      color: rgb(o.bg[0], o.bg[1], o.bg[2]),
    });
  }

  // 行底线
  page.drawLine({
    start: { x: A4_LAYOUT.MARGIN, y: bottomY },
    end: { x: A4_LAYOUT.MARGIN + A4_LAYOUT.CONTENT_W, y: bottomY },
    thickness: BORDER_WIDTH,
    color: border,
  });
  // 列分隔线（跳过左外框，左外框由第 0 列 x 决定是否铺）
  for (const cell of row.cells) {
    if (cell.x > A4_LAYOUT.MARGIN + WIDTH_TOLERANCE) {
      page.drawLine({
        start: { x: cell.x, y: topY },
        end: { x: cell.x, y: bottomY },
        thickness: BORDER_WIDTH,
        color: border,
      });
    }
  }
  // 右外框 + 可选的顶部外框
  const rightX = A4_LAYOUT.MARGIN + A4_LAYOUT.CONTENT_W;
  page.drawLine({
    start: { x: rightX, y: topY },
    end: { x: rightX, y: bottomY },
    thickness: BORDER_WIDTH,
    color: border,
  });
  if (o.drawTopBorder) {
    page.drawLine({
      start: { x: A4_LAYOUT.MARGIN, y: topY },
      end: { x: rightX, y: topY },
      thickness: BORDER_WIDTH,
      color: border,
    });
  }

  // 文本：多行单元格垂直居中，行内按 lineHeight 递减
  const lineH = row.fontSize * row.lineHeight;
  for (const cell of row.cells) {
    const blockH = cell.lines.length * lineH;
    const blockTop = topY - (row.height - blockH) / 2;
    const innerLeft = cell.x + row.paddingX;
    const innerW = Math.max(cell.width - row.paddingX * 2, MIN_TEXT_WIDTH);

    cell.lines.forEach((line, k) => {
      if (line === "") return;
      const baseline = blockTop - k * lineH - (lineH + row.fontSize * BASELINE_FACTOR) / 2;
      const textW = measureText(font, line, row.fontSize, cell.bold);
      let x = innerLeft;
      if (cell.align === "center") x = innerLeft + (innerW - textW) / 2;
      else if (cell.align === "right") x = innerLeft + (innerW - textW);
      // 文本比列还宽时不允许往左越界（右对齐会算出 < innerLeft）
      if (x < innerLeft) x = innerLeft;

      drawFittedLine(page, font, line, {
        x,
        y: baseline,
        size: row.fontSize,
        color: cell.color,
        bold: cell.bold,
        maxWidth: innerW,
        allowCondense: !cell.mono,
      });
    });
  }
}

// ═══════════════════════════════════════════════════════════
// 5. 对外主函数
// ═══════════════════════════════════════════════════════════

/**
 * 在 `state` 当前页绘制表格，**就地推进 `state.y`**（与 `drawParagraph` 风格一致），
 * 必要时 `addPage` 并**写回 `state.page`**。
 *
 * 跨页续排表头算法（arch §1.4.3）：
 * ```
 * for each row:
 *   ① 每格 wrapCjk 折行
 *   ② rowH = maxLines × fontSize × lineHeight + 2 × paddingY
 *   ③ if (state.y - rowH < MARGIN) → addPage + y 归位 + 重画表头 + pageBreaks++
 *   ④ 底色（rowBg 优先，其次斑马纹）
 *   ⑤ 逐列逐行 drawText，垂直居中、水平按 align
 * afterTable: state.y -= 8
 * ```
 *
 * @param state doc/page/font/y 四字段状态（可直接传 `export.ts` 的 `RenderState`）
 * @param opts 表格定义
 * @returns `rowsDrawn` 实际画出的数据行数（不含表头/续排表头）；`pageBreaks` 新开页次数
 */
export function drawTable(
  state: PdfTableState,
  opts: DrawTableOptions
): { rowsDrawn: number; pageBreaks: number } {
  const summary = { rowsDrawn: 0, pageBreaks: 0 };
  if (!state || !state.doc || !state.page || !state.font || !opts) return summary;

  const columns = normalizeColumns(opts.columns);
  const rows = Array.isArray(opts.rows) ? opts.rows : [];
  // 空表不画（连表头都不画）：调用方应自己渲染「（暂无数据）」文案
  if (columns.length === 0 || rows.length === 0) return summary;

  const fontSize = positiveOr(opts.fontSize, DEFAULT_FONT_SIZE);
  const headerFontSize = positiveOr(opts.headerFontSize, DEFAULT_HEADER_FONT_SIZE);
  const lineHeight = positiveOr(opts.lineHeight, DEFAULT_LINE_HEIGHT);
  const paddingX = nonNegativeOr(opts.paddingX, DEFAULT_PADDING_X);
  const paddingY = nonNegativeOr(opts.paddingY, DEFAULT_PADDING_Y);
  const emptyText = typeof opts.emptyText === "string" ? opts.emptyText : DEFAULT_EMPTY_TEXT;

  const headerBgRaw = opts.headerBg as RGBTuple | null | undefined;
  const headerBg: RGBTuple | null =
    headerBgRaw === null ? null : sanitizeColor(headerBgRaw) ?? DEFAULT_HEADER_BG;
  const zebraBg: RGBTuple | null = sanitizeColor(opts.zebraBg);
  const borderColor: RGBTuple = sanitizeColor(opts.borderColor) ?? DEFAULT_BORDER_COLOR;
  const repeatHeader = opts.repeatHeaderOnPageBreak !== false;
  const rowBgFn = typeof opts.rowBg === "function" ? opts.rowBg : null;

  const headerRow = prepareRow(
    columns,
    columns.map((c) => ({
      text: stripEmoji(c.header).trim(),
      bold: true,
      color: HEADER_TEXT_COLOR,
    })),
    state.font,
    headerFontSize,
    lineHeight,
    paddingX,
    paddingY
  );
  if (headerRow.height > HEADER_WARN_HEIGHT) {
    console.warn(
      `[pdf-table] 表头行高 ${round2(headerRow.height)}pt > ${HEADER_WARN_HEIGHT}pt，` +
        `疑似列宽过窄（调用方错误），照常绘制`
    );
  }

  const startNewPage = (): void => {
    state.page = state.doc.addPage([A4_LAYOUT.PAGE_W, A4_LAYOUT.PAGE_H]);
    state.y = A4_LAYOUT.PAGE_H - A4_LAYOUT.MARGIN;
  };

  // 表头：当前页放不下就先换页（首次换页也算一次 pageBreak）
  if (state.y - headerRow.height < A4_LAYOUT.MARGIN) {
    startNewPage();
    summary.pageBreaks += 1;
  }
  paintRow(state.page, state.font, headerRow, state.y, {
    bg: headerBg,
    borderColor,
    drawTopBorder: true,
  });
  state.y -= headerRow.height;

  for (let i = 0; i < rows.length; i += 1) {
    const row: TableRow = rows[i] ?? {};
    const prepared = prepareRow(
      columns,
      columns.map((c) => readCell(row, c.key, emptyText)),
      state.font,
      fontSize,
      lineHeight,
      paddingX,
      paddingY
    );

    // ③ 跨页：放弃当前页剩余空间 → 新页 → ★ 重画表头
    if (state.y - prepared.height < A4_LAYOUT.MARGIN) {
      startNewPage();
      summary.pageBreaks += 1;
      if (repeatHeader) {
        paintRow(state.page, state.font, headerRow, state.y, {
          bg: headerBg,
          borderColor,
          drawTopBorder: true,
        });
        state.y -= headerRow.height;
      }
    }

    // ④ 底色：rowBg 优先；返回 null ⇒ 明确不铺底；返回 undefined ⇒ 交给斑马纹
    let explicitBg: RGBTuple | null | undefined;
    if (rowBgFn) {
      try {
        const custom = rowBgFn(i, row);
        explicitBg =
          custom === null ? null : sanitizeColor(custom) ?? undefined;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[pdf-table] rowBg 回调异常（第 ${i} 行），已忽略底色：${message}`);
        explicitBg = undefined;
      }
    }
    const bg: RGBTuple | null =
      explicitBg !== undefined ? explicitBg : zebraBg && i % 2 === 1 ? zebraBg : null;

    // ⑤ 绘制
    paintRow(state.page, state.font, prepared, state.y, {
      bg,
      borderColor,
      drawTopBorder: false,
    });
    state.y -= prepared.height;
    summary.rowsDrawn += 1;
  }

  state.y -= AFTER_TABLE_GAP;
  return summary;
}

/**
 * 只算高度、不绘制（供 T10 预判「第 0 章 TL;DR 表能否一页看完」）。
 *
 * 口径与 `drawTable` **完全一致**（同一套 `normalizeColumns` / `prepareRow`），
 * 返回「表格从开始画到结束共消耗多少 pt」，已含表头 + 全部分行 + 尾部 8pt 留白。
 * 判定方式：`measureTableHeight(opts, font) <= state.y - MARGIN - 页脚预留`。
 *
 * ⚠️ 副作用仅有 `console.warn`（列宽异常时），不触碰任何 `PDFPage`。
 *
 * @param opts 表格定义（与 `drawTable` 同构）
 * @param font 已嵌入的字体（用于量宽）
 * @returns 高度（pt）；`columns`/`rows` 为空时返回 0
 */
export function measureTableHeight(opts: DrawTableOptions, font: PDFFont): number {
  if (!opts || !font) return 0;
  const columns = normalizeColumns(opts.columns);
  const rows = Array.isArray(opts.rows) ? opts.rows : [];
  if (columns.length === 0 || rows.length === 0) return 0;

  const fontSize = positiveOr(opts.fontSize, DEFAULT_FONT_SIZE);
  const headerFontSize = positiveOr(opts.headerFontSize, DEFAULT_HEADER_FONT_SIZE);
  const lineHeight = positiveOr(opts.lineHeight, DEFAULT_LINE_HEIGHT);
  const paddingX = nonNegativeOr(opts.paddingX, DEFAULT_PADDING_X);
  const paddingY = nonNegativeOr(opts.paddingY, DEFAULT_PADDING_Y);
  const emptyText = typeof opts.emptyText === "string" ? opts.emptyText : DEFAULT_EMPTY_TEXT;

  const headerRow = prepareRow(
    columns,
    columns.map((c) => ({
      text: stripEmoji(c.header).trim(),
      bold: true,
      color: HEADER_TEXT_COLOR,
    })),
    font,
    headerFontSize,
    lineHeight,
    paddingX,
    paddingY
  );

  let total = headerRow.height;
  for (const row of rows) {
    const cells = columns.map((c) => readCell(row ?? {}, c.key, emptyText));
    total += prepareRow(columns, cells, font, fontSize, lineHeight, paddingX, paddingY).height;
  }
  return total + AFTER_TABLE_GAP;
}
