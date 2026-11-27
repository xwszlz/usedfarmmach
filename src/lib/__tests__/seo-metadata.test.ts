/**
 * SEO 元数据（src/lib/seo-metadata.ts）回归测试。
 *
 * 钉三件事，全部源自 2026-11-25 websiteanalyzer.dev 审计报告的实测项：
 *
 * 1. **8 语首页 title ≤ 60 / description ≤ 160 字符** —— 报告判定的 Low 级问题
 *    （英文 title 69 字符、description 168 字符经 HTML 转义后 176）。超长会在
 *    SERP 被截断，关键词直接看不到。用测试锁住，避免以后改文案又飘回去。
 * 2. **overrides 不能吞掉 openGraph 的基础字段** —— 报告判定的「og:type / og:url
 *    缺失」真正根因不是 layout 漏写，而是 generatePageMetadata 末尾把
 *    `...overrides` 摊平，只要调用方传 openGraph（哪怕只为补一张分享图）就会把
 *    url / type / siteName 整个对象覆盖掉。首页与 /engineer 页正是这种用法。
 * 3. **overrides 里显式给的字段仍然要生效** —— 修深合并不能把调用方的意图吃掉。
 */
import { describe, it, expect } from "vitest";
import type { Metadata } from "next";
import {
  ALL_LOCALES,
  buildHreflang,
  generatePageMetadata,
  localizedMeta,
} from "@/lib/seo-metadata";

const TITLE_MAX = 60;
const DESC_MAX = 160;

/**
 * Metadata["openGraph"] 在 Next 的类型里是联合类型（OpenGraph | OpenGraphMetadata），
 * 后者没有 type / siteName 等字段，直接点访问会报 TS2339。
 * 这里统一收窄成一个「我们要断言的那几个字段」的视图，避免每处都写 as。
 */
type OgView = {
  title?: string;
  description?: string;
  url?: string | URL;
  siteName?: string;
  locale?: string;
  type?: string;
  images?: unknown;
};

function ogOf(md: Metadata): OgView {
  return (md.openGraph ?? {}) as OgView;
}

describe("首页 8 语 title / description 长度", () => {
  it("每种语言的 title 都不超过 60 字符", () => {
    const home = localizedMeta.home;
    const over: string[] = [];
    for (const lang of ALL_LOCALES) {
      const entry = home[lang];
      expect(entry, `缺少 ${lang} 的首页元数据`).toBeDefined();
      const len = [...entry.title].length;
      if (len > TITLE_MAX) over.push(`${lang}=${len}`);
    }
    expect(over, `title 超出 ${TITLE_MAX} 字符：${over.join(", ")}`).toEqual([]);
  });

  it("每种语言的 description 都不超过 160 字符", () => {
    const home = localizedMeta.home;
    const over: string[] = [];
    for (const lang of ALL_LOCALES) {
      const entry = home[lang];
      expect(entry, `缺少 ${lang} 的首页元数据`).toBeDefined();
      const len = [...entry.description].length;
      if (len > DESC_MAX) over.push(`${lang}=${len}`);
    }
    expect(over, `description 超出 ${DESC_MAX} 字符：${over.join(", ")}`).toEqual([]);
  });

  it("首页 8 语齐备，一个不缺", () => {
    expect(Object.keys(localizedMeta.home).sort()).toEqual([...ALL_LOCALES].sort());
  });
});

describe("generatePageMetadata 的 overrides 深合并", () => {
  // 复刻首页 page.tsx 的真实调用形态：只为补分享图而传 openGraph。
  const withImage = () =>
    generatePageMetadata("home", "en", "", {
      openGraph: {
        images: [{ url: "https://usedfarmmach.com/images/og.png", width: 1200, height: 630 }],
      },
    });

  it("传了 openGraph.images 之后，og:url 仍然存在且是当前页绝对地址", () => {
    const og = ogOf(withImage());
    expect(og.url).toBeTruthy();
    expect(String(og.url).endsWith("/en")).toBe(true);
  });

  it("传了 openGraph.images 之后，og:type 仍然是 website", () => {
    expect(ogOf(withImage()).type).toBe("website");
  });

  it("传了 openGraph.images 之后，og:siteName 仍然存在", () => {
    expect(ogOf(withImage()).siteName).toBe("AgriTrade");
  });

  it("调用方显式给的 images 确实生效（深合并不能吃掉 override）", () => {
    const images = ogOf(withImage()).images;
    expect(images).toBeTruthy();
    const first = Array.isArray(images) ? images[0] : images;
    expect(first).toMatchObject({ width: 1200, height: 630 });
  });

  it("不传 overrides 时，四件套齐全", () => {
    const og = ogOf(generatePageMetadata("home", "en"));
    expect(og.url).toBeTruthy();
    expect(og.type).toBe("website");
    expect(og.siteName).toBe("AgriTrade");
    expect(og.title).toBeTruthy();
  });

  it("overrides 里的非 openGraph 字段（如 robots）照常覆盖", () => {
    const md = generatePageMetadata("home", "en", "", {
      robots: { index: false, follow: false },
    });
    expect(md.robots).toMatchObject({ index: false, follow: false });
  });
});

describe("canonical 与 hreflang", () => {
  it("canonical 指向当前语言的绝对地址", () => {
    const md = generatePageMetadata("home", "ru", "");
    expect(md.alternates?.canonical).toMatch(/\/ru$/);
  });

  it("hreflang 只声明本站实际存在的语言（.com=8 / .cn=2 由 siteConfig 决定）", () => {
    const langs = buildHreflang("/products");
    // 至少要有 x-default，且不含 .cn 未上线的语言时不能凭空多出来
    expect(langs["x-default"]).toBeTruthy();
    expect(Object.keys(langs).length).toBeGreaterThanOrEqual(2);
  });
});
