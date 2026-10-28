/**
 * AI 输出语种基建 —— 全站 AI 功能（深度分析 / 估值 / 销售策略 …）的**唯一**语言决策入口。
 *
 * 背景（老板实测反馈）：`.com` 国际站的三个 AI 功能此前全部只输出中文，
 * 因为 prompt 硬编码中文且没有任何语言指令。本模块把「这次该输出什么语言」
 * 与「怎么把这个语言要求写进 prompt」两件事收敛到一处，避免每条链路各写一份。
 *
 * 设计要点：
 *   1. 语种集合与 `siteConfigMap.com.locales` 一致（zh/en/ru/es/pt/ar/fr/hi），
 *      即「AI 能输出的语言 ⊆ 站点能展示的语言」，永不多出一个前端切不回去的语种。
 *   2. 决策走**优先级链**（见 `resolveAiLocale`），命中即返回，保证结果确定可测。
 *   3. `.cn` 站点只有 zh/en —— 解析结果必须收敛，否则会给国内用户输出俄语报告。
 *      收敛放在最后统一做一道，而不是散落在每个分支里，避免漏改。
 *   4. 语言指令用**英文**书写：模型对英文元指令的遵从度更稳定，
 *      且指令里还要引用中文/阿拉伯文语种名，中英混排比中文指令更不容易产生歧义。
 *
 * 本模块为服务端/纯函数库，无副作用、不发网络请求。
 */
import { siteConfig, isCnSite } from "@/config/site";
import { getLocaleOfCountry } from "@/lib/credits/fx";

/** AI 功能支持的输出语种（与 siteConfigMap.com.locales 一致） */
export type AiLocale = "zh" | "en" | "ru" | "es" | "pt" | "ar" | "fr" | "hi";

/**
 * 各语种的**本语种自称**（用于给 LLM 下语言指令；必须用该语言自己写，不能用英文名）。
 *
 * 写成「简体中文」而不是 "Chinese"、"Русский" 而不是 "Russian"：
 * 模型看到目标语言的自称时，输出更稳定地落到该语言，减少「用英文解释俄语」这类漂移。
 */
export const AI_LOCALE_SELF_NAME: Record<AiLocale, string> = {
  zh: "简体中文",
  en: "English",
  ru: "Русский",
  es: "Español",
  pt: "Português",
  ar: "العربية",
  fr: "Français",
  hi: "हिन्दी",
};

/** 全部受支持的 AI 输出语种（顺序与 .com 站点 locales 一致） */
export const AI_LOCALES: readonly AiLocale[] = [
  "zh",
  "en",
  "ru",
  "es",
  "pt",
  "ar",
  "fr",
  "hi",
];

/** 语种集合的 O(1) 判定表（避免每次归一化都 `includes` 线性扫描） */
const AI_LOCALE_SET: ReadonlySet<string> = new Set<string>(AI_LOCALES);

/**
 * `.cn` 站点允许的 AI 输出语种。
 * `.cn` 线上只有 zh/en 两个语言路由，AI 若吐出 ru/es/… 前端无处安放。
 */
const CN_ALLOWED_LOCALES: readonly AiLocale[] = ["zh", "en"];

/**
 * 是否启用「登录用户偏好语言」（`User.preferredLanguage`）参与决策。
 *
 * ⚠️ 默认 **false**，且不是忘了打开：
 *   `User.preferredLanguage` 字段全仓**只读不写** —— 注册接口
 *   `src/app/api/auth/register/route.ts` 从不写入该字段，schema 默认值是 `"zh"`。
 *   于是所有 `.com` 外国用户的该字段恒为 `"zh"`，一旦启用，只要 body 没带 locale
 *   就会全员命中中文，把这次的修复直接抵消。
 *
 * 打开条件：注册接口 / 用户中心「改语言」接口补齐写入之后再改成 `true`。
 * 期间本模块的 `resolveAiLocale` 仍会校验该字段的合法性（代码保留，开关关闭）。
 */
const USE_USER_PREFERENCE: boolean = false;

/**
 * 归一化任意输入为 AiLocale，不合法返回 null。
 *
 * 接受的写法（大小写不敏感、容忍空白与地区后缀）：
 *   "zh" / "ZH" / "zh-CN" / "zh_CN" / " en-US " → 主语言子标签
 * 不接受的写法（返回 null，让调用方决定兜底）：
 *   undefined / null / 数字 / 空串 / " ko "（不在 8 语种内）/ "zh-Hans-CN" 之外的怪值由主标签兜住
 */
export function normalizeAiLocale(value: unknown): AiLocale | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  // 取主语言子标签：BCP-47 的 `zh-CN` / `en_US` / `hi-IN` 都要落到 `zh` / `en` / `hi`
  const primary = raw.toLowerCase().split(/[-_]/)[0];
  if (!primary) return null;
  return AI_LOCALE_SET.has(primary) ? (primary as AiLocale) : null;
}

/** AI 语种决策的来源标记（写日志用：出问题时能一眼看出「为什么是俄语」） */
export type AiLocaleSource =
  | "body"
  | "user-preference"
  | "ip-country"
  | "accept-language"
  | "referer"
  | "site-default";

