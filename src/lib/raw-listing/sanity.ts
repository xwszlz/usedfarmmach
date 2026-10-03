/**
 * 《采集数据上架》自动判定规则库（sanity）
 *
 * 实现 `docs/采集数据上架方案.md` §2.1 的全部阈值，对每条 `RawListing`
 * 给出 `auto_reject | needs_review | auto_pass`（优先级：
 * `auto_reject` > `needs_review` > `auto_pass`，零命中才 `auto_pass`）。
 *
 * 设计要点：
 *  - 本文件为**纯函数**：DB 相关事实（品牌是否匹配 / 品类能否推断 /
 *    同品牌中位价 / 是否重复）由调用方探测后经 `SanityContext` 注入，
 *    从而保证可单测、可复现。
 *  - 币种折算表用于「无 priceCny 时按 priceRaw×汇率」估算。
 *
 * 与设计文档的一处刻意收敛（已上报）：
 *  §2.1 表格把「host 缺失」列为 auto_reject，但 §2.2-5 明确
 *  「sourceUrl 缺失」属**必须人工确认**。二者冲突，本实现取保守侧：
 *  空 sourceUrl → `needs_review`（不误杀合法但缺链的采集行）；
 *  仅当 URL 存在却非 http(s)/不可解析、或命中黑名单域名时才 auto_reject。
 */

import {
  ACTION_PRIORITY,
  PRICE_MAX_CNY,
  PRICE_MIN_CNY,
  PRICE_OUTLIER_RATIO,
  SOURCE_URL_BLACKLIST,
  type SanityAction,
  type SanityContext,
  type SanityInput,
  type SanityOptions,
  type SanityResult,
  type SanityRuleHit,
} from "./types";

/** 内置汇率兜底表（币种 → 人民币）。EUR 对齐国内导入脚本 7.91；USD 对齐内部路由 7.25。 */
export const EXCHANGE_RATES: Readonly<Record<string, number>> = {
  CNY: 1,
  RMB: 1,
  EUR: 7.91,
  USD: 7.25,
  GBP: 9.2,
  PLN: 1.85,
  CZK: 0.32,
  RON: 1.6,
  HUF: 0.02,
  RUB: 0.08,
  UAH: 0.19,
  TRY: 0.22,
  CHF: 8.2,
  SEK: 0.69,
  NOK: 0.68,
  DKK: 1.06,
  CAD: 5.3,
  AUD: 4.75,
  JPY: 0.048,
  KRW: 0.0053,
};

/**
 * 估算人民币价：优先用采集端已折算的 `priceCny`；
 * 缺失时用 `priceRaw × 汇率`；币种未知或汇率缺失 → null。
 */
export function resolveEffectivePriceCny(
  input: Pick<SanityInput, "priceCny" | "priceRaw" | "currency">,
  rates: Readonly<Record<string, number>> = EXCHANGE_RATES
): number | null {
  if (typeof input.priceCny === "number" && Number.isFinite(input.priceCny)) {
    return input.priceCny;
  }
  if (typeof input.priceRaw === "number" && Number.isFinite(input.priceRaw) && input.currency) {
    const rate = rates[input.currency.toUpperCase()];
    if (typeof rate === "number" && Number.isFinite(rate)) {
      return input.priceRaw * rate;
    }
  }
  return null;
}

/** 解析 http(s) URL；非 http(s) 或不可解析返回 null */
export function tryParseHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.host) return null;
    return u;
  } catch {
    return null;
  }
}

/** host 是否命中域名黑名单（pinterest.* 以子串兼容） */
export function isBlacklistedHost(host: string): boolean {
  const h = host.toLowerCase();
  return SOURCE_URL_BLACKLIST.some((b) => h === b || h.endsWith("." + b) || h.includes(b));
}

/** modelName 是否为噪声（过短 / 含 URL 片段 / 纯符号） */
export function isNoisyModelName(modelName: string): boolean {
  const m = (modelName || "").trim();
  if (m.length < 2) return true;
  if (/watch|http/i.test(m)) return true;
  if (!/[A-Za-z0-9\u4e00-\u9fa5]/.test(m)) return true;
  return false;
}

/**
 * 对单条采集数据执行全量自动判定。
 *
 * @param input RawListing 字段投影
 * @param ctx   调用方注入的 DB 探测事实
 * @param opts  可选：currentYear / exchangeRates
 */
