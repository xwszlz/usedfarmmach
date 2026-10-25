/**
 * AI 销售策略 · 导出模块（T2 PDF 作战手册 / T3 Excel 经销商联系表）
 * ─────────────────────────────────────────────────────────
 * 本文件不含任何业务逻辑改动，仅提供两个纯函数：
 *   - buildPdf(payload)      ：渲染 5 模块中文 PDF（pdf-lib + Noto Sans SC 嵌入字体）
 *   - buildExcel(dealers,set)：生成经销商联系表（exceljs，PII 按 unlock 集合门禁）
 *
 * 合规红线（#1 数据不出境 / PII 最小化）：
 *   - PDF 仅渲染「系统脱敏后的联系方式」（永远不出现明文 PII）；
 *   - Excel 仅在 dealer.id ∈ unlockedSet 时写明文电话/微信/邮箱，否则走 maskPhone/maskEmail
 *     （微信无公网标准 → 统一占位 "微信:********"）。unlockedSet 由路由依据 PiiAuditLog 构建。
 *
 * CJK 字体：src/lib/sales-strategy/fonts/NotoSansSC-Regular.ttf（Noto Sans SC 完整字形，
 *           pdf-lib subset:true 仅嵌入用到的字形，产物体积保持很小）。
 */
import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as ExcelJS from "exceljs";
import * as fs from "node:fs";
import * as path from "node:path";
import { maskPhone, maskEmail } from "@/lib/pii";
import type { StrategyLlmResult } from "./prompt";

/** 导出 PDF 路由用的「渠道」结构：脱敏联系方式 + 基础属性 */
export interface StrategyExportChannel {
  candidateId: string;
  type: "lead" | "dealer";
  name: string;
  brand?: string | null;
  model?: string | null;
  region?: string | null;
  rationale?: string;
  phoneMasked: string;
  wechatMasked: string;
  emailMasked: string;
}

/** 导出 PDF 路由用的「本品」结构 */
export interface StrategyProductInfo {
  brandName?: string | null;
  modelName?: string | null;
  year?: number | null;
  categoryName?: string | null;
  priceCny?: number | null;
  location?: string | null;
  condition?: string | null;
  workingHours?: number | null;
  isChineseBrand?: boolean;
}

/** buildPdf 入参 */
export interface StrategyExportPayload {
  strategy: StrategyLlmResult;
  product: StrategyProductInfo | null;
  channels: StrategyExportChannel[];
  locale?: "zh" | "en";
}

/** buildExcel 入参（携带明文联系方式，由路由安全获取；非解锁行将被脱敏） */
export interface ExcelDealerInput {
  id: string;
  partition: "cn" | "intl";
  grade: string | null;
  brands: string[];
  models: string[];
  regions: string[];
  nature: string | null;
  name: string | null;
  /** 明文联系方式（路由从当前站点 prisma 安全读取；buildExcel 据此门禁） */
  phone: string | null;
  wechat: string | null;
  email: string | null;
  sourceUrl: string | null;
}

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
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** CJK 友好的按字符换行（中文无空格，pdf-lib 原生仅按空格断行，故自实现） */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
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
      const w = font.widthOfTextAtSize(ch, size);
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

/**
 * 生成《AI 销售策略作战手册》PDF（5 模块）。
 * @returns PDF 字节（Uint8Array）
 */
export async function buildPdf(payload: StrategyExportPayload): Promise<Uint8Array> {
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

/**
 * 生成经销商联系表（Excel）。PII 门禁：
 *   dealer.id ∈ unlockedSet → 明文电话/微信/邮箱；否则 maskPhone/maskEmail 脱敏。
 */
export async function buildExcel(
  dealers: ExcelDealerInput[],
  unlockedSet: Set<string>,
  locale: "zh" | "en" = "zh"
): Promise<Buffer> {
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
    const emailCell = unlocked ? d.email || "" : maskEmail(d.email);
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
