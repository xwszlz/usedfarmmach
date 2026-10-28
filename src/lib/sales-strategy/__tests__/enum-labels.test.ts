/**
 * `enum-labels.ts` 回归守卫 · 8 语种枚举本地化
 * ─────────────────────────────────────────────────────────
 * 背景：销售策略 JSON 里的 `axis` / `basisType` / `urgency` / 灯色 / `role` / `level`
 * 是系统枚举，**禁止 LLM 翻译**（derive.ts / pdf-table.ts / Excel 三处按字面量精确匹配）。
 * 于是 8 语种用户在界面上会看到原始中文 —— 本字典是唯一解药，但它必须满足两条硬约束：
 *
 *   ① 每个受支持语种都有译名，且**不等于原始中文**（zh 除外，中文本来就是中文）；
 *      写错一个键名 ⇒ 界面漏出原始中文，老板视角就是"没做完"。
 *   ② 未知值**原样返回**，绝不返回空串 / undefined ⇒ 宁可显示中文也不能显示空白。
 *
 * 运行：`npx vitest run src/lib/sales-strategy`
 */
import { describe, expect, it } from "vitest";
import {
  translateAxis,
  translateBasis,
  translateDealerRole,
  translateRejectLevel,
  translateTrafficLight,
  translateUrgency,
  isChineseLocale,
} from "@/lib/sales-strategy/enum-labels";
import type { AiLocale } from "@/lib/i18n/ai-locale";

/** 8 个受支持语种（与 `.com` 站点 locales 一致） */
const ALL_LOCALES: readonly AiLocale[] = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"];

/** 除中文以外的 7 个语种：译名必须与原始中文不同 */
const NON_ZH_LOCALES: readonly AiLocale[] = ALL_LOCALES.filter((l) => l !== "zh");

/** `MarketAxis` 五值（strategy-schema.ts:155-164） */
const MARKET_AXES = ["国内", "欧洲", "中亚", "非洲中东澳新", "新机对标"] as const;

/** `PriceBasisType` 五值 + `未找到` 占位符（strategy-schema.ts:178-187 + NOT_FOUND） */
const PRICE_BASES = ["新机对标", "欧洲二手净价", "FOB建议", "国内二手估", "推算", "未找到"] as const;

/** `Urgency` 三值（strategy-schema.ts:239） */
const URGENCIES = ["立刻", "本周", "出口前"] as const;

/** `DealerRole` 八值（strategy-schema.ts:245-253） */
const DEALER_ROLES = [
  "原厂",
  "进口商",
  "授权经销",
  "二手商",
  "拍卖行",
  "物流",
  "政府",
  "终端",
] as const;

/** 准入灯色：schema 键名 + 颜色别名 */
const TRAFFIC_LIGHTS = ["friendly", "needPermit", "forbidden", "green", "yellow", "red"] as const;

