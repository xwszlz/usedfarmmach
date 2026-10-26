/**
 * AI 销售策略 · 导出模块（PDF 作战手册）
 * ─────────────────────────────────────────────────────────
 * 本文件职责（T10 后）：
 *   - `buildPdf(payload)`：**双版式自动选路**
 *       · 任一新决策字段存在 ⇒ `buildPdfV2`（8 章 + 附录，对齐黄金样板）
 *       · 全部缺失（老策略 JSON / 老客户端）⇒ `buildPdfLegacy`（5 模块，逐字保留）
 *   - 契约 re-export：把 export-types.ts（类型）与 export-excel.ts（buildExcel）重新导出，
 *     保证既有 `@/lib/sales-strategy/export` 调用方零改动。
 *
 * 文件拆分（N01 契约冻结）：
 *   - 导出层全部类型 → `./export-types.ts`（唯一真相）
 *   - Excel 渲染     → `./export-excel.ts`
 *   - PDF 表格基建   → `./pdf-table.ts`（T09：drawTable / wrapCjk / stripEmoji / renderStars / A4_LAYOUT）
 *   - 降级归一化     → `./derive.ts`（N02：`normalizeDecisionFields`，PDF/Excel/UI 共用一份口径）
 *
 * 合规红线（#1 数据不出境 / PII 最小化）：
 *   - PDF 仅渲染「系统脱敏后的联系方式」（永远不出现明文 PII）；
 *
 * 渲染硬约定（arch §1.4.2，违反即返工）：
 *   1. **emoji 一律不进 PDF**：`NotoSansSC-Regular.ttf` 无 emoji 字形 ⇒ 所有入纸文本先过
 *      `stripEmoji()`，改用文本标记 `[告警]` / `[绿]友好` / `[黄]需许可` / `[红]禁入`；
 *   2. **星级不用 ★**：统一 `renderStars(n)` → `"5 星"`。
 *
 * CJK 字体：src/lib/sales-strategy/fonts/NotoSansSC-Regular.ttf（subset:true 仅嵌入用到的字形）。
 */
import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "node:fs";
import * as path from "node:path";
import type { StrategyExportPayload, StrategyExportChannel } from "./export-types";
import type { StrategyLlmResult } from "./prompt";
import {
  A4_LAYOUT,
  drawTable,
  measureTableHeight,
  renderStars,
  stripEmoji,
  wrapCjk,
  type DrawTableOptions,
  type RGBTuple,
  type TableColumn,
  type TableRow,
} from "./pdf-table";
import { normalizeDecisionFields, type DecisionEnv, type NormalizedStrategy } from "./derive";
import {
  EMPTY_CELL,
  FX_NOTE_ZH,
  NO_FABRICATION_CLAUSE,
  NOT_FOUND,
  WEB_DEGRADED_BANNER,
  WEB_STATUS_NOTE,
  type RejectLevel,
} from "./strategy-schema";

// ── 契约 re-export（N01 契约冻结）─────────────────────────────────────────────
// 类型定义已集中到 export-types.ts（唯一真相），Excel 渲染已抽到 export-excel.ts。
// 此处 re-export 的目的是让既有 import 路径 `@/lib/sales-strategy/export` 全部**不用改**
// 即可继续编译（含 export/pdf/route.ts、export/excel/route.ts、客户端导出按钮、既有测试）。
export { buildExcel } from "./export-excel";
export type {
  BuildExcelLayout,
  ExcelDealerInput,
  StrategyExportChannel,
  StrategyExportPayload,
  StrategyExportWebStatus,
  StrategyProductInfo,
} from "./export-types";

const FONT_FILE = "NotoSansSC-Regular.ttf";

/** 解析字体文件路径：优先项目根下的源码目录，便于 Next 运行时与 vitest 共用 */
function resolveFontPath(): string {
  const candidates: string[] = [
    path.join(process.cwd(), "src/lib/sales-strategy/fonts", FONT_FILE),
    path.join(process.cwd(), "fonts", FONT_FILE),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`NotoSansSC 字体未找到，已尝试: ${candidates.join(", ")}`);
}

/**
 * 模块级字体字节缓存：避免每次导出都 readFileSync 一个 ~10.5MB 的字体文件。
 * 进程内只读一次，后续请求直接复用内存中的字形数据。
 */
let cachedFontBytes: Buffer | null = null;
function getFontBytes(): Buffer {
  if (!cachedFontBytes) {
    cachedFontBytes = fs.readFileSync(resolveFontPath());
  }
  return cachedFontBytes;
}

// ── PDF 布局常量（A4：595 x 842pt）──
// T10 任务 E：改为从 `pdf-table.ts` 的 A4_LAYOUT 读取，杜绝「两份定义漂移」。
const { PAGE_W, PAGE_H, MARGIN, CONTENT_W } = A4_LAYOUT;

/**
 * CJK 友好的按字符换行。
 *
 * T10 任务 E：函数体已委派给 `pdf-table.ts` 的 `wrapCjk`（语义逐字相同），
 * **签名与全部调用点不变**——一份实现两处使用。
 *
 * ⚠️ 该导出仅为单测验证「委派等价」而存在（`export-pdf-v2.test.ts` 断言两者逐元素相等），
 *    业务代码请直接用 `pdf-table.ts` 的 `wrapCjk`。
 */
/** @internal 仅供单测断言委派等价，勿在业务代码中直接调用 */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  return wrapCjk(text, font, size, maxWidth);
}

interface RenderState {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  y: number;
}

/** 确保当前页剩余空间足够；不足则新建一页 */
function ensureSpace(state: RenderState, needed: number): void {
  if (state.y - needed < MARGIN) {
    state.page = state.doc.addPage([PAGE_W, PAGE_H]);
    state.y = PAGE_H - MARGIN;
  }
}

/** 绘制一个段落（自动换行） */
function drawParagraph(
  state: RenderState,
  text: string,
  opts: { size?: number; gap?: number; color?: [number, number, number]; indent?: number } = {}
): void {
  const size = opts.size ?? 10;
  const lineH = size * 1.5;
  const indent = opts.indent ?? 0;
  const color = opts.color ?? [0.2, 0.2, 0.2];
  const lines = wrapText(text, state.font, size, CONTENT_W - indent);
  for (const ln of lines) {
    ensureSpace(state, lineH);
    state.page.drawText(ln, {
      x: MARGIN + indent,
      y: state.y,
      size,
      font: state.font,
      color: { type: "RGB", red: color[0], green: color[1], blue: color[2] } as any,
    });
    state.y -= lineH;
  }
  state.y -= opts.gap ?? 4;
}

/** 绘制模块标题（带底色条） */
function drawSectionTitle(state: RenderState, title: string): void {
  const size = 13;
  const barH = size + 10;
  ensureSpace(state, barH + 6);
  state.page.drawRectangle({
    x: MARGIN,
    y: state.y - barH + 4,
    width: CONTENT_W,
    height: barH,
    color: { type: "RGB", red: 0.04, green: 0.5, blue: 0.33 } as any,
  });
  state.page.drawText(title, {
    x: MARGIN + 8,
    y: state.y - size + 2,
    size,
    font: state.font,
    color: { type: "RGB", red: 1, green: 1, blue: 1 } as any,
  });
  state.y -= barH + 8;
}

