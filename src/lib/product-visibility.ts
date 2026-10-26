/**
 * 网站端产品可见性口径（单一事实来源 / single source of truth）
 *
 * 口径（2026-10-26 老板拍板）：**`status='active'` —— 国产机同样上网站端。**
 *   此前按「小程序渠道 ∧ 国产品牌」隐藏，该过滤已整体取消：只要商品处于上架状态，
 *   网站列表 / 详情一律可见，不再区分卖家渠道与品牌产地。
 *
 * 历史沿革（留档，便于追溯）：
 *   - 早期：`status='active' AND 非(小程序渠道 ∧ 国产品牌)`，把小程序侧的国产机挡在网站外；
 *   - 2026-10-26：取消该过滤。实测 .cn 影响面只有 3 台（active 126 = 国际品牌 88 + 国产 38；
 *     系统账号发布 21 台，其中被隐藏的国产机 3 台；真实小程序用户发布数 0）。
 *
 * 关于 `dbSellerId` 入参：`/[locale]/products` 页面与 `/api/products` 仍按旧签名调用
 *   （各自查一次小程序系统账号 id）。入参**已不参与判定**，保留是为了让本次改动维持
 *   「只改判定、不动调用方」的最小面；后续清理时再把那次多余查询一并去掉。
 *
 * 安全底线（改动本函数前请守）：**宁可多显示，也绝不静默丢产品。**
 *   旧实现曾用 `{ NOT: { seller: { email: X } } }`，因 `User.email` 为可空列 + SQL 三值逻辑，
 *   把 `email IS NULL` 的产品静默丢弃。任何新增条件都必须避开"依赖可空列"的写法。
 *
 * 一致性：本函数为「网站端可见性」的唯一判定入口，`/api/products`（网站分支）与
 *         `/[locale]/products` 列表页（findMany / count）**必须**共用同一返回值，
 *         以保证页面计数与列表 API 口径完全一致。
 */
import type { Prisma } from "@prisma/client";

/**
 * 小程序系统卖家账号邮箱。
 *
 * ⚠️ 2026-10-26 起**不再用于可见性判定**（国产机已放开上网站端），仅保留导出以兼容
 * 既有调用方（`/[locale]/products` 与 `/api/products` 仍用它查一次 id 并传入
 * {@link buildWebsiteVisibleWhere}，该入参目前被忽略）。清理那次多余查询时一并移除本常量。
 */
export const MINIAPP_SELLER_EMAIL = "miniprogram@shendiao.com";

/**
 * 构造「网站端」产品可见性 where。
 *
 * @param dbSellerId 小程序系统卖家账号的 `User.id`；**已不参与判定**，仅为兼容既有调用方保留。
 * @returns Prisma `ProductWhereInput`：`{ status: 'active' }`（与入参无关）。
 */
export function buildWebsiteVisibleWhere(
  dbSellerId: string | null
): Prisma.ProductWhereInput {
  // 2026-10-26：老板拍板「国产机上网站端」⇒ 不再按「小程序渠道 × 国产品牌」过滤。
  // 保留入参是为了不动两个调用方（各自那次系统账号查询随后可一并清理）。
  void dbSellerId;
  return { status: "active" };
}

/**
 * 万能搜索条件（型号 / 品牌名 / 品类名 / 描述 / 位置）。
 *
 * 抽为**纯函数**以便单测；字段集合与匹配语义与 `api/products/route.ts` 原实现完全一致。
 */
export function buildSearchOrConditions(
  query: string
): Prisma.ProductWhereInput[] {
  return [
    { modelName: { contains: query, mode: "insensitive" } },
    { brand: { nameZh: { contains: query, mode: "insensitive" } } },
    { brand: { nameEn: { contains: query, mode: "insensitive" } } },
    { category: { nameZh: { contains: query, mode: "insensitive" } } },
    { category: { nameEn: { contains: query, mode: "insensitive" } } },
    { descriptionZh: { contains: query, mode: "insensitive" } },
    { descriptionEn: { contains: query, mode: "insensitive" } },
    { location: { contains: query, mode: "insensitive" } },
  ];
}

/**
 * 把「万能搜索」条件以 **AND** 语义叠加到既有 where 上（关键修复）。
 *
 * ⚠️ 旧实现 `where.OR = [...searchConditions]` 会**整体覆盖** where 的顶层 `OR`。
 * 历史上可见性 where 带一个顶层 `OR`（小程序渠道 × 国产品牌），被覆盖后 `?q=` 搜索
 * 会令可见性过滤失效、泄漏出本该隐藏的产品。2026-10-26 国产机放开后可见性已无 `OR`
 * （只剩 `status`），但**本函数仍必须用 AND 叠加**：否则会覆盖调用方已有的 `AND`
 * 子条件（brand / category / province 等），同样导致过滤失效。
 *
 * 现改为把搜索的 `OR` 作为**子条件** push 进顶层 `AND`，令「可见性」与「搜索」同时生效，
 * 且不覆盖 / 不丢失调用方已写入的其它 `AND` 子条件（brand / category / province / ...）。
 * AND 具交换律，子条件追加顺序不影响结果。
 *
 * @param where 既有 where（可能已含 status / 可见性 OR / 其它 AND 子条件）
 * @param query 搜索关键字；空值（`""` / `null` / `undefined`）→ 原样返回，不做任何改动
 * @returns 叠加搜索条件后的**新** where（不修改入参对象）
 */
export function applySearchQueryToWhere(
  where: Prisma.ProductWhereInput,
  query: string | null | undefined
): Prisma.ProductWhereInput {
  if (!query) return where;
  const rawAnd = where.AND;
  const existingAnd: Prisma.ProductWhereInput[] = Array.isArray(rawAnd)
    ? rawAnd
    : rawAnd
      ? [rawAnd]
      : [];
  return {
    ...where,
    AND: [...existingAnd, { OR: buildSearchOrConditions(query) }],
  };
}
