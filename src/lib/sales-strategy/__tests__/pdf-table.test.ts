/**
 * T09 单测：`pdf-table.ts` 表格渲染基建
 * ─────────────────────────────────────────────────────────
 * 覆盖 arch §5「批次 2 · T09」验收 ①–⑦：
 *   ① 基本绘制（rowsDrawn / pageBreaks / PDF 字节合法）
 *   ② 跨页续排表头（30 行 × 6 列 → pageBreaks ≥ 1 + 第 2 页顶部出现表头）
 *   ③ 列宽之和 ≠ 515 → 缩放不抛错
 *   ④ stripEmoji
 *   ⑤ renderStars
 *   ⑥ 空单元格 → "—"
 *   ⑦ PdfTableState 与 export.ts 的 RenderState 结构兼容（不改 export.ts）
 * 另加：measureTableHeight 与 drawTable 高度口径一致性、wrapCjk 语义。
 *
 * **跨页表头的验证手法（关键，别弱化成「看起来对」）**
 *   PDF 内容流被 Flate 压缩 + 字体 subset 后，字节流里**读不到**表头文字，
 *   `doc.save()` 的字节断言不可靠。故用 **`PDFPage.prototype.drawText` 原型级 mock 拦截**：
 *   记录每次 drawText 的 (text, options, this=所在 PDFPage)。
 *   - `headerCalls.length >= 2`  ⇒ 表头被画了 ≥2 次（初始 1 次 + 续排 ≥1 次）；
 *   - `new Set(headerCalls.map(c => c.page)).size >= 2` ⇒ 确实跨了**实体页**，
 *     而不是在同一页重复画（这是"续排"与"重复绘制"的区分点）；
 *   - 第 2 页表头的 `options.y` 接近 `PAGE_H - MARGIN` ⇒ 确实在**新页顶部**。
 *   同时断言 `allCalls.length > 0`，防止「原型拦截失效 → 断言恒真」的假绿。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  A4_LAYOUT,
  drawTable,
  measureTableHeight,
  renderStars,
  stripEmoji,
  wrapCjk,
  type DrawTableOptions,
  type PdfTableState,
  type TableColumn,
  type TableRow,
} from "../pdf-table";

// ═══════════════════════════════════════════════════════════
// 测试夹具：与 export.ts 相同方式加载 NotoSansSC
// ═══════════════════════════════════════════════════════════

const FONT_FILE = "NotoSansSC-Regular.ttf";

/** 与 `export.ts` 的 `resolveFontPath()` 同口径的两条候选路径 */
function resolveFontPath(): string {
  const candidates = [
    path.join(process.cwd(), "src/lib/sales-strategy/fonts", FONT_FILE),
    path.join(process.cwd(), "fonts", FONT_FILE),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`NotoSansSC 字体未找到，已尝试: ${candidates.join(", ")}`);
}

/** 字体字节只读一次（~10MB，避免每个用例重复 IO） */
let fontBytes: Buffer | null = null;
function getFontBytes(): Buffer {
  if (!fontBytes) fontBytes = fs.readFileSync(resolveFontPath());
  return fontBytes;
}

interface TestState {
  state: PdfTableState;
  doc: PDFDocument;
  firstPage: PDFPage;
}

/** 造一个与 `buildPdf` 里 `RenderState` 同构的状态对象（不是伪造：真 doc + 真嵌入字体 + 真页） */
async function createState(startY?: number): Promise<TestState> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(getFontBytes(), { subset: true });
  const firstPage = doc.addPage([A4_LAYOUT.PAGE_W, A4_LAYOUT.PAGE_H]);
  return {
    doc,
    firstPage,
    state: {
      doc,
      page: firstPage,
      font,
      y: startY ?? A4_LAYOUT.PAGE_H - A4_LAYOUT.MARGIN,
    },
  };
}

// ═══════════════════════════════════════════════════════════
// drawText 原型级拦截（跨页表头断言的唯一可靠手段）
// ═══════════════════════════════════════════════════════════

interface DrawCall {
  text: string;
  page: PDFPage;
  options: Record<string, unknown>;
}

