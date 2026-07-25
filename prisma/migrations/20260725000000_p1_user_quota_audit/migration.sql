-- P1 用户体系：额度用量字段 + UsageLog（additive，可回滚）
-- 由 src/lib/quota 守卫消费；与 CreditTransaction 解耦（红线）。

-- 1) User 扩展：自然月用量窗口起点 + 4 个动作独立月度计数器
ALTER TABLE "User" ADD COLUMN "usagePeriodStart" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "usagePublish" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "usageInquiry" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "usageAiValuation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "usageViewContact" INTEGER NOT NULL DEFAULT 0;

-- 2) UsageLog 模型：额度消费流水（仅摘要，绝不落明文 PII）
CREATE TABLE "UsageLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "tier" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UsageLog_userId_periodStart_idx" ON "UsageLog" ("userId","periodStart");
CREATE INDEX "UsageLog_action_periodStart_idx" ON "UsageLog" ("action","periodStart");

-- 回滚（如需）：
-- DROP TABLE "UsageLog";
-- ALTER TABLE "User" DROP COLUMN "usageViewContact";
-- ALTER TABLE "User" DROP COLUMN "usageAiValuation";
-- ALTER TABLE "User" DROP COLUMN "usageInquiry";
-- ALTER TABLE "User" DROP COLUMN "usagePublish";
-- ALTER TABLE "User" DROP COLUMN "usagePeriodStart";
