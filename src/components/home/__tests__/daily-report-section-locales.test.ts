/**
 * 首页「跨境套利日报」区块 —— 8 语种文案完整性 + 兜底语种回归测试。
 *
 * 背景（P0 线上缺陷）：该区块挂在 `.com` 国际站首页，但内联 `LABELS` 只有
 * zh / en / ru 三个语种，且兜底是 `|| LABELS.zh`。于是 es / pt / fr / ar / hi
 * 的访客打开首页时，整个区块（标题、副标题、TOP3、市场情报、基准价、统计卡）
 * 全部显示中文 —— 对海外买家来说等于「这站不是给我看的」。
 *
 * 本测试锁死三件事：
 *  1. 8 个语种的 key 必须与 zh 完全一致、一个不缺且非空；
 *  2. 交付方的排版硬性要求：fr 不得出现 ASCII 半角单引号、ar/hi 不得出现 CJK、
 *     非中文语种的值不得只是英文的复制品；
 *  3. 兜底行为：未收录语种（如 de）必须渲染英语，**绝不能**渲染中文。
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// next/link 依赖 Next 运行时，在 node 环境里用最小替身替代（只保留 href + children）
vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: { href?: string; children?: React.ReactNode }) =>
    React.createElement("a", { href: props.href }, props.children),
}));

// lucide-react 图标与本测试无关，全部替换为空 span，避免无关的渲染开销
vi.mock("lucide-react", () => {
  const Icon = () => React.createElement("span");
  return {
    __esModule: true,
    TrendingUp: Icon,
    ArrowRight: Icon,
    Globe: Icon,
    Newspaper: Icon,
    BarChart3: Icon,
  };
});

import { DailyReportSection, LABELS } from "../daily-report-section";
import { getLocalizedData } from "@/config/daily-report-home";

/** 平台支持的 8 个语种（见 src/i18n 与路由 `[locale]`） */
const LOCALES = ["zh", "en", "ru", "es", "pt", "fr", "ar", "hi"] as const;

/** 本次补齐的 5 个国际站语种 */
const NEW_LOCALES = ["es", "pt", "fr", "ar", "hi"] as const;

/** 与 zh 对象逐一对齐的 19 个 key（不要增删） */
const EXPECTED_KEYS = [
  "title",
  "subtitle",
  "topOpportunities",
  "marketIntel",
  "industryNews",
  "price",
  "profit",
  "margin",
  "viewDetail",
  "viewAll",
  "dataSituationTitle",
  "dataSituationSubtitle",
  "viewDetailFull",
  "benchmarkIndex",
  "domesticPending",
  "statBenchmark",
  "statArbitrage",
  "statDomestic",
  "statSample",
] as const;

/** CJK 统一表意文字（含扩展 A）+ 中日韩标点，用于检测「中文外泄」 */
const CJK_RE = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

describe("daily-report-section LABELS —— 语种覆盖", () => {
  it("8 个语种全部存在", () => {
    for (const locale of LOCALES) {
      expect(LABELS[locale], `缺少语种 ${locale} 的文案`).toBeDefined();
    }
    expect(Object.keys(LABELS).sort()).toEqual([...LOCALES].sort());
  });

  it("每个语种都恰好含 19 个 key，且与 zh 完全对齐、值非空", () => {
    const zhKeys = Object.keys(LABELS.zh).sort();
    expect(zhKeys).toEqual([...EXPECTED_KEYS].sort());

    for (const locale of LOCALES) {
      const labels = LABELS[locale];
      expect(Object.keys(labels).sort(), `${locale} 的 key 与 zh 不一致`).toEqual(zhKeys);
      for (const key of EXPECTED_KEYS) {
        const value = labels[key];
        expect(typeof value, `${locale}.${key} 必须是字符串`).toBe("string");
        expect(value.trim().length, `${locale}.${key} 不能为空`).toBeGreaterThan(0);
      }
    }
  });
});