function spyOnDrawText(): DrawCall[] {
  const calls: DrawCall[] = [];
  const original = PDFPage.prototype.drawText;
  vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
    this: PDFPage,
    text: string,
    options?: Parameters<PDFPage["drawText"]>[1]
  ): void {
    calls.push({ text, page: this, options: (options ?? {}) as Record<string, unknown> });
    original.call(this, text, options);
  });
  return calls;
}

/**
 * 表头「实际绘制次数」= 去重后的 (页, y) 组合数。
 *
 * 为什么要去重：表头是 `bold: true`，而单字体环境的粗体是「同文本右偏移 0.22pt 重绘一次」，
 * 所以一次表头绘制会产生 **2 次** drawText 调用（x 不同、y 相同）。
 * 直接数调用次数会把「1 次绘制」算成 2 次，从而把断言变成恒真 —— 必须按 (页, y) 去重。
 */
function countDistinctHeaderDraws(headerCalls: DrawCall[]): {
  total: number;
  pages: number;
  yByPage: Map<PDFPage, number[]>;
} {
  const yByPage = new Map<PDFPage, number[]>();
  let total = 0;
  for (const call of headerCalls) {
    const y = Math.round(Number(call.options.y) * 100) / 100;
    const list = yByPage.get(call.page) ?? [];
    if (!list.includes(y)) {
      list.push(y);
      total += 1;
    }
    yByPage.set(call.page, list);
  }
  return { total, pages: yByPage.size, yByPage };
}

const TOLERANCE = 0.05;

describe("pdf-table · drawTable 基本绘制（验收 ①）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("3 列 3 行：rowsDrawn=3、pageBreaks=0、单页、PDF 字节合法且 > 2KB", async () => {
    const { state, doc } = await createState();
    const opts: DrawTableOptions = {
      columns: [
        { key: "equipment", header: "机型", width: 195 },
        { key: "channel", header: "最优渠道", width: 220 },
        { key: "price", header: "预期成交价", width: 100, align: "right" },
      ],
      rows: [
        { equipment: "圆捆打捆机 9YG-1.2", channel: "荷兰二手商（Drenthe）", price: "¥128,000" },
        { equipment: "青贮收获机 4QZ-2200", channel: "乌兹别克斯坦进口商", price: "¥236,000" },
        { equipment: "拖拉机 1004", channel: "河北本地二手商", price: "¥86,000" },
      ],
    };

    const result = drawTable(state, opts);

    expect(result.rowsDrawn).toBe(3);
    expect(result.pageBreaks).toBe(0);
    expect(doc.getPageCount()).toBe(1);
    // 画完表格后 state.y 应该确实被推进了（就地推进语义，不用返回新 state）
    expect(state.y).toBeLessThan(A4_LAYOUT.PAGE_H - A4_LAYOUT.MARGIN);

    const bytes = await doc.save();
    expect(Buffer.from(bytes).toString("latin1").startsWith("%PDF-")).toBe(true);
    expect(bytes.length).toBeGreaterThan(2 * 1024);
  }, 60_000);

  it("空 rows / 空 columns 时安全返回，不画任何东西", async () => {
    const { state, doc } = await createState();
    const before = state.y;

    const emptyRows = drawTable(state, {
      columns: [{ key: "a", header: "A", width: A4_LAYOUT.CONTENT_W }],
      rows: [],
    });
    expect(emptyRows).toEqual({ rowsDrawn: 0, pageBreaks: 0 });

    const emptyColumns = drawTable(state, { columns: [], rows: [{ a: "x" }] });
    expect(emptyColumns).toEqual({ rowsDrawn: 0, pageBreaks: 0 });

    expect(state.y).toBe(before);
    expect(doc.getPageCount()).toBe(1);
  }, 60_000);
});

