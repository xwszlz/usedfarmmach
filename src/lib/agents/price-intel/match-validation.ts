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
 *   ② 一对多禁令：同一 productId 不得被 ≥ 2 个**语义不同**的 rawModel 命中（归一化后相同视为同一条）。
 *      ⚠️ 本函数仅在**显式传入 state** 时才做单次运行内的有状态拦截（供单测 / 只读审计用）；
 *         生产链路的跨条裁决已改由 agent 的 Pass 2「全局裁决」完成，以消除"边遍历边占坑"的顺序敏感。
 *   ③ 数字段一致性（定稿版：「集合成员 + 条件年度豁免」）：
 *      seg(s)    = String(s).match(/\d+/g) ?? []   // 全部数字段，**不做 length≥2 过滤**（单数字也参与）
 *      isYear(x) = /^(19|20)\d{2}$/.test(x)
 *      L = dedup(seg(候选)),  P = dedup(seg(库存))
 *        ① 对 L 中每个段 x：x ∈ P ⇒ 通过；x ∉ P 且 isYear(x) ⇒ 豁免；否则 ⇒ 拒绝
 *        ② 对 P 中每个段 y：y ∈ L ⇒ 通过；y ∉ L 且 isYear(y) ⇒ 豁免；否则 ⇒ 拒绝（对称，堵空集/年度绕过）
 *        ③ L 与 P 均为空 ⇒ 模糊步骤(3/4/5)拒绝；步骤 1/2 不受此判据约束
 *        ④ 成员判定 = **完全相等**（不做前缀）：`9` 与 `970` 不再互相通过
 *      ⚠️ 从**原始串**取数字段（normalizeModel 会把 "980 (2016)" 粘连成 "9802016"）。
 *   ④ 长度约束：候选规范化后长度 < 2 的必须丢弃。
 *
 * 【设计原则】
 *   - 纯函数、零 DB 依赖
 *   - 全部 additive：调用方拿不到通过则**拒绝该候选**而非放行；不改变既有匹配顺序
 *   - normalizeModel 直接复用 model-alias 的既有导出，避免两处实现漂移
 */
import { normalizeModel } from "@/lib/model-alias";

/** 匹配来源步（用于规则①的差异化适用与规则③的空集约束） */
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
 * 取原始串中的**全部**数字段（**不做 length ≥ 2 过滤**，单数字段也参与）。
 *
 * ⚠️ 必须从**原始串**（未 normalizeModel）里取数字段：
 *   normalizeModel 会把 "980 (2016)" 去掉空格/括号变成 "9802016"（两段被粘连成一段），
 *   从归一化串里取数字段会得到 ["9802016"]，反而把年度括号误当骨架 ⇒ 误杀榜首 980。
 *   从原始串取则为 ["980","2016"]，可分别判定"型号 980"与"年度 2016"。
 */
function allDigitSegments(raw: string): string[] {
  return String(raw ?? "").match(/\d+/g) ?? [];
}

/** 年份段判定：4 位纯数字且落在 19xx / 20xx（用于「条件豁免」） */
function isYearSegment(seg: string): boolean {
  return /^(19|20)\d{2}$/.test(seg);
}

/** 去重（成员判定用；顺序不影响语义） */
function dedup(list: string[]): string[] {
  return Array.from(new Set(list));
}

/**
 * 规则③（定稿）：数字段「集合成员 + 条件年度豁免」。
 *
 *   设 L = dedup(seg(候选))、P = dedup(seg(库存))。
 *   ① 候选每个段：∈P ⇒ 通过；∉P 且是年份 ⇒ 豁免；否则 ⇒ 拒绝。
 *   ② 库存每个段：∈L ⇒ 通过；∉L 且是年份 ⇒ 豁免；否则 ⇒ 拒绝（对称；堵住"候选空集/全年度"绕过）。
 *   ③ L、P 皆空 ⇒ 模糊步骤(3/4/5)拒绝；步骤 1/2 不受约束。
 *   ④ 成员 = 完全相等（**不做前缀**）：`9` 与 `970` 不互相通过；`BiG Pack 12` 不再命中 `1290`。
 *
 *   正例：980 (2016)→980（2016 年份豁免）、'Jaguar 970'→970、'Comprima F 125 XC'→F125xc。
 *   反例：'Rubin 9/300 U'→Rubin12/300u（9∉[12,300] 且非年份）、'Jaguar 9'→970、'BiG Pack 12'→1290、
 *         'Comprima F 12'→F125xc、LX2204→LX2004、Magnum 380→420。
 */
function skeletonOk(candRaw: string, prodRaw: string, viaStep: MatchStep): boolean {
  const L = dedup(allDigitSegments(candRaw));
  const P = dedup(allDigitSegments(prodRaw));
  // ③ 双边空集：模糊步骤一律拒绝（步骤 1/2 不约束）
  if (L.length === 0 && P.length === 0) return viaStep === 1 || viaStep === 2;
  // ① 候选每个数字段：成员 或 年度豁免
  for (const x of L) {
    if (P.includes(x)) continue;
    if (isYearSegment(x)) continue;
    return false;
  }
  // ② 库存每个数字段：成员 或 年度豁免（对称）
  for (const y of P) {
    if (L.includes(y)) continue;
    if (isYearSegment(y)) continue;
    return false;
  }
  return true;
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

  // ③ 数字段一致性（定稿：集合成员 + 条件年度豁免；用原始串取数字段，避免 normalizeModel 粘连）
  if (!skeletonOk(cand.rawListingModel, cand.productModelName, cand.viaStep)) {
    const L = dedup(allDigitSegments(cand.rawListingModel));
    const P = dedup(allDigitSegments(cand.productModelName));
    if (L.length === 0 && P.length === 0) {
      return reject(
        cand,
        "digit_skeleton",
        `候选与库存均无数字段（模糊步骤 step${cand.viaStep} 拒绝）`
      );
    }
    return reject(
      cand,
      "digit_skeleton",
      `候选数字段 [${L.join("/")}] 与库存 [${P.join("/")}] 不满足「成员相等/年度豁免」`
    );
  }

  // ② 一对多禁令（仅当显式传入 state 时；生产链路已改由 agent Pass 2 全局裁决）
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
