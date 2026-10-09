/**
 * T03：估值解析层 —— 主数据 code 解析
 *
 * 职责：将估值所需的「中文名 / 英文名」输入，转换成「主数据字典 code」，
 *       并回退权威因子（品牌保值系数、机型热度系数）。
 * 设计原则：纯只读查询；任何一步失败都降级为 null（交由名匹配路径兜底），绝不抛错。
 */

import { PrismaClient } from "@prisma/client";

export interface ResolvedValuationCodes {
  /** 品牌主数据 code（Brand.code）；未匹配为 null */
  brandCode: string | null;
  /** 品类主数据 code（Category.code）；未匹配为 null */
  categoryCode: string | null;
  /** 机型主数据 code（ModelDictionary.modelCode）；未匹配为 null */
  modelCode: string | null;
  /** 品牌权威保值系数（Brand.brandValueFactor）；未匹配为 null */
  brandValueFactor: number | null;
  /** 机型热度系数（ModelDictionary.modelPopularityFactor）；未匹配为 null */
  modelPopularityFactor: number | null;
  /** 匹配方式（debug 用） */
  matchMethod: string;
}

export interface ResolveCodesArgs {
  brandId?: string | null;
  categoryId?: string | null;
  brandName?: string | null;
  categoryName?: string | null;
  modelName?: string | null;
}

/**
 * 解析估值主数据 code。
 *
 * - brandId   → 直接查 Brand 拿权威 code 与 brandValueFactor；
 * - categoryId → 直接查 Category 拿 code；
 * - modelName → 在 ModelDictionary（isActive=true）中按 displayName 包含/被包含、
 *               或 modelCode token 匹配；若已知 brandCode 则优先同品牌命中。
 *
 * 返回结构绝不抛异常：任一步失败都把对应字段置 null，交由 formulas.ts 的名匹配回退，
 * 从而保证「解析不到 code」时估值数字与改造前完全一致（零回归）。
 */
export async function resolveValuationCodes(
  args: ResolveCodesArgs,
  prisma: PrismaClient
): Promise<ResolvedValuationCodes> {
  const result: ResolvedValuationCodes = {
    brandCode: null,
    categoryCode: null,
    modelCode: null,
    brandValueFactor: null,
    modelPopularityFactor: null,
    matchMethod: "none",
  };

  try {
    // 1) 品牌 code + 权威保值系数
    if (args.brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: args.brandId },
        select: { code: true, brandValueFactor: true },
      });
      if (brand) {
        result.brandCode = brand.code ?? null;
        result.brandValueFactor = brand.brandValueFactor ?? null;
      }
    }

    // 2) 品类 code
    if (args.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: args.categoryId },
        select: { code: true },
      });
      if (category) {
        result.categoryCode = category.code ?? null;
      }
    }

    // 3) 机型 code（ModelDictionary）
    if (args.modelName && args.modelName.trim().length > 0) {
      const name = args.modelName.trim();
      const nameLower = name.toLowerCase();
      const candidates = await prisma.modelDictionary.findMany({
        where: { isActive: true },
        select: {
          modelCode: true,
          displayName: true,
          brandCode: true,
          categoryCode: true,
          modelPopularityFactor: true,
        },
      });

      const matched = candidates.filter((m) => {
        const dn = m.displayName || "";
        const dnLower = dn.toLowerCase();
        const mcLower = (m.modelCode || "").toLowerCase();
        return (
          dn.includes(name) ||
          name.includes(dn) ||
          dnLower.includes(nameLower) ||
          nameLower.includes(mcLower) ||
          mcLower.includes(nameLower)
        );
      });

      // 已知品牌时，优先同品牌命中（降低跨品牌误匹配）
      let best = matched;
      if (result.brandCode && best.length > 1) {
        const byBrand = best.filter((m) => m.brandCode === result.brandCode);
        if (byBrand.length > 0) best = byBrand;
      }

      if (best.length > 0) {
        // 取 displayName 最长（最具体）的命中项
        best.sort(
          (a, b) => (b.displayName || "").length - (a.displayName || "").length
        );
        const m = best[0];
        result.modelCode = m.modelCode;
        result.modelPopularityFactor = m.modelPopularityFactor ?? null;
        result.matchMethod = "model_dictionary";
      } else {
        result.matchMethod = "model_not_found";
      }
    }
  } catch (err) {
    // 任何异常都降级，不影响主流程
    result.matchMethod = "error_fallback";
    // eslint-disable-next-line no-console
    console.warn("[resolveValuationCodes] 解析失败，回退名匹配:", err);
  }

  return result;
}
