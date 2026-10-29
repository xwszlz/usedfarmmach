/**
 * 估值「成色」纯函数 + 枚举定义 —— **零运行时依赖的叶子模块**。
 *
 * ⚠️ 为什么必须独立于 `image-analyzer.ts`（这不是洁癖，是构建能否通过的硬约束）：
 *
 *   `formulas.ts` 被客户端组件（`components/valuation/valuation-report-pro.tsx`、
 *   `valuation-report-section.tsx`、`product-valuation-report.tsx` 等均带 `"use client"`）
 *   直接 import，而它在运行时需要 `visualScoreToConditionFactor`；
 *   `image-analyzer.ts` 因为要走 SSRF 守卫，顶层依赖 `@/lib/net/ssrf-guard`
 *   ⇒ `node:dns/promises` / `node:net`。
 *
 *   于是只要这些纯函数留在 `image-analyzer.ts` 里，webpack 在为客户端编译
 *   `formulas.ts` 时就会顺着这条边把 Node 内置模块打进浏览器 bundle ⇒
 *   `UnhandledSchemeError: Reading from "node:dns/promises" is not handled by plugins`，
 *   `next build` 直接失败（2026-11 stupid 构建事故，Vercel cle1 实测）。
 *
 *   改造前 `image-analyzer.ts` 没有 Node 依赖，那条客户端边只是"多打包点无用代码"的无害冗余，
 *   所以一直没暴露；守卫一加上，它立刻变成致命边。
 *
 * ⇒ 这里的 import **只允许 type-only**（编译期擦除）。任何往本文件加运行时 import 的行为
 *   都会把这个问题原样再犯一遍。新增"前端也要用的估值纯函数"，放这里；会出网 / 用 Node 的，放 image-analyzer。
 */
import type { AiLocale } from "@/lib/i18n/ai-locale";

/** 成色代码：英文枚举，**不翻译**（下游按字面量匹配） */
export type ConditionCode = "excellent" | "good" | "fair" | "poor";

/** 全部合法成色代码（顺序：由好到差） */
export const CONDITION_CODES: readonly ConditionCode[] = ["excellent", "good", "fair", "poor"];

/**
 * 把评分换算成成色代码（分段与 prompt 里的评估标准严格一致）。
 * 非法输入兜底为 fair（既不过度乐观也不过度悲观）。
 */
export function scoreToConditionCode(score: number): ConditionCode {
  const n = Number(score);
  if (!Number.isFinite(n)) return "fair";
  if (n >= 9) return "excellent";
  if (n >= 7) return "good";
  if (n >= 5) return "fair";
  return "poor";
}

/**
 * 把任意模型输出归一化成合法 `ConditionCode`。
 *
 * 容错范围：大小写、空白、以及模型自作主张给出的中文标签/近义词。
 * 仍然识别不了 ⇒ 用 `fallbackScore` 换算（评分总是有的，代码必须有值）。
 */
export function normalizeConditionCode(value: unknown, fallbackScore: number): ConditionCode {
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    const exact = CONDITION_CODES.find((code) => code === raw);
    if (exact) return exact;
    // 模型偶发的中文/近义写法（旧 prompt 只给了中文标签，兼容一下）
    if (raw.includes("优秀") || raw.includes("极好") || raw.includes("excellent")) return "excellent";
    if (raw.includes("良好") || raw.includes("good")) return "good";
    if (raw.includes("一般") || raw.includes("fair")) return "fair";
    if (raw.includes("较差") || raw.includes("差") || raw.includes("poor")) return "poor";
  }
  return scoreToConditionCode(fallbackScore);
}

/** 成色代码 → 各语种可读文案（前端 `visual.labelText` 直接渲染） */
const CONDITION_LABEL_TEXT: Record<AiLocale, Record<ConditionCode, string>> = {
  zh: { excellent: "优秀", good: "良好", fair: "一般", poor: "较差" },
  en: { excellent: "Excellent", good: "Good", fair: "Fair", poor: "Poor" },
  ru: { excellent: "Отличное", good: "Хорошее", fair: "Среднее", poor: "Плохое" },
  es: { excellent: "Excelente", good: "Bueno", fair: "Regular", poor: "Malo" },
  pt: { excellent: "Excelente", good: "Bom", fair: "Razoável", poor: "Ruim" },
  ar: { excellent: "ممتاز", good: "جيد", fair: "مقبول", poor: "ضعيف" },
  fr: { excellent: "Excellent", good: "Bon", fair: "Moyen", poor: "Mauvais" },
  hi: { excellent: "उत्कृष्ट", good: "अच्छा", fair: "सामान्य", poor: "खराब" },
};

/**
 * 取某语种的成色可读文案。
 * 未知语种回落英文，非法代码回落 fair —— 绝不返回 undefined（前端不做空值判断）。
 */
export function conditionCodeLabelText(code: ConditionCode | null | undefined, locale: AiLocale): string {
  const table = CONDITION_LABEL_TEXT[locale] ?? CONDITION_LABEL_TEXT.en;
  const safeCode: ConditionCode = code && CONDITION_CODES.includes(code) ? code : "fair";
  return table[safeCode];
}

/**
 * 将视觉成色评分转换为成色因子
 */
export function visualScoreToConditionFactor(visualScore: number): number {
  if (visualScore >= 9) return 1.05;
  if (visualScore >= 8) return 1.0;
  if (visualScore >= 7) return 0.98;
  if (visualScore >= 6) return 0.95;
  if (visualScore >= 5) return 0.90;
  if (visualScore >= 4) return 0.85;
  if (visualScore >= 3) return 0.78;
  return 0.70;
}
