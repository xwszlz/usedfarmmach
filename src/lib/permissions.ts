/**
 * 用户体系：三层权限模型
 * Layer 1: 登录状态（游客 vs 注册用户）
 * Layer 2: 角色（buyer / seller / admin）
 * Layer 3: 会员等级（free / basic / premium / enterprise）
 */

// 会员等级配置
export const MEMBERSHIP_TIERS = {
  free: {
    label: { zh: '免费用户', en: 'Free', ru: 'Бесплатно' },
    valuationsPerMonth: 5,   // 每月免费估价次数
    publishesPerMonth: 1,      // 每月免费发布产品数
    canViewSellerContact: true, // 能否查看卖家联系方式
    canExportData: false,
    canSeeArbitrage: false,       // 能否查看跨境套利数据
    canTopProduct: false,
    maxImagesPerProduct: 5,
    maxVideosPerProduct: 1,
  },
  basic: {
    label: { zh: '普通会员', en: 'Basic', ru: 'Базовый' },
    valuationsPerMonth: 50,
    publishesPerMonth: 10,
    canViewSellerContact: true,
    canExportData: false,
    canSeeArbitrage: true,
    canTopProduct: false,
    maxImagesPerProduct: 10,
    maxVideosPerProduct: 3,
  },
  premium: {
    label: { zh: '高级会员', en: 'Premium', ru: 'Премиум' },
    valuationsPerMonth: -1,      // -1 = 无限
    publishesPerMonth: -1,
    canViewSellerContact: true,
    canExportData: true,
    canSeeArbitrage: true,
    canTopProduct: true,
    maxImagesPerProduct: 20,
    maxVideosPerProduct: 5,
  },
  enterprise: {
    label: { zh: '企业会员', en: 'Enterprise', ru: 'Корпоративный' },
    valuationsPerMonth: -1,
    publishesPerMonth: -1,
    canViewSellerContact: true,
    canExportData: true,
    canSeeArbitrage: true,
    canTopProduct: true,
    maxImagesPerProduct: 50,
    maxVideosPerProduct: 10,
  },
} as const;

export type MembershipTier = keyof typeof MEMBERSHIP_TIERS;

// 角色配置
export const ROLE_PERMISSIONS = {
  buyer: {
    label: { zh: '买家', en: 'Buyer', ru: 'Покупатель' },
    canPublishProduct: false,
    canInquire: true,
    canFavorite: true,
    canViewArbitrage: false,
  },
  seller: {
    label: { zh: '卖家', en: 'Seller', ru: 'Продавец' },
    canPublishProduct: true,
    canInquire: true,
    canFavorite: true,
    canViewArbitrage: true,
  },
  admin: {
    label: { zh: '管理员', en: 'Admin', ru: 'Администратор' },
    canPublishProduct: true,
    canInquire: true,
    canFavorite: true,
    canViewArbitrage: true,
    canManageUsers: true,
    canManageProducts: true,
  },
} as const;

export type UserRole = keyof typeof ROLE_PERMISSIONS;

/**
 * 检查用户是否有某项权限
 */
export function checkPermission(
  role: string,
  tier: string,
  action: 'valuation' | 'publish' | 'viewContact' | 'viewArbitrage' | 'exportData' | 'topProduct'
): boolean {
  // 先检查角色权限
  const rolePerms = ROLE_PERMISSIONS[role as UserRole];
  if (!rolePerms) return false;

  // 再检查会员等级限制
  const tierConfig = MEMBERSHIP_TIERS[tier as MembershipTier] || MEMBERSHIP_TIERS.free;

  switch (action) {
    case 'valuation':
      return tierConfig.valuationsPerMonth !== 0;
    case 'publish':
      return !!rolePerms.canPublishProduct && tierConfig.publishesPerMonth !== 0;
    case 'viewContact':
      return !!rolePerms.canViewSellerContact;
    case 'viewArbitrage':
      return !!tierConfig.canSeeArbitrage;
    case 'exportData':
      return !!tierConfig.canExportData;
    case 'topProduct':
      return !!tierConfig.canTopProduct;
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
