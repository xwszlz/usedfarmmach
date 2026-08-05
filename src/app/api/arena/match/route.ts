import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";
import { rankCandidates } from "@/lib/arena/scoring-engine";
import type { ArenaInput, ArenaMatchResult } from "@/lib/arena/types";

export const dynamic = "force-dynamic";

// 品类关键词映射
const CATEGORY_KEYWORDS: Record<string, { en: string; zh: string }> = {
  tractor: { en: "tractor", zh: "拖拉机" },
  harvester: { en: "harvest", zh: "收割" },
  baler: { en: "baler", zh: "打捆" },
  wrapper: { en: "wrapper", zh: "裹包" },
};

// ShowcaseItem deviceType 关键词（文本字段，用 contains 查询）
const SHOWCASE_DEVICE_KEYWORDS: Record<string, string[]> = {
  tractor: ["拖拉机", "tractor", "Tractor"],
  harvester: ["收割", "harvest", "Harvest"],
  baler: ["打捆", "baler", "Baler"],
  wrapper: ["裹包", "wrapper", "Wrapper"],
};

// 价格区间 → 估算 CNY 价格
const PRICE_RANGE_MAP: Record<string, number> = {
  economy: 50000,
  mid: 150000,
  high: 300000,
  flagship: 600000,
  ultra: 1000000,
  inquire: 200000,
};

const PRODUCT_INCLUDE = {
  brand: true,
  category: true,
  images: {
    orderBy: { sortOrder: "asc" as const },
    take: 1,
  },
  seller: {
    select: {
      id: true,
      companyName: true,
      country: true,
    },
  },
};

const SHOWCASE_INCLUDE = {
  brandRel: true,
  booth: { select: { name: true, pavilion: true } },
};

/**
 * 归一化 Product → 统一格式
 */
function normalizeProduct(p: any): any {
  return {
    ...p,
    source: "used" as const,
    showcaseId: null,
    modelName: p.modelName || p.title || "",
    images: p.images?.map((img: any) => ({ ...img, url: getImageUrl(img.url) })) || [],
    priceCny: p.priceCny || 0,
  };
}

/**
 * 归一化 ShowcaseItem → 统一格式
 */
