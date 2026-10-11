/**
 * 幂等注册礼包：grantRegisterGiftIfNeeded
 *
 * 经 UserMilestone(event=register_gift) 去重；已发则跳过，保证幂等。
 * 数值取 DEFAULT_REWARD_VALUES.registerGift（P0 增长方案 2026-09-06：默认 20，可被 SystemConfig 覆盖）。
 *
 * 复用模式：与 src/app/api/credits/recharge/route.ts 的 $transaction 一致，
 * 写入 CreditLot（gift 批次）+ CreditTransaction（流水）+ 用户 credits 自增。
 */
import { prisma } from "@/lib/db";
import { GIFT_TTL_DAYS, RECHARGE_TTL_DAYS, type RewardValues } from "./constants";
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

/**
 * 充值发放积分（积分中心 / 支付回调统一入口）。
 *
 * 与注册礼包保持一致的写法：事务内建 CreditLot（account=recharge，+365 天有效期）
 * + CreditTransaction（type=recharge）+ User.credits 自增。
 *
 * @param userId   目标用户
 * @param amount   发放积分（恒为正）
 * @param reason   流水原因（如 "充值:pack60" / "微信支付充值"）
 * @param sourceId 关联单据号（BillingOrder / 微信 transaction_id / Stripe session id），用于幂等去重
 * @returns 已发放积分（amount <= 0 时返回 0，不写库）
 */
export async function grantRecharge(
  userId: string,
  amount: number,
  reason: string,
  sourceId?: string
): Promise<number> {
  const amt = Math.max(0, Math.floor(amount));
  if (amt <= 0) return 0;

  await prisma.$transaction(async (tx) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RECHARGE_TTL_DAYS);

    const lot = await tx.creditLot.create({
      data: {
        userId,
        account: "recharge",
        sourceType: "recharge",
        sourceId: sourceId ?? null,
        initialAmount: amt,
        remainingAmount: amt,
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
        type: "recharge",
        amount: amt,
        balance: (user?.credits ?? 0) + amt,
        reason,
        account: "recharge",
        lotId: lot.id,
        expiresAt,
        relatedId: sourceId ?? null,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: amt } },
    });
  });

  return amt;
}