describe("pdf-table · 跨页续排表头（验收 ②，★核心）", () => {
  afterEach(() => vi.restoreAllMocks());

  const HEADER_MARK = "HDR_UNIQUE_中文";

  /** 6 列，列宽 90 + 85×5 = 515，刚好等于 CONTENT_W */
  const columns: TableColumn[] = [
    { key: "c1", header: HEADER_MARK, width: 90 },
    { key: "c2", header: "机型", width: 85 },
    { key: "c3", header: "国别", width: 85 },
    { key: "c4", header: "价格", width: 85, align: "right" },
    { key: "c5", header: "渠道", width: 85 },
    { key: "c6", header: "电话", width: 85, mono: true },
  ];

  function buildRows(count: number): TableRow[] {
    return Array.from({ length: count }, (_, i) => ({
      c1: `序号 ${i + 1}`,
      c2: `2021款 圆捆机 9YG-1.2 #${i + 1}`,
      c3: i % 2 === 0 ? "荷兰" : "乌兹别克斯坦",
      c4: `¥${120_000 + i * 1000}`,
      c5: "授权经销",
      c6: `+31 6 ${String(10000000 + i).slice(0, 8)}`,
    }));
  }

  it("30 行 × 6 列：pageBreaks ≥ 1，且第 2 页顶部重画表头", async () => {
    // 从页面中部开始画（模拟表格上方已有前置段落），保证必然翻页
    const { state, doc, firstPage } = await createState(300);
    const calls = spyOnDrawText();

    const result = drawTable(state, { columns, rows: buildRows(30) });

    // 防「原型拦截失效导致断言恒真」的假绿：先确认拦截器真的抓到了绘制调用
    expect(calls.length).toBeGreaterThan(0);

    expect(result.rowsDrawn).toBe(30);
    expect(result.pageBreaks).toBeGreaterThanOrEqual(1);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    // state.page 必须被写回（否则后续段落画到旧页上，静默丢内容）
    expect(state.page).not.toBe(firstPage);

    const headerCalls = calls.filter((c) => c.text.includes(HEADER_MARK));
    // 按 (页, y) 去重后的真实表头绘制次数：初始 1 次 + 每次翻页续排 1 次
    const headerDraws = countDistinctHeaderDraws(headerCalls);
    expect(headerDraws.total).toBeGreaterThanOrEqual(2);
    // 关键：表头出现在 ≥2 个不同的实体页上（区分「续排」与「同页重复绘制」）
    expect(headerDraws.pages).toBeGreaterThanOrEqual(2);

    // 第 2 页的表头必须落在新页顶部（y 接近 PAGE_H - MARGIN）
    const secondPageEntry = Array.from(headerDraws.yByPage.entries()).find(
      ([page]) => page !== firstPage
    );
    expect(secondPageEntry).toBeDefined();
    const secondPageHeaderY = Math.max(...(secondPageEntry?.[1] ?? [Number.NaN]));
    expect(Number.isFinite(secondPageHeaderY)).toBe(true);
    expect(secondPageHeaderY).toBeGreaterThan(A4_LAYOUT.PAGE_H - A4_LAYOUT.MARGIN - 40);

    // 数据行文本不得被重复绘制（表头重画不能顺手把首行也重画）
    const rowOneCalls = calls.filter((c) => c.text === "序号 1");
    expect(rowOneCalls.length).toBe(1);
  }, 90_000);

  it("repeatHeaderOnPageBreak=false 时翻页不重画表头（但 pageBreaks 仍计数）", async () => {
    const { state, doc, firstPage } = await createState(300);
    const calls = spyOnDrawText();

    const result = drawTable(state, {
      columns,
      rows: buildRows(30),
      repeatHeaderOnPageBreak: false,
    });

    expect(result.pageBreaks).toBeGreaterThanOrEqual(1);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    const headerDraws = countDistinctHeaderDraws(calls.filter((c) => c.text.includes(HEADER_MARK)));
    // 只画了 1 次，且只在第 1 页
    expect(headerDraws.total).toBe(1);
    expect(headerDraws.pages).toBe(1);
    expect(Array.from(headerDraws.yByPage.keys())).toEqual([firstPage]);
  }, 90_000);
});

