/**
 * 配件分类数据访问层
 *
 * 封装四级分类体系的查询逻辑：
 * - getCatalogTree(): 导航树（MachineType → SubSystem → ComponentGroup + partCount）
 * - getParts(): 多级筛选查询，返回配件列表 + 分页 + 品牌聚合
 * - getPartById(): 配件详情，含层级关系 + 兼容机型
 * - getRelatedParts(): 同部件组的关联配件
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { PartCardData } from "@/components/parts/PartCard";

// ─── 类型定义 ───────────────────────────────────────────

export interface CatalogTreeNode {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  sortOrder: number;
  subSystems: CatalogSubSystemNode[];
}

export interface CatalogSubSystemNode {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  sortOrder: number;
  componentGroups: CatalogComponentGroupNode[];
}

export interface CatalogComponentGroupNode {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  sortOrder: number;
  partCount: number;
}

export interface PartListFilters {
  machineType?: string;
  subSystem?: string;
  componentGroup?: string;
  brand?: string;
  keyword?: string;
  stockStatus?: string;
  page: number;
  pageSize: number;
}

export interface PartListItem {
  id: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  nameRu: string;
  brand: string;
  oemNumber: string | null;
  price: number;
  currency: string;
  stockStatus: string;
  images: string[];
  isOEM: boolean;
  componentGroup: { code: string; nameZh: string; nameEn: string };
  subSystem: { code: string; nameZh: string; nameEn: string };
  machineType: { code: string; nameZh: string; nameEn: string };
}

export interface PartDetail {
  id: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  nameRu: string;
  brand: string;
  oemNumber: string | null;
  price: number;
  currency: string;
  stockStatus: string;
  images: string[];
  descriptionZh: string | null;
  descriptionEn: string | null;
  descriptionRu: string | null;
  specs: Prisma.JsonValue | null;
  isOEM: boolean;
  isAftermarket: boolean;
  dataQuality: string;
  componentGroupId: string;
  componentGroup: { code: string; nameZh: string; nameEn: string };
  subSystem: { code: string; nameZh: string; nameEn: string };
  machineType: { code: string; nameZh: string; nameEn: string };
  compatibleMachines: {
    id: string;
    brand: string;
    model: string;
    yearRange: string | null;
    notes: string | null;
  }[];
}

// ─── 查询函数 ───────────────────────────────────────────

/**
 * 获取完整导航树（四级分类结构）
 * 只返回 isActive 的节点，每个 ComponentGroup 附带 partCount
 */
export async function getCatalogTree(): Promise<CatalogTreeNode[]> {
  const machineTypes = await prisma.machineType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      subSystems: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          componentGroups: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              _count: {
                select: { parts: { where: { isActive: true } } },
              },
            },
          },
        },
      },
    },
  });

  return machineTypes.map((mt) => ({
    id: mt.id,
    code: mt.code,
    nameZh: mt.nameZh,
    nameEn: mt.nameEn,
    sortOrder: mt.sortOrder,
    subSystems: mt.subSystems.map((ss) => ({
      id: ss.id,
      code: ss.code,
      nameZh: ss.nameZh,
      nameEn: ss.nameEn,
      sortOrder: ss.sortOrder,
      componentGroups: ss.componentGroups.map((cg) => ({
        id: cg.id,
        code: cg.code,
        nameZh: cg.nameZh,
        nameEn: cg.nameEn,
        sortOrder: cg.sortOrder,
        partCount: cg._count.parts,
      })),
    })),
  }));
}

/**
 * 多级筛选查询配件列表
 * 返回配件列表 + 分页信息 + 品牌聚合
 */