// ═══════════════════════════════════════════════════════════
// 0. 双版式选路（arch §1.4.4）
// ═══════════════════════════════════════════════════════════

/**
 * V2 触发键：任一 `!= null` 即走 8 章版式。
 *
 * 为什么用「字段存在性」而不是版本号：旧策略 JSON 里根本没有这些键（老数据不重跑），
 * 因此「有无新字段」天然等价于「新旧策略」，无需额外 DB 列或客户端传参。
 */
const V2_TRIGGER_KEYS = [
  "tldr",
  "keyInsight",
  "equipmentProfiles",
  "marketAnchors",
  "bestDestinations",
  "marketRanking",
  "accessTrafficLight",
  "todayCalls",
  "complianceTasks",
  "openQuestions",
  "dataSources",
] as const;

/**
 * 生成《AI 销售策略作战手册》PDF。
 *
 * 双版式自动选路（arch §1.4.4）：
 *   - 任一 `V2_TRIGGER_KEYS` 存在 ⇒ `buildPdfV2`（8 章 + 附录）
 *   - 全部缺失 ⇒ `buildPdfLegacy`（5 模块，逐字保留，老策略/老客户端零回归）
 *
 * @param payload 导出载荷（`strategy` 内 12 个新字段全可选）
 * @returns PDF 字节（Uint8Array）
 */
export async function buildPdf(payload: StrategyExportPayload): Promise<Uint8Array> {
  const strategy = payload?.strategy as Record<string, unknown> | undefined | null;
  const isV2 = V2_TRIGGER_KEYS.some((k) => strategy?.[k] != null);
  return isV2 ? buildPdfV2(payload) : buildPdfLegacy(payload);
}

// ═══════════════════════════════════════════════════════════
// 1. V2 文案表（zh / en；顺序与章节一一对应）
// ═══════════════════════════════════════════════════════════

interface PdfTexts {
  docTitle: string;
  productPrefix: string;
  bannerTitle: string;
  bannerNotePrefix: string;

  // 10 段固定标题（A1 验收 1:1；zh 逐字，en 语义对应，顺序一致）
  s0: string;
  s05: string;
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  s45: string;
  s5: string;
  s6: string;
  s7: string;
  sAppendix: string;

  // 第 0 章
  hEquipment: string;
  hBestChannel: string;
  hPrice: string;
  hWhy: string;
  tldrAutoNote: string;
  tldrMismatch: (a: number, b: number) => string;

  // 第 0.5 章
  contrastPrefix: string;

  // 第 1 章
  hNote: string;
  profType: string;
  profSpec: string;
  profPower: string;
  profCond: string;
  profPos: string;
  specNotFound: string;

  // 第 2 章
  ancAxis: string;
  ancMarket: string;
  ancPrice: string;
  ancBasis: string;
  axisResidual: string;
  readoutPrefix: string;

  // 第 3 章
  destMarket: string;
  destBasis: string;
  destChain: string;
  rejTitle: string;
  rejMarket: string;
  rejLevel: string;
  rejReason: string;
  noRejected: string;
  noL3Warn: string;
  notGenerated: string;

  // 第 4 章
  rkRank: string;
  rkMarket: string;
  rkStars: string;
  rkFactors: string;
  rankingNotGenerated: string;
  factorUnit: string;
  factorLiquidity: string;
  factorPayment: string;
  factorCompliance: string;

  // 第 4.5 章
  lightFriendly: string;
  lightPermit: string;
  lightForbidden: string;
  notCovered: string;

  // 第 5 章
  callRole: string;
  callOrg: string;
  callPhone: string;
  callWhy: string;
  noCallsToday: (n: number) => string;
  seeExcel: string;

  // 第 6 章
  ctItem: string;
  ctOwner: string;
  ctDeadline: string;
  ctStatus: string;
  autoConverted: string;
  compDataExport: string;
  compCrossBorder: string;
  compNotes: string;

  // 第 7 章
  oqQuestion: string;
  oqAffects: string;
  oqUrgency: string;

  // 附录
  dsName: string;
  dsRef: string;
  dsNote: string;
  fxPrefix: string;

  // P1 区（G16 补渲染）
  p1Scripts: string;
  p1Listing: string;
  p1Actions: string;
  p1Responsibility: string;
  p1Seller: string;
  p1Platform: string;
  p1Disclaimer: string;
}

const TEXTS_ZH: PdfTexts = {
  docTitle: "AI 销售策略 · 作战手册",
  productPrefix: "本品：",
  bannerTitle: "[告警] " + WEB_DEGRADED_BANNER,
  bannerNotePrefix: "检索备注：",

  s0: "0. 一页结论 TL;DR",
  s05: "0.5 与上一单的关键反转",
  s1: "1. 机型画像对比",
  s2: "2. 全球价格锚点矩阵",
  s3: "3. 每台最优去向",
  s4: "4. 四因子市场排名",
  s45: "4.5 准入红绿灯",
  s5: "5. 今天该打的电话",
  s6: "6. 合规前置清单",
  s7: "7. 待老板确认",
  sAppendix: "附录 · 数据来源",

  hEquipment: "机型",
  hBestChannel: "最优去向",
  hPrice: "预期价",
  hWhy: "一句话理由",
  tldrAutoNote: "（自动汇总：AI 未给出一页结论）",
  tldrMismatch: (a, b) => `（注：一页结论 ${a} 行 ≠ 机型画像 ${b} 行，已按一页结论渲染）`,

  contrastPrefix: "与上一单对比：",

  hNote: "备注",
  profType: "类型",
  profSpec: "规格",
  profPower: "功率",
  profCond: "车况",
  profPos: "定位",
  specNotFound: "参数未找到",

  ancAxis: "价格轴",
  ancMarket: "市场",
  ancPrice: "价格",
  ancBasis: "口径",
  axisResidual: "其他（未归轴）",
  readoutPrefix: "关键读图：",

  destMarket: "首选去向",
  destBasis: "依据",
  destChain: "计算链",
  rejTitle: "否决建议（不该去的市场）：",
  rejMarket: "市场",
  rejLevel: "档位",
  rejReason: "原因",
  noRejected: "[告警] 本轮未生成否决建议，请谨慎决策并自行核实准入政策",
  noL3Warn: "[告警] 本轮未给出禁入判定（无 L3），高危市场请人工二次核实",
  notGenerated: "（未生成）",

  rkRank: "排名",
  rkMarket: "市场",
  rkStars: "星级",
  rkFactors: "四因子（单价/流动/回款/合规）",
  rankingNotGenerated: "（未生成排名）",
  factorUnit: "单价",
  factorLiquidity: "流动",
  factorPayment: "回款",
  factorCompliance: "合规",

  lightFriendly: "[绿]友好",
  lightPermit: "[黄]需许可",
  lightForbidden: "[红]禁入",
  notCovered: "暂无（本轮未覆盖）",

  callRole: "角色",
  callOrg: "机构",
  callPhone: "电话（已脱敏）",
  callWhy: "为何今天打",
  noCallsToday: (n) =>
    `今日无可用电话；见附件 Excel 全量名单（${n} 条），优先联系近 30 天有成交的二手商。`,
  seeExcel: "见附件 Excel",

  ctItem: "事项",
  ctOwner: "负责",
  ctDeadline: "时限",
  ctStatus: "状态",
  autoConverted: "（自动转换：AI 未给出合规清单，已由合规提示转换）",
  compDataExport: "数据出境：",
  compCrossBorder: "跨境合规：",
  compNotes: "补充提示：",

  oqQuestion: "待确认问题",
  oqAffects: "影响什么",
  oqUrgency: "紧迫度",

  dsName: "来源",
  dsRef: "引用",
  dsNote: "备注",
  fxPrefix: "汇率基准（服务端常量）：",

  p1Scripts: "[P1] 销售话术",
  p1Listing: "[P1] 上架清单",
  p1Actions: "[P1] 执行分工与时限",
  p1Responsibility: "[P1] 责任划分与免责",
  p1Seller: "卖方责任：",
  p1Platform: "平台责任：",
  p1Disclaimer: "免责声明：",
};

