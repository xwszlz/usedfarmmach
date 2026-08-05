/**
 * 积分体系存量数据回填脚本（设计文档 §2.4）
 *
 * 执行时机：prisma migrate dev/deploy 之后；幂等可重跑。
 *
 * 1. 余额迁移（Q4）：每个 credits > 0 且无 migration 批次的用户
 *    建 CreditLot{account:'recharge', sourceType:'migration', expiresAt=now+1年}
 *    + 一条 type='migration' 流水（不污染 recharge 充值收入口径）。
 * 2. 终身标记：membershipTier IN (basic/premium/enterprise) 且 membershipExpiresAt IS NULL
 *    的用户置 lifetime=true（已有过期时间的用户保持原值不动）。
 * 3. 邀请码：所有 inviteCode 为空的用户生成 8 位 base36 码（撞码重试）。
 * 4. 输出迁移报告（用户数/总迁移分/lifetime 用户数）。
 *
 * 运行：npx tsx prisma/seed-credit-migration.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateInviteCode } from "../src/lib/credits/invite-code";

const prisma = new PrismaClient();

const MIGRATION_LOT_TTL_DAYS = 365; // Q4：存量余额记充值分，1 年过期自迁移日起算

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** 判断是否为唯一约束冲突 */
function isP2002(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

/** 步骤 1：存量余额迁移为 recharge 批次 */
async function migrateBalances(): Promise<{ users: number; totalCredits: number }> {
  const users = await prisma.user.findMany({
    where: { credits: { gt: 0 } },
    select: { id: true, credits: true },
  });

  let migratedUsers = 0;
  let totalCredits = 0;

  for (const user of users) {
    // 幂等判据：该用户是否已存在 migration 批次
    const existing = await prisma.creditLot.findFirst({
      where: { userId: user.id, sourceType: "migration" },
      select: { id: true },
    });
    if (existing) continue;

    const expiresAt = addDays(new Date(), MIGRATION_LOT_TTL_DAYS);
    await prisma.$transaction(async (tx) => {
      const lot = await tx.creditLot.create({
        data: {
          userId: user.id,
          account: "recharge",
          sourceType: "migration",
          initialAmount: user.credits,
          remainingAmount: user.credits,
          expiresAt,
        },
      });
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          type: "migration",
          amount: user.credits,
          balance: user.credits,
          reason: "存量余额迁移（记充值分，1 年有效期）",
          account: "recharge",
          lotId: lot.id,
          expiresAt,
        },
      });
    });

    migratedUsers += 1;
    totalCredits += user.credits;
  }

  return { users: migratedUsers, totalCredits };
}

/** 步骤 2：存量付费用户置终身标记 */
async function markLifetimeUsers(): Promise<number> {
  const result = await prisma.user.updateMany({
    where: {
      membershipTier: { in: ["basic", "premium", "enterprise"] },
      membershipExpiresAt: null,
      lifetime: false,
    },
    data: { lifetime: true },
  });
  return result.count;
}

/** 步骤 3：为存量用户生成邀请码（撞码重试，最多 10 次/人） */
async function backfillInviteCodes(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { inviteCode: null },
    select: { id: true },
  });

  let filled = 0;
  for (const user of users) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { inviteCode: generateInviteCode() },
        });
        filled += 1;
        break;
      } catch (error) {
        if (!isP2002(error)) throw error;
        // 撞码 → 换码重试
      }
    }
  }
  return filled;
}

async function main() {
  console.log("=== 积分体系存量数据回填开始 ===");

  const balanceReport = await migrateBalances();
  console.log(
    `[1/3] 余额迁移完成：${balanceReport.users} 个用户，共迁移 ${balanceReport.totalCredits} 分（recharge 批次，1 年有效期）`
  );

  const lifetimeCount = await markLifetimeUsers();
  console.log(`[2/3] 终身标记完成：${lifetimeCount} 个用户置 lifetime=true`);

  const inviteCodeCount = await backfillInviteCodes();
  console.log(`[3/3] 邀请码回填完成：${inviteCodeCount} 个用户生成 inviteCode`);

  console.log("=== 迁移报告 ===");
  console.log(
    JSON.stringify(
      {
        migratedUsers: balanceReport.users,
        migratedCredits: balanceReport.totalCredits,
        lifetimeUsers: lifetimeCount,
        inviteCodes: inviteCodeCount,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("回填失败：", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
