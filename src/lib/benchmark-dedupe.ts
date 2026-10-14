/**
 * 品牌基准价去重工具（API 读层）
 *
 * 用途：防 cn-postgres（阿里云 RDS 北京）历史镜像残留导致的 BrandBenchmark 重复行。
 *   —— 整表从 Neon 镜像到 cn 时若未先清旧行，会出现同一 (brand, model, sourceSite)
 *      两行：一批 lastVerified=2026-08-20（旧镜像残留），一批 lastVerified=2026-10-11
 *      （id 与 Neon 完全相同，即本次正确镜像）。两行除 priceCny 小数舍入外完全一致，
 *      导致 /benchmark 看板「同一机型两行」、顶部卡片基准价条目/有效样本量被灌水、
 *      ④ 境内 vs 全球基准价差 intlByBrand 均价被双计。
 *
 * 本模块为纯函数（无副作用、不依赖 prisma、不改动输入顺序语义），供 API 读层与
 * 运维清除脚本 scripts/dedupe-benchmark.ts 复用同一套去重口径，保证线上线下口径一致。
 *
 * 分组键：`${brand}||${model}||${sourceSite}`
 *   —— 精确匹配、大小写敏感。例如 "CATAYA 3000 SUPER" 与 "Centaya 3000 Super"
 *      是两台不同机器，绝不可合并。
 *
 * 每组保留规则：
 *   1) 优先按 lastVerified 取最新一行；
 *   2) lastVerified 为空/无效时，回退按 updatedAt 比较；
 *   3) 两者都缺时，保留该组首个出现的行。
 *
 * 输出：保持「键首次出现的相对顺序」（依赖 Map 的首插顺序），不重排。
 */

/**
 * 去重函数约束的“品牌基准价行”最小公共形状。
 * lastVerified / updatedAt 允许为 Date、可解析字符串或空，以兼容 Prisma 全量对象与 select 子集。
 */
export interface BrandBenchmarkLike {
  brand: string;
  model: string;
  sourceSite: string;
  lastVerified?: Date | string | null;
  updatedAt?: Date | string | null;
}

/**
 * 计算单行的“有效时间戳”（毫秒），用于跨行比较谁更新。
 * 优先 lastVerified，其次 updatedAt；任一为有效 Date 或可解析字符串则采用，
 * 否则返回 null（表示“无时间可比较”，对应规则③）。
 */
function resolveEffectiveTime(row: BrandBenchmarkLike): number | null {
  const candidates: Array<Date | string | null | undefined> = [
    row.lastVerified,
    row.updatedAt,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const date = candidate instanceof Date ? candidate : new Date(candidate);
    const time = date.getTime();
    if (!Number.isNaN(time)) return time;
  }
  return null;
}

/**
 * 对品牌基准价数组按 (brand, model, sourceSite) 精确去重。
 *
 * @param rows 原始行数组（已按调用方既定 orderBy 排好序，本函数仅做分组、不重排）。
 * @returns 去重后的数组；长度 ≤ 输入长度，且任意两行不复用同一分组键。
 */
export function dedupeBrandBenchmark<T extends BrandBenchmarkLike>(rows: T[]): T[] {
  if (!Array.isArray(rows)) return [];
  // Map 天然保留“键首次插入”的顺序，满足“保持相对顺序、不重排”的要求。
  const groups = new Map<string, { row: T; time: number | null }>();

  for (const row of rows) {
    const brand = row.brand ?? "";
    const model = row.model ?? "";
    const sourceSite = row.sourceSite ?? "";
    const key = `${brand}||${model}||${sourceSite}`;
    const time = resolveEffectiveTime(row);

    const existing = groups.get(key);
    if (!existing) {
      // 首行：直接记为该组当前保留行。
      groups.set(key, { row, time });
    } else if (time !== null && (existing.time === null || time > existing.time)) {
      // 当前行时间更新（或旧行无时间、当前行有），替换保留行；
      // 时间相等或当前更早/无时间时，保留首行（规则③兜底）。
      groups.set(key, { row, time });
    }
    // 否则保持 existing 不变（保留先出现、且时间不更旧的行）。
  }

  return Array.from(groups.values()).map((g) => g.row);
}