const TEXTS_EN: PdfTexts = {
  docTitle: "AI Sales Strategy · Battle Manual",
  productPrefix: "Equipment: ",
  bannerTitle: "[WARN] " + WEB_DEGRADED_BANNER,
  bannerNotePrefix: "Search note: ",

  s0: "0. TL;DR — One Page Conclusion",
  s05: "0.5 Key Reversal vs. Last Deal",
  s1: "1. Equipment Profile Comparison",
  s2: "2. Global Price Anchor Matrix",
  s3: "3. Best Destination per Unit",
  s4: "4. Four-Factor Market Ranking",
  s45: "4.5 Access Traffic Light",
  s5: "5. Calls to Make Today",
  s6: "6. Compliance Pre-Checklist",
  s7: "7. To Confirm with the Boss",
  sAppendix: "Appendix · Data Sources",

  hEquipment: "Equipment",
  hBestChannel: "Best channel",
  hPrice: "Expected price",
  hWhy: "One-line reason",
  tldrAutoNote: "(auto-summarized: AI gave no TL;DR)",
  tldrMismatch: (a, b) =>
    `(note: TL;DR has ${a} row(s) but profile has ${b}; rendered from TL;DR)`,

  contrastPrefix: "Versus last deal: ",

  hNote: "Note",
  profType: "Type",
  profSpec: "Spec",
  profPower: "Power",
  profCond: "Condition",
  profPos: "Positioning",
  specNotFound: "Spec not found",

  ancAxis: "Price axis",
  ancMarket: "Market",
  ancPrice: "Price",
  ancBasis: "Basis",
  axisResidual: "Other (unmapped)",
  readoutPrefix: "Readout: ",

  destMarket: "Best destination",
  destBasis: "Basis",
  destChain: "Calc chain",
  rejTitle: "Rejected markets (do not go):",
  rejMarket: "Market",
  rejLevel: "Level",
  rejReason: "Reason",
  noRejected: "[WARN] No rejection advice generated this round; verify access rules yourself",
  noL3Warn: "[WARN] No outright ban (L3) issued this round; double-check high-risk markets",
  notGenerated: "(not generated)",

  rkRank: "#",
  rkMarket: "Market",
  rkStars: "Stars",
  rkFactors: "Four factors (price/liquidity/payment/compliance)",
  rankingNotGenerated: "(no ranking generated)",
  factorUnit: "Price",
  factorLiquidity: "Liquidity",
  factorPayment: "Payment",
  factorCompliance: "Compliance",

  lightFriendly: "[GREEN] Friendly",
  lightPermit: "[AMBER] Permit needed",
  lightForbidden: "[RED] Forbidden",
  notCovered: "N/A (not covered this round)",

  callRole: "Role",
  callOrg: "Organisation",
  callPhone: "Phone (masked)",
  callWhy: "Why today",
  noCallsToday: (n) =>
    `No usable phone numbers today; see the attached Excel master list (${n} rows).`,
  seeExcel: "See attached Excel",

  ctItem: "Item",
  ctOwner: "Owner",
  ctDeadline: "Deadline",
  ctStatus: "Status",
  autoConverted: "(auto-converted: AI gave no compliance list, derived from compliance notes)",
  compDataExport: "Data export: ",
  compCrossBorder: "Cross-border: ",
  compNotes: "Notes: ",

  oqQuestion: "Open question",
  oqAffects: "Affects",
  oqUrgency: "Urgency",

  dsName: "Source",
  dsRef: "Reference",
  dsNote: "Note",
  fxPrefix: "FX base (server constant): ",

  p1Scripts: "[P1] Sales scripts",
  p1Listing: "[P1] Listing checklist",
  p1Actions: "[P1] Action owners & ETA",
  p1Responsibility: "[P1] Responsibility & disclaimer",
  p1Seller: "Seller: ",
  p1Platform: "Platform: ",
  p1Disclaimer: "Disclaimer: ",
};

function textsFor(zh: boolean): PdfTexts {
  return zh ? TEXTS_ZH : TEXTS_EN;
}

// ═══════════════════════════════════════════════════════════
// 2. V2 绘制原语（emoji 闸门 / 灰度注记 / 表格透传）
// ═══════════════════════════════════════════════════════════

/** 正文深色 / 次级灰 / 告警橙 / 结论绿（PDF 只有 RGB，无主题色板） */
const COLOR_TEXT: RGBTuple = [0.18, 0.18, 0.18];
const COLOR_SUB: RGBTuple = [0.45, 0.45, 0.45];
const COLOR_GRAY: RGBTuple = [0.55, 0.55, 0.55];
const COLOR_WARN: RGBTuple = [0.68, 0.32, 0.04];
const COLOR_OK: RGBTuple = [0.05, 0.42, 0.28];
const COLOR_S_TIER: RGBTuple = [1, 0.9, 0.9];

/** `[绿]友好` 这类前缀不需要特殊渲染，仅作为可搜索标记 */

/** 全角/半角统一后的安全文本（永不产出 `undefined` / `null` / `[object Object]`） */
function safeText(value: unknown, fallback: string = NOT_FOUND): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

/** 段落（**统一过 stripEmoji**，V2 所有正文必须走这里） */
function para(
  state: RenderState,
  text: string,
  opts: { size?: number; gap?: number; color?: RGBTuple; indent?: number } = {}
): void {
  drawParagraph(state, stripEmoji(text), opts);
}

/** 灰字注记（降级说明 / 口径提示） */
function note(state: RenderState, text: string): void {
  para(state, text, { size: 8.5, color: COLOR_GRAY, gap: 4 });
}

/** 橙字告警（`[告警]` 条目） */
function warnNote(state: RenderState, text: string): void {
  para(state, text, { size: 8.5, color: COLOR_WARN, gap: 4 });
}