describe("translateAxis · 市场轴位", () => {
  it("8 个语种都返回非空文案", () => {
    for (const locale of ALL_LOCALES) {
      for (const axis of MARKET_AXES) {
        const label = translateAxis(axis, locale);
        expect(label, `${locale} / ${axis} 空文案`).toBeTruthy();
        expect(label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("7 个非中文语种的译名都不等于原始中文（否则界面等于没翻译）", () => {
    for (const locale of NON_ZH_LOCALES) {
      for (const axis of MARKET_AXES) {
        expect(translateAxis(axis, locale), `${locale} / ${axis}`).not.toBe(axis);
      }
    }
  });

  it("中文语种返回中文原文（不做二次包装）", () => {
    expect(translateAxis("欧洲", "zh")).toBe("欧洲");
    expect(translateAxis("中亚", "zh-CN")).toBe("中亚");
  });

  it("带地区后缀的 locale 归一化到主语言（ru-RU → ru）", () => {
    expect(translateAxis("欧洲", "ru-RU")).toBe(translateAxis("欧洲", "ru"));
    expect(translateAxis("中亚", "zh_CN")).toBe(translateAxis("中亚", "zh"));
    expect(translateAxis("中亚", " PT ")).toBe(translateAxis("中亚", "pt"));
  });

  it("未知语种回落英文（不是空白、不是中文）", () => {
    expect(translateAxis("欧洲", "ko")).toBe(translateAxis("欧洲", "en"));
  });
});

describe("translateBasis · 价格口径", () => {
  it("6 个口径 × 8 语种都非空，且非中文语种不等于原文", () => {
    for (const locale of ALL_LOCALES) {
      for (const basis of PRICE_BASES) {
        const label = translateBasis(basis, locale);
        expect(label, `${locale} / ${basis} 空文案`).toBeTruthy();
        if (locale !== "zh") expect(label, `${locale} / ${basis}`).not.toBe(basis);
      }
    }
  });

  it("`未找到` 也能翻译（模型偶尔把它写进 basisType）", () => {
    expect(translateBasis("未找到", "en")).toBe("Not found");
    expect(translateBasis("未找到", "ru")).not.toBe("未找到");
  });
});

describe("translateUrgency / translateDealerRole / translateTrafficLight", () => {
  it("紧迫度 3 值 × 8 语种非空且非中文语种不等于原文", () => {
    for (const locale of ALL_LOCALES) {
      for (const urgency of URGENCIES) {
        const label = translateUrgency(urgency, locale);
        expect(label).toBeTruthy();
        if (locale !== "zh") expect(label, `${locale} / ${urgency}`).not.toBe(urgency);
      }
    }
  });

  it("渠道角色 8 值 × 8 语种非空且非中文语种不等于原文", () => {
    for (const locale of ALL_LOCALES) {
      for (const role of DEALER_ROLES) {
        const label = translateDealerRole(role, locale);
        expect(label).toBeTruthy();
        if (locale !== "zh") expect(label, `${locale} / ${role}`).not.toBe(role);
      }
    }
  });

  it("准入灯色两套写法（schema 键名 + 颜色别名）都有译名", () => {
    for (const locale of ALL_LOCALES) {
      for (const light of TRAFFIC_LIGHTS) {
        const label = translateTrafficLight(light, locale);
        expect(label).toBeTruthy();
        if (locale !== "zh") expect(label, `${locale} / ${light}`).not.toBe(light);
      }
    }
  });

  it("否决分级保留 L1/L2/L3 编号（跨 PDF / Excel / 界面必须能对齐）", () => {
    for (const locale of ALL_LOCALES) {
      for (const level of ["L1", "L2", "L3"] as const) {
        const label = translateRejectLevel(level, locale);
        expect(label.startsWith(level), `${locale} / ${level} 丢了档位编号`).toBe(true);
        // 编号之后必须有措辞，不能只有 "L1"
        expect(label.length).toBeGreaterThan(level.length);
      }
    }
  });
});

describe("未知枚举值 · 原样返回输入（绝不返回空串 / undefined）", () => {
  const UNKNOWN = "北美洲特殊区" as const;

  it("五个翻译函数对未知值都原样返回", () => {
    for (const locale of ALL_LOCALES) {
      expect(translateAxis(UNKNOWN, locale)).toBe(UNKNOWN);
      expect(translateBasis(UNKNOWN, locale)).toBe(UNKNOWN);
      expect(translateUrgency(UNKNOWN, locale)).toBe(UNKNOWN);
      expect(translateTrafficLight(UNKNOWN, locale)).toBe(UNKNOWN);
      expect(translateDealerRole(UNKNOWN, locale)).toBe(UNKNOWN);
      expect(translateRejectLevel(UNKNOWN, locale)).toBe(UNKNOWN);
    }
  });

  it("模型自造的英文枚举同样原样返回（不吞成空白）", () => {
    expect(translateAxis("Southeast Asia", "ru")).toBe("Southeast Asia");
    expect(translateBasis("auction price", "ar")).toBe("auction price");
  });

  it("空串原样返回空串（调用方据此判断「没有这一格」而不是渲染出「undefined」）", () => {
    expect(translateAxis("", "en")).toBe("");
    expect(translateDealerRole("", "zh")).toBe("");
    expect(translateRejectLevel("", "hi")).toBe("");
  });

  it("绝不返回 undefined / null", () => {
    for (const locale of ALL_LOCALES) {
      for (const value of ["", UNKNOWN, "国内"]) {
        for (const fn of [
          translateAxis,
          translateBasis,
          translateUrgency,
          translateTrafficLight,
          translateDealerRole,
          translateRejectLevel,
        ]) {
          const out = fn(value, locale);
          expect(typeof out).toBe("string");
          expect(out).not.toBeUndefined();
        }
      }
    }
  });
});

describe("isChineseLocale", () => {
  it("只有中文语种为 true（含带地区后缀写法）", () => {
    expect(isChineseLocale("zh")).toBe(true);
    expect(isChineseLocale("zh-CN")).toBe(true);
    expect(isChineseLocale("ZH_cn")).toBe(true);
    for (const locale of NON_ZH_LOCALES) expect(isChineseLocale(locale)).toBe(false);
    expect(isChineseLocale(undefined)).toBe(false);
    expect(isChineseLocale(null)).toBe(false);
    expect(isChineseLocale("")).toBe(false);
  });
});
