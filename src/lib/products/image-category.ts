/**
 * 产品图片类别与排序权重（共享模块，零运行时依赖）
 *
 * 设计要点：
 * - 本文件刻意「重复定义」 prisma/schema.prisma 的 `ImageCategory` enum，而非从
 *   `@prisma/client` 引入，目的是保持叶子模块解耦：任何潜在客户端打包路径都不会被
 *   带进 Prisma 运行时 / Node 依赖；同时也避免与 schema 的强耦合导致改一处动全身。
 * - ⚠️ 同步约定：下方的枚举值、`IMAGE_CATEGORY_PRIORITY` 必须与
 *   `prisma/schema.prisma` 的 `enum ImageCategory` 及 `ProductImage.imageCategory`
 *   字段严格一致。改动任一侧都必须同步另一侧。
 *
 * 排序语义（老板诉求）：
 * - 仪表盘(DASHBOARD) 要排到型号铭牌(NAMEPLATE) 紧后面 = 第 3 位（原发布表单里排第 8）。
 * - 整机全貌(OVERALL) > 铭牌 > 仪表盘 > 其余；无类别的旧图排到最后。
 */

/** 图片类别枚举（与 prisma/schema.prisma 的 ImageCategory 值一一对应） */
export enum ImageCategory {
  OVERALL = "OVERALL",
  NAMEPLATE = "NAMEPLATE",
  DASHBOARD = "DASHBOARD",
  CAB = "CAB",
  ENGINE = "ENGINE",
  WORKING_MECHANISM = "WORKING_MECHANISM",
  CHASSIS = "CHASSIS",
  REAR = "REAR",
  FRONT_ATTACHMENT = "FRONT_ATTACHMENT",
  SIDE = "SIDE",
  DETAIL = "DETAIL",
  DAMAGE = "DAMAGE",
}

/** 类别排序权重：数字越小越靠前（铭牌/仪表盘永远排在最前） */
export const IMAGE_CATEGORY_PRIORITY: Record<ImageCategory, number> = {
  [ImageCategory.OVERALL]: 1,
  [ImageCategory.NAMEPLATE]: 2,
  [ImageCategory.DASHBOARD]: 3,
  [ImageCategory.CAB]: 4,
  [ImageCategory.ENGINE]: 5,
  [ImageCategory.WORKING_MECHANISM]: 6,
  [ImageCategory.CHASSIS]: 7,
  [ImageCategory.REAR]: 8,
  [ImageCategory.FRONT_ATTACHMENT]: 9,
  [ImageCategory.SIDE]: 10,
  [ImageCategory.DETAIL]: 11,
  [ImageCategory.DAMAGE]: 12,
};

/** 发布表单的拍摄引导顺序（仪表盘已排到第 3，紧挨型号铭牌之后） */
export const PHOTO_SUGGESTION_CATEGORIES: { label: string; category: ImageCategory }[] = [
  { label: "整机全貌", category: ImageCategory.OVERALL },
  { label: "型号铭牌", category: ImageCategory.NAMEPLATE },
  { label: "仪表盘", category: ImageCategory.DASHBOARD },
  { label: "驾驶室", category: ImageCategory.CAB },
  { label: "发动机舱", category: ImageCategory.ENGINE },
  { label: "作业机构", category: ImageCategory.WORKING_MECHANISM },
  { label: "轮毂底盘", category: ImageCategory.CHASSIS },
  { label: "后侧图", category: ImageCategory.REAR },
  { label: "前脸附件", category: ImageCategory.FRONT_ATTACHMENT },
  { label: "侧面全身", category: ImageCategory.SIDE },
  { label: "细节特写", category: ImageCategory.DETAIL },
  { label: "损伤部位", category: ImageCategory.DAMAGE },
];

/** 产品识别时的关键类别（铭牌 + 仪表盘缺失时要提醒） */
export const KEY_RECOGNITION_CATEGORIES = [
  ImageCategory.NAMEPLATE,
  ImageCategory.DASHBOARD,
] as const;

/** 无类别时的兜底权重：统一排在有类别的图片之后 */
const UNCATEGORIZED_PRIORITY = 999;

/**
 * 取某类别的排序权重。
 * @param c 图片类别，可能为 undefined / null（旧图无类别）
 * @returns 有类别返回对应权重；无类别返回兜底值 999（排最后）
 */
export function categoryPriority(c?: ImageCategory | null): number {
  if (c === undefined || c === null) return UNCATEGORIZED_PRIORITY;
  // 防御：若传入一个不在映射里的字符串也不至于崩（虽然类型上不该发生）
  return IMAGE_CATEGORY_PRIORITY[c] ?? UNCATEGORIZED_PRIORITY;
}

/**
 * 把图片数组按类别优先级升序重排（铭牌/仪表盘永远靠前），不修改入参。
 *
 * 排序键 = [类别权重, 原数组下标]：
 * - 同权重保持原相对顺序（等价于稳定排序，但不依赖引擎实现差异）；
 * - 无类别（imageCategory 为 undefined / null）统一落到最后（权重 999）。
 *
 * @template T 必须带可选 imageCategory 字段（与 schema 同步）
 * @param images 待排序的图片数组
 * @returns 排序后的新数组（入参不被改动）
 */
export function prioritizeKeyImages<T extends { imageCategory?: ImageCategory | null }>(
  images: T[]
): T[] {
  // 安全兜底：非数组直接返回空数组，避免下游崩
  if (!Array.isArray(images)) return [];
  return images
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const pa = categoryPriority(a.item.imageCategory);
      const pb = categoryPriority(b.item.imageCategory);
      if (pa !== pb) return pa - pb;
      return a.idx - b.idx; // 同权重保持原序
    })
    .map((entry) => entry.item);
}

/**
 * 把任意来源（请求体字符串 / Prisma 枚举值 / 未知值）安全归一化为 ImageCategory | null。
 * 非法值一律返回 null（不抛错、不静默放行未知类别）。
 */
export function toImageCategory(value: unknown): ImageCategory | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && (value as ImageCategory) in IMAGE_CATEGORY_PRIORITY) {
    return value as ImageCategory;
  }
  return null;
}
