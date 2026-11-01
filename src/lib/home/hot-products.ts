import type { Prisma } from "@prisma/client";

/**
 * 首页热门产品排序契约。
 *
 * 首页无头条位，取量必须等于卡片位数量。
 * （原因：`<HeroSection topProduct={...} />` 在 aadeb32「网站Phase1视觉布局重组」已从首页移除，
 *  `topProduct` 自此是「取出来又丢掉」的死代码。原契约 take:5 + slice(1,5) 建立在
 *  「第 1 位是头条位」的错误假设上，后果是浏览量第 1 的机器被跳过头名、仅 17 次浏览的反而上卡，
 *  与「显示最值得看的四台」完全相反。取多少就显示多少，禁止多取再丢弃。）
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

/** 首页卡片位数量（四列网格） */
export const HOME_CARD_COUNT = 4;

/**
 * 查询取量 = 卡片位数量。
 *
 * 首页没有独立的「头条位」（HeroSection 在 aadeb32 已从首页移除），
 * 所以取多少就显示多少，不能多取再丢弃 —— 否则浏览量第 1 的机器会被跳过。
 */
export const HOME_PRODUCT_TAKE = HOME_CARD_COUNT;

/**
 * 首页四卡片 = 浏览量最高的前 4 台（不跳过第 1 名）。
 *
 * 纯函数，保持输入顺序不变（调用方必须已按 HOME_PRODUCT_ORDER_BY 排序）。
 * 不足 4 行时自然收敛（3 行给 3 台）；0 行返回空数组而不是 undefined。
 *
 * @param rows 已排序的产品行
 * @returns 前 HOME_CARD_COUNT 个元素组成的新数组
 */
export function pickHomeCards<T>(rows: T[]): T[] {
  return rows.slice(0, HOME_CARD_COUNT);
}
