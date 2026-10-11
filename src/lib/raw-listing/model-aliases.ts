/**
 * 机型别名表（v1 常量文件，零 schema 变更）
 *
 * 俗称（马力俗称 / 行话）↔ 官方型号 的双向映射，供机型搜索展开。
 *
 * ⚠️ 占位说明（数据活儿，待老板确认）：
 *  - 2504 / 2204 = CLAAS 拖拉机马力俗称（数字即马力档，如 2504≈250 马力级）
 *  - 850  = 克拉斯（CLAAS）青贮机（forage harvester）俗称
 *  - 9080 = 纽荷兰（NEW HOLLAND）打捆机俗称
 *  下列官方型号为**合理占位**，真实官方型号（含准确系列名）待老板拍板后替换。
 *  TODO(老板确认): 替换下方官方型号为厂商官方命名；并补充缺失的俗称/官方对。
 */
export const MODEL_ALIASES: Record<string, string> = {
  // TODO(老板确认): 2504/2204 为 CLAAS 拖拉机马力俗称，官方系列名待确认
  "2504": "CLAAS AXION 2504",
  "2204": "CLAAS AXION 2204",
  // TODO(老板确认): 850 为克拉斯（CLAAS）青贮机俗称，官方型号待确认
  "850": "CLAAS JAGUAR 850",
  // TODO(老板确认): 9080 为纽荷兰（NEW HOLLAND）打捆机俗称，官方型号待确认
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