/** 章节标题（13pt，A1 顺序断言的锚点；统一过 stripEmoji） */
function section(state: RenderState, title: string): void {
  drawSectionTitle(state, stripEmoji(title));
}

/**
 * 表格透传：列宽必须由调用方给绝对 pt 且和 === `CONTENT_W`(515)。
 * 这里做最后一层防御——若某章算错，`drawTable` 会按比例缩放 + `console.warn`，不抛错。
 */
function table(state: RenderState, opts: Omit<DrawTableOptions, "columns"> & { columns: TableColumn[] }): void {
  drawTable(state, opts);
}

/** 空数据行断言用的灰字 */
function emptyHint(state: RenderState, text: string): void {
  note(state, text);
}

// ═══════════════════════════════════════════════════════════
// 3. 环境构造 + 归一化（唯一口径来自 derive.ts）
// ═══════════════════════════════════════════════════════════

/** 本品名（`品牌 型号（年份）`），与 legacy 口径一致 */
function productNameOf(payload: StrategyExportPayload, zh: boolean): string {
  const product = payload.product ?? null;
  const name = [product?.brandName, product?.modelName, product?.year ? `${product.year}款` : ""]
    .filter(Boolean)
    .join(" ");
  return name || (zh ? "未指定设备" : "Unspecified equipment");
}

/**
 * 构造 `derive.ts` 的降级环境。
 *
 * 已知口径缺口（**不做虚构兜底**，如实退化）：
 *   - `hasPriorStrategy`：`StrategyExportPayload` 里没有历史基线字段 ⇒ 恒 `false`
 *     （后果：`keyInsight.contrastWithPrior` 被丢弃，符合"禁止凭空造上一单"）；
 *   - `evidenceUrls`：payload 不含 URL 列表 ⇒ 恒 `[]`（后果：`dataSources` 的 `Web检索` 行
 *     退化为 `—` + 状态说明，而不是编一个链接）。
 */
function buildEnv(payload: StrategyExportPayload, zh: boolean): DecisionEnv {
  const s = (payload.strategy ?? {}) as StrategyLlmResult;
  const product = payload.product ?? null;
  const pr = s.priceRange ?? null;
  const rawStatus = payload.webStatus ?? "ok";
  // `StrategyExportWebStatus` 多一个 "error"，`WebEvidenceStatus` 没有 ⇒ 在此归到 disabled。
  // ⚠️ **仅在「派生意」上折叠**（derive 只判断「有无外部证据」，出错与未接入同义）；
  //    **展示层仍用原值 `payload.webStatus`**（见 buildPdfV2 的告警条分支，
  //    `error` 与 `disabled` 的告警文案可区分），故不丢信息。
  const webStatus = rawStatus === "error" ? "disabled" : rawStatus;
  const priceText =
    pr && (pr.suggestedMinCny != null || pr.suggestedMaxCny != null)
      ? `¥${pr.suggestedMinCny ?? "?"}–¥${pr.suggestedMaxCny ?? "?"}`
      : null;

  return {
    productName: productNameOf(payload, zh),
    brandName: product?.brandName ?? "",
    priceMinCny: typeof pr?.suggestedMinCny === "number" ? pr.suggestedMinCny : null,
    priceMaxCny: typeof pr?.suggestedMaxCny === "number" ? pr.suggestedMaxCny : null,
    webStatus,
    webNote: payload.webNote ?? "",
    hasPriorStrategy: false,
    candidateCount: Array.isArray(payload.channels) ? payload.channels.length : 0,
    evidenceUrls: [],
    summary: s.summary ?? null,
    priceRange: priceText,
    compliance: s.compliance
      ? {
          dataExport: s.compliance.dataExport ?? null,
          crossBorder: s.compliance.crossBorder ?? null,
          // 注意：`StrategyLlmResult.compliance` 用 `notes`（复数），`DecisionEnv` 用 `note`（单数）
          note: s.compliance.notes ?? null,
        }
      : null,
  };
}

// ═══════════════════════════════════════════════════════════
// 4. 各章 renderer（每章一个函数，避免 300 行巨函数）
// ═══════════════════════════════════════════════════════════

/** 章 0：一页结论 TL;DR（4 列表；`tldr.length` 应 = 机型数） */
function renderTldr(
  state: RenderState,
  n: NormalizedStrategy,
  t: PdfTexts,
  rawTldrCount: number
): void {
  section(state, t.s0);

  const columns: TableColumn[] = [
    { key: "equipment", header: t.hEquipment, width: 150 },
    { key: "bestChannel", header: t.hBestChannel, width: 130 },
    { key: "expectedPriceCny", header: t.hPrice, width: 95 },
    { key: "why", header: t.hWhy, width: 140 },
  ];
  const rows: TableRow[] = n.tldr.map((r) => ({
    equipment: safeText(r.equipment),
    bestChannel: safeText(r.bestChannel),
    expectedPriceCny: safeText(r.expectedPriceCny),
    why: safeText(r.why),
  }));

  // A2 预判：本表必须一页看完（超了不抛错，但要留痕，便于 QA/日志定位列宽问题）
  const need = measureTableHeight({ columns, rows }, state.font);
  if (state.y - need < MARGIN) {
    console.warn(
      `[export] 第 0 章 TL;DR 表高 ${Math.round(need)}pt 超过当前页剩余 ` +
        `${Math.round(state.y - MARGIN)}pt，将跨页（A2「一页看完」可能不成立）`
    );
  }

  table(state, { columns, rows, emptyText: NOT_FOUND });

  if (rawTldrCount === 0) note(state, t.tldrAutoNote);
  if (n.tldr.length !== n.equipmentProfiles.length) {
    warnNote(state, t.tldrMismatch(n.tldr.length, n.equipmentProfiles.length));
  }
  state.y -= 4;
}

/** 章 0.5：关键反转（`keyInsight === null` ⇒ 整段不渲染，连标题一起不画） */
function renderKeyInsight(state: RenderState, n: NormalizedStrategy, t: PdfTexts): void {
  const ki = n.keyInsight;
  if (!ki) return;
  section(state, t.s05);
  para(state, safeText(ki.headline), { size: 11, color: COLOR_TEXT, gap: 3 });
  para(state, safeText(ki.body), { size: 9.5, color: COLOR_SUB, gap: 4 });
  if (ki.contrastWithPrior) {
    para(state, t.contrastPrefix + ki.contrastWithPrior, { size: 9, color: COLOR_GRAY, gap: 6 });
  }
  state.y -= 2;
}