function normalizeShowcaseItem(item: any): any {
  // 确定 CNY 价格
  let priceCny = item.msrpCny;
  if (!priceCny && item.msrpUsd) priceCny = item.msrpUsd * 7.2;
  if (!priceCny && item.price) {
    priceCny = item.currency === "USD" ? item.price * 7.2 : item.price;
  }
  if (!priceCny) {
    priceCny = PRICE_RANGE_MAP[item.priceRange || ""] || 200000;
  }

  // 确定年份
  const year = item.year || item.launchYear || 2024;

  // 新机 condition = "new"，workingHours = 0
  const isNew = item.itemType === "new";
  const condition = isNew ? "new" : (item.condition || "good");
  const workingHours = isNew ? 0 : (item.workingHours ?? null);

  // 从 specs JSON 解析马力
  let enginePower: number | null = null;
  if (item.specs) {
    try {
      const specs = JSON.parse(item.specs);
      enginePower = Number(specs.enginePower || specs.power || specs.hp) || null;
    } catch {
      // ignore parse error
    }
  }

  // 品牌信息
  const brand = item.brandRel
    ? {
        id: item.brandRel.id,
        nameZh: item.brandRel.nameZh,
        nameEn: item.brandRel.nameEn,
        brandTier: item.brandRel.brandTier || item.machineTier || null,
        originCountry: item.brandRel.originCountry || item.country || null,
        isChineseBrand: item.brandRel.isChineseBrand ?? false,
      }
    : item.brand
    ? {
        id: null,
        nameZh: item.brand,
        nameEn: item.brand,
        brandTier: item.machineTier || null,
        originCountry: item.country || null,
        isChineseBrand: item.isChineseMade ?? false,
      }
    : null;

  // 图片 — ShowcaseItem.images 是 String[]
  const images = (item.images || []).slice(0, 1).map((url: string) => ({ url: getImageUrl(url) }));

  const source = isNew ? ("showcase-new" as const) : ("showcase-used" as const);

  return {
    id: `showcase-${item.id}`,
    showcaseId: item.id,
    source,
    modelName: item.model || item.deviceType || "",
    title: item.model || item.deviceType || "",
    titleEn: item.model || item.deviceType || "",
    priceCny,
    year,
    workingHours,
    condition,
    enginePower,
    location: item.country || null,
    tradeTerm: null,
    tradePort: null,
    brand,
    category: {
      nameZh: item.deviceType,
      nameEn: item.deviceType,
    },
    images,
    seller: null,
    country: item.country,
    isChineseMade: item.isChineseMade,
    isNewLaunch: item.isNewLaunch,
    description: item.descriptionZh || item.description,
    itemType: item.itemType,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证参数
    const crop = String(body.crop || "wheat");
    const machineType = String(body.machineType || "other");
    const budget = Number(body.budget) || 30;
    const fieldSize = body.fieldSize ? Number(body.fieldSize) : undefined;
    const targetRegion = body.targetRegion || undefined;
    const maxAge = body.maxAge ? Number(body.maxAge) : undefined;

    const input: ArenaInput = { crop, machineType, budget, fieldSize, targetRegion, maxAge };

    const budgetYuan = budget * 10000;
    const minYear = maxAge ? 2026 - maxAge : 0;

    // ========== 1. 查询二手农机 (Product) ==========
    const baseWhere = {
      status: "active" as const,
      ...(minYear > 0 ? { year: { gte: minYear } } : {}),
    };

    const keywords = CATEGORY_KEYWORDS[machineType];
    let categoryIds: string[] = [];
    if (keywords) {
      const categories = await prisma.category.findMany({
        where: {
          OR: [
            { nameEn: { contains: keywords.en, mode: "insensitive" as const } },
            { nameZh: { contains: keywords.zh } },
          ],
        },
        select: { id: true },
      });
      categoryIds = categories.map((c) => c.id);
    }

    // Product 三级降级查询
    let products = await prisma.product.findMany({
      where: {
        ...baseWhere,
        ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
        priceCny: { gte: budgetYuan * 0.5, lte: budgetYuan * 1.5 },
      },
      include: PRODUCT_INCLUDE,
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    if (products.length < 3) {
      products = await prisma.product.findMany({
        where: {
          ...baseWhere,
          ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
          priceCny: { gte: budgetYuan * 0.3, lte: budgetYuan * 2.0 },
        },
        include: PRODUCT_INCLUDE,
        take: 20,
        orderBy: { createdAt: "desc" },
      });
    }

    if (products.length < 3) {
      products = await prisma.product.findMany({
        where: {
          ...baseWhere,
          ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
        },
        include: PRODUCT_INCLUDE,
        take: 20,
        orderBy: { createdAt: "desc" },
      });
    }

    const normalizedProducts = products.map(normalizeProduct);

    // ========== 2. 查询博览会展品 (ShowcaseItem) ==========
    const showcaseKeywords = SHOWCASE_DEVICE_KEYWORDS[machineType];
    const showcaseBaseWhere = {
      status: "published" as const,
      ...(minYear > 0
        ? {
            OR: [
              { year: { gte: minYear } },
              { launchYear: { gte: minYear } },
            ],
          }
        : {}),
    };

    let showcaseItems: any[] = [];

    if (showcaseKeywords) {
      showcaseItems = await prisma.showcaseItem.findMany({
        where: {
          ...showcaseBaseWhere,
          OR: showcaseKeywords.map((kw) => ({
            deviceType: { contains: kw, mode: "insensitive" as const },
          })),
        },
        include: SHOWCASE_INCLUDE,
        take: 30,
        orderBy: { hotScore: "desc" },
      });
    } else {
      // "other" — 不过滤品类，取热门展品
      showcaseItems = await prisma.showcaseItem.findMany({
        where: showcaseBaseWhere,
        include: SHOWCASE_INCLUDE,
        take: 30,
        orderBy: { hotScore: "desc" },
      });
    }

    const normalizedShowcase = showcaseItems.map(normalizeShowcaseItem);

    // ========== 3. 合并 + 评分 + 排名 ==========
    const allCandidates = [...normalizedProducts, ...normalizedShowcase];
    const ranked = rankCandidates(allCandidates, input);
    const topCandidates = ranked.slice(0, 6);

    const result: ArenaMatchResult = {
      candidates: topCandidates,
      totalFound: ranked.length,
      returnedCount: topCandidates.length,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Arena match error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to match candidates" },
      { status: 500 }
    );
  }
}
