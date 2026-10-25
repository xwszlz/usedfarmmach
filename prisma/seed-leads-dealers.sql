-- ══════════════════════════════════════════════════════════════════════════
-- AI 销售策略 — Lead / Dealer 幂等种子（决策 A）
-- 作用：把既有 Product.contact*（开放直连卖家联系方式）与企业卖家、
--       ValuationLead（估值留资，若存在）同步进新增的 Lead / Dealer 表。
-- 特性：
--   - 可重复执行（ON CONFLICT ("contentHash") DO NOTHING）
--   - 不修改任何现有表；仅 INSERT 新行
--   - 依赖 pgcrypto 的 gen_random_uuid()（Prisma 项目通常已启用）
--   - ValuationLead 不存在时整段跳过（DO $$ ... END $$ 守卫）
-- 执行：psql "$DATABASE_URL" -f prisma/seed-leads-dealers.sql
--       （或经 Prisma 的 db execute；需在 `prisma db push` 之后执行）
-- ══════════════════════════════════════════════════════════════════════════

-- 1) 同步 Product.contact* → Lead（每台有联系方式的在售产品一行一条线索）
INSERT INTO "Lead" ("id", "source", "name", "phone", "wechat", "whatsapp", "email",
                    "brand", "model", "year", "location", "region", "contentHash",
                    "productId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'product_contact',
  COALESCE(p."contactName", ''),
  p."contactPhone",
  p."contactWechat",
  NULL,
  p."contactEmail",
  b."nameZh",
  p."modelName",
  p."year",
  p."location",
  p."location",
  md5('lead|product|' || p."id" || '|' || COALESCE(p."contactPhone", '') || '|' || COALESCE(p."contactEmail", '')),
  p."id",
  NOW(),
  NOW()
FROM "Product" p
LEFT JOIN "Brand" b ON b."id" = p."brandId"
WHERE p."status" = 'active'
  AND (p."contactPhone" IS NOT NULL OR p."contactWechat" IS NOT NULL OR p."contactEmail" IS NOT NULL)
ON CONFLICT ("contentHash") DO NOTHING;

-- 2) 同步 Product.contact*（企业卖家）→ Dealer（渠道经销商）
INSERT INTO "Dealer" ("id", "name", "phone", "wechat", "email", "brands", "regions",
                      "location", "source", "contentHash", "productId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  COALESCE(p."contactName", u."companyName", ''),
  p."contactPhone",
  p."contactWechat",
  p."contactEmail",
  ARRAY[COALESCE(b."nameZh", b."nameEn", '')],
  CASE WHEN p."location" IS NOT NULL THEN ARRAY[p."location"] ELSE ARRAY[]::text[] END,
  p."location",
  'product_contact',
  md5('dealer|product|' || p."id" || '|' || COALESCE(p."contactPhone", '')),
  p."id",
  NOW(),
  NOW()
FROM "Product" p
LEFT JOIN "Brand" b ON b."id" = p."brandId"
LEFT JOIN "User" u ON u."id" = p."sellerId"
WHERE p."status" = 'active'
  AND u."companyName" IS NOT NULL
  AND (p."contactPhone" IS NOT NULL OR p."contactWechat" IS NOT NULL OR p."contactEmail" IS NOT NULL)
ON CONFLICT ("contentHash") DO NOTHING;

-- 3) 同步 ValuationLead → Lead（若该表存在；否则整段跳过）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ValuationLead') THEN
    INSERT INTO "Lead" ("id", "source", "name", "phone", "wechat", "whatsapp", "email",
                        "brand", "model", "contentHash", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      'valuation_lead',
      '',
      NULL,
      NULL,
      NULL,
      vl."email",
      vl."valuationParams"->>'brand',
      vl."valuationParams"->>'model',
      md5('lead|valuation|' || COALESCE(vl."email", '') || '|' || COALESCE(vl."paramsHash", '')),
      NOW(),
      NOW()
    FROM "ValuationLead" vl
    ON CONFLICT ("contentHash") DO NOTHING;
  END IF;
END $$;
