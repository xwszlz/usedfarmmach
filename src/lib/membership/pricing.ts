// 会员订阅定价（**全站唯一价格来源**）
//
// ⚠️ 单一事实来源：/membership 页面展示的价格 与 /api/membership/checkout 实际扣款金额
//    必须都从这里取。两边各写一份迟早会出现「页面显示 A 价、实际扣 B 价」的重大事故。
//
// 定价口径（2026-09-08 拍板）：
//   .cn 月付 ¥88 / ¥158 / ¥288，年付 ¥880 / ¥1580 / ¥2880（年付 = 10 个月价）
//   .com 维持现网：月 $29 / $79 / $299，年 $290 / $790 / $2990
//
// 仅常量 + 纯函数，不依赖 Prisma / node 模块，可安全被客户端组件引用。
import type { MembershipTier } from "@/lib/permissions";

export type BillingCycle = "monthly" | "yearly";

export interface MembershipPrice {
  /** .cn 月付，单位：元 */
  cnyMonthly: number;
  /** .cn 年付，单位：元 */
  cnyYearly: number;
  /** .com 月付，单位：美元 */
  usdMonthly: number;
  /** .com 年付，单位：美元 */
  usdYearly: number;
}

export const MEMBERSHIP_PRICING: Record<MembershipTier, MembershipPrice> = {
  free: { cnyMonthly: 0, cnyYearly: 0, usdMonthly: 0, usdYearly: 0 },
  basic: { cnyMonthly: 88, cnyYearly: 880, usdMonthly: 29, usdYearly: 290 },
  premium: { cnyMonthly: 158, cnyYearly: 1580, usdMonthly: 79, usdYearly: 790 },
  enterprise: { cnyMonthly: 288, cnyYearly: 2880, usdMonthly: 299, usdYearly: 2990 },
};

/** 档位展示顺序（免费档列示作对比） */
export const MEMBERSHIP_TIER_ORDER: MembershipTier[] = [
  "free",
  "basic",
  "premium",
  "enterprise",
];

/** 各周期对应的会员有效期天数 */
export const CYCLE_DAYS: Record<BillingCycle, number> = {
  monthly: 30,
  yearly: 365,
};

function priceOf(tier: MembershipTier): MembershipPrice {
  return (
    MEMBERSHIP_PRICING[tier] || { cnyMonthly: 0, cnyYearly: 0, usdMonthly: 0, usdYearly: 0 }
  );
}

/** .cn 价格（单位：元） */
export function getMembershipCny(tier: MembershipTier, cycle: BillingCycle): number {
  const p = priceOf(tier);
  return cycle === "yearly" ? p.cnyYearly : p.cnyMonthly;
}

/** .com 价格（单位：美元） */
export function getMembershipUsd(tier: MembershipTier, cycle: BillingCycle): number {
  const p = priceOf(tier);
  return cycle === "yearly" ? p.usdYearly : p.usdMonthly;
}

/** .cn 价格（单位：分），供微信 Native 下单使用 */
export function getMembershipCnyCents(tier: MembershipTier, cycle: BillingCycle): number {
  return getMembershipCny(tier, cycle) * 100;
}

/** .com 价格（单位：分），供 Stripe 使用 */
export function getMembershipUsdCents(tier: MembershipTier, cycle: BillingCycle): number {
  return getMembershipUsd(tier, cycle) * 100;
}

/** 是否可购买的付费档（排除 free） */
export function isPaidTier(tier: MembershipTier): boolean {
  return tier !== "free";
}