describe("pdf-table · 列宽校验（验收 ③）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("列宽之和 400 ≠ 515：按比例缩放、console.warn、不抛错", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { state } = await createState();

    const opts: DrawTableOptions = {
      columns: [
        { key: "a", header: "机型", width: 100 },
        { key: "b", header: "渠道", width: 150 },
        { key: "c", header: "价格", width: 150, align: "right" },
      ],
      rows: [
        { a: "圆捆机", b: "荷兰二手商", c: "¥128,000" },
        { a: "青贮机", b: "乌兹别克斯坦", c: "¥236,000" },
        { a: "拖拉机", b: "河北", c: "¥86,000" },
      ],
    };

    // 用预置对象承接返回值（避免 TS 在闭包赋值后把变量收窄成 null）
    const summary = { rowsDrawn: -1, pageBreaks: -1 };
    expect(() => {
      const r = drawTable(state, opts);
      summary.rowsDrawn = r.rowsDrawn;
      summary.pageBreaks = r.pageBreaks;
    }).not.toThrow();

    expect(summary.rowsDrawn).toBe(3);
    expect(summary.pageBreaks).toBe(0);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("列宽之和"))).toBe(true);
  }, 60_000);

  it("列宽全部非法（0 / 负数 / NaN）：等分兜底，不抛错", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { state } = await createState();

    const result = drawTable(state, {
      columns: [
        { key: "a", header: "A", width: 0 },
        { key: "b", header: "B", width: -20 },
        { key: "c", header: "C", width: Number.NaN },
      ],
      rows: [{ a: "1", b: "2", c: "3" }],
    });

    expect(result.rowsDrawn).toBe(1);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("列宽全部非法"))).toBe(true);
  }, 60_000);
});

describe("pdf-table · stripEmoji（验收 ④）", () => {
  it("剥离 ⚠️🔴🟢🟡✅❌，保留中文", () => {
    const out = stripEmoji("⚠️注意🔴禁入🟢友好");
    expect(out).toBe("注意禁入友好");
    // 逐字符兜底断言：不得残留任何 emoji 码点
    for (const ch of Array.from(out)) {
      const cp = ch.codePointAt(0) ?? 0;
      expect(cp >= 0x1f000 && cp <= 0x1faff).toBe(false);
      expect(cp).not.toBe(0x26a0);
      expect(cp).not.toBe(0x2705);
      expect(cp).not.toBe(0x274c);
      expect(cp).not.toBe(0xfe0f);
    }
    expect(stripEmoji("🟡需许可 ✅合规 ❌禁止")).toBe("需许可 合规 禁止");
  });

  it("保留 Noto Sans SC 可绘的常见符号 ★ ☆ ☐", () => {
    // arch §1.4.2：★/☆ 属可保留符号集；★ 是 U+2605，会被 Extended_Pictographic 误伤，必须白名单救回
    expect(stripEmoji("★★★☆☆ ☐ 待办")).toBe("★★★☆☆ ☐ 待办");
  });

  it("边界输入不抛错", () => {
    expect(stripEmoji("")).toBe("");
    expect(stripEmoji(undefined as unknown as string)).toBe("");
    expect(stripEmoji(null as unknown as string)).toBe("");
    expect(stripEmoji("纯中文·—…→≤℃")).toBe("纯中文·—…→≤℃");
  });
});

