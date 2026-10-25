/**
 * AI 销售策略 · 区域聚合（T5）
 * ─────────────────────────────────────────────────────────
 * 纯函数模块：**零运行时依赖**（不 import prisma / pii / db），
 * 只依赖类型 + 同为纯函数的 grading.ts。
 *
 * 聚合口径：
 *   - 按 d.regions 展开：一个多地区经销商计入其每一个地区（不是只算一次）；
 *   - regions 为空 → 归入「未标注」；
 *   - 分级使用 resolveGrade(d, ctx)；
 *   - 排序：total 降序 → A 降序 → region 字典序。
 */
import type { DealerPublic } from "./types";
import { resolveGrade, type DealerGrade, type GradeContext } from "./grading";

/** 单个地区的聚合结果 */
export interface RegionStat {
  region: string;
  total: number;
  A: number;
  B: number;
  C: number;
}

/** regions 为空时的占位地区名 */
const UNKNOWN_REGION = "未标注";

/**
 * 按地区聚合经销商数量与 A/B/C 分级分布。
 *
 * @param dealers 经销商列表（境内 + 跨境）
 * @param ctx     可选产品上下文（透传给 resolveGrade，影响分级）
 * @returns RegionStat[]（已按 total↓ / A↓ / region 字典序排序）
 */
export function aggregateByRegion(dealers: DealerPublic[], ctx?: GradeContext): RegionStat[] {
  const map = new Map<string, RegionStat>();

  for (const d of dealers) {
    const regions = d.regions && d.regions.length > 0 ? d.regions : [UNKNOWN_REGION];
    const grade: DealerGrade = resolveGrade(d, ctx);
    for (const r of regions) {
      let stat = map.get(r);
      if (!stat) {
        stat = { region: r, total: 0, A: 0, B: 0, C: 0 };
        map.set(r, stat);
      }
      stat.total += 1;
      stat[grade] += 1;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.total - a.total || b.A - a.A || a.region.localeCompare(b.region)
  );
}
