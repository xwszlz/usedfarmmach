/**
 * 幂等注册礼包：grantRegisterGiftIfNeeded
 *
 * 经 UserMilestone(event=register_gift) 去重；已发则跳过，保证幂等。
 * 数值取 DEFAULT_REWARD_VALUES.registerGift（2026-10-28 全球统一为 1000，双站同值、不按币种区分，
 * 可被 SystemConfig 覆盖）。历史用户已发放的旧数值不回收、不补差。
 *
 * 复用模式：与 src/app/api/credits/recharge/route.ts 的 $transaction 一致，
 * 写入 CreditLot（gift 批次）+ CreditTransaction（流水）+ 用户 credits 自增。
 */
import { prisma } from "@/lib/db";
import { GIFT_TTL_DAYS, RECHARGE_TTL_DAYS, type RewardValues } from "./constants";
import { getRewardValues } from "./config";
import type { Prisma } from "@prisma/client";

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
 * @param sourceId 关联单据号（BillingOrder / 微信 transaction_id / Paddle transaction id），用于幂等去重
 * @param tx      可选的事务客户端（Prisma.TransactionClient）。传入时本函数不再自建事务，
 *                由调用方保证原子性（如 Paddle webhook 需要在同一事务内「查重 + 入账」）；
 *                不传则保持原有行为（内部 prisma.$transaction）。
 * @returns 已发放积分（amount <= 0 时返回 0，不写库）
 */
export async function grantRecharge(
  userId: string,
  amount: number,
  reason: string,
  sourceId?: string,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const amt = Math.max(0, Math.floor(amount));
  if (amt <= 0) return 0;

  // 调用方已提供事务客户端（如 Paddle webhook 需在同一个事务内完成「查重 + 入账」）：
  // 禁止再嵌套 prisma.$transaction（嵌套事务会报错），原子性由外层事务保证。
  if (tx) {
    await writeRechargeEntries(tx, userId, amt, reason, sourceId);
    return amt;
  }

  // 无外层事务时自行包裹一层交互式事务。三写逻辑统一收敛到 writeRechargeEntries，
  // 全仓只有一份写入实现，避免「改一处漏一处」的静默 bug。
  await prisma.$transaction((txc) =>
    writeRechargeEntries(txc, userId, amt, reason, sourceId)
  );

  return amt;
}

/**
 * 充值三步写：CreditLot → CreditTransaction → User.credits.increment。
 * 供 grantRecharge 在「外层已提供事务客户端」时复用，避免嵌套事务。
 *
 */
async function writeRechargeEntries(
  db: Prisma.TransactionClient,
  userId: string,
  amt: number,
  reason: string,
  sourceId?: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + RECHARGE_TTL_DAYS);

  const lot = await db.creditLot.create({
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

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  await db.creditTransaction.create({
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

  await db.user.update({
    where: { id: userId },
    data: { credits: { increment: amt } },
  });
}