describe("daily-report-section LABELS —— 排版硬性要求", () => {
  it("fr 的值不含 ASCII 半角单引号 '（必须用排版撇号 ’ 或改写句子）", () => {
    for (const key of EXPECTED_KEYS) {
      expect(LABELS.fr[key], `fr.${key} 出现了 ASCII 单引号`).not.toContain("'");
    }
  });

  it("ar / hi 的值不含 CJK 字符", () => {
    for (const locale of ["ar", "hi"] as const) {
      for (const key of EXPECTED_KEYS) {
        expect(CJK_RE.test(LABELS[locale][key]), `${locale}.${key} 含 CJK：${LABELS[locale][key]}`).toBe(false);
      }
    }
  });

  it("非中文语种的值一律不含 CJK（防再次把中文串进外语槽位）", () => {
    for (const locale of ["en", "ru", "es", "pt", "fr", "ar", "hi"] as const) {
      for (const key of EXPECTED_KEYS) {
        expect(CJK_RE.test(LABELS[locale][key]), `${locale}.${key} 含 CJK：${LABELS[locale][key]}`).toBe(false);
      }
    }
  });

  it("es / pt / fr / ar / hi 每个 key 都不等于 en 值（防只复制英文充数）", () => {
    // 若将来某条译文确实与 en 同形（例如纯专有名词），在此白名单登记后再放行
    const IDENTICAL_TO_EN_ALLOWED = new Set<string>([]);

    for (const locale of NEW_LOCALES) {
      for (const key of EXPECTED_KEYS) {
        const id = `${locale}.${key}`;
        if (IDENTICAL_TO_EN_ALLOWED.has(id)) continue;
        expect(LABELS[locale][key], `${id} 与 en 完全一样，疑似未翻译`).not.toBe(LABELS.en[key]);
      }
    }
  });

  it("同一语种内 19 条文案不应出现重复（防整块复制粘贴）", () => {
    for (const locale of LOCALES) {
      const values = EXPECTED_KEYS.map((key) => LABELS[locale][key]);
      expect(new Set(values).size, `${locale} 内存在重复文案`).toBe(values.length);
    }
  });
});

describe("daily-report-section 渲染 —— 语种与兜底", () => {
  for (const locale of LOCALES) {
    it(`locale="${locale}" 渲染出该语种的标题与副标题`, () => {
      const html = renderToStaticMarkup(
        React.createElement(DailyReportSection, { locale, initialArticles: [] })
      );
      expect(html).toContain(LABELS[locale].title);
      expect(html).toContain(LABELS[locale].subtitle);
    });
  }

  it("核心回归：未收录语种 de 回落英语，不回落中文", () => {
    const html = renderToStaticMarkup(
      React.createElement(DailyReportSection, { locale: "de", initialArticles: [] })
    );

    // 必须是英文（"Today..." 只出现在 en 的 topOpportunities 里，无论撇号是否被 HTML 转义都命中）
    expect(html).toContain(LABELS.en.title);
    expect(html).toContain(LABELS.en.subtitle);
    expect(html).toContain("Today");

    // 绝不能是中文（标签层）
    expect(html).not.toContain(LABELS.zh.title);
    expect(html).not.toContain(LABELS.zh.subtitle);
    expect(html).not.toContain(LABELS.zh.marketIntel);
    expect(html).not.toContain(LABELS.zh.industryNews);
    expect(html).not.toContain(LABELS.zh.profit);
    expect(html).not.toContain(LABELS.zh.viewAll);

    // 数据层（highlights / TOP3 / 市场情报）同样不能回落中文
    const zhData = getLocalizedData("zh");
    expect(html).not.toContain(zhData.highlights[0].label);
    expect(html).not.toContain(zhData.topArbitrage[0].product);
    expect(html).not.toContain(zhData.marketIntel[0].text);
  });

  it("数据层：es / pt / fr / ar / hi / de 全部回落英语，zh 保持中文", () => {
    const en = getLocalizedData("en");
    const zh = getLocalizedData("zh");

    expect(getLocalizedData("zh").highlights[0].label).toBe(zh.highlights[0].label);
    expect(getLocalizedData("zh").topArbitrage[0].product).toBe(zh.topArbitrage[0].product);

    for (const locale of ["es", "pt", "fr", "ar", "hi", "de"]) {
      const d = getLocalizedData(locale);
      expect(d.highlights[0].label, `${locale} 的 highlight 未回落英语`).toBe(en.highlights[0].label);
      expect(d.topArbitrage[0].product, `${locale} 的 TOP3 产品名未回落英语`).toBe(
        en.topArbitrage[0].product
      );
      expect(d.marketIntel[0].text, `${locale} 的市场情报未回落英语`).toBe(en.marketIntel[0].text);
    }
  });
});
