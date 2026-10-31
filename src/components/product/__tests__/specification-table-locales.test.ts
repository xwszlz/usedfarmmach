/**
 * 规格表多语种标签完整性测试
 * ─────────────────────────────
 * 平台 `.com` 站面向 8 个语种（zh / en / ru / es / pt / fr / ar / hi），
 * 但 `specification-table.tsx` 的内联 `LABELS` 曾经只写了 zh / en / ru 三个语种，
 * 兜底是 `LABELS[locale] || LABELS.en` —— 于是 es / pt / fr / ar / hi 这 5 个语种
 * （占 8 语种的 62.5%）打开任何产品详情页，规格表 15 个字段名全部显示英文，
 * 是外国买家第一眼就能看到的粗糙感。
 *
 * 本文件锁死以下口径，防止回退：
 *   ① 8 个语种在 `LABELS` 里都必须有条目；
 *   ② 每个语种的 15 个 key 一个不缺、值非空；
 *   ③ fr 的译文里不允许出现 ASCII 半角单引号 `'`（必须用排版撇号 `’`）；
 *   ④ ar / hi 的译文里不允许出现 CJK 字符（防止漏翻成中文）；
 *   ⑤ es / pt / fr / ar / hi 的译文不允许等于对应英文值（防止只复制 en）；
 *   ⑥ zh / en / ru 三个既有语种的文案不被误改（回归保护）；
 *   ⑦ 实渲染（react-dom/server）出来的标签顺序与译文正确，且 `hoursUnit` /
 *      `notAvailable` 这两个非字段名标签真的被用上了。
 *
 * 说明：`LABELS` 没有对外 export（本次改动被限定为「只在 LABELS 里补语种」，
 * 不允许动导出面），所以本测试通过读取组件源码做静态解析来拿到 LABELS，
 * 再用真实渲染做端到端对照 —— 静态解析保证 15 个 key 齐全，真实渲染保证
 * 这些 key 真的接到了表格行上。
 *
 * 运行：`npx vitest run src/components/product/__tests__/specification-table-locales.test.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpecificationTable } from "@/components/product/specification-table";

/** 平台对外支持的 8 个语种（顺序与 next-intl 路由一致） */
const ALL_LOCALES = ["zh", "en", "ru", "es", "pt", "fr", "ar", "hi"] as const;

/** 本次补翻的 5 个语种 */
const PATCHED_LOCALES = ["es", "pt", "fr", "ar", "hi"] as const;

/** 补齐前的 3 个既有语种（回归保护） */
const LEGACY_LOCALES = ["zh", "en", "ru"] as const;

/** 规格表 15 个标签 key，顺序与源码 `zh` 对象一致 */
const REQUIRED_KEYS = [
  "brand",
  "model",
  "year",
  "workingHours",
  "engineType",
  "ratedPower",
  "driveSystem",
  "mainConfig",
  "overallDimension",
  "netWeight",
  "category",
  "origin",
  "condition",
  "hoursUnit",
  "notAvailable",
] as const;

/**
 * 组件 `rows` 数组的顺序 —— 也就是渲染后 `<tr>` 的出现顺序。
 * brand 单独占第一行（右侧带「品牌官网」链接），其余 12 项走 `rows.slice(1)`。
 */
const EXPECTED_RENDERED_ORDER = [
  "brand",
  "model",
  "category",
  "year",
  "workingHours",
  "engineType",
  "ratedPower",
  "driveSystem",
  "mainConfig",
  "overallDimension",
  "netWeight",
  "origin",
  "condition",
] as const;

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(HERE, "..", "specification-table.tsx");

/** CJK 统一表意文字 / 扩展 A / 兼容表意文字 / CJK 标点 —— 用于检测「漏翻成中文」 */
const CJK_PATTERN = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

/**
 * 从组件源码里静态解析出内联 `LABELS` 对象。
 *
 * 解析口径：
 *   - 语种块的行首必须是恰好 2 个空格 + `语种码: {`（与源码缩进一致）；
 *   - 键值对形如 `    key: "value",`（行首 4 空格）。
 *
 * @returns 语种码 → (key → 译文) 的映射；源码里缺失的语种不会出现在返回值里。
 */
