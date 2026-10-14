-- =============================================================
-- Round-1 线索导入 · 验收 SQL 集
-- =============================================================
-- 分两侧：
--   A. .cn 侧 —— ECS(101.200.125.199) 沙箱不可达，由老板在 ECS 上执行
--   B. .com 侧（Neon）—— 由 scripts/leads/reconcile-intl.ts 实跑
-- 全部为只读查询，无任何 INSERT / UPDATE / DELETE / DDL。
-- 每节都写了「期望值」，不符即为不通过。
-- =============================================================


-- =============================================================
-- A. .cn 侧（老板在 ECS 执行）
-- =============================================================

-- A1. 境内 58 户是否全部入库
--     期望：58
SELECT count(*) AS cn_manual_dealer_rows
FROM "RawListing"
WHERE source = 'manual_dealer';


-- A2. 🔴 备注是否真的落库（第 0 步「先合并部署」的验收点）
--     期望：58 —— 若小于 58，说明 import-leads.ts 仍是旧的整体覆盖逻辑，
--     备注（含 [同号·关联] / [电话占位] / [自家·禁外呼]）被丢弃，必须停止并重新部署
SELECT count(*) AS rows_with_notes_marker
FROM "RawListing"
WHERE source = 'manual_dealer'
  AND notes IS NOT NULL
  AND notes LIKE '%[性质]%';


-- A3. 逐标记统计（确认各类前缀都在）
--     期望：[性质]=58；[机型组]=58；[同号·关联]=6；[电话占位]=4（境内部分）；[自家·禁外呼]=0（2 户在待核，不入库）
SELECT
  count(*) FILTER (WHERE notes LIKE '%[性质]%')         AS has_nature,
  count(*) FILTER (WHERE notes LIKE '%[机型组]%')       AS has_model_group,
  count(*) FILTER (WHERE notes LIKE '%[同号·关联：%')    AS has_relation,
  count(*) FILTER (WHERE notes LIKE '%[电话占位]%')      AS has_placeholder_phone,
  count(*) FILTER (WHERE notes LIKE '%[自家·禁外呼]%')   AS has_self_owned,
  count(*) FILTER (WHERE notes LIKE '%[品牌兜底]%')      AS has_brand_fallback
FROM "RawListing"
WHERE source = 'manual_dealer';


-- A4. 归属列：必须全是 'cn'，不得有 unknown（unknown 不入库，出现即为判错）
--     期望：cn=58，其余口径均为 0
SELECT "goodsRegion", count(*) AS n
FROM "RawListing"
WHERE source = 'manual_dealer'
GROUP BY "goodsRegion"
ORDER BY n DESC;


-- A5. PII 审计：每导入一行应写一条 audit
--     期望：>= 58
SELECT count(*) AS pii_audit_rows
FROM "PiiAuditLog"
WHERE action = 'import'
  AND "targetListingId" IN (
    SELECT id FROM "RawListing" WHERE source = 'manual_dealer'
  );


-- A6. 幂等：同一份 CSV 再导一次
--     期望：imported = 0, skipped = 58
--     （这不是 SQL，是操作步骤；导入接口返回的这两个字段必须如此）
--     imported=0 说明 contentHash 全撞、没有产生重复行。


-- A7. 护栏回归：构造 1 条 goodsRegion='cn' 的行，打到 **.com** 的导入接口
--     期望：rejectedCount = 1（.com 站只收 intl，境内数据必须被拒）
--     目的：验证站点准入护栏还在（数据不出境红线）


-- A8. 待核 2 户：两侧都应查不到
--     期望：0（它们归属 unknown，不入库；只存在于 待核-2026-10-13.csv）
SELECT count(*) AS should_be_zero
FROM "RawListing"
WHERE "sellerName" LIKE '%神雕%'
   OR "sellerName" LIKE '%金色神雕%';


-- =============================================================
-- B. .com 侧（Neon，由 reconcile-intl.ts 实跑）
-- =============================================================

-- B1. 境外 18 户行数
--     期望：18
SELECT count(*) AS intl_rows
FROM "RawListing"
WHERE source = 'manual_dealer_intl';


-- B2. 卖家名去重数（18 户应 18 个不同主体）
--     期望：18
SELECT count(DISTINCT "sellerName") AS distinct_sellers
FROM "RawListing"
WHERE source = 'manual_dealer_intl';


-- B3. contentHash 是否有重复（重复 = 幂等被破坏）
--     期望：0
SELECT count(*) AS dup_hash_groups
FROM (
  SELECT "contentHash"
  FROM "RawListing"
  GROUP BY "contentHash"
  HAVING count(*) > 1
) t;


-- B4. 🔴 数据不出境红线：.com 库里绝不能出现归属为境内的数据
--     期望：0（必须为 0，非 0 即红线事故）
SELECT count(*) AS cn_rows_on_com
FROM "RawListing"
WHERE "goodsRegion" = 'cn';


-- B5. 境外行的归属应全为 'intl'
--     期望：intl=18，无其它值
SELECT "goodsRegion", count(*) AS n
FROM "RawListing"
WHERE source = 'manual_dealer_intl'
GROUP BY "goodsRegion";


-- B6. 备注里是否已带上 Round-1 标记（若这 18 行是新导的）
--     说明：本批境外 18 户为**已入库存量**，本次只做字段对账不重导，
--     故此值可能 < 18；用于判断哪些行需要补备注。
SELECT
  count(*) FILTER (WHERE notes LIKE '%[性质]%') AS has_nature,
  count(*)                                       AS total
FROM "RawListing"
WHERE source = 'manual_dealer_intl';


-- =============================================================
-- C. 双侧一致性
-- =============================================================

-- C1. 合计口径：境内 58 + 境外 18 + 待核 2 = 78
--     分别用 A1 + B1 + （待核 CSV 行数 2）核对，合计必须为 78。
--     注意：这是「U7-B 不合并」口径 —— 78 户一个都不能少，
--     同号问题由 [同号·关联] 备注解决，**不是靠合并行数**。
