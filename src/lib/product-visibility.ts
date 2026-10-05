/**
 * 网站端产品可见性口径（单一事实来源 / single source of truth）
 *
 * 口径：`status='active'` 且 非(小程序账号 ∧ 国产品牌)
 *   ≡ status='active' AND (sellerId <> 小程序账号id OR brand.isImported = true)
 *
 * 为何用 sellerId（标量）而非嵌套 relation 的 seller.email：
 *   1) `User.email` 为**可空列**（schema：`email String?`）。旧实现用
 *      `{ NOT: { seller: { email: X } } }`，Prisma 生成形如
 *      `NOT (j.email = $1 AND j.id IS NOT NULL)`（LEFT JOIN）；当 email IS NULL 时，
 *      该谓词在 SQL 三值逻辑下求值为 NULL（而非 TRUE）→ 产品被**静默丢弃**。
 *   2) `Product.sellerId` 为 **NOT NULL** 列，`sellerId <> $1` 只会是 TRUE/FALSE，
 *      不存在 NULL，彻底规避三值逻辑陷阱。
 *
 * 安全退化：若查不到小程序账号（dbSellerId 为 null）→ 不排除任何人（只保留 active）。
 *           原则：宁可多显示，也绝不静默丢产品。
 *
 * 一致性：本函数为「网站端可见性」的唯一判定入口，`/api/products`（网站分支）与
 *         `/[locale]/products` 列表页（findMany / count）**必须**共用同一返回值，
 *         以保证页面计数与列表 API 口径完全一致。
 */
import type { Prisma } from "@prisma/client";

/** 小程序系统卖家账号邮箱（.com 可见性规则的判定键） */
export const MINIAPP_SELLER_EMAIL = "miniprogram@shendiao.com";

/**
 * 构造「网站端」产品可见性 where。
 *
 * @param dbSellerId 小程序系统卖家账号的 `User.id`；**查不到时传 null**。
 * @returns Prisma `ProductWhereInput`：`{ status:'active', OR:[{sellerId:{not:id}},{brand:{isImported:true}}] }`；
 *          当 `dbSellerId` 为 null 时退化为 `{ status:'active' }`（不排除任何人）。
 */
export function buildWebsiteVisibleWhere(
  dbSellerId: string | null
): Prisma.ProductWhereInput {
  // 安全退化：查不到小程序账号 → 不做任何排除
  if (!dbSellerId) {
    return { status: "active" };
  }
  return {
    status: "active",
    OR: [
      // 非小程序账号发布的 active 产品（含 .cn 网站新渠道）——sellerId 为 NOT NULL，无三值逻辑
      { sellerId: { not: dbSellerId } },
      // 小程序账号发布的国际品牌产品
      { brand: { isImported: true } },
    ],
  };
}
