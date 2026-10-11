/**
 * 额度引擎常量（T01 基础层）
 *
 * 2026-10 重构：取消 4 档会员，改为「积分中心 + 积分充值」。
 *   - 额度闸门不再按会员等级区分（原 MEMBERSHIP_TIERS 退役）；
 *     所有用户统一走 UNIFIED_QUOTA_LIMITS（见下），消除付费档位优势。
 *   - AI 估值（aiValuation）不再占用月度额度，改为按 token 实际消耗 ×2 扣积分
 *     （见 src/lib/credits/spend.ts 的 computeAiCost / deductCredits）；
 *     因此 aiValuation 从 QUOTA_ACTIONS 中移除。
 *
 * 红线：额度与积分解耦——本模块只决定「某动作本月是否超额」，
 *       绝不引用 CreditTransaction / credits。
 */
import { prisma } from "@/lib/db";

/** 受额度守卫的动作（已移除 aiValuation，改走积分计费） */
export const QUOTA_ACTIONS = ["publish", "inquiry", "viewContact"] as const;
export type QuotaAction = (typeof QUOTA_ACTIONS)[number];

/**
 * 统一月度额度上限（取消会员分档后，所有用户一致）。
 * -1 表示无限额度。publish/inquiry/viewContact 统一为 50/月，避免免费档被刷。
 */
export const UNIFIED_QUOTA_LIMITS: Record<QuotaAction, number> = {
  publish: 50,
  inquiry: 50,
  viewContact: 50,
};

/** 超级管理员数量上限（多超管治理基线） */
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

/** QuotaUser：额度守卫所需的最小用户字段集合（与 QUOTA_USER_SELECT 对应） */
export interface QuotaUser {
  id: string;
  membershipTier: string;
  usagePeriodStart: Date | null;
  usagePublish: number;
  usageInquiry: number;
  usageViewContact: number;
}

/** 动作 → 月度计数器字段映射 */
const ACTION_FIELD: Record<
  QuotaAction,
  "publishesPerMonth" | "inquiriesPerMonth" | "contactsPerMonth"
> = {
  publish: "publishesPerMonth",
  inquiry: "inquiriesPerMonth",
  viewContact: "contactsPerMonth",
};

/**
 * 取某动作的月度上限。
 * 2026-10 重构后忽略会员等级（tier 形参保留兼容旧调用方），统一返回 UNIFIED_QUOTA_LIMITS。
 * -1 表示无限；未知动作回退 0。
 */
export function getQuotaLimit(_tier: string, action: QuotaAction): number {
  const v = UNIFIED_QUOTA_LIMITS[action];
  return typeof v === "number" ? v : 0;
}

/** 统一 SELECT（供 getQuotaUser 使用，保证字段集合一致） */
export const QUOTA_USER_SELECT = {
  id: true,
  membershipTier: true,
  usagePeriodStart: true,
  usagePublish: true,
  usageInquiry: true,
  usageViewContact: true,
} as const;

/** 按 userId 读取额度守卫所需的用户字段；用户不存在返回 null */
export async function getQuotaUser(userId: string): Promise<QuotaUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: QUOTA_USER_SELECT,
  });
  return u as unknown as QuotaUser | null;
}
