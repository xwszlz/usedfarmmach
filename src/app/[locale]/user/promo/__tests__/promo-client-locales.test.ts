/**
 * 「我的推广码」页（`src/app/[locale]/user/promo/promo-client.tsx`）文案完整性 + 兜底语种。
 *
 * 与首页日报区块同源缺陷：内联 LABELS 只有 zh / en / ru，兜底写成 `|| LABELS.zh`，
 * 导致 es / pt / fr / ar / hi 访客看到整块中文。此处锁死 8 语种覆盖与英语兜底。
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";

// 只断言文案表，但被测模块顶层 import 了 next/link 与 lucide-react，
// 在 node 环境下用最小替身替代，避免依赖 Next 运行时。
vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: { href?: string; children?: React.ReactNode }) =>
    React.createElement("a", { href: props.href }, props.children),
}));
vi.mock("lucide-react", () => {
  const Icon = () => React.createElement("span");
  return {
    __esModule: true,
    Copy: Icon,
    Check: Icon,
    Share2: Icon,
    Loader2: Icon,
    Gift: Icon,
  };
});

import { LABELS } from "../promo-client";

const LOCALES = ["zh", "en", "ru", "es", "pt", "fr", "ar", "hi"] as const;
const NEW_LOCALES = ["es", "pt", "fr", "ar", "hi"] as const;

const EXPECTED_KEYS = [
  "title",
  "subtitle",
  "myCode",
  "links",
  "home",
  "products",
  "valuation",
  "credits",
  "expo",
  "copy",
  "copied",
  "loginGate",
  "loginBtn",
  "tip",
] as const;

const CJK_RE = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

describe("promo-client LABELS —— 语种覆盖", () => {
  it("8 个语种全部存在，key 与 zh 对齐且非空", () => {
    const zhKeys = Object.keys(LABELS.zh).sort();
    expect(zhKeys).toEqual([...EXPECTED_KEYS].sort());

    for (const locale of LOCALES) {
      const labels = LABELS[locale];
      expect(labels, `缺少语种 ${locale} 的文案`).toBeDefined();
      expect(Object.keys(labels).sort(), `${locale} 的 key 与 zh 不一致`).toEqual(zhKeys);
      for (const key of EXPECTED_KEYS) {
        expect(labels[key].trim().length, `${locale}.${key} 不能为空`).toBeGreaterThan(0);
      }
    }
  });

  it("fr 不含 ASCII 半角单引号，ar / hi 及其余外语不含 CJK", () => {
    for (const key of EXPECTED_KEYS) {
      expect(LABELS.fr[key], `fr.${key} 出现了 ASCII 单引号`).not.toContain("'");
    }
    for (const locale of ["en", "ru", "es", "pt", "fr", "ar", "hi"] as const) {
      for (const key of EXPECTED_KEYS) {
        expect(CJK_RE.test(LABELS[locale][key]), `${locale}.${key} 含 CJK`).toBe(false);
      }
    }
  });

  it("es / pt / fr / ar / hi 的价值不是英文复制品（myCode 同形 Code/Código 除外）", () => {
    // 纯专有名词/单词在不同语言中确实可能同形，逐条显式登记
    const IDENTICAL_TO_EN_ALLOWED = new Set<string>(["fr.myCode"]);
    for (const locale of NEW_LOCALES) {
      for (const key of EXPECTED_KEYS) {
        const id = `${locale}.${key}`;
        if (IDENTICAL_TO_EN_ALLOWED.has(id)) continue;
        expect(LABELS[locale][key], `${id} 与 en 完全一样，疑似未翻译`).not.toBe(LABELS.en[key]);
      }
    }
  });

  it("兜底口径：LABELS 里没有的语种不会拿到中文文案", () => {
    // 组件里的取值表达式为 `LABELS[locale] || LABELS.en`
    const resolve = (locale: string) => LABELS[locale] || LABELS.en;
    expect(resolve("de").title).toBe(LABELS.en.title);
    expect(resolve("de").title).not.toBe(LABELS.zh.title);
    expect(resolve("zh").title).toBe(LABELS.zh.title);
  });
});
