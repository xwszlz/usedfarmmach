-- 精选配对层 MachinePart 建表
-- 安全：仅新建表 + 索引，不触碰任何现有表/数据（避免 prisma db push 漂表风险）
-- 执行：npx prisma db execute --file prisma/machine-part-create-table.sql

CREATE TABLE IF NOT EXISTS "MachinePart" (
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "machineId"  TEXT     NOT NULL,
  "partId"     TEXT     NOT NULL,
  "partSource" TEXT     NOT NULL,
  "matchType"  TEXT     NOT NULL DEFAULT 'brand',
  "rank"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MachinePart_machineId_idx" ON "MachinePart" ("machineId");
CREATE INDEX IF NOT EXISTS "MachinePart_partId_idx"  ON "MachinePart" ("partId");