describe("pdf-table · renderStars（验收 ⑤）", () => {
  it("输出中文「N 星」并 clamp 到 [1,5]", () => {
    expect(renderStars(5)).toBe("5 星");
    expect(renderStars(4)).toBe("4 星");
    expect(renderStars(1)).toBe("1 星");
    expect(renderStars(0)).toBe("1 星"); // 下界 clamp
    expect(renderStars(9)).toBe("5 星"); // 上界 clamp
    expect(renderStars(-3)).toBe("1 星");
  });

  it("NaN / Infinity / 非数字不抛错", () => {
    expect(() => renderStars(Number.NaN)).not.toThrow();
    expect(renderStars(Number.NaN)).toMatch(/^[1-5] 星$/);
    expect(renderStars(Number.POSITIVE_INFINITY)).toBe("5 星");
    expect(renderStars(Number.NEGATIVE_INFINITY)).toBe("1 星");
    expect(renderStars(undefined as unknown as number)).toBe("1 星");
  });

  it("小数四舍五入且结果恒在 1–5", () => {
    for (const n of [0.4, 1.5, 2.49, 3.51, 4.5]) {
      const text = renderStars(n);
      const value = Number(text.replace(" 星", ""));
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it("不使用 ★（PDF 字体约定）", () => {
    expect(renderStars(5)).not.toContain("★");
  });
});

describe("pdf-table · 空单元格（验收 ⑥）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("text 为空的单元格画成「—」", async () => {
    const { state } = await createState();
    const calls = spyOnDrawText();

    drawTable(state, {
      columns: [
        { key: "a", header: "机型", width: 200 },
        { key: "b", header: "渠道", width: A4_LAYOUT.CONTENT_W - 200 },
      ],
      rows: [{ a: "圆捆机", b: "" }],
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((c) => c.text === "—")).toBe(true);
  }, 60_000);

  it("缺失 key（undefined）同样兜底为「—」；自定义 emptyText 生效", async () => {
    const { state } = await createState();
    const calls = spyOnDrawText();

    drawTable(state, {
      columns: [
        { key: "a", header: "机型", width: 200 },
        { key: "missing", header: "缺失", width: A4_LAYOUT.CONTENT_W - 200 },
      ],
      rows: [{ a: "圆捆机" }],
      emptyText: "无",
    });

    expect(calls.some((c) => c.text === "无")).toBe(true);
    expect(calls.some((c) => c.text === "—")).toBe(false);
  }, 60_000);
});

describe("pdf-table · 与 export.ts 的状态兼容性（验收 ⑦）", () => {
  /**
   * `export.ts:102-107` 的私有 `RenderState`（未导出）逐字镜像：
   *   interface RenderState { doc: PDFDocument; page: PDFPage; font: PDFFont; y: number }
   * 若哪天 `PdfTableState` 改了字段名/类型，下面两条赋值会立即编译失败 ⇒ 守住「不改 export.ts」的承诺。
   */
  it("PdfTableState 与 RenderState 可双向赋值（类型级断言）", () => {
    type RenderStateMirror = {
      doc: PDFDocument;
      page: PDFPage;
      font: import("pdf-lib").PDFFont;
      y: number;
    };

    // T10 把 buildPdf 的 state 直接传给 drawTable ⇒ 必须可赋值
    const fromRenderState: PdfTableState = {} as RenderStateMirror;
    // 反向：drawTable 就地推进后的 state 要能被 export.ts 的绘制函数继续消费
    const backToRenderState: RenderStateMirror = {} as PdfTableState;

    const fieldNames = ["doc", "page", "font", "y"];
    expect(Object.keys(fromRenderState)).toEqual([]); // 运行时是空对象强转，仅编译期有意义
    expect(Object.keys(backToRenderState)).toEqual([]);
    // 用字面量再确认一次字段名与类型（漏一个字段这里就编译不过）
    const literal: PdfTableState = {
      doc: undefined as unknown as PDFDocument,
      page: undefined as unknown as PDFPage,
      font: undefined as unknown as import("pdf-lib").PDFFont,
      y: 0,
    };
    expect(Object.keys(literal).sort()).toEqual(fieldNames.sort());
  });

  it("drawTable 只就地修改 y，不要求调用方替换 state 对象（与 drawParagraph 同风格）", async () => {
    const { state } = await createState();
    const sameState = state;
    const yBefore = state.y;

    drawTable(state, {
      columns: [{ key: "a", header: "A", width: A4_LAYOUT.CONTENT_W }],
      rows: [{ a: "row-1" }, { a: "row-2" }],
    });

    expect(state).toBe(sameState); // 引用不变
    expect(state.y).toBeLessThan(yBefore);
  }, 60_000);
});

describe("pdf-table · measureTableHeight / wrapCjk（T10 预判依赖）", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  const columns: TableColumn[] = [
    { key: "a", header: "机型", width: 200 },
    { key: "b", header: "渠道", width: 215 },
    { key: "c", header: "价格", width: 100, align: "right" },
  ];
  const rows: TableRow[] = [
    { a: "圆捆机", b: "荷兰二手商", c: "¥128,000" },
    { a: "青贮机", b: "乌兹别克斯坦进口商", c: "¥236,000" },
    { a: "拖拉机", b: "河北", c: "¥86,000" },
  ];

  it("高度随行数单调递增，且空表为 0", async () => {
    const { state } = await createState();
    const font = state.font;

    expect(measureTableHeight({ columns, rows: [] }, font)).toBe(0);
    expect(measureTableHeight({ columns: [], rows }, font)).toBe(0);

    const h3 = measureTableHeight({ columns, rows }, font);
    const h6 = measureTableHeight({ columns, rows: [...rows, ...rows] }, font);
    expect(h3).toBeGreaterThan(0);
    expect(h6).toBeGreaterThan(h3);
  }, 60_000);

  it("与 drawTable 实际消耗的高度完全一致（同一套行高口径）", async () => {
    const { state } = await createState();
    const opts: DrawTableOptions = { columns, rows };
    const expected = measureTableHeight(opts, state.font);
    const yBefore = state.y;

    const result = drawTable(state, opts);

    expect(result.pageBreaks).toBe(0);
    // 无翻页时：消耗高度 = measureTableHeight（含表头 + 全部行 + 尾部 8pt）
    expect(yBefore - state.y).toBeCloseTo(expected, 4);
  }, 60_000);

  it("多行单元格行高 = maxLines × fontSize × lineHeight + 2×paddingY", async () => {
    const { state } = await createState();
    const font = state.font;
    const fontSize = 8.5;
    const lineHeight = 1.35;
    const paddingX = 4;
    const paddingY = 3;
    const lineH = fontSize * lineHeight;

    const oneRow = [{ a: "短", b: "短", c: "短" }];
    const twoRows = [...oneRow, ...oneRow];

    const h1 = measureTableHeight({ columns, rows: oneRow }, font);
    const h2 = measureTableHeight({ columns, rows: twoRows }, font);
    // 相邻两行高度差 = 单行数据行行高（1 行文本）
    expect(h2 - h1).toBeCloseTo(lineH + paddingY * 2, 4);

    // 长文本必然折成多行，逐行验证公式：总高 = 表头 + maxLines×lineH + 2×paddingY + 8
    const longText = "这是一段很长的机型描述".repeat(8);
    const innerWidth = columns[0].width - paddingX * 2;
    const expectedLines = wrapCjk(longText, font, fontSize, innerWidth).length;
    expect(expectedLines).toBeGreaterThan(1);

    const multi = measureTableHeight(
      { columns, rows: [{ a: longText, b: "渠道", c: "价格" }] },
      font
    );
    // h1 = 表头 + 1 行单行数据行 + 8 ⇒ 把单行替换成 expectedLines 行
    const expected = h1 - (lineH + paddingY * 2) + expectedLines * lineH + paddingY * 2;
    expect(multi).toBeCloseTo(expected, 4);
  }, 60_000);

  it("wrapCjk 复刻 export.ts wrapText 语义：CJK 按字符换行、超宽单字独占一行", async () => {
    const { state } = await createState();
    const font = state.font;

    expect(wrapCjk("", font, 8.5, 100)).toEqual([]);

    const lines = wrapCjk("中文换行测试".repeat(6), font, 8.5, 40);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 8.5)).toBeLessThanOrEqual(40 + TOLERANCE);
    }
    // 硬换行保留空行占位（与 wrapText 一致）
    expect(wrapCjk("第一行\n\n第三行", font, 8.5, 200)).toEqual(["第一行", "", "第三行"]);
    // 单字宽于 maxWidth 时该字独占一行，且不死循环
    const narrow = wrapCjk("中中中", font, 30, 1);
    expect(narrow).toEqual(["中", "中", "中"]);
  }, 60_000);
});

