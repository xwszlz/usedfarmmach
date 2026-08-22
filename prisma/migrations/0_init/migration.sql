-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "emailPending" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "consentCrossBorderAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "companyName" TEXT,
    "country" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'zh',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "freeValuationsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "freeValuationsUsed" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "membershipExpiresAt" TIMESTAMP(3),
    "membershipTier" TEXT NOT NULL DEFAULT 'free',
    "usagePeriodStart" TIMESTAMP(3),
    "usagePublish" INTEGER NOT NULL DEFAULT 0,
    "usageInquiry" INTEGER NOT NULL DEFAULT 0,
    "usageAiValuation" INTEGER NOT NULL DEFAULT 0,
    "usageViewContact" INTEGER NOT NULL DEFAULT 0,
    "username" TEXT,
    "resetToken" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "wxOpenid" TEXT,
    "miniOpenid" TEXT,
    "inviteCode" TEXT,
    "invitedViaCode" TEXT,
    "lifetime" BOOLEAN NOT NULL DEFAULT false,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceFingerprint" TEXT,
    "registerIp" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "originCountry" TEXT NOT NULL,
    "isImported" BOOLEAN NOT NULL DEFAULT false,
    "nameRu" TEXT NOT NULL DEFAULT '',
    "nameEs" TEXT NOT NULL DEFAULT '',
    "namePt" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT NOT NULL DEFAULT '',
    "nameFr" TEXT NOT NULL DEFAULT '',
    "nameHi" TEXT NOT NULL DEFAULT '',
    "brandTier" TEXT,
    "establishedYear" INTEGER,
    "expoCoverUrl" TEXT,
    "expoLogoUrl" TEXT,
    "expoSlug" TEXT,
    "expoStory" TEXT,
    "exportVolume" TEXT,
    "isChineseBrand" BOOLEAN NOT NULL DEFAULT false,
    "officialWebsite" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "parentId" TEXT,
    "nameRu" TEXT NOT NULL DEFAULT '',
    "nameEs" TEXT NOT NULL DEFAULT '',
    "namePt" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT NOT NULL DEFAULT '',
    "nameFr" TEXT NOT NULL DEFAULT '',
    "nameHi" TEXT NOT NULL DEFAULT '',
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "workingHours" INTEGER,
    "condition" TEXT NOT NULL,
    "priceCny" DOUBLE PRECISION NOT NULL,
    "priceUsd" DOUBLE PRECISION,
    "location" TEXT NOT NULL,
    "descriptionZh" TEXT,
    "descriptionEn" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "descriptionRu" TEXT,
    "descriptionEs" TEXT,
    "descriptionPt" TEXT,
    "descriptionAr" TEXT,
    "descriptionFr" TEXT,
    "descriptionHi" TEXT,
    "driveSystem" TEXT,
    "enginePower" INTEGER,
    "engineType" TEXT,
    "mainConfig" TEXT,
    "netWeight" DOUBLE PRECISION,
    "overallHeight" DOUBLE PRECISION,
    "overallLength" DOUBLE PRECISION,
    "overallWidth" DOUBLE PRECISION,
    "priceMode" TEXT NOT NULL DEFAULT 'por',
    "standardDescriptionEn" TEXT,
    "tradePort" TEXT,
    "tradeTerm" TEXT NOT NULL DEFAULT 'FOB',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "city" TEXT,
    "country" TEXT,
    "province" TEXT,
    "promotedUntil" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "refreshedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "angleLabel" TEXT,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVideo" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "duration" INTEGER,
    "fileSize" INTEGER,
    "moderatedAt" TIMESTAMP(3),
    "moderationStatus" TEXT DEFAULT 'pending',
    "playCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'miniprogram',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demand" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "targetCountry" TEXT NOT NULL,
    "categoryId" TEXT,
    "brandId" TEXT,
    "budgetMinUsd" DOUBLE PRECISION,
    "budgetMaxUsd" DOUBLE PRECISION,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "deadlineMonths" INTEGER,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "guaranteeIntentId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternationalPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceForeignCny" DOUBLE PRECISION NOT NULL,
    "priceForeignRaw" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "exchangeRate" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceDate" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastVerified" TIMESTAMP(3),

    CONSTRAINT "InternationalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "brandId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "workingHours" INTEGER,
    "estimatedPriceCny" DOUBLE PRECISION NOT NULL,
    "estimatedPriceUsd" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "factors" TEXT,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandBenchmark" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "brandNameZh" TEXT,
    "model" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceSite" TEXT NOT NULL,
    "priceForeign" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "priceCny" DOUBLE PRECISION NOT NULL,
    "exchangeRate" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "sourceDate" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sampleSize" INTEGER NOT NULL DEFAULT 1,
    "medianPrice" DOUBLE PRECISION,
    "listingCount" INTEGER NOT NULL DEFAULT 0,
    "priceType" TEXT NOT NULL DEFAULT 'listing',
    "region" TEXT,
    "lastVerified" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "reason" TEXT,
    "relatedId" TEXT,
    "account" TEXT,
    "lotId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "breakdown" TEXT,
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'CNY',
    "targetCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'exchangerate-api',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArbitrageTopCache" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "domesticPrice" DOUBLE PRECISION NOT NULL,
    "foreignPrice" DOUBLE PRECISION NOT NULL,
    "priceDiff" DOUBLE PRECISION NOT NULL,
    "priceDiffPercent" DOUBLE PRECISION NOT NULL,
    "profitMargin" DOUBLE PRECISION,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArbitrageTopCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleZh" TEXT NOT NULL,
    "titleEn" TEXT,
    "titleRu" TEXT,
    "contentZh" TEXT NOT NULL,
    "contentEn" TEXT,
    "contentRu" TEXT,
    "excerptZh" TEXT,
    "excerptEn" TEXT,
    "excerptRu" TEXT,
    "coverImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "category" TEXT,
    "tags" TEXT,
    "sourcePlatform" TEXT,
    "sourceUrl" TEXT,
    "metaTitle" TEXT,
    "metaDesc" TEXT,
    "keywords" TEXT,
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tagsEn" TEXT,
    "tagsRu" TEXT,
    "contentEs" TEXT,
    "contentPt" TEXT,
    "excerptEs" TEXT,
    "excerptPt" TEXT,
    "tagsEs" TEXT,
    "tagsPt" TEXT,
    "titleEs" TEXT,
    "titlePt" TEXT,
    "contentAr" TEXT,
    "contentFr" TEXT,
    "contentHi" TEXT,
    "excerptAr" TEXT,
    "excerptFr" TEXT,
    "excerptHi" TEXT,
    "tagsAr" TEXT,
    "tagsFr" TEXT,
    "tagsHi" TEXT,
    "titleAr" TEXT,
    "titleFr" TEXT,
    "titleHi" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketIntel" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "icon" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "url" TEXT,
    "detailedContent" TEXT,
    "dataSummary" TEXT,
    "actionTips" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "detailedContentEn" TEXT,
    "detailedContentRu" TEXT,
    "regionEn" TEXT,
    "regionRu" TEXT,
    "tagsEn" TEXT,
    "tagsRu" TEXT,
    "textEn" TEXT,
    "textRu" TEXT,
    "detailedContentEs" TEXT,
    "detailedContentPt" TEXT,
    "regionEs" TEXT,
    "regionPt" TEXT,
    "tagsEs" TEXT,
    "tagsPt" TEXT,
    "textEs" TEXT,
    "textPt" TEXT,
    "detailedContentAr" TEXT,
    "detailedContentFr" TEXT,
    "detailedContentHi" TEXT,
    "regionAr" TEXT,
    "regionFr" TEXT,
    "regionHi" TEXT,
    "tagsAr" TEXT,
    "tagsFr" TEXT,
    "tagsHi" TEXT,
    "textAr" TEXT,
    "textFr" TEXT,
    "textHi" TEXT,

    CONSTRAINT "MarketIntel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "productId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawListing" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "brandName" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "year" INTEGER,
    "workingHours" INTEGER,
    "condition" TEXT,
    "priceRaw" DOUBLE PRECISION,
    "currency" TEXT,
    "priceCny" DOUBLE PRECISION,
    "location" TEXT NOT NULL,
    "sellerName" TEXT,
    "sellerPhone" TEXT,
    "sellerWechat" TEXT,
    "sellerWhatsapp" TEXT,
    "images" TEXT,
    "contentHash" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDefinition" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "schedule" TEXT,
    "endpoint" TEXT,
    "dependencies" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "config" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRunLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "result" TEXT,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialService" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerLogo" TEXT,
    "interestRate" DOUBLE PRECISION,
    "maxAmount" DOUBLE PRECISION,
    "maxTerm" INTEGER,
    "downPayment" DOUBLE PRECISION,
    "coverage" TEXT,
    "premium" DOUBLE PRECISION,
    "description" TEXT,
    "requirements" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "productId" TEXT,
    "applicantName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "companyName" TEXT,
    "appliedAmount" DOUBLE PRECISION NOT NULL,
    "appliedTerm" INTEGER,
    "purpose" TEXT,
    "idCardUrl" TEXT,
    "assetProofUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "approvedAmount" DOUBLE PRECISION,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "contractId" TEXT,
    "warrantyType" TEXT NOT NULL,
    "coverage" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "provider" TEXT,
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warrantyId" TEXT,
    "serviceCenterId" TEXT,
    "maintenanceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cost" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "technician" TEXT,
    "partsReplaced" TEXT,
    "photos" TEXT,
    "notes" TEXT,
    "rating" INTEGER,
    "ratingComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'read',
    "rateLimitPerHour" INTEGER NOT NULL DEFAULT 100,
    "rateLimitPerDay" INTEGER NOT NULL DEFAULT 1000,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "initialAmount" INTEGER NOT NULL,
    "remainingAmount" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 1,
    "streakDay" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'bound',
    "certRewarded" BOOLEAN NOT NULL DEFAULT false,
    "firstPublishRewarded" BOOLEAN NOT NULL DEFAULT false,
    "firstPayRewarded" BOOLEAN NOT NULL DEFAULT false,
    "riskFlag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMilestone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "amountCny" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "screenshotUrl" TEXT,
    "note" TEXT,
    "adminNote" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "creditsCost" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyQuota" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RiskReview" (
    "id" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationReportOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'created',
    "reportHtml" TEXT,
    "productInfo" JSONB,
    "valuationResult" JSONB,
    "productName" TEXT,
    "productId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValuationReportOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PiiAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'view_full',
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PiiAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSendLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineryIdentity" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "serialNo" TEXT,
    "manufactureDate" TEXT,
    "factoryName" TEXT,
    "factoryLocation" TEXT,
    "verifyHash" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineryIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineryEvent" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "operator" TEXT,
    "location" TEXT,
    "evidence" TEXT,
    "metadata" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "applicantName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "businessLicenseNo" TEXT,
    "businessLicenseImg" TEXT,
    "legalPerson" TEXT,
    "registeredCapital" TEXT,
    "businessScope" TEXT,
    "personnelName" TEXT,
    "personnelCertNo" TEXT,
    "personnelCertImg" TEXT,
    "personnelLevel" TEXT,
    "productId" TEXT,
    "inspectionReportNo" TEXT,
    "inspectionReportImg" TEXT,
    "inspectionGrade" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "inspectionOrg" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'county',
    "province" TEXT NOT NULL,
    "city" TEXT,
    "district" TEXT,
    "address" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "services" TEXT,
    "businessHours" TEXT,
    "images" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionReport" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "inspectorName" TEXT NOT NULL,
    "inspectionOrg" TEXT,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallGrade" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "inspectionItems" TEXT NOT NULL,
    "summary" TEXT,
    "recommendations" TEXT,
    "photos" TEXT,
    "reportPdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainRecord" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "previousHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorId" TEXT,
    "operatorName" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL DEFAULT '',
    "nameEs" TEXT NOT NULL DEFAULT '',
    "namePt" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT NOT NULL DEFAULT '',
    "nameFr" TEXT NOT NULL DEFAULT '',
    "nameHi" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubSystem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL DEFAULT '',
    "nameEs" TEXT NOT NULL DEFAULT '',
    "namePt" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT NOT NULL DEFAULT '',
    "nameFr" TEXT NOT NULL DEFAULT '',
    "nameHi" TEXT NOT NULL DEFAULT '',
    "machineTypeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL DEFAULT '',
    "nameEs" TEXT NOT NULL DEFAULT '',
    "namePt" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT NOT NULL DEFAULT '',
    "nameFr" TEXT NOT NULL DEFAULT '',
    "nameHi" TEXT NOT NULL DEFAULT '',
    "subSystemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL DEFAULT '',
    "nameEs" TEXT NOT NULL DEFAULT '',
    "namePt" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT NOT NULL DEFAULT '',
    "nameFr" TEXT NOT NULL DEFAULT '',
    "nameHi" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL,
    "oemNumber" TEXT,
    "componentGroupId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "stockStatus" TEXT NOT NULL DEFAULT 'in_stock',
    "images" TEXT[],
    "descriptionZh" TEXT,
    "descriptionEn" TEXT,
    "descriptionRu" TEXT,
    "specs" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOEM" BOOLEAN NOT NULL DEFAULT false,
    "isAftermarket" BOOLEAN NOT NULL DEFAULT false,
    "dataSource" TEXT NOT NULL DEFAULT 'manual',
    "dataQuality" TEXT NOT NULL DEFAULT 'verified',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatibleMachine" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "yearRange" TEXT,
    "notes" TEXT,

    CONSTRAINT "CompatibleMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_legacy" (
    "id" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "nameRu" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "stockStatus" TEXT NOT NULL DEFAULT 'in_stock',
    "compatibleModels" TEXT[],
    "images" TEXT[],
    "descriptionZh" TEXT,
    "descriptionEn" TEXT,
    "descriptionRu" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_legacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachinePart" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "partSource" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachinePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpoRegistration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "wechat" TEXT,
    "email" TEXT,
    "company" TEXT,
    "country" TEXT,
    "category" TEXT,
    "boothType" TEXT,
    "intentDevice" TEXT,
    "visitDate" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'website',
    "expoType" TEXT NOT NULL DEFAULT 'virtual',
    "locale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpoRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "description" TEXT,
    "bannerUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booth" (
    "id" TEXT NOT NULL,
    "expoId" TEXT NOT NULL,
    "merchantId" TEXT,
    "name" TEXT NOT NULL,
    "hall" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'standard',
    "status" TEXT NOT NULL DEFAULT 'empty',
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "coverImage" TEXT,
    "intro" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT,
    "pavilion" TEXT NOT NULL DEFAULT 'china',
    "tier" TEXT NOT NULL DEFAULT 'standard',

    CONSTRAINT "Booth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowcaseItem" (
    "id" TEXT NOT NULL,
    "boothId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "workingHours" INTEGER,
    "condition" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "images" TEXT[],
    "videos" TEXT[],
    "specs" TEXT,
    "description" TEXT,
    "productId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "arModelUrl" TEXT,
    "brandId" TEXT,
    "brochureUrl" TEXT,
    "country" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "descriptionEs" TEXT,
    "descriptionFr" TEXT,
    "descriptionHi" TEXT,
    "descriptionPt" TEXT,
    "descriptionRu" TEXT,
    "descriptionZh" TEXT,
    "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isChineseMade" BOOLEAN DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isNewLaunch" BOOLEAN NOT NULL DEFAULT false,
    "itemType" TEXT NOT NULL DEFAULT 'used',
    "launchYear" INTEGER,
    "machineTier" TEXT,
    "msrpCny" DOUBLE PRECISION,
    "msrpUsd" DOUBLE PRECISION,
    "origin" TEXT,
    "priceRange" TEXT,
    "series" TEXT,

    CONSTRAINT "ShowcaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpoInquiry" (
    "id" TEXT NOT NULL,
    "showcaseItemId" TEXT,
    "boothId" TEXT,
    "merchantId" TEXT,
    "buyerId" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "buyerWechat" TEXT,
    "buyerCountry" TEXT,
    "message" TEXT NOT NULL,
    "intent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpoInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT,
    "showcaseItemId" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "deliveryTime" TEXT,
    "paymentTerms" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "counterPrice" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "quoteId" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "paymentMethod" TEXT,
    "paymentId" TEXT,
    "escrowStatus" TEXT,
    "trackingNumber" TEXT,
    "shippingCompany" TEXT,
    "contractUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "images" TEXT[],
    "itemMatchScore" INTEGER,
    "serviceScore" INTEGER,
    "logisticsScore" INTEGER,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldVideo" (
    "id" TEXT NOT NULL,
    "boothId" TEXT,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "machineType" TEXT,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'qr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuaranteeIntent" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT,
    "productId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "amountCny" DOUBLE PRECISION NOT NULL,
    "wechatSubMerchantId" TEXT NOT NULL,
    "wechatOrderNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuaranteeIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountLink" (
    "id" TEXT NOT NULL,
    "comUserId" TEXT NOT NULL,
    "cnUserId" TEXT NOT NULL,
    "linkToken" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeInvoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'paid',
    "paidAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceIndex" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "region" TEXT,
    "indexValue" DOUBLE PRECISION NOT NULL,
    "avgPriceCny" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "monthOverMonth" DOUBLE PRECISION,
    "yearOverYear" DOUBLE PRECISION,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "keyMetrics" TEXT,
    "topBrands" TEXT,
    "topCategories" TEXT,
    "priceTrends" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteStat" (
    "id" TEXT NOT NULL,
    "totalPageViews" INTEGER NOT NULL DEFAULT 0,
    "totalProductViews" INTEGER NOT NULL DEFAULT 0,
    "totalCategoryViews" INTEGER NOT NULL DEFAULT 0,
    "totalVideoPlays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auctioneer" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "licenseNo" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "phone" TEXT,
    "isAffiliated" BOOLEAN NOT NULL DEFAULT true,
    "hostedCount" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auctioneer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "buyerPaid" DOUBLE PRECISION NOT NULL,
    "hammerPrice" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionRegistration" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "depositAmount" DOUBLE PRECISION,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositConfirmedAt" TIMESTAMP(3),
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalListing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "rentalType" TEXT NOT NULL,
    "pricePerDay" DOUBLE PRECISION,
    "pricePerMonth" DOUBLE PRECISION,
    "pricePerYear" DOUBLE PRECISION,
    "deposit" DOUBLE PRECISION,
    "minRentalPeriod" INTEGER,
    "maxRentalPeriod" INTEGER,
    "deliveryAvailable" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFee" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellerAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending_deposit',
    "paidAt" TIMESTAMP(3),
    "escrowStartedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "buyerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "buyerConfirmedAt" TIMESTAMP(3),
    "autoReleaseAt" TIMESTAMP(3),
    "deliveryAddress" TEXT,
    "deliveryCompany" TEXT,
    "trackingNo" TEXT,
    "shippedAt" TIMESTAMP(3),
    "disputeStatus" TEXT,
    "disputeReason" TEXT,
    "disputeOpenedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "balanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceExpiredAt" TIMESTAMP(3),
    "balanceMethod" TEXT,
    "balancePaidAt" TIMESTAMP(3),
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositExpiredAt" TIMESTAMP(3),
    "depositPaidAt" TIMESTAMP(3),

    CONSTRAINT "EscrowOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "transactionId" TEXT,
    "prepayId" TEXT,
    "tradeNo" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rawRequest" TEXT,
    "rawResponse" TEXT,
    "rawCallback" TEXT,
    "paidAt" TIMESTAMP(3),
    "callbackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovSubsidyPolicy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "policyNumber" TEXT,
    "region" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "machineryTypes" TEXT,
    "subsidyAmount" DOUBLE PRECISION,
    "subsidyRatio" DOUBLE PRECISION,
    "maxSubsidy" DOUBLE PRECISION,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "applicationUrl" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovSubsidyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovMachineryData" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "registrationNo" TEXT,
    "plateNumber" TEXT,
    "ownerName" TEXT,
    "brandName" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enginePower" DOUBLE PRECISION,
    "emissionStandard" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "inspectionResult" TEXT,
    "registrationStatus" TEXT DEFAULT 'active',
    "dataSource" TEXT NOT NULL DEFAULT 'gov_registry',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovMachineryData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverseasWarehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "warehouseType" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION,
    "area" DOUBLE PRECISION,
    "services" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverseasWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservePrice" DOUBLE PRECISION,
    "priceIncrement" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "deposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "winnerId" TEXT,
    "winningBid" DOUBLE PRECISION,
    "totalBids" INTEGER NOT NULL DEFAULT 0,
    "totalBidders" INTEGER NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "contractId" TEXT,
    "coverImage" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedBidId" TEXT,
    "acceptedPrice" DOUBLE PRECISION,
    "sellerQuoteAmount" DOUBLE PRECISION,
    "sellerQuoteMsg" TEXT,
    "sellerQuoteAt" TIMESTAMP(3),
    "askingPrice" DOUBLE PRECISION NOT NULL,
    "bargainNo" TEXT NOT NULL,
    "announcementNo" TEXT,
    "announcementHtml" TEXT,
    "contractTemplateNo" TEXT,
    "contractHtml" TEXT,
    "evaluationPrice" DOUBLE PRECISION,
    "knownFlaws" TEXT,
    "minParticipants" INTEGER NOT NULL DEFAULT 3,
    "paymentDeadline" TIMESTAMP(3),
    "auctionMode" TEXT NOT NULL DEFAULT 'BLIND',
    "hammerPrice" DOUBLE PRECISION,
    "auctioneerId" TEXT,
    "settlementId" TEXT,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isWinning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionBooking" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3),
    "flawConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "riskConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" DOUBLE PRECISION,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositProofUrl" TEXT,
    "depositConfirmedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "type" TEXT NOT NULL DEFAULT 'bargain',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "templateNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contractType" TEXT NOT NULL DEFAULT 'sale',
    "sellerName" TEXT NOT NULL,
    "sellerCreditCode" TEXT,
    "sellerAddress" TEXT,
    "sellerPhone" TEXT,
    "sellerLegalPerson" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNo" TEXT,
    "content" TEXT NOT NULL,
    "paymentDays" INTEGER NOT NULL DEFAULT 2,
    "deliveryDays" INTEGER NOT NULL DEFAULT 3,
    "transferResponsibility" TEXT NOT NULL DEFAULT 'buyer',
    "courtJurisdiction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicContract" (
    "id" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contractType" TEXT NOT NULL DEFAULT 'sale',
    "tradeTerm" TEXT NOT NULL DEFAULT 'FOB',
    "productInfo" TEXT NOT NULL,
    "priceCny" DOUBLE PRECISION NOT NULL,
    "priceUsd" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "paymentMethod" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "deliveryAddress" TEXT,
    "terms" TEXT NOT NULL,
    "attachments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sellerSignedAt" TIMESTAMP(3),
    "buyerSignedAt" TIMESTAMP(3),
    "sellerSignature" TEXT,
    "buyerSignature" TEXT,
    "pdfUrl" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectronicContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificationEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "notifyOnNew" BOOLEAN NOT NULL DEFAULT false,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerRating" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "productId" TEXT,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "itemMatchScore" INTEGER,
    "serviceScore" INTEGER,
    "logisticsScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_miniOpenid_key" ON "User"("miniOpenid");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_expoSlug_key" ON "Brand"("expoSlug");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductVideo_productId_idx" ON "ProductVideo"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE INDEX "Subscriber_email_idx" ON "Subscriber"("email");

-- CreateIndex
CREATE INDEX "Subscriber_isActive_idx" ON "Subscriber"("isActive");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InternationalPrice_productId_idx" ON "InternationalPrice"("productId");

-- CreateIndex
CREATE INDEX "BrandBenchmark_brand_model_idx" ON "BrandBenchmark"("brand", "model");

-- CreateIndex
CREATE INDEX "BrandBenchmark_category_idx" ON "BrandBenchmark"("category");

-- CreateIndex
CREATE INDEX "BrandBenchmark_sourceSite_idx" ON "BrandBenchmark"("sourceSite");

-- CreateIndex
CREATE INDEX "BrandBenchmark_brand_sourceSite_idx" ON "BrandBenchmark"("brand", "sourceSite");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_type_createdAt_idx" ON "CreditTransaction"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "ExchangeRate_baseCurrency_targetCurrency_idx" ON "ExchangeRate"("baseCurrency", "targetCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_baseCurrency_targetCurrency_effectiveDate_key" ON "ExchangeRate"("baseCurrency", "targetCurrency", "effectiveDate");

-- CreateIndex
CREATE INDEX "ArbitrageTopCache_rank_idx" ON "ArbitrageTopCache"("rank");

-- CreateIndex
CREATE INDEX "ArbitrageTopCache_validUntil_idx" ON "ArbitrageTopCache"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ArbitrageTopCache_productId_rank_key" ON "ArbitrageTopCache"("productId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_category_idx" ON "Article"("category");

-- CreateIndex
CREATE INDEX "Article_sourcePlatform_idx" ON "Article"("sourcePlatform");

-- CreateIndex
CREATE INDEX "MarketIntel_date_idx" ON "MarketIntel"("date");

-- CreateIndex
CREATE INDEX "MarketIntel_isActive_date_idx" ON "MarketIntel"("isActive", "date");

-- CreateIndex
CREATE INDEX "ChatSession_visitorId_status_idx" ON "ChatSession"("visitorId", "status");

-- CreateIndex
CREATE INDEX "ChatSession_productId_idx" ON "ChatSession"("productId");

-- CreateIndex
CREATE INDEX "ChatSession_updatedAt_idx" ON "ChatSession"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RawListing_contentHash_key" ON "RawListing"("contentHash");

-- CreateIndex
CREATE INDEX "RawListing_status_scrapedAt_idx" ON "RawListing"("status", "scrapedAt");

-- CreateIndex
CREATE INDEX "RawListing_source_scrapedAt_idx" ON "RawListing"("source", "scrapedAt");

-- CreateIndex
CREATE INDEX "RawListing_contentHash_idx" ON "RawListing"("contentHash");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDefinition_agentId_key" ON "AgentDefinition"("agentId");

-- CreateIndex
CREATE INDEX "AgentDefinition_status_agentId_idx" ON "AgentDefinition"("status", "agentId");

-- CreateIndex
CREATE INDEX "AgentRunLog_agentId_startedAt_idx" ON "AgentRunLog"("agentId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRunLog_status_startedAt_idx" ON "AgentRunLog"("status", "startedAt");

-- CreateIndex
CREATE INDEX "FinancialService_serviceType_isActive_idx" ON "FinancialService"("serviceType", "isActive");

-- CreateIndex
CREATE INDEX "LoanApplication_userId_status_idx" ON "LoanApplication"("userId", "status");

-- CreateIndex
CREATE INDEX "LoanApplication_status_createdAt_idx" ON "LoanApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Warranty_productId_status_idx" ON "Warranty"("productId", "status");

-- CreateIndex
CREATE INDEX "Warranty_endDate_idx" ON "Warranty"("endDate");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_productId_status_idx" ON "MaintenanceRecord"("productId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_status_scheduledDate_idx" ON "MaintenanceRecord"("status", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_status_idx" ON "ApiKey"("userId", "status");

-- CreateIndex
CREATE INDEX "ApiKey_status_idx" ON "ApiKey"("status");

-- CreateIndex
CREATE INDEX "CreditLot_userId_account_expiresAt_idx" ON "CreditLot"("userId", "account", "expiresAt");

-- CreateIndex
CREATE INDEX "CreditLot_expiresAt_remainingAmount_idx" ON "CreditLot"("expiresAt", "remainingAmount");

-- CreateIndex
CREATE INDEX "CheckIn_userId_day_idx" ON "CheckIn"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_userId_day_key" ON "CheckIn"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_inviteeId_key" ON "Invitation"("inviteeId");

-- CreateIndex
CREATE INDEX "Invitation_inviterId_createdAt_idx" ON "Invitation"("inviterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserMilestone_userId_event_key" ON "UserMilestone"("userId", "event");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_orderNo_key" ON "ServiceOrder"("orderNo");

-- CreateIndex
CREATE INDEX "ServiceOrder_userId_status_createdAt_idx" ON "ServiceOrder"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_status_createdAt_idx" ON "ServiceOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Promotion_userId_status_idx" ON "Promotion"("userId", "status");

-- CreateIndex
CREATE INDEX "Promotion_type_status_endAt_idx" ON "Promotion"("type", "status", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuota_day_type_key" ON "DailyQuota"("day", "type");

-- CreateIndex
CREATE INDEX "RiskReview_status_createdAt_idx" ON "RiskReview"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ValuationReportOrder_orderNo_key" ON "ValuationReportOrder"("orderNo");

-- CreateIndex
CREATE INDEX "ValuationReportOrder_orderNo_idx" ON "ValuationReportOrder"("orderNo");

-- CreateIndex
CREATE INDEX "ValuationReportOrder_status_createdAt_idx" ON "ValuationReportOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PiiAuditLog_actorId_createdAt_idx" ON "PiiAuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "PiiAuditLog_targetUserId_createdAt_idx" ON "PiiAuditLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSendLog_userId_createdAt_idx" ON "EmailSendLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSendLog_type_createdAt_idx" ON "EmailSendLog"("type", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSendLog_recipientHash_createdAt_idx" ON "EmailSendLog"("recipientHash", "createdAt");

-- CreateIndex
CREATE INDEX "UsageLog_userId_periodStart_idx" ON "UsageLog"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "UsageLog_action_periodStart_idx" ON "UsageLog"("action", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "MachineryIdentity_productId_key" ON "MachineryIdentity"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MachineryIdentity_qrCode_key" ON "MachineryIdentity"("qrCode");

-- CreateIndex
CREATE INDEX "MachineryIdentity_qrCode_idx" ON "MachineryIdentity"("qrCode");

-- CreateIndex
CREATE INDEX "MachineryEvent_identityId_eventDate_idx" ON "MachineryEvent"("identityId", "eventDate");

-- CreateIndex
CREATE INDEX "MachineryEvent_eventType_idx" ON "MachineryEvent"("eventType");

-- CreateIndex
CREATE INDEX "Certification_userId_certType_idx" ON "Certification"("userId", "certType");

-- CreateIndex
CREATE INDEX "Certification_status_idx" ON "Certification"("status");

-- CreateIndex
CREATE INDEX "Certification_certType_status_idx" ON "Certification"("certType", "status");

-- CreateIndex
CREATE INDEX "ServiceCenter_province_level_idx" ON "ServiceCenter"("province", "level");

-- CreateIndex
CREATE INDEX "ServiceCenter_isActive_idx" ON "ServiceCenter"("isActive");

-- CreateIndex
CREATE INDEX "ServiceCenter_level_isActive_idx" ON "ServiceCenter"("level", "isActive");

-- CreateIndex
CREATE INDEX "InspectionReport_productId_idx" ON "InspectionReport"("productId");

-- CreateIndex
CREATE INDEX "InspectionReport_overallGrade_idx" ON "InspectionReport"("overallGrade");

-- CreateIndex
CREATE INDEX "InspectionReport_status_inspectionDate_idx" ON "InspectionReport"("status", "inspectionDate");

-- CreateIndex
CREATE INDEX "BlockchainRecord_productId_blockIndex_idx" ON "BlockchainRecord"("productId", "blockIndex");

-- CreateIndex
CREATE INDEX "BlockchainRecord_currentHash_idx" ON "BlockchainRecord"("currentHash");

-- CreateIndex
CREATE UNIQUE INDEX "MachineType_code_key" ON "MachineType"("code");

-- CreateIndex
CREATE INDEX "MachineType_isActive_sortOrder_idx" ON "MachineType"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "SubSystem_machineTypeId_isActive_idx" ON "SubSystem"("machineTypeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubSystem_machineTypeId_code_key" ON "SubSystem"("machineTypeId", "code");

-- CreateIndex
CREATE INDEX "ComponentGroup_subSystemId_isActive_idx" ON "ComponentGroup"("subSystemId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentGroup_subSystemId_code_key" ON "ComponentGroup"("subSystemId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Part_sku_key" ON "Part"("sku");

-- CreateIndex
CREATE INDEX "Part_componentGroupId_isActive_idx" ON "Part"("componentGroupId", "isActive");

-- CreateIndex
CREATE INDEX "Part_brand_isActive_idx" ON "Part"("brand", "isActive");

-- CreateIndex
CREATE INDEX "Part_sku_idx" ON "Part"("sku");

-- CreateIndex
CREATE INDEX "Part_oemNumber_idx" ON "Part"("oemNumber");

-- CreateIndex
CREATE INDEX "Part_stockStatus_isActive_idx" ON "Part"("stockStatus", "isActive");

-- CreateIndex
CREATE INDEX "CompatibleMachine_partId_idx" ON "CompatibleMachine"("partId");

-- CreateIndex
CREATE INDEX "CompatibleMachine_brand_model_idx" ON "CompatibleMachine"("brand", "model");

-- CreateIndex
CREATE INDEX "part_legacy_category_isActive_idx" ON "part_legacy"("category", "isActive");

-- CreateIndex
CREATE INDEX "part_legacy_brand_isActive_idx" ON "part_legacy"("brand", "isActive");

-- CreateIndex
CREATE INDEX "MachinePart_machineId_idx" ON "MachinePart"("machineId");

-- CreateIndex
CREATE INDEX "MachinePart_partId_idx" ON "MachinePart"("partId");

-- CreateIndex
CREATE INDEX "ExpoRegistration_status_createdAt_idx" ON "ExpoRegistration"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExpoRegistration_expoType_status_idx" ON "ExpoRegistration"("expoType", "status");

-- CreateIndex
CREATE INDEX "ExpoRegistration_source_idx" ON "ExpoRegistration"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Expo_slug_key" ON "Expo"("slug");

-- CreateIndex
CREATE INDEX "Expo_status_startDate_idx" ON "Expo"("status", "startDate");

-- CreateIndex
CREATE INDEX "Expo_type_status_idx" ON "Expo"("type", "status");

-- CreateIndex
CREATE INDEX "Booth_expoId_status_idx" ON "Booth"("expoId", "status");

-- CreateIndex
CREATE INDEX "Booth_hall_status_idx" ON "Booth"("hall", "status");

-- CreateIndex
CREATE INDEX "Booth_merchantId_idx" ON "Booth"("merchantId");

-- CreateIndex
CREATE INDEX "Booth_pavilion_status_idx" ON "Booth"("pavilion", "status");

-- CreateIndex
CREATE INDEX "Booth_tier_status_idx" ON "Booth"("tier", "status");

-- CreateIndex
CREATE INDEX "Booth_brandId_idx" ON "Booth"("brandId");

-- CreateIndex
CREATE INDEX "ShowcaseItem_boothId_status_idx" ON "ShowcaseItem"("boothId", "status");

-- CreateIndex
CREATE INDEX "ShowcaseItem_deviceType_status_idx" ON "ShowcaseItem"("deviceType", "status");

-- CreateIndex
CREATE INDEX "ShowcaseItem_brand_status_idx" ON "ShowcaseItem"("brand", "status");

-- CreateIndex
CREATE INDEX "ShowcaseItem_itemType_status_idx" ON "ShowcaseItem"("itemType", "status");

-- CreateIndex
CREATE INDEX "ShowcaseItem_country_status_idx" ON "ShowcaseItem"("country", "status");

-- CreateIndex
CREATE INDEX "ShowcaseItem_priceRange_status_idx" ON "ShowcaseItem"("priceRange", "status");

-- CreateIndex
CREATE INDEX "ShowcaseItem_hotScore_idx" ON "ShowcaseItem"("hotScore");

-- CreateIndex
CREATE INDEX "ShowcaseItem_isNewLaunch_status_idx" ON "ShowcaseItem"("isNewLaunch", "status");

-- CreateIndex
CREATE INDEX "ExpoInquiry_status_createdAt_idx" ON "ExpoInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExpoInquiry_boothId_status_idx" ON "ExpoInquiry"("boothId", "status");

-- CreateIndex
CREATE INDEX "ExpoInquiry_showcaseItemId_idx" ON "ExpoInquiry"("showcaseItemId");

-- CreateIndex
CREATE INDEX "ExpoInquiry_buyerId_idx" ON "ExpoInquiry"("buyerId");

-- CreateIndex
CREATE INDEX "Quote_buyerId_status_idx" ON "Quote"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Quote_sellerId_status_idx" ON "Quote"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Quote_status_validUntil_idx" ON "Quote"("status", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");

-- CreateIndex
CREATE INDEX "Order_buyerId_status_idx" ON "Order"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Order_sellerId_status_idx" ON "Order"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_orderNo_idx" ON "Order"("orderNo");

-- CreateIndex
CREATE INDEX "Review_revieweeId_status_idx" ON "Review"("revieweeId", "status");

-- CreateIndex
CREATE INDEX "Review_reviewerId_idx" ON "Review"("reviewerId");

-- CreateIndex
CREATE INDEX "Review_orderId_idx" ON "Review"("orderId");

-- CreateIndex
CREATE INDEX "FieldVideo_boothId_idx" ON "FieldVideo"("boothId");

-- CreateIndex
CREATE INDEX "FieldVideo_source_idx" ON "FieldVideo"("source");

-- CreateIndex
CREATE INDEX "GuaranteeIntent_buyerUserId_status_idx" ON "GuaranteeIntent"("buyerUserId", "status");

-- CreateIndex
CREATE INDEX "GuaranteeIntent_sellerUserId_status_idx" ON "GuaranteeIntent"("sellerUserId", "status");

-- CreateIndex
CREATE INDEX "GuaranteeIntent_wechatOrderNo_idx" ON "GuaranteeIntent"("wechatOrderNo");

-- CreateIndex
CREATE INDEX "AccountLink_comUserId_idx" ON "AccountLink"("comUserId");

-- CreateIndex
CREATE INDEX "AccountLink_cnUserId_idx" ON "AccountLink"("cnUserId");

-- CreateIndex
CREATE INDEX "AccountLink_linkToken_idx" ON "AccountLink"("linkToken");

-- CreateIndex
CREATE UNIQUE INDEX "AccountLink_comUserId_cnUserId_key" ON "AccountLink"("comUserId", "cnUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeCustomer_userId_key" ON "StripeCustomer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeCustomer_stripeCustomerId_key" ON "StripeCustomer"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "StripeCustomer_stripeCustomerId_idx" ON "StripeCustomer"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "StripeSubscription_userId_status_idx" ON "StripeSubscription"("userId", "status");

-- CreateIndex
CREATE INDEX "StripeSubscription_stripeCustomerId_status_idx" ON "StripeSubscription"("stripeCustomerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StripeInvoice_stripeInvoiceId_key" ON "StripeInvoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "StripeInvoice_subscriptionId_idx" ON "StripeInvoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "StripeInvoice_stripeInvoiceId_idx" ON "StripeInvoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "PriceIndex_date_idx" ON "PriceIndex"("date");

-- CreateIndex
CREATE INDEX "PriceIndex_category_date_idx" ON "PriceIndex"("category", "date");

-- CreateIndex
CREATE INDEX "PriceIndex_brand_date_idx" ON "PriceIndex"("brand", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceIndex_date_category_brand_region_key" ON "PriceIndex"("date", "category", "brand", "region");

-- CreateIndex
CREATE INDEX "IndustryReport_status_publishedAt_idx" ON "IndustryReport"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "IndustryReport_reportType_period_idx" ON "IndustryReport"("reportType", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Auctioneer_licenseNo_key" ON "Auctioneer"("licenseNo");

-- CreateIndex
CREATE INDEX "Auctioneer_licenseNo_idx" ON "Auctioneer"("licenseNo");

-- CreateIndex
CREATE INDEX "Auctioneer_isAffiliated_idx" ON "Auctioneer"("isAffiliated");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_auctionId_key" ON "Settlement"("auctionId");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- CreateIndex
CREATE INDEX "Settlement_auctionId_idx" ON "Settlement"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionRegistration_auctionId_eligible_idx" ON "AuctionRegistration"("auctionId", "eligible");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionRegistration_auctionId_bidderId_key" ON "AuctionRegistration"("auctionId", "bidderId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalListing_productId_key" ON "RentalListing"("productId");

-- CreateIndex
CREATE INDEX "RentalListing_status_rentalType_idx" ON "RentalListing"("status", "rentalType");

-- CreateIndex
CREATE INDEX "RentalListing_ownerId_status_idx" ON "RentalListing"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowOrder_orderNo_key" ON "EscrowOrder"("orderNo");

-- CreateIndex
CREATE INDEX "EscrowOrder_buyerId_paymentStatus_idx" ON "EscrowOrder"("buyerId", "paymentStatus");

-- CreateIndex
CREATE INDEX "EscrowOrder_sellerId_paymentStatus_idx" ON "EscrowOrder"("sellerId", "paymentStatus");

-- CreateIndex
CREATE INDEX "EscrowOrder_productId_idx" ON "EscrowOrder"("productId");

-- CreateIndex
CREATE INDEX "EscrowOrder_paymentStatus_createdAt_idx" ON "EscrowOrder"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "EscrowOrder_autoReleaseAt_idx" ON "EscrowOrder"("autoReleaseAt");

-- CreateIndex
CREATE INDEX "PaymentRecord_orderId_idx" ON "PaymentRecord"("orderId");

-- CreateIndex
CREATE INDEX "PaymentRecord_transactionId_idx" ON "PaymentRecord"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");

-- CreateIndex
CREATE INDEX "GovSubsidyPolicy_region_status_idx" ON "GovSubsidyPolicy"("region", "status");

-- CreateIndex
CREATE INDEX "GovSubsidyPolicy_category_status_idx" ON "GovSubsidyPolicy"("category", "status");

-- CreateIndex
CREATE INDEX "GovSubsidyPolicy_effectiveDate_idx" ON "GovSubsidyPolicy"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "GovMachineryData_productId_key" ON "GovMachineryData"("productId");

-- CreateIndex
CREATE INDEX "GovMachineryData_brandName_category_idx" ON "GovMachineryData"("brandName", "category");

-- CreateIndex
CREATE INDEX "GovMachineryData_registrationNo_idx" ON "GovMachineryData"("registrationNo");

-- CreateIndex
CREATE INDEX "OverseasWarehouse_country_status_idx" ON "OverseasWarehouse"("country", "status");

-- CreateIndex
CREATE INDEX "OverseasWarehouse_warehouseType_status_idx" ON "OverseasWarehouse"("warehouseType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_acceptedBidId_key" ON "Auction"("acceptedBidId");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_bargainNo_key" ON "Auction"("bargainNo");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_settlementId_key" ON "Auction"("settlementId");

-- CreateIndex
CREATE INDEX "Auction_status_createdAt_idx" ON "Auction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Auction_sellerId_idx" ON "Auction"("sellerId");

-- CreateIndex
CREATE INDEX "Auction_productId_idx" ON "Auction"("productId");

-- CreateIndex
CREATE INDEX "Bid_auctionId_amount_idx" ON "Bid"("auctionId", "amount");

-- CreateIndex
CREATE INDEX "Bid_bidderId_idx" ON "Bid"("bidderId");

-- CreateIndex
CREATE INDEX "InspectionBooking_auctionId_status_idx" ON "InspectionBooking"("auctionId", "status");

-- CreateIndex
CREATE INDEX "InspectionBooking_userId_idx" ON "InspectionBooking"("userId");

-- CreateIndex
CREATE INDEX "InspectionBooking_status_createdAt_idx" ON "InspectionBooking"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_templateNo_key" ON "ContractTemplate"("templateNo");

-- CreateIndex
CREATE INDEX "ContractTemplate_status_idx" ON "ContractTemplate"("status");

-- CreateIndex
CREATE INDEX "ContractTemplate_contractType_idx" ON "ContractTemplate"("contractType");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicContract_contractNo_key" ON "ElectronicContract"("contractNo");

-- CreateIndex
CREATE INDEX "ElectronicContract_sellerId_status_idx" ON "ElectronicContract"("sellerId", "status");

-- CreateIndex
CREATE INDEX "ElectronicContract_buyerId_status_idx" ON "ElectronicContract"("buyerId", "status");

-- CreateIndex
CREATE INDEX "ElectronicContract_productId_idx" ON "ElectronicContract"("productId");

-- CreateIndex
CREATE INDEX "ElectronicContract_status_createdAt_idx" ON "ElectronicContract"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_productId_key" ON "Favorite"("userId", "productId");

-- CreateIndex
CREATE INDEX "Follow_userId_createdAt_idx" ON "Follow"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Follow_sellerId_idx" ON "Follow"("sellerId");

-- CreateIndex
CREATE INDEX "Follow_notificationEnabled_idx" ON "Follow"("notificationEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_userId_sellerId_key" ON "Follow"("userId", "sellerId");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_createdAt_idx" ON "SavedSearch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerRating_sellerId_createdAt_idx" ON "SellerRating"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerRating_raterId_idx" ON "SellerRating"("raterId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerRating_sellerId_raterId_productId_key" ON "SellerRating"("sellerId", "raterId", "productId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVideo" ADD CONSTRAINT "ProductVideo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_guaranteeIntentId_fkey" FOREIGN KEY ("guaranteeIntentId") REFERENCES "GuaranteeIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternationalPrice" ADD CONSTRAINT "InternationalPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArbitrageTopCache" ADD CONSTRAINT "ArbitrageTopCache_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunLog" ADD CONSTRAINT "AgentRunLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "FinancialService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ElectronicContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_serviceCenterId_fkey" FOREIGN KEY ("serviceCenterId") REFERENCES "ServiceCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLot" ADD CONSTRAINT "CreditLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMilestone" ADD CONSTRAINT "UserMilestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineryIdentity" ADD CONSTRAINT "MachineryIdentity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineryEvent" ADD CONSTRAINT "MachineryEvent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "MachineryIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReport" ADD CONSTRAINT "InspectionReport_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReport" ADD CONSTRAINT "InspectionReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainRecord" ADD CONSTRAINT "BlockchainRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubSystem" ADD CONSTRAINT "SubSystem_machineTypeId_fkey" FOREIGN KEY ("machineTypeId") REFERENCES "MachineType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentGroup" ADD CONSTRAINT "ComponentGroup_subSystemId_fkey" FOREIGN KEY ("subSystemId") REFERENCES "SubSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_componentGroupId_fkey" FOREIGN KEY ("componentGroupId") REFERENCES "ComponentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibleMachine" ADD CONSTRAINT "CompatibleMachine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booth" ADD CONSTRAINT "Booth_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booth" ADD CONSTRAINT "Booth_expoId_fkey" FOREIGN KEY ("expoId") REFERENCES "Expo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booth" ADD CONSTRAINT "Booth_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowcaseItem" ADD CONSTRAINT "ShowcaseItem_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowcaseItem" ADD CONSTRAINT "ShowcaseItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpoInquiry" ADD CONSTRAINT "ExpoInquiry_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpoInquiry" ADD CONSTRAINT "ExpoInquiry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpoInquiry" ADD CONSTRAINT "ExpoInquiry_showcaseItemId_fkey" FOREIGN KEY ("showcaseItemId") REFERENCES "ShowcaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldVideo" ADD CONSTRAINT "FieldVideo_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeIntent" ADD CONSTRAINT "GuaranteeIntent_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeIntent" ADD CONSTRAINT "GuaranteeIntent_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLink" ADD CONSTRAINT "AccountLink_comUserId_fkey" FOREIGN KEY ("comUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLink" ADD CONSTRAINT "AccountLink_cnUserId_fkey" FOREIGN KEY ("cnUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripeCustomer" ADD CONSTRAINT "StripeCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripeSubscription" ADD CONSTRAINT "StripeSubscription_stripeCustomerId_fkey" FOREIGN KEY ("stripeCustomerId") REFERENCES "StripeCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripeSubscription" ADD CONSTRAINT "StripeSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripeInvoice" ADD CONSTRAINT "StripeInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "StripeSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionRegistration" ADD CONSTRAINT "AuctionRegistration_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionRegistration" ADD CONSTRAINT "AuctionRegistration_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowOrder" ADD CONSTRAINT "EscrowOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowOrder" ADD CONSTRAINT "EscrowOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowOrder" ADD CONSTRAINT "EscrowOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EscrowOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovMachineryData" ADD CONSTRAINT "GovMachineryData_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionBooking" ADD CONSTRAINT "InspectionBooking_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionBooking" ADD CONSTRAINT "InspectionBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicContract" ADD CONSTRAINT "ElectronicContract_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicContract" ADD CONSTRAINT "ElectronicContract_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicContract" ADD CONSTRAINT "ElectronicContract_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerRating" ADD CONSTRAINT "SellerRating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerRating" ADD CONSTRAINT "SellerRating_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