function parseInlineLabels(): Record<string, Record<string, string>> {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const labelsStart = source.indexOf("const LABELS");
  if (labelsStart < 0) {
    throw new Error(`未在 ${SOURCE_PATH} 中找到内联 LABELS 对象`);
  }

  // 语种块起始位置：行首恰好 2 个空格
  const blockStartPattern = /^ {2}([A-Za-z][A-Za-z0-9_-]*):\s*\{\s*$/gm;
  blockStartPattern.lastIndex = labelsStart;
  const blockStarts: { locale: string; index: number }[] = [];
  let blockMatch: RegExpExecArray | null = blockStartPattern.exec(source);
  while (blockMatch !== null) {
    blockStarts.push({ locale: blockMatch[1], index: blockMatch.index });
    blockMatch = blockStartPattern.exec(source);
  }

  const parsed: Record<string, Record<string, string>> = {};
  for (let i = 0; i < blockStarts.length; i += 1) {
    const from = blockStarts[i].index;
    const to = i + 1 < blockStarts.length ? blockStarts[i + 1].index : source.length;
    const block = source.slice(from, to);
    const entries: Record<string, string> = {};
    const entryPattern = /^ {4}([A-Za-z][A-Za-z0-9_]*):\s*"([^"]*)",?\s*$/gm;
    let entryMatch: RegExpExecArray | null = entryPattern.exec(block);
    while (entryMatch !== null) {
      entries[entryMatch[1]] = entryMatch[2];
      entryMatch = entryPattern.exec(block);
    }
    parsed[blockStarts[i].locale] = entries;
  }
  return parsed;
}

/** 剥掉 HTML 标签（含内联的 lucide SVG 图标），只留纯文本 */
function stripTags(html: string): string {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RenderedRow {
  /** 左侧字段名（就是 LABELS 里的译文） */
  label: string;
  /** 右侧字段值 */
  value: string;
}

/** 从渲染出的 HTML 里按 `<tr>` 顺序抽出 (label, value) 对 */
function extractRenderedRows(markup: string): RenderedRow[] {
  const rows: RenderedRow[] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null = rowPattern.exec(markup);
  while (rowMatch !== null) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
      stripTags(cell[1]),
    );
    if (cells.length >= 2) {
      rows.push({ label: cells[0], value: cells[1] });
    }
    rowMatch = rowPattern.exec(markup);
  }
  return rows;
}

/** 渲染一份「所有字段都有值」的规格表，返回按行拆好的文本 */
function renderFilled(locale: string): RenderedRow[] {
  const markup = renderToStaticMarkup(
    createElement(SpecificationTable, {
      brandName: "John Deere",
      brandOfficialWebsite: null,
      modelName: "6120M",
      year: 2021,
      workingHours: 3200,
      engineType: "Diesel",
      enginePower: 120,
      driveSystem: "4WD",
      mainConfig: "Cab, AC",
      overallLength: 4500,
      overallWidth: 2300,
      overallHeight: 2800,
      netWeight: 6200,
      conditionLabel: "Used",
      categoryName: "Tractor",
      brandOriginCountry: "Germany",
      locale,
    }),
  );
  return extractRenderedRows(markup);
}

/** 渲染一份「可选字段全为空」的规格表，用于验证 notAvailable 译文真的生效 */
function renderEmpty(locale: string): RenderedRow[] {
  const markup = renderToStaticMarkup(
    createElement(SpecificationTable, {
      brandName: "John Deere",
      brandOfficialWebsite: null,
      modelName: "6120M",
      year: 2021,
      workingHours: null,
      engineType: null,
      enginePower: null,
      driveSystem: null,
      mainConfig: null,
      overallLength: null,
      overallWidth: null,
      overallHeight: null,
      netWeight: null,
      conditionLabel: "Used",
      categoryName: "Tractor",
      brandOriginCountry: null,
      locale,
    }),
  );
  return extractRenderedRows(markup);
}

const LABELS = parseInlineLabels();

