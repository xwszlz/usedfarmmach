/**
 * 单测：AI 输出语种基建（`src/lib/i18n/ai-locale.ts` + `fx.ts` 新增的国家→语种映射）
 *
 * 这次改造的事故形态很具体：老板在 `.com` 国际站实测三个 AI 功能**全部输出中文**。
 * 所以本文件锁四件事：
 *   ① 归一化必须消化 `zh-CN` / `EN` / `hi-IN` 这类真实前端与浏览器给出的写法；
 *   ② `resolveAiLocale` 的优先级链一字不差（body > IP > accept-language > referer > 站点默认）；
 *   ③ **`.cn` 收敛**：`.cn` 上 `bodyLocale:"ru"` 必须回落 `zh` ——
 *      这是防止 `.cn` 用户收到俄语报告的唯一闸门，红在这条等于线上事故；
 *   ④ 语言指令必须真的包含「不许翻译 JSON key / 不许本地化固定枚举」这两条硬约束，
 *      否则深度分析的 `condition: "excellent|good|fair|poor"` 会被模型本地化成中文，下游匹配全废。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// fx.ts 顶层 import 了 @/lib/db（prisma 实例化会强依赖 DATABASE_URL），单测里桩掉
vi.mock("@/lib/db", () => ({ prisma: {} }));

// 汇率服务桩（fx.ts 顶层 import，本文件不测汇率数值）
vi.mock("@/lib/services/exchange-rate-service", () => ({
  exchangeRateService: {
    getLiveRatesFromDb: vi.fn(async () => ({})),
    getAllRates: vi.fn(async () => ({ base: "CNY", rates: { CNY: 1 } })),
  },
}));

/**
 * 站点桩：`src/config/site.ts` 的 `SITE` 是 **import 时求值** 的模块常量，
 * 因此 `process.env.SITE = "cn"` 在 import 之后再改是无效的，必须整模块 mock。
 * 这里用 `vi.hoisted` 的共享状态，让每个 test 能独立切换 com/cn。
 */
const site = vi.hoisted(() => {
  const COM_LOCALES = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"];
  const CN_LOCALES = ["zh", "en"];
  return {
    variant: "com" as "com" | "cn",
    COM_LOCALES,
    CN_LOCALES,
  };
});

const COM_LOCALES = site.COM_LOCALES;
const CN_LOCALES = site.CN_LOCALES;

vi.mock("@/config/site", () => {
  const siteConfig = {
    site: "com",
    siteName: "AgriTrade",
    locales: [...site.COM_LOCALES],
    defaultLocale: "en",
  };
  return {
    SITE: site.variant,
    siteConfig,
    siteConfigMap: {
      com: siteConfig,
      cn: { ...siteConfig, site: "cn", locales: [...site.CN_LOCALES], defaultLocale: "zh" },
    },
    cnFeatures: {},
    getSiteVariant: () => site.variant,
    isCnSite: () => site.variant === "cn",
    isComSite: () => site.variant === "com",
    isOverseasAiAllowed: () => site.variant !== "cn",
  };
});

import { siteConfig } from "@/config/site";
import {
  AI_LOCALES,
  AI_LOCALE_SELF_NAME,
  buildLanguageDirective,
  normalizeAiLocale,
  resolveAiLocale,
  withLanguage,
} from "@/lib/i18n/ai-locale";
import { COUNTRY_LOCALE, getLocaleOfCountry } from "@/lib/credits/fx";

/** 把「站点切到 com / cn」这件事收敛成一个函数（含 defaultLocale 同步） */
function setSite(variant: "com" | "cn"): void {
  site.variant = variant;
  siteConfig.locales = variant === "cn" ? [...CN_LOCALES] : [...COM_LOCALES];
  siteConfig.defaultLocale = variant === "cn" ? "zh" : "en";
}

/** 构造最小 NextRequest 假体：只需 headers.get(name)，且大小写不敏感 */
function makeRequest(headers: Record<string, string> = {}): {
  headers: { get(name: string): string | null };
} {
  const lowered: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    lowered[key.toLowerCase()] = value;
  }
  return {
    headers: {
      get(name: string): string | null {
        return lowered[name.toLowerCase()] ?? null;
      },
    },
  };
}

beforeEach(() => {
  setSite("com");
});

