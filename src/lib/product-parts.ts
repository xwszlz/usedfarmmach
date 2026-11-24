/**
 * 整机适配零部件分页查询（产品详情页 →「查看全部零部件」独立页）
 *
 * 与 parts-catalog.getCompatiblePartsForProduct 的区别：
 *  - 那个函数只取前 N 条用于详情页紧凑展示；
 *  - 本文件取「该整机的全部适配件」，支持机型/子系统/部件组/品牌/关键词筛选 + 分页 + 分面统计。
 *
 * 口径（与既有逻辑保持一致，优先级从高到低）：
 *  1. machine —— MachinePart 整机精选配对层（97 台二手农机配对数据，最精准）
 *  2. brand   —— CompatibleMachine 品牌级匹配（同品牌全部兼容件）
 *  3. generic —— 通用件兜底（GENERIC_PART_BRANDS 白名单，见 parts-catalog.ts）
 *  4. none    —— 无匹配
 *
 * 说明：配对层存在部分 partSource='part_legacy' 的历史件（PartLegacy 表，无四级分类），
 * 这里同样纳入结果，但其没有机型/子系统/部件组归属；一旦用户按层级筛选，它们自然被排除。
 */
import { prisma } from "@/lib/db";
import { GENERIC_PART_BRANDS } from "@/lib/parts-catalog";

export interface ProductPartItem {
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
  /** 历史件（PartLegacy）无四级分类，为 null */
  componentGroup: { code: string; nameZh: string; nameEn: string } | null;
  subSystem: { code: string; nameZh: string; nameEn: string } | null;
  machineType: { code: string; nameZh: string; nameEn: string } | null;
}

export interface PartFacetNode {
  code: string;
  nameZh: string;
  nameEn: string;
  count: number;
  children: PartFacetNode[];
}

export interface ProductPartsQuery {
  productId: string;
  brandEn: string;
  brandZh: string;
  page?: number;
  pageSize?: number;
  /** 机型 code；传 "__all__" 或空表示全部机型 */
  machineType?: string;
  subSystem?: string;
  componentGroup?: string;
  brand?: string;
  keyword?: string;
}

export interface ProductPartsResult {
  items: ProductPartItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** 当前结果集内出现的品牌（用于品牌下拉） */
  brands: string[];
  /** 机型 → 子系统 → 部件组 分面树（含数量，仅含非空节点） */
  facetTree: PartFacetNode[];
  /** 匹配口径 */
  matchedBy: "machine" | "brand" | "generic" | "none";
  /** 未筛选前的适配件总数 */
  scopeTotal: number;
  /** 当前结果集里出现过的机型（顶部分类 chips 用） */
  machineTypes: { code: string; nameZh: string; nameEn: string; count: number }[];
  /** 无四级分类归属的历史件数量（PartLegacy），用于「全部机型」计数对齐 */
  unclassified: number;
}

const HIERARCHY_SELECT = {
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
          machineType: { select: { code: true, nameZh: true, nameEn: true } },
        },
      },
    },
  },
};

/** 产品所属机型 code 归一化：品类 code → 配件机型 code（两边编码体系不同，见 prisma/master-data/category.json） */
const CATEGORY_TO_MACHINE_TYPE: Record<string, string> = {
  // 收获类
  cotton_harvester: "cotton_picker",
  combine: "combine_harvester",
  corn_harvester: "combine_harvester",
  corn_thresher: "combine_harvester",
  sugarcane_harvester: "sugarcane_harvester",
  potato_harvester: "potato_harvester",
  // 播种栽植
  seeding: "seeder",
  seed_drill: "seeder",
  planter: "seeder",
  planting: "transplanter",
  transplanter: "transplanter",
  // 植保
  spraying: "sprayer",
  sprayer: "sprayer",
  // 打捆
  baler: "baler",
  round_baler: "baler",
  square_baler: "baler",
  // 饲草
  forage_harvester: "forage_harvester",
  forage: "forage_equipment",
  hay_forage: "forage_equipment",
  mower: "forage_equipment",
  rake: "forage_equipment",
  tedder: "forage_equipment",
  // 耕整地
  tillage: "tillage",
  plow: "tillage",
  disc_harrow: "tillage",
  subsoiler: "tillage",
  // 拖拉机（细分品类统一归到 tractor）
  tractor: "tractor",
  tractor_compact: "tractor",
  tractor_mid: "tractor",
  tractor_high: "tractor",
  // 其他
  irrigation: "irrigation",
  grain_dryer: "grain_dryer",
  dryer: "grain_dryer",
};

export interface MachineTypeLike {
  code: string;
  nameZh: string;
  nameEn: string;
}

/**
 * 品类/产品名的中文同义词 → 配件机型 code。
 * 品类名与机型名并非总能对上（例如品类叫「青贮机」而机型叫「青储机」），
 * 这里显式列出口语/文件里的常见写法，避免漏判。
 */
