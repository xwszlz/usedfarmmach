/**
 * QA 专用：PDF 真实文本抽取器（独立于渲染层，不依赖 drawText 拦截）
 * ─────────────────────────────────────────────────────────
 * 目的：T13 验收要求「解出文本」证据，而不是只看 mock 计数。本工具**只读产物字节**：
 *   1) `PDFDocument.load(bytes)` 打开真实产物；
 *   2) 从页面 Resources 取每个字体的 `ToUnicode` CMap（pdf-lib 的 CustomFontEmbedder 会写，
 *      故 subset 字体也能反查到 unicode）；
 *   3) 解码页面内容流（`decodePDFRawStream` 处理 FlateDecode）；
 *   4) 逐条解析 `Tf` / `Tj` / `TJ` 文本算子，用 ToUnicode 把 glyph code 还原成字符。
 *
 * 局限（如实说明，不做过度承诺）：
 *   - 只还原「绘制了什么文本」，不还原视觉间距/字重（表格加粗重绘会产生重复文本）；
 *   - 无 ToUnicode 的字体退化为 `<HEX>` 占位（本仓库 NotoSansSC 走 subset 嵌入，有 CMap）；
 *   - 单页多内容流、Form XObject 内的文本本实现不递归（本仓库渲染器不产出 XObject 文本）。
 */
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
  decodePDFRawStream,
} from "pdf-lib";

export interface PdfTextResult {
  /** 逐页文本（页序即 PDF 页序，索引 0 = 第 1 页） */
  pages: string[];
  /** 全文（页间以 \n\n 连接），便于做「全文任何位置都不得出现 X」这类断言 */
  all: string;
}

// ── 字节流解码 ───────────────────────────────────────────────
function resolveObj(ctx: any, obj: any): any {
  return obj instanceof PDFRef ? ctx.lookup(obj) : obj;
}

function streamToLatin1(ctx: any, obj: any): string | null {
  const resolved = resolveObj(ctx, obj);
  if (resolved instanceof PDFRawStream) {
    try {
      return Buffer.from(decodePDFRawStream(resolved).decode()).toString("latin1");
    } catch {
      return Buffer.from(resolved.contents as Uint8Array).toString("latin1");
    }
  }
  if (resolved instanceof PDFStream) {
    try {
      return Buffer.from(resolved.getContents()).toString("latin1");
    } catch {
      return null;
    }
  }
  return null;
}

// ── ToUnicode CMap 解析 ──────────────────────────────────────
function utf16beHexToString(hex: string): string {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  if (bytes.length === 0) return "";
  return Buffer.from(Uint8Array.from(bytes)).swap16().toString("utf16le");
}

function incrementLastUnit(src: string, delta: number): string {
  if (src.length === 0) return src;
  const last = src.charCodeAt(src.length - 1) + delta;
  return src.slice(0, -1) + String.fromCharCode(last);
}

/** 解析 CMap → glyph code → unicode 文本 */
export function parseToUnicodeCMap(cmap: string): Map<number, string> {
  const map = new Map<number, string>();

  // beginbfchar <src> <dst> ... endbfchar
  const charBlock = /beginbfchar([\s\S]*?)endbfchar/g;
  let block: RegExpExecArray | null;
  while ((block = charBlock.exec(cmap)) !== null) {
    const tokens = block[1].match(/<([0-9A-Fa-f]+)>/g) ?? [];
    for (let i = 0; i + 1 < tokens.length; i += 2) {
      const src = parseInt(tokens[i].slice(1, -1), 16);
      map.set(src, utf16beHexToString(tokens[i + 1].slice(1, -1)));
    }
  }

  // beginbfrange <lo> <hi> <dst> | [<d1> <d2> ...] endbfrange
  const rangeBlock = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((block = rangeBlock.exec(cmap)) !== null) {
    const entry =
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g;
    let e: RegExpExecArray | null;
    while ((e = entry.exec(block[1])) !== null) {
      const lo = parseInt(e[1], 16);
      const hi = parseInt(e[2], 16);
      if (e[3] !== undefined) {
        const base = utf16beHexToString(e[3]);
        for (let code = lo; code <= hi; code++) {
          map.set(code, incrementLastUnit(base, code - lo));
        }
      } else {
        const dsts = (e[4].match(/<([0-9A-Fa-f]+)>/g) ?? []).map((h) =>
          utf16beHexToString(h.slice(1, -1))
        );
        dsts.forEach((d, i) => {
          if (lo + i <= hi) map.set(lo + i, d);
        });
      }
    }
  }

  return map;
}

// ── 字体 → CMap 映射 ────────────────────────────────────────
type FontCmaps = Record<string, Map<number, string>>;

