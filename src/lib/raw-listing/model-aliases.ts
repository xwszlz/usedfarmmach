/**
 * 机型别名表（v1 常量文件，零 schema 变更）
 *
 * 俗称（马力俗称 / 行话）↔ 官方型号 的双向映射，供机型搜索展开。
 *
 * ✅ 映射已与老板确认（2026-10-11）：
 *  - 2504 / 2204 = CLAAS 拖拉机马力俗称（数字即马力档，如 2504≈250 马力级）
 *  - 9080 = 纽荷兰（NEW HOLLAND）大方捆打捆机（BB 系列）俗称
 *  - 850 经确认为 2504 的旧称，不再单列；历史数据若存为 "850"，导入时归一到 "2504" 即可被 "2504" 搜出
 */
export const MODEL_ALIASES: Record<string, string> = {
  "2504": "CLAAS AXION 2504",
  "2204": "CLAAS AXION 2204",
  "9080": "NEW HOLLAND BB 9080",
};

/**
 * 输入俗称或官方名 → 展开为可用于 `contains` 的候选串集合（双向）。
 * 调用方负责为返回的每一项构造 `{ modelName: { contains: t, mode: "insensitive" } }`。
 *
 * 展开逻辑：
 *  - 保留原输入（如 modelName 原样存 "2504"，搜索 "2504" 必中）；
 *  - 俗称 → 官方名（输入 "2504" 也能命中存了官方名的行）；
 *  - 官方名片段 → 俗称（输入 "AXION 2504" / "AXION" 也能命中存了 "2504" 的行）。
 */
export function expandModelQuery(input: string): string[] {
  const t = (input || "").trim();
  if (!t) return [];
  const out = new Set<string>([t]);
  const lower = t.toLowerCase();
  // 俗称 → 官方名
  if (MODEL_ALIASES[t]) out.add(MODEL_ALIASES[t]);
  if (MODEL_ALIASES[lower]) out.add(MODEL_ALIASES[lower]);
  // 反向：官方名片段 → 俗称
  for (const [alias, official] of Object.entries(MODEL_ALIASES)) {
    if (official.toLowerCase().includes(lower)) out.add(alias);
  }
  return Array.from(out);
}