/** 章 1：机型画像对比（空 ⇒ 退化两列表 + `参数未找到`） */
function renderProfiles(state: RenderState, n: NormalizedStrategy, t: PdfTexts): void {
  section(state, t.s1);

  const profiles = n.equipmentProfiles;
  if (profiles.length === 0) {
    table(state, {
      columns: [
        { key: "equipment", header: t.hEquipment, width: 250 },
        { key: "note", header: t.hNote, width: 265 },
      ],
      rows: [{ equipment: NOT_FOUND, note: t.specNotFound }],
      emptyText: NOT_FOUND,
    });
    state.y -= 4;
    return;
  }

  const columns: TableColumn[] = [
    { key: "name", header: t.hEquipment, width: 105 },
    { key: "type", header: t.profType, width: 65 },
    { key: "spec", header: t.profSpec, width: 130 },
    { key: "power", header: t.profPower, width: 60 },
    { key: "condition", header: t.profCond, width: 70 },
    { key: "positioning", header: t.profPos, width: 85 },
  ];
  const rows: TableRow[] = profiles.map((p) => {
    const weight = p.weightKg != null ? `${p.weightKg}kg` : EMPTY_CELL;
    const country = p.brandCountry ? `${p.brandCountry} · ` : "";
    return {
      name: safeText(p.name),
      type: safeText(p.type, t.specNotFound),
      spec: `${safeText(p.spec, t.specNotFound)}（${weight}）`,
      power: safeText(p.power, t.specNotFound),
      condition: safeText(p.condition, t.specNotFound),
      positioning: country + safeText(p.positioning, t.specNotFound),
    };
  });

  table(state, { columns, rows, emptyText: NOT_FOUND, zebraBg: [0.975, 0.975, 0.975] });
  note(state, t.specNotFound + " 的单元格表示站内与外部检索均未取到该参数（未编造）。");
  state.y -= 2;
}

/** 章 2：全球价格锚点矩阵 + 关键读图（逐格 `未找到`，不删格） */
function renderAnchors(state: RenderState, n: NormalizedStrategy, t: PdfTexts): void {
  section(state, t.s2);

  const columns: TableColumn[] = [
    { key: "equipment", header: t.hEquipment, width: 115 },
    { key: "axis", header: t.ancAxis, width: 80 },
    { key: "market", header: t.ancMarket, width: 130 },
    { key: "priceText", header: t.ancPrice, width: 110, align: "right" },
    { key: "basisType", header: t.ancBasis, width: 80 },
  ];
  const rows: TableRow[] = n.marketAnchors.map((a) => ({
    equipment: safeText(a.equipment),
    axis: a.axisResidual ? t.axisResidual : safeText(a.axis),
    market: safeText(a.market),
    priceText: safeText(a.priceText),
    basisType: safeText(a.basisType),
  }));

  if (rows.length === 0) {
    table(state, {
      columns,
      rows: [{ equipment: NOT_FOUND, axis: EMPTY_CELL, market: NOT_FOUND, priceText: NOT_FOUND, basisType: EMPTY_CELL }],
      emptyText: NOT_FOUND,
    });
  } else {
    table(state, { columns, rows, emptyText: NOT_FOUND, fontSize: 8, headerFontSize: 8 });
  }

  if (n.readout) {
    para(state, t.readoutPrefix + n.readout, { size: 9.5, color: COLOR_OK, gap: 5 });
  }
  state.y -= 2;
}

/** 否决档位 → 中文措辞（PRD §3.3 三档，措辞固定） */
const REJECT_LEVEL_LABEL: Record<RejectLevel, string> = {
  L1: "不推荐",
  L2: "不建议",
  L3: "禁入",
};

/** 章 3：每台最优去向（含 rejected 三档 + 无 L3 告警） */
function renderBestDestinations(state: RenderState, n: NormalizedStrategy, t: PdfTexts): void {
  section(state, t.s3);

  if (n.bestDestinations.length === 0) {
    para(state, t.notGenerated, { size: 9, color: COLOR_GRAY });
    warnNote(state, t.noRejected);
    return;
  }

  const columns: TableColumn[] = [
    { key: "equipment", header: t.hEquipment, width: 110 },
    { key: "market", header: t.destMarket, width: 160 },
    { key: "basis", header: t.destBasis, width: 135 },
    { key: "calcChain", header: t.destChain, width: 110 },
  ];
  const rows: TableRow[] = n.bestDestinations.map((d) => ({
    equipment: safeText(d.equipment),
    market: d.market.length > 0 ? d.market.join(" → ") : NOT_FOUND,
    basis: safeText(d.basis),
    calcChain: safeText(d.calcChain, EMPTY_CELL),
  }));
  table(state, { columns, rows, emptyText: NOT_FOUND });
  state.y -= 2;

  // ── 否决建议（三档措辞）────────────────────────────────
  const rejected = n.bestDestinations.flatMap((d) =>
    d.rejected.map((r) => ({ equipment: d.equipment, ...r }))
  );
  para(state, t.rejTitle, { size: 9.5, color: COLOR_TEXT, gap: 3 });
  if (rejected.length === 0) {
    warnNote(state, t.noRejected);
    return;
  }

  const rejColumns: TableColumn[] = [
    { key: "equipment", header: t.hEquipment, width: 110 },
    { key: "market", header: t.rejMarket, width: 130 },
    { key: "level", header: t.rejLevel, width: 60, align: "center" },
    { key: "reason", header: t.rejReason, width: 215 },
  ];
  const rejRows: TableRow[] = rejected.map((r) => ({
    equipment: safeText(r.equipment),
    market: safeText(r.market),
    level: REJECT_LEVEL_LABEL[r.level] ?? REJECT_LEVEL_LABEL.L1,
    reason: safeText(r.reason),
  }));
  table(state, {
    columns: rejColumns,
    rows: rejRows,
    emptyText: NOT_FOUND,
    fontSize: 8,
    headerFontSize: 8,
    rowBg: (_i, row) => {
      // L3 禁入行浅红，其余不铺底（L1/L2 只上色会显得比 L3 更严重，故只标 L3）
      const level = typeof row.level === "string" ? row.level : "";
      return level === REJECT_LEVEL_LABEL.L3 ? COLOR_S_TIER : null;
    },
  });

  const hasL3 = rejected.some((r) => r.level === "L3");
  if (!hasL3) warnNote(state, t.noL3Warn);
  state.y -= 2;
}

/** 章 4：四因子市场排名（空 ⇒ 保留标题 + `（未生成排名）`） */
function renderRanking(state: RenderState, n: NormalizedStrategy, t: PdfTexts): void {
  section(state, t.s4);

  if (n.marketRanking.length === 0) {
    emptyHint(state, t.rankingNotGenerated);
    return;
  }

  const columns: TableColumn[] = [
    { key: "equipment", header: t.hEquipment, width: 115 },
    { key: "rank", header: t.rkRank, width: 45, align: "center", mono: true },
    { key: "market", header: t.rkMarket, width: 120 },
    { key: "stars", header: t.rkStars, width: 55, align: "center" },
    { key: "factors", header: t.rkFactors, width: 180 },
  ];
  const rows: TableRow[] = n.marketRanking.map((r) => ({
    equipment: safeText(r.equipment),
    rank: String(r.rank),
    market: safeText(r.market),
    stars: renderStars(r.stars),
    factors: r.factors
      ? `${t.factorUnit} ${safeText(r.factors.unitPrice)}｜` +
        `${t.factorLiquidity} ${safeText(r.factors.liquidity)}｜` +
        `${t.factorPayment} ${safeText(r.factors.paymentSpeed)}｜` +
        `${t.factorCompliance} ${safeText(r.factors.complianceCost)}`
      : NOT_FOUND,
  }));

  // 一票否决（stars 已被 derive.enforceStars 压到 1）用浅红提示
  table(state, {
    columns,
    rows,
    emptyText: NOT_FOUND,
    fontSize: 8,
    headerFontSize: 8,
    rowBg: (_i, row) => (typeof row.stars === "string" && row.stars.startsWith("1 ") ? COLOR_S_TIER : null),
  });
  state.y -= 2;
}