describe("pdf-table · 富单元格与着色（rowBg / mono / bold）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("TableCell 的 bold / color 生效，rowBg 返回 null 时不铺底也不报错", async () => {
    const { state } = await createState();

    const result = drawTable(state, {
      columns: [
        { key: "a", header: "优先级", width: 100 },
        { key: "b", header: "渠道", width: 200 },
        { key: "c", header: "电话", width: 215, mono: true },
      ],
      rows: [
        {
          a: { text: "S（今天必打）", bold: true, color: [0.7, 0.1, 0.1] },
          b: "荷兰二手商",
          c: "+31 6 12345678",
        },
        { a: "A", b: "乌兹别克斯坦进口商", c: "+998 90 1234567" },
      ],
      zebraBg: [0.97, 0.97, 0.97],
      rowBg: (index) => (index === 0 ? [1, 0.9, 0.9] : null),
    });

    expect(result.rowsDrawn).toBe(2);
  }, 60_000);

  it("rowBg 回调抛异常时被吞掉并继续绘制", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { state } = await createState();

    const result = drawTable(state, {
      columns: [{ key: "a", header: "A", width: A4_LAYOUT.CONTENT_W }],
      rows: [{ a: "x" }, { a: "y" }],
      rowBg: () => {
        throw new Error("boom");
      },
    });

    expect(result.rowsDrawn).toBe(2);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("rowBg 回调异常"))).toBe(true);
  }, 60_000);
});