const MACHINE_TYPE_NAME_SYNONYMS: Record<string, string[]> = {
  tractor: ["拖拉机"],
  combine_harvester: ["联合收割机", "谷物联合收割机", "收割机"],
  forage_harvester: ["青贮", "青储", "饲料收获机"],
  baler: ["打捆", "压捆"],
  transplanter: ["插秧机"],
  seeder: ["播种机", "条播机", "精量播种"],
  tillage: ["耕地", "圆盘耙", "深松", "整地", "犁"],
  sprayer: ["植保", "喷雾", "喷药"],
  grain_dryer: ["烘干机", "干燥机"],
  irrigation: ["灌溉", "喷灌", "滴灌"],
  forage_equipment: ["牧草", "割草机", "搂草机", "摊晒机", "打草机"],
  cotton_picker: ["采棉机", "棉花采摘"],
  sugarcane_harvester: ["甘蔗"],
  potato_harvester: ["土豆", "马铃薯"],
};

/**
 * 由产品品类推断其对应的配件机型 code。
 * 先查别名表，再用中文/英文名做包含匹配兜底；无法判断时返回 null（页面会展示全部机型配件）。
 */
export function resolveMachineTypeCode(input: {
  categoryCode?: string | null;
  categoryNameZh?: string | null;
  categoryNameEn?: string | null;
  machineTypes: MachineTypeLike[];
}): string | null {
  const { categoryCode, categoryNameZh, categoryNameEn, machineTypes } = input;
  const codes = machineTypes.map((m) => m.code);
  const exists = (code: string | null | undefined) => !!code && codes.includes(code);

  if (categoryCode && exists(CATEGORY_TO_MACHINE_TYPE[categoryCode])) {
    return CATEGORY_TO_MACHINE_TYPE[categoryCode];
  }
  if (categoryCode && exists(categoryCode)) return categoryCode;

  const zh = (categoryNameZh || "").trim();
  const en = (categoryNameEn || "").trim().toLowerCase();

  // 中文同义词优先（品类名与机型名写法不一致的情况）
  if (zh) {
    for (const [code, words] of Object.entries(MACHINE_TYPE_NAME_SYNONYMS)) {
      if (!exists(code)) continue;
      if (words.some((w) => zh.includes(w))) return code;
    }
  }

  // 名称双向包含匹配（品类名 vs 机型名，中文优先）
  if (zh) {
    const hit = machineTypes.find(
      (m) => m.nameZh && (zh.includes(m.nameZh) || m.nameZh.includes(zh))
    );
    if (hit) return hit.code;
  }
  if (en) {
    const hit = machineTypes.find((m) => {
      const n = (m.nameEn || "").toLowerCase();
      return n && (en.includes(n) || n.includes(en));
    });
    if (hit) return hit.code;
  }
  return null;
}

/** 解析该产品适配件范围 */
async function resolveScope(
  productId: string,
  brandEn: string,
  brandZh: string
): Promise<{
  matchedBy: "machine" | "brand" | "generic" | "none";
  partIds: string[] | null;
  legacyIds: string[];
  genericBrands: string[] | null;
}> {
  // 1. 整机精选配对层
  const paired = await prisma.machinePart.findMany({
    where: { machineId: productId },
    select: { partId: true, partSource: true },
    orderBy: [{ rank: "asc" }, { id: "asc" }],
  });
  if (paired.length > 0) {
    return {
      matchedBy: "machine",
      partIds: paired.filter((p) => p.partSource === "Part").map((p) => p.partId),
      legacyIds: paired.filter((p) => p.partSource !== "Part").map((p) => p.partId),
      genericBrands: null,
    };
  }

  // 2. 品牌级匹配
  const brandCandidates = [brandEn, brandZh].filter(Boolean);
  if (brandCandidates.length > 0) {
    const cm = await prisma.compatibleMachine.findMany({
      where: { brand: { in: brandCandidates } },
      select: { partId: true },
      distinct: ["partId"],
    });
    if (cm.length > 0) {
      return {
        matchedBy: "brand",
        partIds: cm.map((m) => m.partId),
        legacyIds: [],
        genericBrands: null,
      };
    }
  }

  // 3. 通用件兜底
  const genericCount = await prisma.part.count({
    where: {
      isActive: true,
      brand: { in: GENERIC_PART_BRANDS },
      images: { isEmpty: false },
    },
  });
  if (genericCount > 0) {
    return {
      matchedBy: "generic",
      partIds: null,
      legacyIds: [],
      genericBrands: GENERIC_PART_BRANDS,
    };
  }

  return { matchedBy: "none", partIds: [], legacyIds: [], genericBrands: null };
}

