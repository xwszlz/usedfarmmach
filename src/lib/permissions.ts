/**

 * 用户体系：权限模型

 * Layer 1: 登录状态（游客 vs 注册用户）

 * Layer 2: 角色（buyer / seller / admin）

 * Layer 3（原会员等级）已取消：2026-10 起配额与权限统一走角色 + 积分体系，

 *        不再按 membershipTier 区分（见 src/lib/quota/constants.ts 的 UNIFIED_QUOTA_LIMITS）。

 */





// 角色配置

export const ROLE_PERMISSIONS = {

  super_admin: {

    label: { zh: '超级管理员', en: 'Super Admin', ru: 'Супер Администратор' },

    canPublishProduct: true,

    canInquire: true,

    canFavorite: true,

    canViewSellerContact: true,

    canViewArbitrage: true,

    canManageUsers: true,

    canManageProducts: true,

    canManageAdmins: true,

    canManageSystem: true,

  },

  admin: {

    label: { zh: '管理员', en: 'Admin', ru: 'Администратор' },

    canPublishProduct: true,

    canInquire: true,

    canFavorite: true,

    canViewSellerContact: true,

    canViewArbitrage: true,

    canManageUsers: true,

    canManageProducts: true,

  },

  seller: {

    label: { zh: '卖家', en: 'Seller', ru: 'Продавец' },

    canPublishProduct: true,

    canInquire: true,

    canFavorite: true,

    canViewSellerContact: true,

    canViewArbitrage: true,

  },

  buyer: {

    label: { zh: '买家', en: 'Buyer', ru: 'Покупатель' },

    canPublishProduct: false,

    canInquire: true,

    canFavorite: true,

    canViewSellerContact: true,

    canViewArbitrage: false,

  },

} as const;





export type UserRole = keyof typeof ROLE_PERMISSIONS;





/**

 * 会员等级类型（保留类型导出以兼容 src/lib/membership/pricing.ts 等历史模块；

 * 会员体系本身已于 2026-10 取消，不再有升级入口，新注册恒 free）。

 */

export type MembershipTier = 'free' | 'basic' | 'premium' | 'enterprise';





/**

 * 检查用户是否有某项权限

 * 会员等级限制已于 2026-10 取消：本函数仅按角色判定，tier 参数保留为兼容占位但不再参与逻辑。

 */

export function checkPermission(

  role: string,

  _tier: string,

  action: 'valuation' | 'publish' | 'viewContact' | 'viewArbitrage' | 'exportData' | 'topProduct'

): boolean {

  const rolePerms = ROLE_PERMISSIONS[role as UserRole];

  if (!rolePerms) return false;



  switch (action) {

    case 'valuation':

      return true; // 估值按 token 实际消耗计费，无等级限制

    case 'publish':

      return !!rolePerms.canPublishProduct;

    case 'viewContact':

      return !!rolePerms.canViewSellerContact;

    case 'viewArbitrage':

      return !!rolePerms.canViewArbitrage;

    case 'exportData':

    case 'topProduct':

      return false; // 导出/置顶为历史会员专属能力，现无会员体系

    default:

      return false;

  }

}





/**

 * 获取用户当月已用配额

 */

export function getMonthlyQuotaUsed(

  freeValuationsUsed: number,

  resetAt: Date | string,

): { valuationsUsed: number; shouldReset: boolean } {

  const resetDate = new Date(resetAt);

  const now = new Date();

  const shouldReset =

    resetDate.getMonth() !== now.getMonth() ||

    resetDate.getFullYear() !== now.getFullYear();

  return {

    valuationsUsed: shouldReset ? 0 : freeValuationsUsed,

    shouldReset,

  };

}





// ── P1 超管与角色集 ──

/** 超级管理员数量上限（多超管治理基线；石家庄铁家伙维持 super_admin 不降级） */

export const SUPER_ADMIN_MAX = 3;





/** 可赋予的用户角色集合（含 partner_limited 受限合作方） */

export const ROLE_SET = [

  "buyer",

  "seller",

  "editor",

  "admin",

  "super_admin",

  "partner_limited",

] as const;



export type AppRole = (typeof ROLE_SET)[number];
