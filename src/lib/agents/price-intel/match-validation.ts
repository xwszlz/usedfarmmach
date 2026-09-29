/**
 * 匹配后校验层（P0-3，🔴 最高优先）—— 纯函数、零 DB、零副作用
 *
 * 【为什么需要】
 *   把匹配规则"放宽"（大小写不敏感 + 首词前缀兜底）可把端到端覆盖率从 8.7% 刷到 20.7%，
 *   但**配对是错的**：库恩 8 个完全不同型号（vb 3290 / vb 2160 / VB 2260 / …）全部被
 *   配到同一台产品 VbP3165；根因是首词 "VB"（弱 token）命中任何 VB 开头产品。
 *   ⇒ 覆盖率可以被刷高，但配对是错的。本层是保证"提升是真的"的必过闸。
 *
 * 【四条规则】
 *   ① 首词前缀禁令：model 首词若为"弱 token"（长度 ≤ 4 且数字 < 2 位，如 VB / MF / 8R / T7），
 *      禁止用于 contains 兜底匹配（仅当命中来自 step4 首词兜底时生效）。
 *   ② 一对多禁令：同一 productId 不得被 ≥ 2 个语义不同的 rawModel 命中
 *      （单次运行内硬拦；全局只读审计见 scripts/audit-one-to-many.ts）。
 *   ③ 数字骨架一致性：候选与库存的"数字段（长度 ≥ 2）"必须存在相等，或为库存段的上游前缀。
 *      ⚠️ 取"存在性匹配"而非"最长段"，否则 "980 (2016)"（归一化 9802016）会被误判为 2016。
 *   ④ 长度约束：候选规范化后长度 < 2 的必须丢弃。
 *
 * 【设计原则】
 *   - 纯函数、零 DB 依赖
 *   - 全部 additive：调用方拿不到通过则**拒绝该候选**而非放行；不改变既有匹配顺序
 *   - normalizeModel 直接复用 model-alias 的既有导出，避免两处实现漂移
 */
import { normalizeModel } from "@/lib/model-alias";

/** 匹配来源步（用于规则①的差异化适用） */
export type MatchStep = 1 | 2 | 3 | 4 | 5;

export interface MatchCandidate {
  /** 判定所属品牌（brandId/slug） */
  brandSlug: string;
  /** 榜单侧原始型号（c.modelName） */
  rawListingModel: string;
  /** 命中的库存产品 id */
  productId: string;
  /** 库存型号（Product.modelName） */
  productModelName: string;
  /** 由哪一步命中 */
  viaStep: MatchStep;
}

export type RejectRule =
  | "first_token_prefix"
  | "one_to_many"
  | "digit_skeleton"
  | "length";

export interface ValidationRejection {
  candidate: MatchCandidate;
  rule: RejectRule;
  reason: string;
}

export interface ValidationResult {
  ok: boolean;
  rejection?: ValidationRejection;
}

/** 单次运行内的判定状态（规则② 用） */
export interface OneToManyState {
  /** productId → 已命中的 normalized rawModel 集合 */
  seenByProduct: Map<string, Set<string>>;
  /** 可选：显式白名单（`productId::normalizedRawModel`）；命中则整条放行 */
  allowlist?: Set<string>;
}

/**
 * 取原始串中所有"有意义的"数字段：长度 ≥ 2 才算骨架。
 *
 * ⚠️ 必须从**原始串**（未 normalizeModel）里取数字段：
 *   normalizeModel 会把 "980 (2016)" 去掉空格/括号变成 "9802016"（两段被粘连成一段），
 *   从归一化串里取数字段会得到 ["9802016"]，反而把年度括号误当骨架 ⇒ 误杀榜首 980。
 *   从原始串取则为 ["980","2016"]，存在性匹配下与库存 "980" 命中，正确放行。
 *   单数字段（如 "6R 250" 里的 "6"）视为噪声，过滤掉。
 */