export async function getParts(filters: PartListFilters): Promise<{
  parts: PartListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  brands: string[];
}> {
  const {
    machineType,
    subSystem,
    componentGroup,
    brand,
    keyword,
    stockStatus,
    page,
    pageSize,
  } = filters;

  // 构建 Prisma where 条件
  const where: Prisma.PartWhereInput = { isActive: true };

  // 多级筛选：通过 relation 链
  if (componentGroup) {
    where.componentGroup = {
      code: componentGroup,
      isActive: true,
      ...(subSystem || machineType
        ? {
            subSystem: {
              isActive: true,
              ...(subSystem ? { code: subSystem } : {}),
              ...(machineType
                ? {
                    machineType: { code: machineType, isActive: true },
                  }
                : {}),
            },
          }
        : {}),
    };
  } else if (subSystem) {
    where.componentGroup = {
      isActive: true,
      subSystem: {
        code: subSystem,
        isActive: true,
        ...(machineType
          ? { machineType: { code: machineType, isActive: true } }
          : {}),
      },
    };
  } else if (machineType) {
    where.componentGroup = {
      isActive: true,
      subSystem: {
        isActive: true,
        machineType: { code: machineType, isActive: true },
      },
    };
  }

  // 品牌筛选
  if (brand) {
    where.brand = brand;
  }

  // 库存状态筛选
  if (stockStatus && stockStatus !== "all") {
    where.stockStatus = stockStatus;
  }

  // 关键词搜索
  if (keyword && keyword.trim()) {
    const kw = keyword.trim();
    where.OR = [
      { nameZh: { contains: kw, mode: "insensitive" } },
      { nameEn: { contains: kw, mode: "insensitive" } },
      { nameRu: { contains: kw, mode: "insensitive" } },
      { brand: { contains: kw, mode: "insensitive" } },
      { oemNumber: { contains: kw, mode: "insensitive" } },
      { sku: { contains: kw, mode: "insensitive" } },
    ];
  }

  // 品牌聚合：排除品牌筛选条件，显示当前分类下所有可用品牌
  const brandAggWhere: Prisma.PartWhereInput = { ...where };
  delete brandAggWhere.brand;

  // 并行查询：配件列表 + 总数 + 品牌聚合
  const [parts, total, brandAgg] = await Promise.all([
    prisma.part.findMany({
      where,
      orderBy: [{ stockStatus: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sku: true,
        nameZh: true,
        nameEn: true,
        nameRu: true,
        brand: true,
        oemNumber: true,
        price: true,
        currency: true,
        stockStatus: true,
        images: true,
        isOEM: true,
        componentGroup: {
          select: {
            code: true,
            nameZh: true,
            nameEn: true,
            subSystem: {
              select: {
                code: true,
                nameZh: true,
                nameEn: true,
                machineType: {
                  select: { code: true, nameZh: true, nameEn: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.part.count({ where }),
    prisma.part.findMany({
      where: brandAggWhere,
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    }),
  ]);

  // 转换为扁平结构
  const partListItems: PartListItem[] = parts.map((p) => ({
    id: p.id,
    sku: p.sku,
    nameZh: p.nameZh,
    nameEn: p.nameEn,
    nameRu: p.nameRu,
    brand: p.brand,
    oemNumber: p.oemNumber,
    price: p.price,
    currency: p.currency,
    stockStatus: p.stockStatus,
    images: p.images,
    isOEM: p.isOEM,
    componentGroup: {
      code: p.componentGroup.code,
      nameZh: p.componentGroup.nameZh,
      nameEn: p.componentGroup.nameEn,
    },
    subSystem: {
      code: p.componentGroup.subSystem.code,
      nameZh: p.componentGroup.subSystem.nameZh,
      nameEn: p.componentGroup.subSystem.nameEn,
    },
    machineType: {
      code: p.componentGroup.subSystem.machineType.code,
      nameZh: p.componentGroup.subSystem.machineType.nameZh,
      nameEn: p.componentGroup.subSystem.machineType.nameEn,
    },
  }));

  const brands = brandAgg.map((b) => b.brand).filter(Boolean);

  return {
    parts: partListItems,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    brands,
  };
}

/**
 * 获取配件详情（含层级关系 + 兼容机型）
 */
export async function getPartById(id: string): Promise<PartDetail | null> {
  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      compatibleMachines: {
        orderBy: [{ brand: "asc" }, { model: "asc" }],
      },
      componentGroup: {
        select: {
          code: true,
          nameZh: true,
          nameEn: true,
          subSystem: {
            select: {
              code: true,
              nameZh: true,
              nameEn: true,
              machineType: {
                select: { code: true, nameZh: true, nameEn: true },
              },
            },
          },
        },
      },
    },
  });

  if (!part) return null;

  return {
    id: part.id,
    sku: part.sku,
    nameZh: part.nameZh,
    nameEn: part.nameEn,
    nameRu: part.nameRu,
    brand: part.brand,
    oemNumber: part.oemNumber,
    price: part.price,
    currency: part.currency,
    stockStatus: part.stockStatus,
    images: part.images,
    descriptionZh: part.descriptionZh,
    descriptionEn: part.descriptionEn,
    descriptionRu: part.descriptionRu,
    specs: part.specs,
    isOEM: part.isOEM,
    isAftermarket: part.isAftermarket,
    dataQuality: part.dataQuality,
    componentGroupId: part.componentGroupId,
    componentGroup: {
      code: part.componentGroup.code,
      nameZh: part.componentGroup.nameZh,
      nameEn: part.componentGroup.nameEn,
    },
    subSystem: {
      code: part.componentGroup.subSystem.code,
      nameZh: part.componentGroup.subSystem.nameZh,
      nameEn: part.componentGroup.subSystem.nameEn,
    },
    machineType: {
      code: part.componentGroup.subSystem.machineType.code,
      nameZh: part.componentGroup.subSystem.machineType.nameZh,
      nameEn: part.componentGroup.subSystem.machineType.nameEn,
    },
    compatibleMachines: part.compatibleMachines.map((cm) => ({
      id: cm.id,
      brand: cm.brand,
      model: cm.model,
      yearRange: cm.yearRange,
      notes: cm.notes,
    })),
  };
}

/**
 * 产品详情页「适配零部件」查询
 *
 * 匹配策略（运行时，双层）：
 * 1. 品牌级：CM.brand 与产品品牌名（nameEn/nameZh）精确匹配，取该品牌全部兼容配件
 * 2. 兜底：品牌无匹配时，返回通用配件（有 compatibleMachines 记录但品牌不特定，
 *    或按 componentGroup 归类的通用件，如液压/电气/润滑等）
 *
 * 产品 modelName 与 CM.model（完整型号如 "Lexion 770"）不重叠，不做型号级匹配
 * （2026-08-06 数据核查结论：精确=0，品牌级=20/25，无=5/25）。
 */
export async function getCompatiblePartsForProduct(params: {
  brandEn: string;
  brandZh: string;
  modelName: string;
  limit?: number;
}): Promise<{
  parts: PartListItem[];
  matchedBy: "brand" | "generic" | "none";
  matchDetail: { brand: string; model: string } | null;
}> {
  const { brandEn, brandZh, modelName, limit = 8 } = params;

  // 候选品牌名（英文优先，中文兜底）
  const brandCandidates = [brandEn, brandZh].filter(Boolean);

  // 品牌级匹配：CM.brand 命中任一候选品牌
  const brandMatched = await prisma.compatibleMachine.findMany({
    where: { brand: { in: brandCandidates } },
    select: { partId: true },
    distinct: ["partId"],
  });

  if (brandMatched.length > 0) {
    const partIds = brandMatched.map((m) => m.partId);
    const parts = await prisma.part.findMany({
      where: { id: { in: partIds }, isActive: true },
      orderBy: [{ stockStatus: "asc" }, { createdAt: "desc" }],
      take: limit,
      select: PART_LIST_SELECT,
    });
    return {
      parts: parts.map(mapPartListItem),
      matchedBy: "brand",
      matchDetail: { brand: brandEn || brandZh, model: modelName },
    };
  }

  // 兜底：通用配件（品牌为通用件品牌，如 SKF / Bosch / 通用）
  const GENERIC_BRANDS = ["SKF", "Bosch", "通用", "Generic", "Standard"];
  const genericMatched = await prisma.part.findMany({
    where: {
      isActive: true,
      brand: { in: GENERIC_BRANDS },
    },
    orderBy: [{ stockStatus: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: PART_LIST_SELECT,
  });

  if (genericMatched.length > 0) {
    return {
      parts: genericMatched.map(mapPartListItem),
      matchedBy: "generic",
      matchDetail: { brand: brandEn || brandZh, model: modelName },
    };
  }

  return {
    parts: [],
    matchedBy: "none",
    matchDetail: { brand: brandEn || brandZh, model: modelName },
  };
}

// ─── PartListItem 查询/映射公共片段 ───────────────────────

const PART_LIST_SELECT = {
  id: true,
  sku: true,
  nameZh: true,
  nameEn: true,
  nameRu: true,
  brand: true,
  oemNumber: true,
  price: true,
  currency: true,
  stockStatus: true,
  images: true,
  isOEM: true,
  componentGroup: {
    select: {
      code: true,
      nameZh: true,
      nameEn: true,
      subSystem: {
        select: {
          code: true,
          nameZh: true,
          nameEn: true,
          machineType: {
            select: { code: true, nameZh: true, nameEn: true },
          },
        },
      },
    },
  },
} satisfies Prisma.PartSelect;

function mapPartListItem(p: {
  id: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  nameRu: string;
  brand: string;
  oemNumber: string | null;
  price: number;
  currency: string;
  stockStatus: string;
  images: string[];
  isOEM: boolean;
  componentGroup: {
    code: string;
    nameZh: string;
    nameEn: string;
    subSystem: {
      code: string;
      nameZh: string;
      nameEn: string;
      machineType: { code: string; nameZh: string; nameEn: string };
    };
  };
}): PartListItem {
  return {
    id: p.id,
    sku: p.sku,
    nameZh: p.nameZh,
    nameEn: p.nameEn,
    nameRu: p.nameRu,
    brand: p.brand,
    oemNumber: p.oemNumber,
    price: p.price,
    currency: p.currency,
    stockStatus: p.stockStatus,
    images: p.images,
    isOEM: p.isOEM,
    componentGroup: {
      code: p.componentGroup.code,
      nameZh: p.componentGroup.nameZh,
      nameEn: p.componentGroup.nameEn,
    },
    subSystem: {
      code: p.componentGroup.subSystem.code,
      nameZh: p.componentGroup.subSystem.nameZh,
      nameEn: p.componentGroup.subSystem.nameEn,
    },
    machineType: {
      code: p.componentGroup.subSystem.machineType.code,
      nameZh: p.componentGroup.subSystem.machineType.nameZh,
      nameEn: p.componentGroup.subSystem.machineType.nameEn,
    },
  };
}

/**
 * 获取同部件组的关联配件（用于详情页推荐）
 */
export async function getRelatedParts(
  componentGroupId: string,
  excludeId: string,
  limit: number = 4
): Promise<PartListItem[]> {
  const parts = await prisma.part.findMany({
    where: {
      componentGroupId,
      isActive: true,
      id: { not: excludeId },
    },
    orderBy: [{ stockStatus: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      sku: true,
      nameZh: true,
      nameEn: true,
      nameRu: true,
      brand: true,
      oemNumber: true,
      price: true,
      currency: true,
      stockStatus: true,
      images: true,
      isOEM: true,
      componentGroup: {
        select: {
          code: true,
          nameZh: true,
          nameEn: true,
          subSystem: {
            select: {
              code: true,
              nameZh: true,
              nameEn: true,
              machineType: {
                select: { code: true, nameZh: true, nameEn: true },
              },
            },
          },
        },
      },
    },
  });

  return parts.map((p) => ({
    id: p.id,
    sku: p.sku,
    nameZh: p.nameZh,
    nameEn: p.nameEn,
    nameRu: p.nameRu,
    brand: p.brand,
    oemNumber: p.oemNumber,
    price: p.price,
    currency: p.currency,
    stockStatus: p.stockStatus,
    images: p.images,
    isOEM: p.isOEM,
    componentGroup: {
      code: p.componentGroup.code,
      nameZh: p.componentGroup.nameZh,
      nameEn: p.componentGroup.nameEn,
    },
    subSystem: {
      code: p.componentGroup.subSystem.code,
      nameZh: p.componentGroup.subSystem.nameZh,
      nameEn: p.componentGroup.subSystem.nameEn,
    },
    machineType: {
      code: p.componentGroup.subSystem.machineType.code,
      nameZh: p.componentGroup.subSystem.machineType.nameZh,
      nameEn: p.componentGroup.subSystem.machineType.nameEn,
    },
  }));
}

/**
 * 整机精选配对层查询（MachinePart）
 *
 * 优先于 getCompatiblePartsForProduct 使用：返回该机器人工/脚本配对的
 * 全部适配配件（97 台二手农机配对层）。
 * 通过 partSource + partId 运行时关联 Part / PartLegacy，映射为 PartCardData。
 * 若该产品无配对记录，返回空数组，由调用方回退到品牌/通用件匹配。
 */
export async function getMachinePairedParts(
  productId: string,
  limit = 200
): Promise<PartCardData[]> {
  const rows = await prisma.machinePart.findMany({
    where: { machineId: productId },
    orderBy: [{ rank: "asc" }, { id: "asc" }],
    take: limit,
  });
  if (rows.length === 0) return [];

  const partIds = rows.filter((r) => r.partSource === "Part").map((r) => r.partId);
  const legacyIds = rows
    .filter((r) => r.partSource === "part_legacy")
    .map((r) => r.partId);

  const [partRows, legacyRows] = await Promise.all([
    partIds.length
      ? prisma.part.findMany({ where: { id: { in: partIds } } })
      : Promise.resolve([] as any[]),
    legacyIds.length
      ? prisma.partLegacy.findMany({ where: { id: { in: legacyIds } } })
      : Promise.resolve([] as any[]),
  ]);

  const partMap = new Map(partRows.map((p) => [p.id, p as any]));
  const legacyMap = new Map(legacyRows.map((p) => [p.id, p as any]));

  const out: PartCardData[] = [];
  for (const r of rows) {
    const p = r.partSource === "Part" ? partMap.get(r.partId) : legacyMap.get(r.partId);
    if (!p) continue;
    out.push({
      id: p.id,
      sku: p.sku ?? "",
      nameZh: p.nameZh,
      nameEn: p.nameEn ?? "",
      nameRu: p.nameRu ?? "",
      brand: p.brand,
      oemNumber: p.oemNumber ?? null,
      price: p.price,
      currency: p.currency ?? "CNY",
      stockStatus: p.stockStatus ?? "in_stock",
      images: p.images ?? [],
      isOEM: p.isOEM ?? false,
    });
  }
  return out;
}
