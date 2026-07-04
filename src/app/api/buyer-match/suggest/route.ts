/**
 * 买家需求匹配 API
 *
 * POST /api/buyer-match/suggest
 *
 * 买家输入农场规模+作物类型+期望机型+预算，
 * 系统从数据库+日报情报中匹配3-5条精准推荐+采购建议。
 *
 * 数据来源：
 *   1. Prisma Product 表（实时库存）
 *   2. strategy_latest.json（市场行情+策略分类）
 *   3. 作物→品类映射表（内置知识库）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// ===== 作物→推荐农机品类映射 =====

const CROP_MACHINE_MAP: Record<string, string[]> = {
  "小麦": ["收割机", "茎穗兼收机", "拖拉机", "播种机"],
  "玉米": ["茎穗兼收机", "茎穗双收", "收割机", "青储机"],
  "水稻": ["收割机", "拖拉机", "播种机"],
  "牧草": ["青储机", "打捆机", "割草机", "搂草机", "摊晒机", "裹包机", "捡拾台"],
  "甘蔗": ["收获机", "拖拉机"],
  "大豆": ["收割机", "播种机", "拖拉机"],
  "马铃薯": ["收获机", "播种机", "拖拉机"],
  "甜菜": ["甜菜机", "收获机"],
  "棉花": ["收割机", "拖拉机"],
  "油菜": ["收割机", "播种机"],
  "燕麦": ["收割机", "打捆机", "播种机"],
  "苜蓿": ["青储机", "打捆机", "割草机", "搂草机", "裹包机"],
  "高粱": ["青储机", "收割机"],
  "青贮玉米": ["青储机", "拖拉机"],
};

// 农场规模→推荐马力区间
const FARM_SIZE_HP_MAP: Record<string, { min: number; max: number; label: string }> = {
  "小户(<100亩)": { min: 50, max: 120, label: "50-120马力" },
  "中型(100-500亩)": { min: 80, max: 200, label: "80-200马力" },
  "大户(500-2000亩)": { min: 120, max: 350, label: "120-350马力" },
  "大型(>2000亩)": { min: 200, max: 600, label: "200-600马力" },
};

// ===== 类型定义 =====

interface BuyerMatchRequest {
  cropType: string;         // 作物类型
  farmSize: string;         // 农场规模
  machineType?: string;     // 期望机型（可选）
  budgetMin?: number;       // 预算下限（万元）
  budgetMax?: number;       // 预算上限（万元）
  location?: string;        // 买家所在地（可选）
}

interface MatchedProduct {
  id: string;
  brandName: string;
  modelName: string;
  year: number;
  workingHours: number | null;
  condition: string;
  priceWan: number;
  categoryName: string;
  location: string;
  imageUrl: string | null;
  hasVideo: boolean;
  sellerName: string | null;
  matchScore: number;
  matchReasons: string[];
}

interface BuyerMatchResponse {
  success: boolean;
  data: {
    recommendations: MatchedProduct[];
    marketInsight: {
      avgPriceWan: number;
      minPriceWan: number;
      maxPriceWan: number;
      totalAvailable: number;
      priceTrend: string;
    };
    purchaseAdvice: string;
    recommendedCategories: string[];
    farmSizeHMatch: string;
    dataDate: string;
  };
}

// ===== 读取日报数据 =====

function readStrategyData(): any | null {
  try {
    const filePath = path.join(process.cwd(), "public", "daily-reports", "strategy_latest.json");
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

// ===== 主处理函数 =====

export async function POST(request: NextRequest) {
  try {
    const body: BuyerMatchRequest = await request.json();
    const { cropType, farmSize, machineType, budgetMin, budgetMax, location } = body;

    if (!cropType) {
      return NextResponse.json(
        { success: false, error: "请选择作物类型" },
        { status: 400 }
      );
    }

    // 1. 作物→品类映射
    const recommendedCategories = CROP_MACHINE_MAP[cropType] || ["收割机", "拖拉机"];
    
    // 如果用户指定了机型，优先使用
    const targetCategories = machineType 
      ? [machineType, ...recommendedCategories.filter(c => c !== machineType)]
      : recommendedCategories;

    // 2. 农场规模→马力区间
    const hpRange = FARM_SIZE_HP_MAP[farmSize] || FARM_SIZE_HP_MAP["中型(100-500亩)"];

    // 3. 构建数据库查询条件
    const whereCondition: any = {
      status: "active",
      OR: targetCategories.map(cat => ({
        category: { nameZh: { contains: cat } }
      })),
    };

    // 预算筛选
    if (budgetMin !== undefined && budgetMax !== undefined) {
      whereCondition.priceCny = {
        gte: budgetMin * 10000,
        lte: budgetMax * 10000,
      };
    } else if (budgetMax !== undefined) {
      whereCondition.priceCny = { lte: budgetMax * 10000 };
    }

    // 4. 查询数据库
    const products = await prisma.product.findMany({
      where: whereCondition,
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        brand: { select: { nameZh: true, nameEn: true } },
        category: { select: { nameZh: true, nameEn: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        videos: { take: 1 },
        seller: { select: { companyName: true, country: true } },
      },
    });

    // 5. 计算匹配分数并排序
    const scored: MatchedProduct[] = products.map((p: any) => {
      let score = 50;
      const reasons: string[] = [];

      // 品类匹配加分
      const productCat = p.category?.nameZh || "";
      if (machineType && productCat.includes(machineType)) {
        score += 30;
        reasons.push("品类完全匹配");
      } else if (recommendedCategories.includes(productCat)) {
        score += 20;
        reasons.push(`${productCat}适合${cropType}作业`);
      }

      // 预算匹配加分
      const priceWan = p.priceCny / 10000;
      if (budgetMin && budgetMax) {
        const midBudget = (budgetMin + budgetMax) / 2;
        const diff = Math.abs(priceWan - midBudget) / midBudget;
        if (diff < 0.15) {
          score += 20;
          reasons.push("价格在预算最佳区间");
        } else if (diff < 0.3) {
          score += 10;
          reasons.push("价格接近预算");
        }
      }

      // 马力匹配加分
      if (p.enginePower) {
        if (p.enginePower >= hpRange.min && p.enginePower <= hpRange.max) {
          score += 15;
          reasons.push(`马力${p.enginePower}HP适合${farmSize}`);
        } else if (p.enginePower >= hpRange.min * 0.8 && p.enginePower <= hpRange.max * 1.2) {
          score += 8;
        }
      }

      // 成色加分
      if (p.condition === "excellent") {
        score += 10;
        reasons.push("成色优秀");
      } else if (p.condition === "good") {
        score += 5;
      }

      // 有图片加分
      if (p.images?.length > 0) {
        score += 5;
      }

      // 有视频加分
      if (p.videos?.length > 0) {
        score += 5;
        reasons.push("有作业视频");
      }

      // 年份较新加分
      const age = new Date().getFullYear() - p.year;
      if (age <= 3) {
        score += 10;
        reasons.push(`${p.year}年款，准新机`);
      } else if (age <= 6) {
        score += 5;
      }

      return {
        id: p.id,
        brandName: p.brand?.nameZh || p.brand?.nameEn || "未知品牌",
        modelName: p.modelName,
        year: p.year,
        workingHours: p.workingHours,
        condition: p.condition,
        priceWan: Math.round(priceWan * 10) / 10,
        categoryName: productCat,
        location: p.location || "",
        imageUrl: p.images?.[0] ? getImageUrl(p.images[0].url) : null,
        hasVideo: (p.videos?.length || 0) > 0,
        sellerName: p.seller?.companyName || null,
        matchScore: Math.min(100, score),
        matchReasons: reasons.length > 0 ? reasons : ["匹配您的需求"],
      };
    });

    // 按匹配分数排序，取前5
    scored.sort((a, b) => b.matchScore - a.matchScore);
    const recommendations = scored.slice(0, 5);

    // 6. 市场行情分析
    const strategyData = readStrategyData();
    let marketInsight = {
      avgPriceWan: 0,
      minPriceWan: 0,
      maxPriceWan: 0,
      totalAvailable: products.length,
      priceTrend: "暂无数据",
    };

    if (products.length > 0) {
      const prices = products.map(p => p.priceCny / 10000);
      marketInsight = {
        avgPriceWan: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 10) / 10,
        minPriceWan: Math.round(Math.min(...prices) * 10) / 10,
        maxPriceWan: Math.round(Math.max(...prices) * 10) / 10,
        totalAvailable: products.length,
        priceTrend: "近期价格稳定",
      };
    }

    // 从日报补充行情
    if (strategyData) {
      const sameCategoryProducts = strategyData.products?.filter((p: any) =>
        recommendedCategories.some(cat => p.categoryName?.includes(cat))
      ) || [];
      
      if (sameCategoryProducts.length > 0 && marketInsight.avgPriceWan === 0) {
        const prices = sameCategoryProducts.map((p: any) => p.priceWan);
        marketInsight = {
          avgPriceWan: Math.round((prices.reduce((a: number, b: number) => a + b, 0) / prices.length) * 10) / 10,
          minPriceWan: Math.round(Math.min(...prices) * 10) / 10,
          maxPriceWan: Math.round(Math.max(...prices) * 10) / 10,
          totalAvailable: sameCategoryProducts.length,
          priceTrend: sameCategoryProducts[0]?.strategyDirection || "近期价格稳定",
        };
      }
    }

    // 7. 采购建议
    let purchaseAdvice = "";
    if (recommendations.length === 0) {
      purchaseAdvice = `当前没有完全匹配${cropType}作业的设备在售。建议扩大预算范围或关注后续上新。我们推荐的品类是：${recommendedCategories.join("、")}。`;
    } else {
      const best = recommendations[0];
      const savingsPercent = marketInsight.avgPriceWan > 0
        ? Math.round((1 - best.priceWan / marketInsight.avgPriceWan) * 100)
        : 0;
      
      purchaseAdvice = `为您推荐${recommendations.length}条匹配设备。最佳匹配是${best.brandName} ${best.modelName}（${best.year}年），`;
      
      if (savingsPercent > 5) {
        purchaseAdvice += `低于同品类均价${savingsPercent}%，性价比突出。`;
      } else if (savingsPercent < -5) {
        purchaseAdvice += `略高于均价${Math.abs(savingsPercent)}%，但成色和配置更优。`;
      } else {
        purchaseAdvice += `价格接近市场均价，定价合理。`;
      }

      if (best.hasVideo) {
        purchaseAdvice += "建议先观看作业视频了解设备状态。";
      }
      
      purchaseAdvice += `${farmSize}推荐选择${hpRange.label}的设备，${cropType}作业首选${recommendedCategories.slice(0, 2).join("或")}。`;
    }

    const responseData: BuyerMatchResponse["data"] = {
      recommendations,
      marketInsight,
      purchaseAdvice,
      recommendedCategories,
      farmSizeHMatch: hpRange.label,
      dataDate: strategyData?.date || new Date().toISOString().split("T")[0],
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error("[BuyerMatch] 错误:", error);
    return NextResponse.json(
      { success: false, error: "需求匹配失败，请稍后重试" },
      { status: 500 }
    );
  }
}