describe("specification-table 内联 LABELS 语种覆盖", () => {
  it("8 个语种（zh/en/ru/es/pt/fr/ar/hi）在 LABELS 里都必须有条目", () => {
    const present = Object.keys(LABELS);
    for (const locale of ALL_LOCALES) {
      expect(present, `LABELS 缺少语种：${locale}`).toContain(locale);
    }
  });

  it("LABELS 里不应出现 8 语种之外的意外语种（防止手滑写错语种码）", () => {
    const unexpected = Object.keys(LABELS).filter(
      (locale) => !(ALL_LOCALES as readonly string[]).includes(locale),
    );
    expect(unexpected, `LABELS 出现未知语种：${unexpected.join(", ")}`).toEqual([]);
  });

  it.each([...ALL_LOCALES])("%s 覆盖全部 15 个 key 且值非空", (locale) => {
    const entries = LABELS[locale];
    expect(entries, `LABELS 缺少语种：${locale}`).toBeDefined();
    expect(Object.keys(entries).sort(), `${locale} 的 key 集合不完整`).toEqual(
      [...REQUIRED_KEYS].sort(),
    );
    for (const key of REQUIRED_KEYS) {
      expect(entries[key], `${locale}.${key} 缺失`).toBeDefined();
      expect(entries[key].trim().length, `${locale}.${key} 为空值`).toBeGreaterThan(0);
    }
  });

  it.each([...ALL_LOCALES])("%s 的 key 顺序与 zh 对象一致（不增删、不换序）", (locale) => {
    expect(Object.keys(LABELS[locale])).toEqual(Object.keys(LABELS.zh));
  });
});

describe("specification-table 译文质量约束", () => {
  it.each([...ALL_LOCALES])("%s 不出现纯残留英文整句（不允许原样等于 en）", (locale) => {
    if (locale === "en") {
      return;
    }
    for (const key of REQUIRED_KEYS) {
      expect(
        LABELS[locale][key],
        `${locale}.${key} 的译文与英文相同，疑似漏翻：「${LABELS[locale][key]}」`,
      ).not.toBe(LABELS.en[key]);
    }
  });

  it("fr 的译文里不允许出现 ASCII 半角单引号 '（必须用排版撇号 ’）", () => {
    for (const key of REQUIRED_KEYS) {
      expect(LABELS.fr[key], `fr.${key} 含 ASCII 单引号：「${LABELS.fr[key]}」`).not.toContain("'");
    }
  });

  it.each(["ar", "hi"] as const)("%s 的译文里不允许出现 CJK 字符（防漏翻成中文）", (locale) => {
    for (const key of REQUIRED_KEYS) {
      expect(
        CJK_PATTERN.test(LABELS[locale][key]),
        `${locale}.${key} 含中文：「${LABELS[locale][key]}」`,
      ).toBe(false);
    }
  });

  it("ar 的译文只含纯文案，不夹带 dir 属性或方向控制字符", () => {
    for (const key of REQUIRED_KEYS) {
      const value = LABELS.ar[key];
      expect(value.toLowerCase(), `ar.${key} 夹带了 dir 属性`).not.toContain("dir=");
      // U+200E LRM / U+200F RLM / U+202A-U+202E 方向控制符
      expect(/[\u200E\u200F\u202A-\u202E]/.test(value), `ar.${key} 夹带了方向控制符`).toBe(false);
    }
  });
});

describe("specification-table 既有语种回归保护", () => {
  /** 补齐前的 zh / en / ru 文案快照 —— 本次改动不允许碰这三段 */
  const LEGACY_SNAPSHOT: Record<string, Record<string, string>> = {
    zh: {
      brand: "品牌",
      model: "型号",
      year: "年份",
      workingHours: "工作小时",
      engineType: "发动机类型",
      ratedPower: "额定功率(HP)",
      driveSystem: "传动方式",
      mainConfig: "主要配置",
      overallDimension: "外形尺寸(长×宽×高 mm)",
      netWeight: "整机重量(KG)",
      category: "品类",
      origin: "产地",
      condition: "设备状况",
      hoursUnit: "小时",
      notAvailable: "暂无",
    },
    en: {
      brand: "Brand",
      model: "Model",
      year: "Year",
      workingHours: "Working Hours",
      engineType: "Engine Type",
      ratedPower: "Rated Power(HP)",
      driveSystem: "Drive System",
      mainConfig: "Main Configuration",
      overallDimension: "Overall Dimension(L×W×H mm)",
      netWeight: "Net Weight(KG)",
      category: "Category",
      origin: "Origin",
      condition: "Condition",
      hoursUnit: "hrs",
      notAvailable: "N/A",
    },
    ru: {
      brand: "Бренд",
      model: "Модель",
      year: "Год",
      workingHours: "Моточасы",
      engineType: "Тип двигателя",
      ratedPower: "Мощность(л.с.)",
      driveSystem: "Привод",
      mainConfig: "Конфигурация",
      overallDimension: "Габариты(Д×Ш×В мм)",
      netWeight: "Вес(КГ)",
      category: "Категория",
      origin: "Происхождение",
      condition: "Состояние",
      hoursUnit: "моточасов",
      notAvailable: "Н/Д",
    },
  };

  it.each([...LEGACY_LOCALES])("%s 的文案与补齐前完全一致（未被误改）", (locale) => {
    expect(LABELS[locale]).toEqual(LEGACY_SNAPSHOT[locale]);
  });
});