/** 关键词匹配（名称/品牌/OEM/SKU，忽略大小写） */
function hitKeyword(item: ProductPartItem, kw: string): boolean {
  const k = kw.toLowerCase();
  return (
    (item.nameZh || "").toLowerCase().includes(k) ||
    (item.nameEn || "").toLowerCase().includes(k) ||
    (item.nameRu || "").toLowerCase().includes(k) ||
    (item.brand || "").toLowerCase().includes(k) ||
    (item.oemNumber || "").toLowerCase().includes(k) ||
    (item.sku || "").toLowerCase().includes(k)
  );
}

/** 由结果集构建 机型 → 子系统 → 部件组 分面树 */
function buildFacetTree(items: ProductPartItem[]): PartFacetNode[] {
  const mtMap = new Map<string, PartFacetNode>();
  const ssKey = (mt: string, ss: string) => `${mt}||${ss}`;
  const cgKey = (mt: string, ss: string, cg: string) => `${mt}||${ss}||${cg}`;
  const ssIndex = new Map<string, PartFacetNode>();
  const cgIndex = new Map<string, PartFacetNode>();

  for (const it of items) {
    if (!it.machineType || !it.subSystem || !it.componentGroup) continue;
    const mt = it.machineType;
    const ss = it.subSystem;
    const cg = it.componentGroup;

    let mtNode = mtMap.get(mt.code);
    if (!mtNode) {
      mtNode = { code: mt.code, nameZh: mt.nameZh, nameEn: mt.nameEn, count: 0, children: [] };
      mtMap.set(mt.code, mtNode);
    }
    mtNode.count += 1;

    const sKey = ssKey(mt.code, ss.code);
    let ssNode = ssIndex.get(sKey);
    if (!ssNode) {
      ssNode = { code: ss.code, nameZh: ss.nameZh, nameEn: ss.nameEn, count: 0, children: [] };
      ssIndex.set(sKey, ssNode);
      mtNode.children.push(ssNode);
    }
    ssNode.count += 1;

    const cKey = cgKey(mt.code, ss.code, cg.code);
    let cgNode = cgIndex.get(cKey);
    if (!cgNode) {
      cgNode = { code: cg.code, nameZh: cg.nameZh, nameEn: cg.nameEn, count: 0, children: [] };
      cgIndex.set(cKey, cgNode);
      ssNode.children.push(cgNode);
    }
    cgNode.count += 1;
  }

  // 数量倒序，便于「配件最多的机型/系统」优先展示
  const sortNodes = (nodes: PartFacetNode[]) => {
    nodes.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
    nodes.forEach((n) => sortNodes(n.children));
  };
  const tree = Array.from(mtMap.values());
  sortNodes(tree);
  return tree;
}

