/**
 * 「性质」归一化器 —— 51 个自由文本原值 → 6 类。
 *
 * 依据 `线索池-PRD` §3.2：匹配顺序**自上而下，命中即停**。
 * 归一化值只写进 `notes` 的 `[性质]` 前缀，不参与 `contentHash`。
 */

/** 六类归一化值（顺序 = 优先级顺序） */
export const NATURE_CLASSES: readonly string[] = [
  "拍卖行/平台",
  "生产厂商/品牌总部",
  "授权经销商",
  "二手商/个人卖家",
  "普通经销商",
  "其他",
] as const;

interface NatureRule {
  /** 归一化值 */
  value: string;
  /** 命中关键词（任一命中即停） */
  keywords: readonly string[];
}

/** 规则表：自上而下，命中即停；最后一条为兜底 */
const NATURE_RULES: readonly NatureRule[] = [
  { value: "拍卖行/平台", keywords: ["拍卖", "平台"] },
  { value: "生产厂商/品牌总部", keywords: ["生产厂商", "总部"] },
  { value: "授权经销商", keywords: ["授权", "总代", "专营", "4S"] },
  { value: "二手商/个人卖家", keywords: ["二手", "个人"] },
  { value: "普通经销商", keywords: ["经销", "产销"] },
];

/** 兜底值 */
const NATURE_FALLBACK = "其他";

/**
 * 归一化「性质」原值。
 *
 * @param raw 源 xlsx 的 `性质` 原值
 * @returns 六类之一
 */
export function normalizeNature(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return NATURE_FALLBACK;
  for (const rule of NATURE_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) return rule.value;
    }
  }
  return NATURE_FALLBACK;
}

/** 归一化结果（含命中证据，供报告使用） */
export interface NatureResult {
  value: string;
  matchedKeyword: string;
  isFallback: boolean;
}

/**
 * 归一化「性质」并返回命中证据。
 *
 * @param raw 源 xlsx 的 `性质` 原值
 */
export function normalizeNatureWithEvidence(raw: string): NatureResult {
  const text = (raw || "").trim();
  if (!text) return { value: NATURE_FALLBACK, matchedKeyword: "", isFallback: true };
  for (const rule of NATURE_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        return { value: rule.value, matchedKeyword: keyword, isFallback: false };
      }
    }
  }
  return { value: NATURE_FALLBACK, matchedKeyword: "", isFallback: true };
}