/** 章 4.5：准入红绿灯（三灯固定，空灯 `暂无（本轮未覆盖）`） */
function renderTrafficLight(state: RenderState, n: NormalizedStrategy, t: PdfTexts): void {
  section(state, t.s45);

  const light = n.accessTrafficLight;
  const join = (list: string[]): string =>
    list.length > 0 ? list.map((x) => safeText(x)).join("、") : t.notCovered;

  table(state, {
    columns: [
      { key: "friendly", header: t.lightFriendly, width: 172 },
      { key: "permit", header: t.lightPermit, width: 172 },
      { key: "forbidden", header: t.lightForbidden, width: 171 },
    ],
    rows: [
      {
        friendly: join(light.friendly),
        permit: join(light.needPermit),
        forbidden: join(light.forbidden),
      },
    ],
    emptyText: t.notCovered,
    rowBg: (_i, row) => {
      // 禁入灯非空 ⇒ 整行浅红提醒（最高优先级信息）
      const forbidden = typeof row.forbidden === "string" ? row.forbidden : "";
      return forbidden === t.notCovered ? null : COLOR_S_TIER;
    },
  });
  state.y -= 2;
}

/** 章 5：今天该打的电话（`todayCalls` × `channels` 联表；空 ⇒ 指向 Excel） */
function renderTodayCalls(
  state: RenderState,
  n: NormalizedStrategy,
  t: PdfTexts,
  channels: StrategyExportChannel[]
): void {
  section(state, t.s5);

  const byCandidate = new Map<string, StrategyExportChannel>();
  for (const c of channels) {
    if (c && typeof c.candidateId === "string") byCandidate.set(c.candidateId, c);
  }

  const rows: TableRow[] = [];
  for (const call of n.todayCalls) {
    for (const id of call.candidateIds) {
      const channel = byCandidate.get(id);
      rows.push({
        equipment: safeText(call.equipment),
        role: safeText(call.role),
        org: channel ? safeText(channel.name) : t.seeExcel,
        phone: channel ? safeText(channel.phoneMasked, EMPTY_CELL) : EMPTY_CELL,
        why: safeText(call.whyToday),
      });
      if (rows.length >= 15) break; // PRD §2 ⑨：总数 ≤15
    }
    if (rows.length >= 15) break;
  }

  if (rows.length === 0) {
    para(state, t.noCallsToday(channels.length), { size: 9.5, color: COLOR_SUB });
    state.y -= 2;
    return;
  }

  table(state, {
    columns: [
      { key: "equipment", header: t.hEquipment, width: 100 },
      { key: "role", header: t.callRole, width: 60 },
      { key: "org", header: t.callOrg, width: 130 },
      { key: "phone", header: t.callPhone, width: 105, mono: true },
      { key: "why", header: t.callWhy, width: 120 },
    ],
    rows,
    emptyText: NOT_FOUND,
    fontSize: 8,
    headerFontSize: 8,
  });
  state.y -= 2;
}

/** 章 6：合规前置清单（+ 老字段 `compliance` 附注，G16） */
function renderComplianceTasks(
  state: RenderState,
  n: NormalizedStrategy,
  t: PdfTexts,
  rawCount: number,
  compliance: StrategyLlmResult["compliance"]
): void {
  section(state, t.s6);

  const rows: TableRow[] = n.complianceTasks.map((c) => ({
    item: safeText(c.item),
    owner: safeText(c.owner),
    deadline: safeText(c.deadline),
    status: safeText(c.status),
  }));

  table(state, {
    columns: [
      { key: "item", header: t.ctItem, width: 265 },
      { key: "owner", header: t.ctOwner, width: 65, align: "center" },
      { key: "deadline", header: t.ctDeadline, width: 85, align: "center" },
      { key: "status", header: t.ctStatus, width: 100, align: "center" },
    ],
    rows,
    emptyText: NOT_FOUND,
    rowBg: (_i, row) => (row.owner === "老板" ? COLOR_S_TIER : null),
  });

  if (rawCount === 0) note(state, t.autoConverted);

  // ── G16：老字段 `compliance` 附注（此前从未上纸）──────────
  if (compliance) {
    if (compliance.dataExport) para(state, t.compDataExport + compliance.dataExport, { size: 9, color: COLOR_SUB, gap: 3 });
    if (compliance.crossBorder) para(state, t.compCrossBorder + compliance.crossBorder, { size: 9, color: COLOR_SUB, gap: 3 });
    if (compliance.notes) para(state, t.compNotes + compliance.notes, { size: 9, color: COLOR_GRAY, gap: 3 });
  }
  state.y -= 2;
}

/** 章 7：待老板确认（derive 保证 ≥1 条「实际到手成本」） */
function renderOpenQuestions(state: RenderState, n: NormalizedStrategy, t: PdfTexts): void {
  section(state, t.s7);

  const rows: TableRow[] = n.openQuestions.map((q) => ({
    question: safeText(q.question),
    affects: safeText(q.affects, EMPTY_CELL),
    urgency: safeText(q.urgency, EMPTY_CELL),
  }));

  table(state, {
    columns: [
      { key: "question", header: t.oqQuestion, width: 285 },
      { key: "affects", header: t.oqAffects, width: 100 },
      { key: "urgency", header: t.oqUrgency, width: 130, align: "center" },
    ],
    rows,
    emptyText: NOT_FOUND,
    rowBg: (_i, row) => (row.urgency === "立刻" ? COLOR_S_TIER : null),
  });
  state.y -= 2;
}

/**
 * 附录：数据来源 + 固定声明 + **P1 区（G16 补渲染）**。
 *
 * P1 区刻意不新起 13pt 章节标题：A1 验收要求「10 段标题 1:1」，
 * 多一个同级标题会让顺序断言失真。故用 11pt 的 `[P1] xxx` 小标签挂在附录之内。
 */
function renderDataSources(
  state: RenderState,
  n: NormalizedStrategy,
  t: PdfTexts,
  payload: StrategyExportPayload
): void {
  section(state, t.sAppendix);

  const rows: TableRow[] = n.dataSources.map((d) => ({
    name: safeText(d.name),
    ref: safeText(d.ref, EMPTY_CELL),
    note: safeText(d.note, EMPTY_CELL),
  }));

  table(state, {
    columns: [
      { key: "name", header: t.dsName, width: 105 },
      { key: "ref", header: t.dsRef, width: 280 },
      { key: "note", header: t.dsNote, width: 130 },
    ],
    rows,
    emptyText: EMPTY_CELL,
    fontSize: 8,
    headerFontSize: 8,
  });

  // 服务端常量固定声明（禁止 LLM 生成，PRD §2 ⑫）
  para(state, NO_FABRICATION_CLAUSE, { size: 8.5, color: COLOR_GRAY, gap: 3 });
  para(state, t.fxPrefix + FX_NOTE_ZH, { size: 8.5, color: COLOR_GRAY, gap: 6 });

  renderP1Area(state, t, payload);
}

