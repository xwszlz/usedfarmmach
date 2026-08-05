/**
 * 幂等注册礼包：grantRegisterGiftIfNeeded
 *
 * 经 UserMilestone(event=register_gift) 去重；已发则跳过，保证幂等。
 * 数值取 DEFAULT_REWARD_VALUES.registerGift（默认 5，可被 SystemConfig 覆盖）。
 *
 * 复用模式：与 src/app/api/credits/recharge/route.ts 的 $transaction 一致，
 * 写入 CreditLot（gift 批次）+ CreditTransaction（流水）+ 用户 credits 自增。
 */
import { prisma } from "@/lib/db";
import { GIFT_TTL_DAYS, type RewardValues } from "./constants";
import { getRewardValues } from "./config";

/** 注册礼包发放结果 */
export interface GrantResult {
  granted: boolean;
  amount: number;
}

/**
 * 发放注册礼包（幂等）。
 * 重复调用仅首次生效：通过 UserMilestone(event=register_gift) 唯一约束去重。
 */
export async function grantRegisterGiftIfNeeded(userId: string): Promise<GrantResult> {
  // 先查里程碑，避免无谓事务
  const existing = await prisma.userMilestone.findUnique({
    where: { userId_event: { userId, event: "register_gift" } },
    select: { id: true },
  });
  if (existing) {
    return { granted: false, amount: 0 };
  }

  const rewardValues: RewardValues = await getRewardValues();
  const amount = rewardValues.registerGift;

  try {
    await prisma.$transaction(async (tx) => {
      const milestone = await tx.userMilestone.create({
        data: { userId, event: "register_gift" },
        select: { id: true },
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + GIFT_TTL_DAYS);

      const lot = await tx.creditLot.create({
        data: {
          userId,
          account: "gift",
          sourceType: "register_gift",
          sourceId: milestone.id,
          initialAmount: amount,
          remainingAmount: amount,
          expiresAt,
        },
        select: { id: true },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: "register_gift",
          amount,
          balance: (user?.credits ?? 0) + amount,
          reason: "注册礼包",
          account: "gift",
          lotId: lot.id,
          expiresAt,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
      });
    });
    return { granted: true, amount };
  } catch (error: any) {
    // 并发去重：唯一约束冲突视为已发，幂等返回
    if (error?.code === "P2002") {
      return { granted: false, amount: 0 };
    }
    throw error;
  }
}

/**
 * 发放邮箱验证礼包（幂等）。数值取 rewardValues.emailVerifiedGift（默认 5，与注册礼包一致）。
 * 经 UserMilestone(event=email_verified_gift) 唯一约束去重；已发则跳过。
 * 用于邮箱验证 magic-link 回调（阶段 1，T06/T09）。
 */
export async function grantEmailVerifiedGiftIfNeeded(
  userId: string
): Promise<GrantResult> {
  const existing = await prisma.userMilestone.findUnique({
    where: { userId_event: { userId, event: "email_verified_gift" } },
    select: { id: true },
  });
  if (existing) {
    return { granted: false, amount: 0 };
  }

  const rewardValues: RewardValues = await getRewardValues();
  const amount = rewardValues.emailVerifiedGift;

  try {
    await prisma.$transaction(async (tx) => {
      const milestone = await tx.userMilestone.create({
        data: { userId, event: "email_verified_gift" },
        select: { id: true },
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + GIFT_TTL_DAYS);

      const lot = await tx.creditLot.create({
        data: {
          userId,
          account: "gift",
          sourceType: "email_verified_gift",
          sourceId: milestone.id,
          initialAmount: amount,
          remainingAmount: amount,
          expiresAt,
        },
        select: { id: true },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: "email_verified_gift",
          amount,
          balance: (user?.credits ?? 0) + amount,
          reason: "邮箱验证奖励",
          account: "gift",
          lotId: lot.id,
          expiresAt,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
      });
    });
    return { granted: true, amount };
  } catch (error: any) {
    if (error?.code === "P2002") {
      return { granted: false, amount: 0 };
    }
    throw error;
  }
}