function digitSkeletons(raw: string): string[] {
  return (String(raw ?? "").match(/\d+/g) ?? []).filter((r) => r.length >= 2);
}

/**
 * 规则③：候选的任一骨架 == 库存的任一骨架，或为库存骨架的上游前缀（用原始串判定）。
 * 正例：980(2016)→980、'BiG Pack 1290'→1290XC、'F 125 XC'→F125xc。
 * 反例：VB 3290→VbP3165、6R 250→7250、LX2204→LX2004、Magnum 380→420。
 */
function skeletonOk(candRaw: string, prodRaw: string): boolean {
  const a = digitSkeletons(candRaw);
  const b = digitSkeletons(prodRaw);
  if (!a.length) return true;   // 候选无骨架 → 规则③不适用（交给规则①④②）
  if (!b.length) return false;  // 候选有骨架、库存纯字母 → 拒绝
  for (const x of a) for (const y of b) if (x === y || y.startsWith(x)) return true;
  return false;
}

/** 规则①：首词是否"弱 token"（无数字或仅 1 位数字，且长度 ≤ 4） */
function isWeakFirstToken(rawListingModel: string): boolean {
  const first = String(rawListingModel ?? "").trim().split(/\s+/)[0] ?? "";
  const nf = normalizeModel(first);
  const digits = (nf.match(/\d/g) ?? []).length;
  // VB/MF/FR/BB(0位)、8R/6R/T7(1位) → weak；1290(4位) / 410(3位) 不 weak
  return nf.length > 0 && nf.length <= 4 && digits < 2;
}

function reject(c: MatchCandidate, rule: RejectRule, reason: string): ValidationResult {
  return { ok: false, rejection: { candidate: c, rule, reason } };
}

/**
 * 校验单条候选配对是否合法。
 * @returns ok=true 表示放行；ok=false 表示拒绝（含 rule 与 reason）。
 */
export function validateMatch(
  cand: MatchCandidate,
  state?: OneToManyState
): ValidationResult {
  const rawNorm = normalizeModel(cand.rawListingModel);

  // 白名单：整条放行（不区分规则）
  if (state?.allowlist?.has(`${cand.productId}::${rawNorm}`)) {
    return { ok: true };
  }

  // ④ 长度约束（最前置，成本最低）
  if (rawNorm.length < 2) {
    return reject(cand, "length", `候选规范化长度=${rawNorm.length} < 2`);
  }

  // ① 首词前缀禁令：仅当 step4（靠首词兜底）且首词为弱 token → 拒绝
  if (cand.viaStep === 4 && isWeakFirstToken(cand.rawListingModel)) {
    const first = String(cand.rawListingModel).trim().split(/\s+/)[0];
    return reject(
      cand,
      "first_token_prefix",
      `首词 "${first}" 为弱 token（无/单个数字且 ≤4），禁止 contains 兜底`
    );
  }

  // ③ 数字骨架一致性（用原始串取数字段，避免 normalizeModel 粘连）
  if (!skeletonOk(cand.rawListingModel, cand.productModelName)) {
    const a = digitSkeletons(cand.rawListingModel);
    const b = digitSkeletons(cand.productModelName);
    if (a.length && !b.length) {
      return reject(cand, "digit_skeleton", `候选骨架 ${a.join("/")}，库存无数字`);
    }
    return reject(
      cand,
      "digit_skeleton",
      `候选骨架 ${a.join("/")} ≠ 库存骨架 ${b.join("/")}（亦非其前缀）`
    );
  }

  // ② 一对多禁令（单次运行内）
  if (state) {
    const seen = state.seenByProduct.get(cand.productId) ?? new Set<string>();
    for (const prev of seen) {
      if (prev !== rawNorm) {
        return reject(
          cand,
          "one_to_many",
          `产品 ${cand.productId} 已被 "${prev}" 命中，又来了 "${rawNorm}"`
        );
      }
    }
    seen.add(rawNorm);
    state.seenByProduct.set(cand.productId, seen);
  }

  return { ok: true };
}