/** 附录内 P1 区：`scripts` / `listingChecklist` / `actionChecklist` / `responsibility`（G16） */
function renderP1Area(state: RenderState, t: PdfTexts, payload: StrategyExportPayload): void {
  const s = (payload.strategy ?? {}) as StrategyLlmResult;

  if (Array.isArray(s.scripts) && s.scripts.length > 0) {
    para(state, t.p1Scripts, { size: 11, color: COLOR_TEXT, gap: 3 });
    s.scripts.forEach((sc, i) => {
      para(state, `${i + 1}. 【${safeText(sc?.scenario, EMPTY_CELL)}】${safeText(sc?.line, EMPTY_CELL)}`, {
        size: 9,
        color: COLOR_SUB,
        gap: 3,
      });
    });
  }

  if (Array.isArray(s.listingChecklist) && s.listingChecklist.length > 0) {
    para(state, t.p1Listing, { size: 11, color: COLOR_TEXT, gap: 3 });
    s.listingChecklist.forEach((item) => {
      para(state, `☐ ${safeText(item?.step, EMPTY_CELL)}. ${safeText(item?.item, EMPTY_CELL)}`, {
        size: 9,
        color: COLOR_SUB,
        gap: 3,
      });
    });
  }

  if (Array.isArray(s.actionChecklist) && s.actionChecklist.length > 0) {
    para(state, t.p1Actions, { size: 11, color: COLOR_TEXT, gap: 3 });
    s.actionChecklist.forEach((item) => {
      const owner = safeText(item?.owner, EMPTY_CELL);
      const eta = safeText(item?.eta, EMPTY_CELL);
      para(
        state,
        `${safeText(item?.step, EMPTY_CELL)}. ${safeText(item?.action, EMPTY_CELL)}（${owner} · ${eta}）`,
        { size: 9, color: COLOR_SUB, gap: 3 }
      );
    });
  }

  const resp = s.responsibility;
  if (resp) {
    para(state, t.p1Responsibility, { size: 11, color: COLOR_TEXT, gap: 3 });
    if (resp.seller) para(state, t.p1Seller + resp.seller, { size: 9, color: COLOR_SUB, gap: 3 });
    if (resp.platform) para(state, t.p1Platform + resp.platform, { size: 9, color: COLOR_SUB, gap: 3 });
    if (resp.disclaimer) para(state, t.p1Disclaimer + resp.disclaimer, { size: 8.5, color: COLOR_GRAY, gap: 3 });
  }
}

// ═══════════════════════════════════════════════════════════
// 5. buildPdfV2（8 章 + 附录，章节表驱动）
// ═══════════════════════════════════════════════════════════

/**
 * V2 版式：10 段固定章节（0 / 0.5 / 1 / 2 / 3 / 4 / 4.5 / 5 / 6 / 7 / 附录）。
 *
 * 章节顺序即 A1 验收口径，**不得重排、不得跳过**（0.5 章按数据存在性整段省略）。
 */
async function buildPdfV2(payload: StrategyExportPayload): Promise<Uint8Array> {
  const locale = payload.locale ?? "zh";
  const zh = locale !== "en";
  const t = textsFor(zh);
  const fontBytes = getFontBytes();

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });

  const state: RenderState = { doc, page: doc.addPage([PAGE_W, PAGE_H]), font, y: PAGE_H - MARGIN };

  const strategy = (payload.strategy ?? {}) as StrategyLlmResult;
  const channels = Array.isArray(payload.channels) ? payload.channels : [];
  const n = normalizeDecisionFields(strategy, buildEnv(payload, zh));

  // ── 封面两行 ────────────────────────────────────────────
  state.page.drawText(t.docTitle, {
    x: MARGIN,
    y: state.y,
    size: 18,
    font,
    color: { type: "RGB", red: 0.04, green: 0.4, blue: 0.28 } as any,
  });
  state.y -= 24;
  para(state, t.productPrefix + productNameOf(payload, zh), { size: 11, color: [0.3, 0.3, 0.3], gap: 8 });

  // ── 任务 D：顶部告警条（webStatus !== "ok"）─────────────
  const webStatus = payload.webStatus ?? "ok";
  if (webStatus !== "ok") {
    warnNote(state, t.bannerTitle);
    const preset =
      webStatus === "error" ? WEB_STATUS_NOTE.disabled : WEB_STATUS_NOTE[webStatus] ?? "";
    const extra = payload.webNote || preset;
    if (extra) note(state, t.bannerNotePrefix + extra);
    state.y -= 2;
  }

  // ── 0 / 0.5 / 1 / 2 / 3 / 4 / 4.5 / 5 / 6 / 7 / 附录 ────
  const rawTldrCount = Array.isArray(strategy.tldr) ? strategy.tldr.length : 0;
  renderTldr(state, n, t, rawTldrCount);
  renderKeyInsight(state, n, t);
  renderProfiles(state, n, t);
  renderAnchors(state, n, t);
  renderBestDestinations(state, n, t);
  renderRanking(state, n, t);
  renderTrafficLight(state, n, t);
  renderTodayCalls(state, n, t, channels);
  renderComplianceTasks(
    state,
    n,
    t,
    Array.isArray(strategy.complianceTasks) ? strategy.complianceTasks.length : 0,
    strategy.compliance
  );
  renderOpenQuestions(state, n, t);
  renderDataSources(state, n, t, payload);

  // ── 降级留痕：**不上纸**（顶层告警条 + 各章内联 [告警] 已覆盖读者需要的信息；
  //     在文末堆一屏「系统降级说明」既挤页又制造近乎空白的尾页），只进服务端日志供 QA/排障。
  // 日志前缀固定为 `[pdf-v2] degraded-banner suppressed:`，方便线上按串 grep 定位。
  if (n.warnings.length > 0) {
    console.warn(
      `[pdf-v2] degraded-banner suppressed: 尾页「系统降级说明」块不上纸，改由本日志留痕；` +
        `共 ${n.warnings.length} 处降级：\n· ${n.warnings.join("\n· ")}`
    );
  }

  const bytes = await doc.save();
  return bytes;
}

// ═══════════════════════════════════════════════════════════
// 6. buildPdfLegacy（5 模块，逐字保留 — 老策略/老客户端零回归）
// ═══════════════════════════════════════════════════════════

/**
 * Legacy 版式：5 模块（经销商清单 / 价格基准 / 全渠道打法 / 话术 / 上架清单）。
 *
 * **函数体逐字搬自 T2-T5 的 `buildPdf`，一行未改**：
 *   - 满足「既有 5 模块渲染不整段删除（向后兼容期保留）」；
 *   - 满足 `export/pdf/__tests__/route.test.ts:202-210`（body 为空 → 200）。
 * 任何对 legacy 视觉的"顺手优化"都会破坏向后兼容期的一致性，故不做。
 */
