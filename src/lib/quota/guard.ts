/**
 * 额度守卫（QuotaGuard，T01 基础层）
 *
 * 设计约束：
 *   - 这是「服务端助手函数」而非 Edge 中间件——因为需读/写数据库（Prisma 在 Edge 不可用）。
 *   - 各动作持有【独立】月度计数器，互不挤占；上限取同 tier 值。
 *   - 自然月惰性重置：以 usagePeriodStart 是否落在当前 YYYY-MM-01 起判，跨月即清零。
 *   - 红线：消费只写 UsageLog，绝不碰 CreditTransaction / credits。
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getQuotaLimit, type QuotaAction, type QuotaUser } from "./constants";

/** 当前自然月起点（本地时区 YYYY-MM-01 00:00:00） */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/** 下个自然月起点（重置日） */
function nextMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}

/** 动作 → 计数器字段映射（用于读取已用量与增量） */
const COUNTER_FIELD: Record<
  QuotaAction,
  "usagePublish" | "usageInquiry" | "usageAiValuation" | "usageViewContact"
> = {
  publish: "usagePublish",
  inquiry: "usageInquiry",
  aiValuation: "usageAiValuation",
  viewContact: "usageViewContact",
};

/**
 * 惰性重置：若用量窗口不在当前自然月，清零全部计数器并刷新窗口起点。
 * 返回最新用户用量状态（重置后 counters 归 0）。
 */
export async function ensureQuotaWindow(user: QuotaUser): Promise<QuotaUser> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const period = user.usagePeriodStart;
  const needReset =
    !period ||
    period.getFullYear() !== now.getFullYear() ||
    period.getMonth() !== now.getMonth();

  if (needReset) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        usagePublish: 0,
        usageInquiry: 0,
        usageAiValuation: 0,
        usageViewContact: 0,
        usagePeriodStart: monthStart,
      },
    });
    return {
      ...user,
      usagePublish: 0,
      usageInquiry: 0,
      usageAiValuation: 0,
      usageViewContact: 0,
      usagePeriodStart: monthStart,
    };
  }
  return user;
}

/** 写额度消费流水（绝不明文、绝不写积分账本） */
async function writeUsageLog(
  userId: string,
  action: QuotaAction,
  tier: string,
  periodStart: Date,
): Promise<void> {
  try {
    await prisma.usageLog.create({
      data: { userId, action, tier, periodStart },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[quota] writeUsageLog failed:", err);
  }
}

export interface ConsumeResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
}

/**
 * 消费一次额度：
 *   1) 惰性重置窗口；2) 读上限；3) 已用 >= 上限（且非无限）→ 超额拒绝；
 *   4) 否则计数器 +1 并写 UsageLog。
 * 返回 { ok, remaining, limit, resetAt }；超额时路由据此返回 403 QUOTA_EXCEEDED。
 */
export async function consumeQuota(
  user: QuotaUser,
  action: QuotaAction,
): Promise<ConsumeResult> {
  const fresh = await ensureQuotaWindow(user);
  const limit = getQuotaLimit(fresh.membershipTier, action);
  const field = COUNTER_FIELD[action];
  const used = fresh[field] as number;
  const resetAt = nextMonthStart(new Date()).toISOString();

  // 硬限额阻断（仅当上限非无限且已用 >= 上限）
  if (limit !== -1 && used >= limit) {
    return { ok: false, remaining: 0, limit, resetAt };
  }

  // 增量对应动作计数器
  let updateData: Prisma.UserUpdateInput;
  switch (action) {
    case "publish":
      updateData = { usagePublish: { increment: 1 } };
      break;
    case "inquiry":
      updateData = { usageInquiry: { increment: 1 } };
      break;
    case "aiValuation":
      updateData = { usageAiValuation: { increment: 1 } };
      break;
    case "viewContact":
      updateData = { usageViewContact: { increment: 1 } };
      break;
  }

  await prisma.user.update({ where: { id: fresh.id }, data: updateData });
  await writeUsageLog(
    fresh.id,
    action,
    fresh.membershipTier,
    fresh.usagePeriodStart || startOfMonth(new Date()),
  );

  const remaining = limit === -1 ? -1 : Math.max(0, limit - (used + 1));
  return { ok: true, remaining, limit, resetAt };
}

export interface QuotaItem {
  action: QuotaAction;
  used: number;
  limit: number;
  remaining: number;
}

export interface QuotaState {
  periodStart: string;
  resetAt: string;
  items: QuotaItem[];
}

/**
 * 只读：返回当前窗口各动作的已用/上限/剩余（不增计数）。
 * 跨月时已用视为 0（不突变数据库，避免面板在月初显示陈旧用量）。
 */
export async function getQuotaState(user: QuotaUser): Promise<QuotaState> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const period = user.usagePeriodStart;
  const inWindow =
    !!period &&
    period.getFullYear() === now.getFullYear() &&
    period.getMonth() === now.getMonth();

  const effectivePeriodStart = inWindow ? period! : monthStart;

  const actions: QuotaAction[] = ["publish", "inquiry", "aiValuation", "viewContact"];
  const items: QuotaItem[] = actions.map((action) => {
    const limit = getQuotaLimit(user.membershipTier, action);
    const used = inWindow ? (user[COUNTER_FIELD[action]] as number) : 0;
    const remaining = limit === -1 ? -1 : Math.max(0, limit - used);
    return { action, used, limit, remaining };
  });

  return {
    periodStart: effectivePeriodStart.toISOString(),
    resetAt: nextMonthStart(now).toISOString(),
    items,
  };
}

/**
 * 统一的超额响应（HTTP 403 + QUOTA_EXCEEDED）。
 * 前端据此展示「本月额度已用尽」+ 升级引导（置灰）。
 */
export function quotaExceededResponse(resetAt: string, locale = "zh") {
  return NextResponse.json(
    {
      success: false,
      code: "QUOTA_EXCEEDED",
      error: "本月额度已用尽",
      data: { remaining: 0, resetAt, upgradeUrl: `/${locale}/membership` },
    },
    { status: 403 },
  );
}
