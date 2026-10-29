/**
 * 产品详情页编辑权限（统一判定）
 *
 * 背景（2026-10-29 产品方拍板）：
 *   - 所有注册登录用户 → 可以编辑**自己发布**的产品详情页，含图片、视频；
 *   - `editor` 角色（以及 admin / super_admin）→ 可以编辑**全站任意**产品的详情页，含图片、视频。
 *
 * 之前的实现是「一刀切」：`/api/products/[id]` 等接口只认 admin/super_admin/editor，
 * 普通卖家连自己的图片/视频都改不了；而 `/api/seller/products/[id]` 又只认 owner，
 * editor 反而进不去。两条链路各自为政，导致 editor 能改图但不能改文案、卖家能改文案但不能改图。
 *
 * 这里把判定收敛成一处，五个接口共用，避免以后再出现口径不一致。
 *
 * 注意：角色一律以**数据库**为准。JWT 里的 `role` 是登录时的快照，管理员撤权后旧 token
 * 仍会带着旧角色；直接信 token 会留下「已撤权仍能编辑」的窗口。
 */
import { prisma } from "@/lib/db";

/** 可编辑「全站任意产品」的角色（editor 为 2026-10-29 新增授权对象） */
export const EDIT_ANY_PRODUCT_ROLES = ["admin", "super_admin", "editor"] as const;

export type ProductEditDenyReason = "not_found" | "anonymous" | "forbidden";

export interface ProductEditPermission {
  /** 是否放行 */
  allowed: boolean;
  /** 放行依据 / 拒绝原因 */
  outcome: "owner" | "privileged" | ProductEditDenyReason;
  /** 数据库中的真实角色（用户不存在时为 null） */
  role: string | null;
  /** 产品最小信息（不存在时为 null） */
  product: { id: string; sellerId: string } | null;
}

/**
 * 判断某个登录用户能否编辑指定产品。
 *
 * @param userId 当前登录用户 ID（来自已验证的 token）
 * @param productId 产品 ID
 */
export async function checkProductEditPermission(
  userId: string,
  productId: string
): Promise<ProductEditPermission> {
  const [user, product] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true },
    }),
  ]);

  if (!product) {
    return { allowed: false, outcome: "not_found", role: user?.role ?? null, product: null };
  }
  if (!user) {
    return { allowed: false, outcome: "anonymous", role: null, product };
  }
  if (product.sellerId === userId) {
    return { allowed: true, outcome: "owner", role: user.role, product };
  }
  if ((EDIT_ANY_PRODUCT_ROLES as readonly string[]).includes(user.role)) {
    return { allowed: true, outcome: "privileged", role: user.role, product };
  }
  return { allowed: false, outcome: "forbidden", role: user.role, product };
}

/** 把拒绝结果翻译成给前端看的提示语（放行时调用方不应使用） */
export function describeEditDenial(permission: ProductEditPermission): string {
  switch (permission.outcome) {
    case "not_found":
      return "产品不存在";
    case "anonymous":
      return "请先登录";
    default:
      return "无权编辑此产品";
  }
}