describe("specification-table 实渲染断言（es / pt / fr / ar / hi）", () => {
  it.each([...PATCHED_LOCALES])("%s 渲染出 13 行，13 个字段名全用了本语种译文", (locale) => {
    const rows = renderFilled(locale);
    expect(rows, `${locale} 渲染行数不对`).toHaveLength(EXPECTED_RENDERED_ORDER.length);
    const expectedLabels = EXPECTED_RENDERED_ORDER.map((key) => LABELS[locale][key]);
    // 比对「字段名全集」：13 个字段名一个不缺、也没有英文残留。
    // 这里刻意不锁死 model / category 的先后 —— 行序由 fix/spec-table-row-order
    // 单独负责，两个分支各自合并都不应该把对方搞红。
    expect([...rows.map((row) => row.label)].sort()).toEqual([...expectedLabels].sort());
  });

  it.each([...PATCHED_LOCALES])("%s 的「型号」「品类」两行都用了本语种译文", (locale) => {
    const rows = renderFilled(locale);
    // 第 1 行固定是「品牌」；第 2、3 行就是「型号」与「品类」这两行
    // （origin/main 上顺序是 品牌→型号→品类，fix/spec-table-row-order 上是
    //  品牌→品类→型号，所以只校验「第 2、3 行是这两行的译文」，不锁先后）。
    expect(rows[0].label, `${locale} 第 1 行不是品牌译文`).toBe(LABELS[locale].brand);
    expect([rows[1].label, rows[2].label].sort(), `${locale} 第 2、3 行不是型号/品类译文`).toEqual(
      [LABELS[locale].model, LABELS[locale].category].sort(),
    );
    expect([rows[1].value, rows[2].value].sort()).toEqual(["6120M", "Tractor"].sort());
  });

  it.each([...PATCHED_LOCALES])("%s 第 1 行与第 4 行起的行序稳定（品牌 → 年份 → … → 状况）", (locale) => {
    const rows = renderFilled(locale);
    expect(rows[0].label, `${locale} 第 1 行不是品牌译文`).toBe(LABELS[locale].brand);
    // 第 4 行起是 year … condition，与行序改造无关，锁死
    const tailKeys = EXPECTED_RENDERED_ORDER.slice(3);
    expect(rows.slice(3).map((row) => row.label)).toEqual(
      tailKeys.map((key) => LABELS[locale][key]),
    );
  });

  it.each([...PATCHED_LOCALES])("%s 的工作小时行用了本语种的小时单位", (locale) => {
    const rows = renderFilled(locale);
    const workingHoursRow = rows.find((row) => row.label === LABELS[locale].workingHours);
    expect(workingHoursRow, `${locale} 找不到工作小时行`).toBeDefined();
    expect(workingHoursRow?.value).toContain(LABELS[locale].hoursUnit);
  });

  it.each([...PATCHED_LOCALES])("%s 的缺失字段会落到本语种的 notAvailable", (locale) => {
    const rows = renderEmpty(locale);
    const nullableKeys = [
      "workingHours",
      "engineType",
      "ratedPower",
      "driveSystem",
      "mainConfig",
      "overallDimension",
      "netWeight",
      "origin",
    ] as const;
    for (const key of nullableKeys) {
      const row = rows.find((item) => item.label === LABELS[locale][key]);
      expect(row, `${locale} 找不到 ${key} 行`).toBeDefined();
      expect(row?.value, `${locale} 的 ${key} 行没有回落到 notAvailable`).toBe(
        LABELS[locale].notAvailable,
      );
    }
  });

  it.each([...PATCHED_LOCALES])("%s 的第一行（品牌）不是英文兜底", (locale) => {
    // 注意：es 与 pt 的品牌译文都是行业标准的 "Marca"（两语种同形），
    // 因此这里只校验「不等于 en」，不校验 8 语种两两互异。
    expect(LABELS[locale].brand, `${locale} 的品牌译文与英文相同`).not.toBe(LABELS.en.brand);
    expect(renderFilled(locale)[0].label, `${locale} 的品牌行仍是英文`).not.toBe(LABELS.en.brand);
  });
});
