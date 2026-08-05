/**
 * 额度引擎常量（T01 基础层）
 *
 * 复用并扩展 MEMBERSHIP_TIERS：
 *   - 每个会员等级已有 publishesPerMonth / valuationsPerMonth
 *   - P1 新增 inquiriesPerMonth / contactsPerMonth，并统一 4 动作映射
 *   - -1 表示无限额度
 *
 * 红线：额度与积分解耦——本模块只决定「某动作本月在否超额」，
 *       绝不引用 CreditTransaction / credits。
 */
import { prisma } from "@/lib/db";
import { MEMBERSHIP_TIERS } from "@/lib/permissions";

/** P1 受额度守卫的 4 个核心动作 */
export const QUOTA_ACTIONS = ["publish", "inquiry", "aiValuation", "viewContact"] as const;
export type QuotaAction = (typeof QUOTA_ACTIONS)[number];

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
  usageAiValuation: number;
  usageViewContact: number;
}

/** 动作 → MEMBERSHIP_TIERS 字段映射 */
const ACTION_FIELD: Record<
  QuotaAction,
  "publishesPerMonth" | "valuationsPerMonth" | "inquiriesPerMonth" | "contactsPerMonth"
> = {
  publish: "publishesPerMonth",
  aiValuation: "valuationsPerMonth",
  inquiry: "inquiriesPerMonth",
  viewContact: "contactsPerMonth",
};

/** 取某会员等级某动作的月度上限；-1 表示无限；未知等级回退 free */
export function getQuotaLimit(tier: string, action: QuotaAction): number {
  const t = (MEMBERSHIP_TIERS as Record<string, Record<string, unknown>>)[tier] ||
    MEMBERSHIP_TIERS.free;
  const v = t[ACTION_FIELD[action]];
  return typeof v === "number" ? v : 0;
}

/** 统一 SELECT（供 getQuotaUser 使用，保证字段集合一致） */
export const QUOTA_USER_SELECT = {
  id: true,
  membershipTier: true,
  usagePeriodStart: true,
  usagePublish: true,
  usageInquiry: true,
  usageAiValuation: true,
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