async function buildPdfLegacy(payload: StrategyExportPayload): Promise<Uint8Array> {
  const { strategy, product, channels, locale = "zh" } = payload;
  const zh = locale !== "en";
  const fontBytes = getFontBytes();

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });

  const state: RenderState = { doc, page: doc.addPage([PAGE_W, PAGE_H]), font, y: PAGE_H - MARGIN };

  const productName =
    [product?.brandName, product?.modelName, product?.year ? `${product.year}款` : ""]
      .filter(Boolean)
      .join(" ") || (zh ? "未指定设备" : "Unspecified equipment");

  // 顶部标题
  state.page.drawText(zh ? "AI 销售策略 · 作战手册" : "AI Sales Strategy · Battle Manual", {
    x: MARGIN,
    y: state.y,
    size: 18,
    font,
    color: { type: "RGB", red: 0.04, green: 0.4, blue: 0.28 } as any,
  });
  state.y -= 24;
  drawParagraph(state, zh ? `本品：${productName}` : `Equipment: ${productName}`, {
    size: 11,
    color: [0.3, 0.3, 0.3],
  });
  if (strategy.summary) {
    drawParagraph(state, (zh ? "摘要：" : "Summary: ") + strategy.summary, {
      size: 11,
      color: [0.1, 0.1, 0.1],
      gap: 8,
    });
  }

  // ① 经销商清单（来自 channels[]，仅脱敏联系方式）
  drawSectionTitle(state, zh ? "① 经销商清单（联系方式已脱敏）" : "① Dealer List (masked)");
  if (channels.length === 0) {
    drawParagraph(state, zh ? "（暂无可对接渠道）" : "(No channels available)", { size: 10 });
  } else {
    channels.forEach((c, i) => {
      const tag = c.type === "dealer" ? (zh ? "经销商" : "Dealer") : zh ? "线索" : "Lead";
      const head = `${i + 1}. ${c.name}  [${tag}]${c.region ? " · " + c.region : ""}`;
      drawParagraph(state, head, { size: 10.5, color: [0.1, 0.1, 0.1] });
      const contact = `${zh ? "电话" : "Tel"}: ${c.phoneMasked || (zh ? "无" : "—")}    ${zh ? "微信" : "WeChat"}: ${c.wechatMasked || (zh ? "无" : "—")}    ${zh ? "邮箱" : "Email"}: ${c.emailMasked || (zh ? "无" : "—")}`;
      drawParagraph(state, contact, { size: 9.5, indent: 12, color: [0.4, 0.4, 0.4] });
      if (c.rationale) {
        drawParagraph(state, (zh ? "推荐理由：" : "Why: ") + c.rationale, {
          size: 9.5,
          indent: 12,
          color: [0.45, 0.45, 0.45],
          gap: 6,
        });
      } else {
        state.y -= 4;
      }
    });
  }

  // ② 价格基准（priceRange）
  drawSectionTitle(state, zh ? "② 价格基准" : "② Price Baseline");
  if (strategy.priceRange && (strategy.priceRange.suggestedMinCny != null || strategy.priceRange.suggestedMaxCny != null)) {
    const pr = strategy.priceRange;
    drawParagraph(
      state,
      `¥${pr.suggestedMinCny ?? "?"} – ¥${pr.suggestedMaxCny ?? "?"}`,
      { size: 12, color: [0.04, 0.4, 0.28] }
    );
    if (pr.currencyNote) drawParagraph(state, (zh ? "币种口径：" : "Currency: ") + pr.currencyNote, { size: 10 });
    if (pr.basis) drawParagraph(state, (zh ? "定价依据：" : "Basis: ") + pr.basis, { size: 10, gap: 6 });
  } else {
    drawParagraph(state, zh ? "（未给出定价区间）" : "(No price range)", { size: 10 });
  }

  // ③ 全渠道打法（channels[] + targetMarkets）
  drawSectionTitle(state, zh ? "③ 全渠道打法" : "③ Omni-channel Playbook");
  if (strategy.targetMarkets && strategy.targetMarkets.length > 0) {
    drawParagraph(state, zh ? "目标市场：" : "Target markets:", { size: 10.5, color: [0.1, 0.1, 0.1] });
    strategy.targetMarkets.forEach((m) => {
      drawParagraph(
        state,
        `· ${m.market}（${m.priority}）${m.priceBand ? " · " + m.priceBand : ""}`,
        { size: 10, indent: 12 }
      );
      if (m.rationale) drawParagraph(state, (zh ? "  理由：" : "  Why: ") + m.rationale, { size: 9.5, indent: 20, color: [0.45, 0.45, 0.45] });
      if (m.channels) drawParagraph(state, (zh ? "  渠道：" : "  Channels: ") + m.channels, { size: 9.5, indent: 20, color: [0.45, 0.45, 0.45] });
    });
  } else {
    drawParagraph(state, zh ? "（未给出目标市场）" : "(No target markets)", { size: 10 });
  }
  if (channels.length > 0) {
    drawParagraph(state, zh ? "渠道对接要点：" : "Channel notes:", { size: 10.5, color: [0.1, 0.1, 0.1], gap: 2 });
    channels.forEach((c) => {
      if (c.rationale) {
        drawParagraph(state, `· ${c.name}：${c.rationale}`, { size: 9.5, indent: 12, color: [0.45, 0.45, 0.45] });
      }
    });
  }

  // ④ 话术（scripts[]）
  drawSectionTitle(state, zh ? "④ 话术" : "④ Scripts");
  if (strategy.scripts && strategy.scripts.length > 0) {
    strategy.scripts.forEach((s, i) => {
      drawParagraph(state, `${i + 1}. 【${s.scenario}】`, { size: 10.5, color: [0.1, 0.1, 0.1] });
      drawParagraph(state, s.line, { size: 10, indent: 12, color: [0.3, 0.3, 0.3], gap: 6 });
    });
  } else {
    drawParagraph(state, zh ? "（未生成话术）" : "(No scripts)", { size: 10 });
  }

  // ⑤ 上架清单（listingChecklist[]）
  drawSectionTitle(state, zh ? "⑤ 上架清单" : "⑤ Listing Checklist");
  if (strategy.listingChecklist && strategy.listingChecklist.length > 0) {
    strategy.listingChecklist.forEach((item) => {
      drawParagraph(state, `☐ ${item.step}. ${item.item}`, { size: 10, indent: 4, color: [0.2, 0.2, 0.2] });
    });
  } else {
    drawParagraph(state, zh ? "（未生成上架清单）" : "(No listing checklist)", { size: 10 });
  }

  // 页脚合规提示
  state.y -= 6;
  const disclaimer =
    strategy.responsibility?.disclaimer ||
    (zh
      ? "免责声明：本手册由 AI 生成，仅供参考；跨境/数据合规由买卖双方自担，平台不承担交易风险。"
      : "Disclaimer: AI-generated for reference only. Cross-border/data compliance is the buyer/seller's responsibility.");
  drawParagraph(state, disclaimer, { size: 8.5, color: [0.55, 0.55, 0.55], gap: 0 });

  const bytes = await doc.save();
  return bytes;
}
