-- =====================================================================
-- 一次性回填：把 LIVE 场次的落槌主体（licensedAgencyId）指向其主持拍卖师
--   执业注册所属的合作持牌拍卖机构。
--
-- 背景（合规红线 #1）：落槌是「拍卖人」的法定行为。平台不持《拍卖经营批准证书》，
--   故落槌主体必须落在合作持牌拍卖机构名下。历史上 auctionMode='LIVE' 的场次可能
--   licensedAgencyId 为空 → 既不能落槌（409）也不能流拍（409），永久卡死。
--
-- 幂等：仅影响 auctionMode='LIVE' 且 licensedAgencyId IS NULL 且**未处于终态**
--   （未落槌/未结案/未流拍）的行；重复执行不会改动已回填的行（第二次 ④ 的
--   pending_unlocked_rows_after 应为 0）。
--   为何排除终态行：终态行已经关闭，回填它不救任何滞留场次；而且事后改动**已关闭**记录
--   正是「落槌主体一经记录不可变更」这条不变量存在的意义 —— 那会伪造法定留痕，
--   同时把 updatedAt 推后，看起来像闭案后被追改，审计必抓。故终态一律 LOCKED_TERMINAL、原样不动。
-- 不触碰 prisma/schema.prisma；无需部署，可直接在 ECS 上执行。
--
-- 执行配方（.cn / ECS）：
--   1) docker ps                        # 找到 postgres 容器名
--   2) docker exec -i <container> psql -U cn_app -d usedfarmmach_cn \
--        < backfill-auction-licensed-agency.sql
--
-- 标识符大小写：Prisma 默认映射 = 表名 PascalCase、列名 camelCase，
--   故所有标识符必须用双引号，否则 PostgreSQL 折叠成小写会找不到对象。
-- =====================================================================

-- ① 回填前体检：应回填的场次数（FIXABLE + FIXABLE_AGENCY_NOT_ACTIVE 的口径）
SELECT count(*) AS "pending_live_rows"
FROM "Auction"
WHERE "auctionMode" = 'LIVE' AND "licensedAgencyId" IS NULL;

-- ② 工作清单 / 逐行判定：六类结论，与 ③ 的写入集合**严格对齐**（②桶划分 = ③会碰的行）：
--    LOCKED_TERMINAL              已落槌/结案/流拍（终态）—— 永不写入（与 D1 classify() 的锁定判定一致）
--    FIXABLE                      机构 ACTIVE，将被写入
--    FIXABLE_AGENCY_NOT_ACTIVE    机构存在但非 ACTIVE，仍会被写入（据实登记主体；落槌仍被应用层拦）
--    BLOCKED_NO_AUCTIONEER        未指派 auctioneerId，或拍卖师档案缺失
--    BLOCKED_AUCTIONEER_NO_AGENCY 拍卖师未登记执业归属机构
--    BLOCKED_AGENCY_MISSING       拍卖师归属的机构档案不存在
SELECT
  a.id,
  a."bargainNo",
  a.title,
  a.status,
  a."auctioneerId",
  au."realName"                 AS "auctioneerName",
  au."licensedAgencyId"         AS "auctioneerAgencyId",
  ag.name                       AS "auctioneerAgencyName",
  ag.status                     AS "auctioneerAgencyStatus",
  CASE
    WHEN a."hammeredAt" IS NOT NULL OR a."status" IN ('LIVE_HAMMERED','LIVE_SETTLED','LIVE_PASSED')
                                          THEN 'LOCKED_TERMINAL'
    WHEN a."auctioneerId" IS NULL        THEN 'BLOCKED_NO_AUCTIONEER'
    WHEN au.id IS NULL                    THEN 'BLOCKED_NO_AUCTIONEER'
    WHEN au."licensedAgencyId" IS NULL    THEN 'BLOCKED_AUCTIONEER_NO_AGENCY'
    WHEN ag.id IS NULL                    THEN 'BLOCKED_AGENCY_MISSING'
    WHEN ag.status <> 'ACTIVE'            THEN 'FIXABLE_AGENCY_NOT_ACTIVE'
    ELSE 'FIXABLE'
  END AS "verdict"
FROM "Auction" a
LEFT JOIN "Auctioneer" au            ON au.id = a."auctioneerId"
LEFT JOIN "LicensedAuctionAgency" ag ON ag.id = au."licensedAgencyId"
WHERE a."auctionMode" = 'LIVE' AND a."licensedAgencyId" IS NULL
ORDER BY "verdict", a."createdAt";

-- ③ 回填：仅在拍卖师的执业归属机构已登记时写入。
--   ⚠️ 本语句**故意不加机构状态过滤** —— 证据：
--     · 写入的是「历史事实：谁主持了这场」，与 ② 的 FIXABLE / FIXABLE_AGENCY_NOT_ACTIVE
--       两个桶一一对应（二者都会被写入）。
--     · 机构是否 ACTIVE 是**落槌时**由应用层把的闸（auction-live-guards.ts 的
--       assertHammerPrivilege，唯一的 403 出口），不是「登记主体」的前置条件。
--     · 若此处过滤掉非 ACTIVE，本次要救援的「机构已停牌/吊销的滞留场次」反而永远无法收口
--       （流拍收口同样要求主体已登记）。
--   故 WHERE 保持精确窄口径，不加 status 过滤。
--   注意：updatedAt 是 Prisma 的 @updatedAt 字段，原始 SQL UPDATE 不会自动维护它，
--   必须在此显式 SET "updatedAt" = now()，否则 @updatedAt 语义被绕过。
UPDATE "Auction" a
SET "licensedAgencyId" = au."licensedAgencyId",
    "updatedAt"        = now()
FROM "Auctioneer" au
WHERE a."auctioneerId" = au.id
  AND a."auctionMode" = 'LIVE'
  AND a."licensedAgencyId" IS NULL
  AND a."hammeredAt" IS NULL
  AND a."status" NOT IN ('LIVE_HAMMERED','LIVE_SETTLED','LIVE_PASSED')
  AND au."licensedAgencyId" IS NOT NULL;

-- ④ 回填后复检：两个口径（务必要一起看）
--   · pending_live_rows_after      —— 与 ① 同口径（含终态）。若存在 LOCKED_TERMINAL 行，
--     此值应**等于** ② 中 LOCKED_TERMINAL 的条数（这些行被**有意**保留，不算失败）。
--   · pending_unlocked_rows_after  —— 叠加锁定守卫（可写入口径）。**此值必须为 0**。
SELECT count(*) AS "pending_live_rows_after"
FROM "Auction"
WHERE "auctionMode" = 'LIVE' AND "licensedAgencyId" IS NULL;

SELECT count(*) AS "pending_unlocked_rows_after"
FROM "Auction"
WHERE "auctionMode" = 'LIVE' AND "licensedAgencyId" IS NULL
  AND "hammeredAt" IS NULL
  AND "status" NOT IN ('LIVE_HAMMERED','LIVE_SETTLED','LIVE_PASSED');