export function evaluateSanity(
  input: SanityInput,
  ctx: SanityContext,
  opts: SanityOptions = {}
): SanityResult {
  const currentYear = opts.currentYear ?? new Date().getFullYear();
  const rates = opts.exchangeRates ?? EXCHANGE_RATES;
  const hits: SanityRuleHit[] = [];

  // ── 规则①：来源域名（黑名单 / 非 http(s) / 缺失）──
  const url = (input.sourceUrl || "").trim();
  if (!url) {
    hits.push({
      rule: "source_url_missing",
      action: "needs_review",
      detail: "sourceUrl 缺失（§2.2 可疑/聚合来源），转人工核实",
    });
  } else {
    const parsed = tryParseHttpUrl(url);
    if (!parsed) {
      hits.push({
        rule: "source_url_invalid",
        action: "auto_reject",
        detail: `sourceUrl 非 http(s) 或不可解析：${url.slice(0, 80)}`,
      });
    } else if (isBlacklistedHost(parsed.host)) {
      hits.push({
        rule: "domain_blacklist",
        action: "auto_reject",
        detail: `来源域名命中黑名单：${parsed.host}`,
      });
    }
  }

  // ── 规则②：modelName 噪声 ──
  if (isNoisyModelName(input.modelName)) {
    hits.push({
      rule: "model_noise",
      action: "auto_reject",
      detail: `modelName 噪声：${(input.modelName || "").trim().slice(0, 60) || "(空)"}`,
    });
  }

  // ── 规则③：价格硬边界 ──
  const price = resolveEffectivePriceCny(input, rates);
  if (price != null && (price < PRICE_MIN_CNY || price > PRICE_MAX_CNY)) {
    hits.push({
      rule: "price_hard_bound",
      action: "auto_reject",
      detail: `价格 ${Math.round(price)} 元超出硬边界 [${PRICE_MIN_CNY}, ${PRICE_MAX_CNY}]`,
    });
  }

  // ── 规则④：价格离群（相对同品牌中位价）──
  if (price != null && ctx.brandMedianCny != null && ctx.brandMedianCny > 0) {
    const ratio = price / ctx.brandMedianCny;
    if (ratio > PRICE_OUTLIER_RATIO || ratio < 1 / PRICE_OUTLIER_RATIO) {
      hits.push({
        rule: "price_outlier",
        action: "needs_review",
        detail: `价格 ${Math.round(price)} 元偏离同品牌中位价 ${Math.round(ctx.brandMedianCny)} 元达 ${ratio.toFixed(1)}×`,
      });
    }
  }

  // ── 规则⑤a：无价 ──
  if (price == null) {
    hits.push({
      rule: "no_price",
      action: "needs_review",
      detail: "无价格（priceCny 与 priceRaw 均缺失）",
    });
  }

  // ── 规则⑤b：年份非法/缺失 ──
  if (input.year == null || input.year < 1980 || input.year > currentYear + 1) {
    hits.push({
      rule: "invalid_year",
      action: "needs_review",
      detail: `年份非法或缺失：${input.year == null ? "null" : input.year}`,
    });
  }

  // ── 规则⑤c：品牌未匹配 ──
  if (!ctx.brandMatched) {
    hits.push({
      rule: "brand_unmatched",
      action: "needs_review",
      detail: `品牌未匹配：${(input.brandName || "").trim() || "(空)"}`,
    });
  }

  // ── 规则⑤d：品类无法推断（需回退兜底 → 强制人工）──
  if (!ctx.categoryInferable) {
    hits.push({
      rule: "category_undetermined",
      action: "needs_review",
      detail: "品类无法由 modelName 推断，需回退兜底并人工确认",
    });
  }

  // ── 规则⑥：重复检测 ──
  if (ctx.isDuplicate) {
    hits.push({
      rule: "duplicate_product",
      action: "auto_reject",
      detail: "命中重复检测（同卖家/品牌/型号/年份）",
    });
  }

  // ── 汇总：取最高优先级 ──
  const action: SanityAction = hits.reduce<SanityAction>(
    (acc, h) => (ACTION_PRIORITY[h.action] > ACTION_PRIORITY[acc] ? h.action : acc),
    "auto_pass"
  );

  const reasons = hits.map((h) => h.rule);
  const notes =
    hits.length === 0
      ? "[sanity] auto_pass：零命中"
      : `[sanity] ${action}：${hits.map((h) => `${h.rule}(${h.detail})`).join("；")}`;

  return { action, hits, reasons, notes };
}