describe("AI_LOCALES / AI_LOCALE_SELF_NAME —— 语种集合必须与前端一致", () => {
  it("AI_LOCALES 与 .com 站点 locales 逐项一致（AI 不能吐前端切不回去的语种）", async () => {
    const actual = await vi.importActual<typeof import("@/config/site")>("@/config/site");
    expect([...AI_LOCALES]).toEqual(actual.siteConfigMap.com.locales);
  });

  it("8 个语种每个都有本语种自称，且不是英文名", () => {
    expect(AI_LOCALES).toHaveLength(8);
    for (const locale of AI_LOCALES) {
      const name = AI_LOCALE_SELF_NAME[locale];
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
    // 抽查：必须用该语言自己写（这是给 LLM 的指令，用英文名会削弱遵从度）
    expect(AI_LOCALE_SELF_NAME.zh).toBe("简体中文");
    expect(AI_LOCALE_SELF_NAME.ru).toBe("Русский");
    expect(AI_LOCALE_SELF_NAME.ar).toBe("العربية");
    expect(AI_LOCALE_SELF_NAME.hi).toBe("हिन्दी");
    // 反向锁：俄语的自称绝不能是英文 "Russian"
    expect(AI_LOCALE_SELF_NAME.ru).not.toBe("Russian");
  });
});

describe("normalizeAiLocale —— 归一化（大小写 / 地区后缀 / 空白 / 非法值）", () => {
  it("带地区后缀的写法落到主语言", () => {
    expect(normalizeAiLocale("zh-CN")).toBe("zh");
    expect(normalizeAiLocale("en-US")).toBe("en");
    expect(normalizeAiLocale("hi-IN")).toBe("hi");
    expect(normalizeAiLocale("pt-BR")).toBe("pt");
    expect(normalizeAiLocale("zh_TW")).toBe("zh");
  });

  it("大小写不敏感", () => {
    expect(normalizeAiLocale("EN")).toBe("en");
    expect(normalizeAiLocale("Ru")).toBe("ru");
    expect(normalizeAiLocale("AR")).toBe("ar");
  });

  it("容忍首尾空白", () => {
    expect(normalizeAiLocale("  es  ")).toBe("es");
    expect(normalizeAiLocale("\tfr\n")).toBe("fr");
  });

  it("不在 8 语种内 → null（交给调用方兜底，不要瞎猜）", () => {
    expect(normalizeAiLocale(" ko ")).toBeNull();
    expect(normalizeAiLocale("ja")).toBeNull();
    expect(normalizeAiLocale("de-DE")).toBeNull();
    expect(normalizeAiLocale("xx")).toBeNull();
  });

  it("非字符串 / 空值 → null", () => {
    expect(normalizeAiLocale(undefined)).toBeNull();
    expect(normalizeAiLocale(null)).toBeNull();
    expect(normalizeAiLocale("")).toBeNull();
    expect(normalizeAiLocale("   ")).toBeNull();
    expect(normalizeAiLocale(123)).toBeNull();
    expect(normalizeAiLocale({ locale: "ru" })).toBeNull();
  });
});

describe("resolveAiLocale —— 优先级链（body > IP > accept-language > referer > site-default）", () => {
  it("第 1 优先：bodyLocale 压过 IP 国家", () => {
    const got = resolveAiLocale({
      bodyLocale: "es",
      request: makeRequest({ "x-vercel-ip-country": "RU" }),
    });
    expect(got).toEqual({ locale: "es", source: "body" });
  });

  it("bodyLocale 带地区后缀也能命中（next-intl 路由值 / 前端透传）", () => {
    expect(
      resolveAiLocale({ bodyLocale: "pt-BR", request: makeRequest() })
    ).toEqual({ locale: "pt", source: "body" });
  });

  it("bodyLocale 非法 → 继续往下走，不吞掉后续来源", () => {
    const got = resolveAiLocale({
      bodyLocale: "ko",
      request: makeRequest({ "x-vercel-ip-country": "DE" }), // DE 未收录语种
    });
    expect(got).toEqual({ locale: "en", source: "site-default" });
  });

  it("第 3 优先：无 body 时 IP 国家生效（无 body 才是 .com 的常态入口）", () => {
    expect(
      resolveAiLocale({ request: makeRequest({ "x-vercel-ip-country": "RU" }) })
    ).toEqual({ locale: "ru", source: "ip-country" });
    expect(
      resolveAiLocale({ request: makeRequest({ "x-vercel-ip-country": "br" }) })
    ).toEqual({ locale: "pt", source: "ip-country" });
    expect(
      resolveAiLocale({ request: makeRequest({ "x-vercel-ip-country": "SA" }) })
    ).toEqual({ locale: "ar", source: "ip-country" });
  });

  it("IP 压过 accept-language（同一请求里两者都在，取 IP）", () => {
    const got = resolveAiLocale({
      request: makeRequest({
        "x-vercel-ip-country": "MX",
        "accept-language": "fr-FR,fr;q=0.9",
      }),
    });
    expect(got).toEqual({ locale: "es", source: "ip-country" });
  });

  it("第 4 优先：IP 未收录时 accept-language 生效", () => {
    const got = resolveAiLocale({
      request: makeRequest({
        "x-vercel-ip-country": "DE", // 未收录 → null
        "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      }),
    });
    expect(got).toEqual({ locale: "ru", source: "accept-language" });
  });

  it("accept-language 按 q 值排序，不按出现顺序", () => {
    // en 先出现但 q 更低，必须选 pt
    expect(
      resolveAiLocale({ request: makeRequest({ "accept-language": "en;q=0.5, pt;q=0.9" }) })
    ).toEqual({ locale: "pt", source: "accept-language" });
    // 带地区且 q 最高者胜出
    expect(
      resolveAiLocale({
        request: makeRequest({ "accept-language": "en-US;q=0.6,ar;q=0.95,ru;q=0.4" }),
      })
    ).toEqual({ locale: "ar", source: "accept-language" });
  });

  it("accept-language 里的非法语种被跳过，继续找下一个可用语种", () => {
    expect(
      resolveAiLocale({ request: makeRequest({ "accept-language": "ko-KR,ko;q=0.9,hi;q=0.3" }) })
    ).toEqual({ locale: "hi", source: "accept-language" });
  });

  it("accept-language 只有非法语种 / 通配 → 视为无结果", () => {
    expect(
      resolveAiLocale({ request: makeRequest({ "accept-language": "ko,ja;q=0.8,*;q=0.1" }) })
    ).toEqual({ locale: "en", source: "site-default" });
  });

  it("第 5 优先：referer 的 /{locale}/ 前缀（老调用方不带 bodyLocale 时）", () => {
    expect(
      resolveAiLocale({
        request: makeRequest({ referer: "https://www.usedfarmmach.com/ru/products/123" }),
      })
    ).toEqual({ locale: "ru", source: "referer" });
  });

  it("referer 里没有语种前缀 → 不误判", () => {
    expect(
      resolveAiLocale({
        request: makeRequest({ referer: "https://www.usedfarmmach.cn/ai/valuation" }),
      })
    ).toEqual({ locale: "en", source: "site-default" });
  });

  it("第 6 优先：什么都没有时回落站点默认（.com → en）", () => {
    expect(resolveAiLocale({ request: makeRequest() })).toEqual({
      locale: "en",
      source: "site-default",
    });
  });

  it("bodyLocale 为空串 / undefined 时不视为命中", () => {
    expect(
      resolveAiLocale({ bodyLocale: "", request: makeRequest() }).source
    ).toBe("site-default");
    expect(
      resolveAiLocale({ bodyLocale: undefined, request: makeRequest() }).source
    ).toBe("site-default");
  });

  it("User.preferredLanguage 默认不参与决策（开关关闭，避免 .com 全员命中 zh）", () => {
    // 全仓 User.preferredLanguage 恒为 "zh"（注册接口从不写该字段），
    // 一旦启用会把所有 .com 外国用户锁成中文 —— 这里锁死「不生效」。
    const got = resolveAiLocale({
      userPreferredLanguage: "zh",
      request: makeRequest({ "x-vercel-ip-country": "RU" }),
    });
    expect(got).toEqual({ locale: "ru", source: "ip-country" });
    expect(got.source).not.toBe("user-preference");
  });
});

describe("resolveAiLocale —— .cn 站点收敛（唯一闸门：.cn 只有 zh/en）", () => {
  beforeEach(() => {
    setSite("cn");
  });

  it("【最关键】.cn 上 bodyLocale:'ru' 必须回落 zh，绝不能出俄语报告", () => {
    const got = resolveAiLocale({ bodyLocale: "ru", request: makeRequest() });
    expect(got.locale).toBe("zh");
    // source 仍如实记为 body，方便日志排查「请求确实传了 ru，但被站点收敛」
    expect(got.source).toBe("body");
  });

  it(".cn 上其它非 zh/en 语种一律收敛到 zh", () => {
    for (const bad of ["es", "pt", "ar", "fr", "hi"]) {
      expect(resolveAiLocale({ bodyLocale: bad, request: makeRequest() }).locale).toBe("zh");
    }
  });

  it(".cn 上 zh / en 原样保留，不被误收敛", () => {
    expect(resolveAiLocale({ bodyLocale: "zh", request: makeRequest() }).locale).toBe("zh");
    expect(resolveAiLocale({ bodyLocale: "en", request: makeRequest() }).locale).toBe("en");
  });

  it(".cn 上 IP 定位到俄语区 → 回落 zh（不是 ru）", () => {
    expect(
      resolveAiLocale({ request: makeRequest({ "x-vercel-ip-country": "RU" }) })
    ).toEqual({ locale: "zh", source: "ip-country" });
  });

  it(".cn 上 accept-language 变成 ru → 回落 zh", () => {
    expect(
      resolveAiLocale({
        request: makeRequest({ "accept-language": "ru-RU,ru;q=0.9,en;q=0.8" }),
      })
    ).toEqual({ locale: "zh", source: "accept-language" });
  });

  it(".cn 上 referer 带 /fr/ → 回落 zh", () => {
    expect(
      resolveAiLocale({
        request: makeRequest({ referer: "https://www.usedfarmmach.cn/fr/products" }),
      })
    ).toEqual({ locale: "zh", source: "referer" });
  });

  it(".cn 兜底是 zh（.com 兜底是 en）—— defaultLocale 决定，不硬编码", () => {
    expect(resolveAiLocale({ request: makeRequest() })).toEqual({
      locale: "zh",
      source: "site-default",
    });
    setSite("com");
    expect(resolveAiLocale({ request: makeRequest() })).toEqual({
      locale: "en",
      source: "site-default",
    });
  });
});

describe("buildLanguageDirective —— 语言指令必须覆盖四类硬约束", () => {
  it("包含该语种的本语种自称（不是英文名）", () => {
    for (const locale of AI_LOCALES) {
      const directive = buildLanguageDirective(locale);
      expect(directive).toContain(AI_LOCALE_SELF_NAME[locale]);
    }
    // 反向锁：俄语指令里不能只出现 "Russian"
    expect(buildLanguageDirective("ru")).toContain("Русский");
  });

  it("包含「不许翻译 JSON key」约束", () => {
    const directive = buildLanguageDirective("ru");
    expect(directive).toContain("Do NOT translate JSON keys");
    // key 示例必须是英文原样
    expect(directive).toContain("conditionScores");
  });

  it("包含「固定枚举不许本地化」约束（下游按英文字符串匹配）", () => {
    const directive = buildLanguageDirective("es");
    expect(directive).toContain("FIXED ENUM");
    expect(directive).toContain("excellent|good|fair|poor");
    expect(directive.toUpperCase()).toContain("DO NOT LOCALIZE");
  });

  it("包含品牌/型号/零件号保留拉丁原文、数字单位国际写法", () => {
    const directive = buildLanguageDirective("ar");
    expect(directive).toContain("proper nouns");
    expect(directive).toContain("Latin");
    expect(directive).toContain("mm, cm, m, kg, t, HP, kW, h, L, %");
  });

  it("包含「不要写『以下是为您撰写的中文报告』这类元说明」", () => {
    const directive = buildLanguageDirective("hi");
    expect(directive).toContain("以下是为您撰写的中文报告");
    expect(directive).toContain("Output only the finished deliverable");
  });

  it("指令是英文书写的（元指令稳定性），且带语种代码便于日志核对", () => {
    const directive = buildLanguageDirective("pt");
    expect(directive).toContain("OUTPUT LANGUAGE");
    expect(directive).toContain("Write the ENTIRE response in Português (pt)");
  });
});

describe("withLanguage —— 追加指令到已有 prompt 末尾", () => {
  it("非空 prompt：原文一字不改，指令追加在末尾（离模型最近）", () => {
    const prompt = "请分析这台拖拉机。";
    const merged = withLanguage(prompt, "en");
    expect(merged.startsWith(prompt)).toBe(true);
    expect(merged).toContain(buildLanguageDirective("en"));
    expect(merged.indexOf(prompt)).toBe(0);
    expect(merged.indexOf("OUTPUT LANGUAGE")).toBeGreaterThan(prompt.length);
  });

  it("空 prompt / 纯空白 prompt：直接返回指令本身", () => {
    expect(withLanguage("", "ru")).toBe(buildLanguageDirective("ru"));
    expect(withLanguage("   \n\t", "ru")).toBe(buildLanguageDirective("ru"));
  });

  it("非字符串容错（防御脏调用方，不抛错）", () => {
    // @ts-expect-error 故意传入非法类型，验证运行时不崩
    expect(withLanguage(undefined, "es")).toBe(buildLanguageDirective("es"));
  });
});

describe("getLocaleOfCountry —— 国家 → 语种（IP 定位兜底）", () => {
  it("大小写不敏感", () => {
    expect(getLocaleOfCountry("RU")).toBe("ru");
    expect(getLocaleOfCountry("ru")).toBe("ru");
    expect(getLocaleOfCountry("br")).toBe("pt");
    expect(getLocaleOfCountry("BR")).toBe("pt");
  });

  it("8 语种主要国家抽查", () => {
    expect(getLocaleOfCountry("CN")).toBe("zh");
    expect(getLocaleOfCountry("US")).toBe("en");
    expect(getLocaleOfCountry("GB")).toBe("en");
    expect(getLocaleOfCountry("IN")).toBe("en"); // 印度给 en 而非 hi
    expect(getLocaleOfCountry("KZ")).toBe("ru");
    expect(getLocaleOfCountry("UA")).toBe("ru"); // 无 uk 语种 → 回落 ru
    expect(getLocaleOfCountry("MX")).toBe("es");
    expect(getLocaleOfCountry("PT")).toBe("pt");
    expect(getLocaleOfCountry("SA")).toBe("ar");
    expect(getLocaleOfCountry("FR")).toBe("fr");
    expect(getLocaleOfCountry("CH")).toBe("fr");
  });

  it("同国家双语并存时口径固定：MA 给 fr（不给 ar），CA 给 en（不给 fr）", () => {
    expect(getLocaleOfCountry("MA")).toBe("fr");
    expect(getLocaleOfCountry("DZ")).toBe("fr");
    expect(getLocaleOfCountry("TN")).toBe("fr");
    expect(getLocaleOfCountry("CA")).toBe("en");
  });

  it("未收录国家 → null（由调用方兜底，不瞎猜）", () => {
    expect(getLocaleOfCountry("XX")).toBeNull();
    expect(getLocaleOfCountry("DE")).toBeNull();
    expect(getLocaleOfCountry("JP")).toBeNull();
  });

  it("空值 / 非 2 字母 → null", () => {
    expect(getLocaleOfCountry(null)).toBeNull();
    expect(getLocaleOfCountry(undefined)).toBeNull();
    expect(getLocaleOfCountry("")).toBeNull();
    expect(getLocaleOfCountry("   ")).toBeNull();
    expect(getLocaleOfCountry("USA")).toBeNull();
    expect(getLocaleOfCountry("R")).toBeNull();
    expect(getLocaleOfCountry("R1")).toBeNull();
  });

  it("COUNTRY_LOCALE 覆盖除 hi 外的 7 个语种，且不含空值", () => {
    const values = new Set(Object.values(COUNTRY_LOCALE));
    // hi 是唯一没有国家入口的语种：印度 IN 按口径给 en（印度英语用户更多，
    // 且 hi 用户多数能读 en），hi 只能经 bodyLocale / accept-language 进入。
    for (const locale of AI_LOCALES) {
      if (locale === "hi") continue;
      expect(values.has(locale)).toBe(true);
    }
    expect(values.has("hi")).toBe(false);
    expect(Object.keys(COUNTRY_LOCALE).length).toBeGreaterThanOrEqual(60);
  });

  it("与币种映射互不干扰（同一国家既能拿到币种也能拿到语种）", () => {
    // 中国：CNY + zh；巴西：BRL + pt —— 两条映射各自独立维护，不要互相顶掉
    expect(getLocaleOfCountry("CN")).toBe("zh");
    expect(getLocaleOfCountry("BR")).toBe("pt");
  });
});
