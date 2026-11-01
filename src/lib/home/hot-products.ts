import type { Prisma } from "@prisma/client";

/**
 * 首页热门产品排序契约。
 *
 * 老板 2026-11-01 拍板：全动态排名、真实热度稳定收敛、不接入 promotedUntil
 * （付费置顶字段 promotedUntil 目前系统里 0 条数据在用，暂不参与排序）。
 *
 * 三级排序，末级 id 是稳定键 —— 避免 viewCount 并列时数据库返回顺序不确定，
 * 表现为「刷新一次排名就变」。
 *
 * 主键 viewCount DESC：真实浏览量（133 个 active 产品里 105 个有数据）
 * 次键 createdAt DESC：新品加权
 * 末键 id        DESC：稳定键，杜绝同分随机跳动
 */
export const HOME_PRODUCT_ORDER_BY: Prisma.ProductOrderByWithRelationInput[] = [
  { viewCount: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
];

/** 首页取量：1 个头条位 + 4 个卡片位 */
export const HOME_PRODUCT_TAKE = 5;

/** 四卡片位数量（头条位之外） */
export const HOME_CARD_COUNT = 4;

/**
 * 把有序结果切成「头条 1 台 + 四卡片 4 台」。
 *
 * 纯函数，保持输入顺序不变（调用方必须已按 HOME_PRODUCT_ORDER_BY 排序）。
 * 不足 5 行时自然收敛：3 行 → 头条 1 + 卡片 2；1 行 → 头条 1 + 卡片 0；
 * 0 行 → 头条 null + 卡片空数组。
 *
 * @param rows 已排序的产品行
 * @returns top 为首位（无数据时为 null），hot 为第 2~5 位（最多 4 个）
 */
export function splitHomeProducts<T>(rows: T[]): { top: T | null; hot: T[] } {
  return { top: rows[0] ?? null, hot: rows.slice(1, 1 + HOME_CARD_COUNT) };
}