export interface ResolveAiLocaleInput {
  /** 前端显式传来的 locale（来自 next-intl 当前路由，代表用户主动选择的语言）—— 优先级最高 */
  bodyLocale?: unknown;
  /** 已登录用户的 User.preferredLanguage（注意：见下方 ⚠️ 这条默认不启用） */
  userPreferredLanguage?: unknown;
  /** NextRequest，用于读请求头 */
  request: { headers: { get(name: string): string | null } };
}

/** 请求头名常量（Vercel 免费提供，`.com` 直接可读；`.cn` 上不存在，读到 null 自然跳过） */
const HEADER_IP_COUNTRY = "x-vercel-ip-country";
const HEADER_ACCEPT_LANGUAGE = "accept-language";
const HEADER_REFERER = "referer";

/**
 * 把任意候选语种收敛到「当前站点真正支持」的范围内。
 *
 * 目前只有 `.cn` 需要收敛（8 → 2）。不收敛会导致 `.cn` 用户收到俄语/阿拉伯语报告，
 * 这是本次改造最容易漏、也最容易被老板再次怼回来的点，故统一在出口做一道。
 */
function convergeToSiteLocales(locale: AiLocale): AiLocale {
  if (!isCnSite()) return locale;
  if (CN_ALLOWED_LOCALES.includes(locale)) return locale;
  const siteDefault = normalizeAiLocale(siteConfig.defaultLocale);
  // `.cn` defaultLocale 是 "zh"；万一被改成非 zh/en 的怪值，兜底仍然给 zh
  if (siteDefault && CN_ALLOWED_LOCALES.includes(siteDefault)) return siteDefault;
  return "zh";
}

/**
 * 解析 `accept-language` 请求头，取 q 值最高的、能归一化的语言。
 *
 * 形如 `ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7`：
 *   按 q 值降序，同 q 值保持原始顺序（`Array.prototype.sort` 在现代 V8 稳定，
 *   但这里仍显式带 `index` 兜底，避免依赖实现细节），逐个尝试归一化。
 *   `q=0` 表示「明确不接受」，直接跳过；`*` 通配跳过。
 */
function pickFromAcceptLanguage(header: string | null): AiLocale | null {
  if (!header) return null;
  const parts = header.split(",");
  const parsed: Array<{ tag: string; q: number; index: number }> = [];
  for (let i = 0; i < parts.length; i += 1) {
    const rawPart = parts[i].trim();
    if (!rawPart) continue;
    const [tagPart, ...params] = rawPart.split(";");
    const tag = tagPart.trim();
    if (!tag || tag === "*") continue;
    let q = 1;
    for (const param of params) {
      const matched = param.trim().match(/^q=([0-9.]+)$/i);
      if (matched) {
        const value = Number.parseFloat(matched[1]);
        if (Number.isFinite(value)) q = value;
      }
    }
    if (q <= 0) continue;
    parsed.push({ tag, q, index: i });
  }
  parsed.sort((a, b) => (b.q - a.q) || (a.index - b.index));
  for (const item of parsed) {
    const hit = normalizeAiLocale(item.tag);
    if (hit) return hit;
  }
  return null;
}

/**
 * 从 `referer` 的路径里抓 `/[a-z]{2}/` 语种前缀（如 `https://x.com/ru/products` → `ru`）。
 *
 * `.cn` 站点用不到这条（`.cn` 请求体内已带 bodyLocale），保留是为了兼容
 * 那些不带 bodyLocale 的老调用方 / 直连 API 的脚本。
 */
function pickFromReferer(referer: string | null): AiLocale | null {
  if (!referer) return null;
  let pathname = referer;
  try {
    pathname = new URL(referer).pathname;
  } catch {
    // 非标准 URL（相对路径 / 缺协议）→ 退化为原始串匹配
  }
  const matched = pathname.match(/\/([a-z]{2})(?:\/|$)/i);
  if (!matched) return null;
  return normalizeAiLocale(matched[1]);
}

/**
 * 统一解析入口：这次 AI 输出该用哪个语种。
 *
 * 优先级链（命中即返回，全部结果是**收敛后**的站点内语种）：
 *   1. `bodyLocale`           —— 用户在当前页面主动选的语言，显式意图，最强
 *   2. `userPreferredLanguage` —— ⚠️ 默认关闭，见 `USE_USER_PREFERENCE` 注释
 *   3. `x-vercel-ip-country`  —— `.com` 跑在 Vercel 上，这个头免费且直接可读
 *   4. `accept-language`      —— 浏览器语言偏好，按 q 值排序
 *   5. `referer`              —— 从 URL 的 `/{locale}/` 前缀反推（老调用方兼容）
 *   6. `siteConfig.defaultLocale` —— 兜底（`.cn` → zh，`.com` → en）
 */
