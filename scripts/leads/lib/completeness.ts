/**
 * 联络完备度计算器 —— P / E / W → 四级 + 「还缺什么」。
 *
 * 依据 `线索池-PRD` §3.3 与工程方案 §8.5：
 * ```
 * P = hasCallablePhone(电话)   // 见 phone-judger.ts
 * E = hasEmail(邮箱)           // 含 '@'
 * W = hasSocial(微信/WA)       // 非空且非 '—'
 * ```
 * | 等级     | 判定式          |
 * |---------|----------------|
 * | ✅ 全    | `P ∧ E ∧ W`    |
 * | 🟡 可外呼 | `P ∧ (E ⊕ W)`  |
 * | 🟠 仅电话 | `P ∧ ¬E ∧ ¬W`  |
 * | 🔴 缺电话 | `¬P`           |
 *
 * 「还缺什么」= `missing.join("、")`，固定顺序 电话 → 邮箱 → 微信/WA；空则 `—`。
 *
 * **本结果是派生值，不入库**（只进 `notes` / 报告）。
 */

import type { PhoneJudgement } from "./phone-judger";

/** 四级完备度 */
export type CompletenessLevel = "全" | "可外呼" | "仅电话" | "缺电话";

/** 展示用 emoji 标签（与源 xlsx `联络完备度` 列一致，便于核对） */
export const LEVEL_LABEL: Readonly<Record<CompletenessLevel, string>> = {
  全: "✅ 全",
  可外呼: "🟡 可外呼",
  仅电话: "🟠 仅电话",
  缺电话: "🔴 缺电话",
};

/** 四级固定顺序（报告统计用，避免依赖 Object.keys 顺序） */
export const LEVEL_ORDER: readonly CompletenessLevel[] = ["全", "可外呼", "仅电话", "缺电话"];

/** 「还缺什么」固定顺序 */
const MISSING_ORDER: readonly string[] = ["电话", "邮箱", "微信/WA"];

/** 空值占位 */
export const NOTHING_MISSING = "—";

/** 邮箱判定：含 '@' */
export function hasEmail(email: string): boolean {
  return (email || "").includes("@");
}

/** 社交判定：非空且非 '—' */
export function hasSocial(social: string): boolean {
  const text = (social || "").trim();
  return text.length > 0 && text !== NOTHING_MISSING;
}

/** 裸 QQ（只有 "QQ" 无号）→ `[弱价值]` */
export function isBareQq(social: string): boolean {
  const text = (social || "").trim();
  if (!text) return false;
  return /^QQ$/i.test(text) || (/QQ/i.test(text) && !/\d/.test(text));
}

/** 计算结果 */
export interface CompletenessResult {
  /** P：存在可直拨号码 */
  p: boolean;
  /** E：含 '@' 的邮箱 */
  e: boolean;
  /** W：微信/WA 非空且非 '—' */
  w: boolean;
  level: CompletenessLevel;
  /** 展示标签（含 emoji） */
  label: string;
  /** 「还缺什么」字符串 */
  missing: string;
  /** 缺项明细 */
  missingList: string[];
}

/**
 * 计算联络完备度。
 *
 * @param phone    电话判定结果（`phone-judger.ts` 产出）
 * @param emailRaw 源 xlsx 的 `邮箱` 原值
 * @param socialRaw 源 xlsx 的 `微信/WA` 原值
 */
export function computeCompleteness(
  phone: PhoneJudgement,
  emailRaw: string,
  socialRaw: string,
): CompletenessResult {
  const p = phone.callable;
  const e = hasEmail(emailRaw);
  const w = hasSocial(socialRaw);

  let level: CompletenessLevel;
  if (!p) {
    level = "缺电话";
  } else if (e && w) {
    level = "全";
  } else if (e || w) {
    // E ⊕ W：此刻二者恰有一个为真
    level = "可外呼";
  } else {
    level = "仅电话";
  }

  const missingList: string[] = [];
  if (!p) missingList.push(MISSING_ORDER[0]);
  if (!e) missingList.push(MISSING_ORDER[1]);
  if (!w) missingList.push(MISSING_ORDER[2]);

  const missing = missingList.length === 0 ? NOTHING_MISSING : missingList.join("、");

  return { p, e, w, level, label: LEVEL_LABEL[level], missing, missingList };
}