/** 主查询：整机全部适配件（筛选 + 分页 + 分面） */
export async function getProductPartsPage(
  query: ProductPartsQuery
): Promise<ProductPartsResult> {
  const {
    productId,
    brandEn,
    brandZh,
    page = 1,
    pageSize = 12,
    machineType,
    subSystem,
    componentGroup,
    brand,
    keyword,
  } = query;

  const scope = await resolveScope(productId, brandEn, brandZh);

  const empty: ProductPartsResult = {
    items: [],
    total: 0,
    page: 1,
    pageSize,
    totalPages: 0,
    brands: [],
    facetTree: [],
    matchedBy: scope.matchedBy,
    scopeTotal: 0,
    machineTypes: [],
    unclassified: 0,
  };
  if (scope.matchedBy === "none") return empty;

  // 全量取回（Part 表 ≤ 千条量级），筛选/分面/分页在内存完成，避免多层 where 组合爆炸
  const partRows =
    scope.partIds === null
      ? await prisma.part.findMany({
          where: {
            isActive: true,
            brand: { in: scope.genericBrands ?? [] },
            images: { isEmpty: false },
          },
          select: HIERARCHY_SELECT,
          orderBy: [{ stockStatus: "asc" }, { createdAt: "desc" }],
        })
      : scope.partIds.length === 0
        ? []
        : await prisma.part.findMany({
            where: { isActive: true, id: { in: scope.partIds } },
            select: HIERARCHY_SELECT,
            orderBy: [{ stockStatus: "asc" }, { createdAt: "desc" }],
          });

  const legacyRows =
    scope.legacyIds.length > 0
      ? await prisma.partLegacy.findMany({
          where: { id: { in: scope.legacyIds }, isActive: true },
          select: {
            id: true,
            nameZh: true,
            nameEn: true,
            nameRu: true,
            brand: true,
            price: true,
            currency: true,
            stockStatus: true,
            images: true,
          },
        })
      : [];

  let items: ProductPartItem[] = partRows.map((p) => ({
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
    componentGroup: p.componentGroup
      ? {
          code: p.componentGroup.code,
          nameZh: p.componentGroup.nameZh,
          nameEn: p.componentGroup.nameEn,
        }
      : null,
    subSystem: p.componentGroup?.subSystem
      ? {
          code: p.componentGroup.subSystem.code,
          nameZh: p.componentGroup.subSystem.nameZh,
          nameEn: p.componentGroup.subSystem.nameEn,
        }
      : null,
    machineType: p.componentGroup?.subSystem?.machineType
      ? {
          code: p.componentGroup.subSystem.machineType.code,
          nameZh: p.componentGroup.subSystem.machineType.nameZh,
          nameEn: p.componentGroup.subSystem.machineType.nameEn,
        }
      : null,
  }));

  // 历史件追加在 Part 之后（无层级归属，仅在未按层级筛选时可见）
  for (const l of legacyRows) {
    items.push({
      id: l.id,
      sku: "",
      nameZh: l.nameZh,
      nameEn: l.nameEn,
      nameRu: l.nameRu,
      brand: l.brand,
      oemNumber: null,
      price: l.price,
      currency: l.currency,
      stockStatus: l.stockStatus,
      images: l.images,
      isOEM: false,
      componentGroup: null,
      subSystem: null,
      machineType: null,
    });
  }

  const scopeTotal = items.length;

  // 品牌 + 关键词先过滤（分面数量按此口径统计，保证 chips 与结果一致）
  let filtered = items;
  if (brand) filtered = filtered.filter((it) => it.brand === brand);
  if (keyword && keyword.trim()) {
    const kw = keyword.trim();
    filtered = filtered.filter((it) => hitKeyword(it, kw));
  }

  const brands = Array.from(new Set(filtered.map((it) => it.brand).filter(Boolean))).sort();
  const facetTree = buildFacetTree(filtered);
  const machineTypes = facetTree.map((n) => ({
    code: n.code,
    nameZh: n.nameZh,
    nameEn: n.nameEn,
    count: n.count,
  }));
  const classified = machineTypes.reduce((s, m) => s + m.count, 0);
  const unclassified = filtered.length - classified;

  // 层级筛选
  if (machineType && machineType !== "__all__") {
    filtered = filtered.filter((it) => it.machineType?.code === machineType);
  }
  if (subSystem) {
    filtered = filtered.filter((it) => it.subSystem?.code === subSystem);
  }
  if (componentGroup) {
    filtered = filtered.filter((it) => it.componentGroup?.code === componentGroup);
  }

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  const start = (safePage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    brands,
    facetTree,
    matchedBy: scope.matchedBy,
    scopeTotal,
    machineTypes,
    unclassified,
  };
}

/** 取全部机型（code / 中英文名，用于品类 → 机型归一化） */
export async function getMachineTypes(): Promise<MachineTypeLike[]> {
  const rows = await prisma.machineType.findMany({
    where: { isActive: true },
    select: { code: true, nameZh: true, nameEn: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows;
}

/**
 * 由「型号级兼容记录」反推机型：产品 modelName 的分词命中 CompatibleMachine.model 时，
 * 取命中配件的机型做多数表决。
 *
 * 用途：大量产品 category 为空（如 CLAAS ROLLANT 350 RC），品类映射失效，
 * 但兼容表的 model 字段（Quadrant 2200 / Lexion 770 …）能反推出机型，精度远高于品牌级。
 */
export async function inferMachineTypeFromCompatibleMachines(input: {
  brandEn?: string | null;
  brandZh?: string | null;
  modelName: string;
}): Promise<string | null> {
  const { brandEn, brandZh, modelName } = input;
  const brandCandidates = [brandEn, brandZh].filter(Boolean) as string[];
  const tokens = (modelName || "")
    .toUpperCase()
    .split(/[\s\-/]+/)
    .filter((t) => t.length >= 3);
  if (brandCandidates.length === 0 || tokens.length === 0) return null;

  const rows = await prisma.compatibleMachine.findMany({
    where: { brand: { in: brandCandidates } },
    select: { model: true, partId: true },
  });
  const hits = rows.filter((r) => {
    const m = (r.model || "").toUpperCase();
    return tokens.some((t) => m.includes(t));
  });
  if (hits.length === 0) return null;

  const parts = await prisma.part.findMany({
    where: { id: { in: Array.from(new Set(hits.map((h) => h.partId))) }, isActive: true },
    select: {
      componentGroup: {
        select: { subSystem: { select: { machineType: { select: { code: true } } } } },
      },
    },
  });

  const counter = new Map<string, number>();
  for (const p of parts) {
    const code = p.componentGroup?.subSystem?.machineType?.code;
    if (!code) continue;
    counter.set(code, (counter.get(code) || 0) + 1);
  }
  if (counter.size === 0) return null;

  return Array.from(counter.entries()).sort((a, b) => b[1] - a[1])[0][0];
}
