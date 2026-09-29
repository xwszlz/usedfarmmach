/**
 * ModelAlias 增量配置表（P0-2 / P0-6）
 *
 * 【为什么单独一个文件】
 *   1. 别名是"人肉知识"，PRD P0-6 要求逐条核验签字；数据与逻辑分离后，核验 diff
 *      只落在本文件，review 边界清晰。
 *   2. model-alias.ts 的 ALIAS_MAP 体量大、被多处 import，**不在原地改**；
 *      本文件的增量表由 model-alias.ts 通过 EFFECTIVE_ALIAS_MAP 叠加消费，旧表零改动。
 *   3. 🔴 强制核验：运行时**只采纳 status === "verified"** 的条目。
 *      AI 生成的候选必须默认 status: "pending"，由人工核验后改 "verified" 才生效。
 *
 * 硬约束：不新增 DB 表、不改 schema；本文件随代码部署即生效。
 */

export type AliasReviewStatus = "pending" | "verified" | "rejected";

/** 单条别名映射 + 核验留痕 */
export interface AliasEntry {
  /** 规范化别名（须为 normalizeModel() 之后的形态：小写、去所有非字母数字） */
  alias: string;
  /** 目标库存型号子串（用于 startsWith / === 匹配，如 "1290XC"） */
  standard: string;
  /** 核验状态：🔴 只有 "verified" 运行时生效 */
  status: AliasReviewStatus;
  /** 核验人（P0-6 依赖此角色） */
  verifiedBy?: string;
  /** 核验日期 YYYY-MM-DD */
  verifiedAt?: string;
  /** 依据（榜单型号 / 库内型号 / 判定说明） */
  note?: string;
}

/**
 * 增量别名表：brandSlug → 候选条目[]
 *
 * ⚠️ 以下 `standard` 值一律为占位 "TODO"、`status` 一律为 "pending"：
 *    AI **不拍板**其正确值（P0-6），须由业务核验后改为 "verified" 并填真实型号。
 *    当前全部 pending ⇒ 本表对运行时**无任何影响**（EFFECTIVE_ALIAS_MAP === ALIAS_MAP）。
 */
export const ALIAS_ADDITIONS: Record<string, AliasEntry[]> = {
  "john-deere": [
    { alias: "8r410", standard: "TODO", status: "pending", note: "榜单 8R 410 vs 库内 9996/L340/7660/6603/6950/7250/8400 —— 疑似无对应，待核验" },
    { alias: "6r250", standard: "TODO", status: "pending", note: "数字骨架 250 vs 7250 → 应拒绝（负样本）" },
  ],
  "new-holland": [
    { alias: "t7315", standard: "TODO", status: "pending", note: "榜单 T7.315 vs 库内 5070/fr9040/BR6090/500/550/870/9080 —— 待核验" },
    { alias: "fr920", standard: "TODO", status: "pending", note: "库内确有 fr9040；FR920 与 FR9040 是否同系列待核验" },
  ],
  krone: [
    { alias: "comprimav150xc", standard: "TODO", status: "pending", note: "榜单 Comprima V 150 XC vs 库内 F125xc/CF155XC/1290XC/1290xchdp —— 待核验" },
    // PRD 正样本：BiG Pack 1290 ✓ → 1290XC（待核验后置 verified）
    { alias: "bigpack1290", standard: "1290XC", status: "pending", note: "PRD 正样本（standard 已可填，但须人工核验后置 verified 才生效）" },
  ],
  dongfanghong: [
    { alias: "lx2204", standard: "TODO", status: "pending", note: "🔴 危险：榜单 LX2204 vs 库内 LX2004，数字接近但不等——数字骨架规则应拒绝" },
  ],
  "case-ih": [
    { alias: "magnum380", standard: "TODO", status: "pending", note: "库内仅 420/割草机 → 疑似 no_counterpart_product（P1-3），别名不生效" },
    { alias: "axialflow8240", standard: "TODO", status: "pending", note: "同上，疑似无对应" },
  ],
  "massey-ferguson": [
    { alias: "mf7700", standard: "TODO", status: "pending", note: "榜单 MF 7700 vs 库内 3404/1840P/1840S —— 待核验" },
    { alias: "8s305", standard: "TODO", status: "pending", note: "库内确有 8S.305（ALIAS_MAP 已含）—— 待核验" },
  ],
};

/**
 * 可规则化的系列前缀增量（追加到 SERIES_PREFIXES 尾部，不删旧项）。
 * TODO 人工核验后填入。
 */
export const SERIES_PREFIX_ADDITIONS: string[] = [];

/**
 * 把「已验证」的增量别名合并成 ALIAS_MAP 同构的只读表。
 * 只有 status === "verified" 的条目才进入结果。
 */
export function buildVerifiedAliasMap(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [slug, entries] of Object.entries(ALIAS_ADDITIONS)) {
    for (const e of entries) {
      if (e.status !== "verified") continue; // 🔴 未核验不生效
      if (!e.alias || !e.standard || e.standard === "TODO") continue; // 空/占位不生效
      (out[slug] ||= {})[e.alias] = e.standard;
    }
  }
  return out;
}

/**
 * 校验层白名单：`"<productId>::<normalizedRawModel>"`。
 *
 * 用途：若「既有 8 条已成功配对」中的某条被 P0-3 校验层误杀，**不放宽规则**，
 * 而是把该条登记到此处强制放行（dry-run 报告会单独列出）。默认空。
 */
export const VALIDATION_ALLOWLIST: Set<string> = new Set<string>([
  // 例： "clxxxxxxxxxxxx::bigpack1290",
]);