function collectFontCMaps(ctx: any, page: any): FontCmaps {
  const out: FontCmaps = {};
  const resources = page.node.Resources() as PDFDict | undefined;
  if (!resources) return out;
  const fonts = resources.lookupMaybe(PDFName.of("Font"), PDFDict);
  if (!fonts) return out;

  for (const [key, value] of fonts.entries()) {
    const fontName = key.asString(); // 形如 "/F1"
    const fontDict = resolveObj(ctx, value);
    if (!(fontDict instanceof PDFDict)) continue;
    const toUnicode = fontDict.lookupMaybe(PDFName.of("ToUnicode"), PDFStream);
    if (!toUnicode) continue;
    const cmapText = streamToLatin1(ctx, toUnicode);
    if (!cmapText) continue;
    out[fontName.replace(/^\//, "")] = parseToUnicodeCMap(cmapText);
  }
  return out;
}

// ── 内容流文本算子解析 ──────────────────────────────────────
const OPERATOR_RE = new RegExp(
  [
    // /F1 9 Tf  → 切换当前字体
    String.raw`\/([A-Za-z0-9._+-]+)\s+[-\d.]+\s+Tf`,
    // <hex> Tj
    String.raw`<([0-9A-Fa-f\s]*)>\s*Tj`,
    // (literal) Tj
    String.raw`\(((?:\\.|[^\\()])*)\)\s*Tj`,
    // [ ... ] TJ
    String.raw`\[((?:[^\[\]\\]|\\.)*)\]\s*TJ`,
    // 换行类算子：Td / TD / T* / Tm
    String.raw`(?:[-\d.]+\s+[-\d.]+\s+Td)|(?:[-\d.]+\s+[-\d.]+\s+TD)|(?:T\*)|(?:[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+Tm)`,
  ].join("|"),
  "g"
);

function decodeHexRun(hex: string, cmap: Map<number, string> | undefined): string {
  const clean = hex.replace(/\s+/g, "");
  if (!cmap) return `<${clean}>`;
  let out = "";
  for (let i = 0; i + 4 <= clean.length; i += 4) {
    const code = parseInt(clean.slice(i, i + 4), 16);
    out += cmap.get(code) ?? "";
  }
  return out;
}

function decodeLiteral(raw: string, cmap: Map<number, string> | undefined): string {
  // 处理 PDF 字面串转义
  const unescaped = raw.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_m, g1: string) => {
    switch (g1) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "b":
        return "\b";
      case "f":
        return "\f";
      default:
        if (/^[0-7]+$/.test(g1)) return String.fromCharCode(parseInt(g1, 8));
        return g1;
    }
  });
  if (!cmap) return unescaped;
  // Identity-H 字面串：每 2 字节一个 glyph code
  let out = "";
  for (let i = 0; i < unescaped.length; i += 2) {
    const code = (unescaped.charCodeAt(i) << 8) | (unescaped.charCodeAt(i + 1) ?? 0);
    out += cmap.get(code) ?? "";
  }
  return out;
}

function extractTextFromContent(content: string, cmaps: FontCmaps): string {
  let current: Map<number, string> | undefined;
  let out = "";
  OPERATOR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPERATOR_RE.exec(content)) !== null) {
    if (m[1] !== undefined) {
      current = cmaps[m[1]];
      continue;
    }
    if (m[2] !== undefined) {
      out += decodeHexRun(m[2], current);
      continue;
    }
    if (m[3] !== undefined) {
      out += decodeLiteral(m[3], current);
      continue;
    }
    if (m[4] !== undefined) {
      const inner = m[4];
      const pieceRe = /<([0-9A-Fa-f\s]*)>|\(((?:\\.|[^\\()])*)\)/g;
      let p: RegExpExecArray | null;
      while ((p = pieceRe.exec(inner)) !== null) {
        out += p[1] !== undefined ? decodeHexRun(p[1], current) : decodeLiteral(p[2], current);
      }
      continue;
    }
    // 换行算子 → 文本以换行分隔（便于人工阅读与「同段连续」断言）
    out += "\n";
  }
  return out;
}

function pageContentStrings(ctx: any, page: any): string[] {
  const contents = page.node.Contents();
  const streams: any[] = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) streams.push(contents.get(i));
  } else if (contents) {
    streams.push(contents);
  }
  const out: string[] = [];
  for (const s of streams) {
    const text = streamToLatin1(ctx, s);
    if (text) out.push(text);
  }
  return out;
}

/** 抽取 PDF 全文（只读字节，不拦截渲染调用） */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextResult> {
  const doc = await PDFDocument.load(bytes as any, { updateMetadata: false });
  const ctx = doc.context;
  const pages: string[] = [];

  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const cmaps = collectFontCMaps(ctx, page);
    const contentTexts = pageContentStrings(ctx, page);
    pages.push(contentTexts.map((c) => extractTextFromContent(c, cmaps)).join("\n"));
  }

  return { pages, all: pages.join("\n\n") };
}

/** PDF 页数与页面尺寸（从产物字节读，验证「第 1 页」类断言的事实基础） */
export async function inspectPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes as any, { updateMetadata: false });
  const sizes = Array.from({ length: doc.getPageCount() }, (_, i) => doc.getPage(i).getSize());
  return { pageCount: doc.getPageCount(), sizes };
}