export function resolveAiLocale(input: ResolveAiLocaleInput): {
  locale: AiLocale;
  source: AiLocaleSource;
} {
  const headers = input.request?.headers;

  // 1. 前端显式 locale（用户主动选的，最高优先级）
  const fromBody = normalizeAiLocale(input.bodyLocale);
  if (fromBody) {
    return { locale: convergeToSiteLocales(fromBody), source: "body" };
  }

  // 2. 登录用户偏好语言（默认关闭，原因见 USE_USER_PREFERENCE 注释）
  if (USE_USER_PREFERENCE) {
    const fromUser = normalizeAiLocale(input.userPreferredLanguage);
    if (fromUser) {
      return { locale: convergeToSiteLocales(fromUser), source: "user-preference" };
    }
  }

  // 3. IP 定位国家 → 语种（Vercel 注入的 x-vercel-ip-country）
  const ipCountry = headers?.get(HEADER_IP_COUNTRY) ?? null;
  const fromIp = getLocaleOfCountry(ipCountry);
  if (fromIp) {
    return { locale: convergeToSiteLocales(fromIp), source: "ip-country" };
  }

  // 4. 浏览器语言偏好
  const fromAcceptLanguage = pickFromAcceptLanguage(
    headers?.get(HEADER_ACCEPT_LANGUAGE) ?? null
  );
  if (fromAcceptLanguage) {
    return { locale: convergeToSiteLocales(fromAcceptLanguage), source: "accept-language" };
  }

  // 5. referer 路径前缀（老调用方兼容）
  const fromReferer = pickFromReferer(headers?.get(HEADER_REFERER) ?? null);
  if (fromReferer) {
    return { locale: convergeToSiteLocales(fromReferer), source: "referer" };
  }

  // 6. 站点默认语种兜底（cn → zh，com → en）
  const siteDefault = normalizeAiLocale(siteConfig.defaultLocale) ?? "en";
  return { locale: convergeToSiteLocales(siteDefault), source: "site-default" };
}

/**
 * 生成注入到 prompt 末尾的语言指令。
 *
 * 英文指令（不是中文）—— 因为模型对英文元指令的遵从度更稳定，
 * 且指令中需要引用「简体中文 / العربية」这类本语种自称，中英混排不会产生歧义。
 *
 * 指令覆盖四类约束（少一条都会踩坑）：
 *   ① 整份输出用目标语言（含章节标题 / 小节标题 / 表头 / 列表项 / 结论）
 *   ② JSON 的 **key** 不翻译（下游按英文 key 取值）
 *   ③ 固定枚举字段**不本地化**（下游按 `"excellent"` / `"normal"` 等英文字符串匹配）
 *   ④ 品牌 / 型号 / 零件号保留拉丁字母原文；数字与单位用国际写法
 * 最后再堵一句「不要写『以下是为您撰写的中文报告』」这类元说明。
 */
export function buildLanguageDirective(locale: AiLocale): string {
  const selfName = AI_LOCALE_SELF_NAME[locale] ?? AI_LOCALE_SELF_NAME.en;
  return [
    "=== OUTPUT LANGUAGE (MANDATORY) ===",
    `Write the ENTIRE response in ${selfName} (${locale}).`,
    "This requirement covers every part of the output, without exception:",
    "- every section heading and sub-heading, including the report title;",
    "- every paragraph, bullet list item and table cell;",
    "- every table column header and row label;",
    "- every conclusion, recommendation and disclaimer sentence.",
    "",
    "Strict constraints:",
    '1. Do NOT translate JSON keys. Keep every key exactly as given in English (e.g. "brand", "conditionScores", "confidence"). Only the VALUES may be in ' +
      `${selfName}.`,
    "2. If a field value is a FIXED ENUM that was given in this prompt as English candidates " +
      '(for example "excellent|good|fair|poor", "normal|abnormal_noise", "yes|no"), output the ' +
      "English enum value verbatim. Do NOT localize, translate or otherwise alter enum values — " +
      "downstream code matches them as exact English strings.",
    "3. Keep proper nouns (brand names, model designations, part numbers, OEM codes) in their " +
      "original Latin spelling. Do NOT transliterate them or rewrite them in the target script.",
    "4. Write numbers and units in international notation: mm, cm, m, kg, t, HP, kW, h, L, %.",
    "5. Output only the finished deliverable. Never add meta commentary such as " +
      '"Here is the report written in Chinese" / "以下是为您撰写的中文报告" — start directly ' +
      "with the content itself.",
    "",
    "Remember: the final answer must be 100% in " +
      `${selfName}, except for JSON keys, enum values and proper nouns as described above.`,
    "=== END OUTPUT LANGUAGE ===",
  ].join("\n");
}

/**
 * 把语言指令追加到已有 prompt 末尾（已有 prompt 为空时直接返回指令本身）。
 *
 * 之所以用 `+"\n\n"` 拼接而不是替换：prompt 里可能已经有历史指令，
 * 语言指令永远追加到最末（离模型最近的位置遵从度最高），不改动原 prompt 一个字。
 */
export function withLanguage(prompt: string, locale: AiLocale): string {
  const directive = buildLanguageDirective(locale);
  const base = typeof prompt === "string" ? prompt : "";
  if (!base.trim()) return directive;
  return `${base}\n\n${directive}`;
}
