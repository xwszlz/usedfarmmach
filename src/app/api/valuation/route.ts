import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateValuation, calculateValuationV4, type ValuationInput, type ValuationResult } from "@/lib/valuation/formulas";
import { analyzeProductImages } from "@/lib/valuation/image-analyzer";
import { analyzeVideo } from "@/lib/valuation/video-analyzer";
import { getVideoUrl } from "@/lib/image-url";

export const dynamic = "force-dynamic";

/**
 * POST /api/valuation
 * 
 * V4 支持的多模态估值接口
 * 
 * Body 参数：
 *   - productId?: string      产品ID（自动获取产品数据）
 *   - brand?: string          品牌
 *   - modelName?: string     型号
 *   - category?: string      品类
 *   - year?: number          年份
 *   - workingHours?: number  工时
 *   - condition?: string     成色
 *   - priceCny?: number     卖家报价
 *   
 *   // V4 新增：多模态输入
 *   - imageUrls?: string[]   产品图片URL列表
 *   - videoUrls?: string[]   产品视频URL列表
 *   
 *   // V4 新增：规格字段
 *   - enginePower?: number    马力 HP
 *   - driveSystem?: string    驱动方式
 *   - mainConfig?: string    主要配置
 *   - netWeight?: number     整机净重 kg
 *   - overallLength?: number 总长 mm
 *   - overallWidth?: number  总宽 mm
 *   - overallHeight?: number 总高 mm
 *   
 *   // V4 控制参数
 *   - useV4?: boolean       是否使用V4引擎（默认true）
 *   - skipImageAnalysis?: boolean  跳过图片分析（默认false）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, brand, modelName, category, year, workingHours, condition, priceCny, useV4, skipImageAnalysis } = body;

    // V4 新增字段
    const imageUrls: string[] = body.imageUrls || [];
    const videoUrls: string[] = body.videoUrls || [];
    const enginePower = body.enginePower ? Number(body.enginePower) : undefined;
    const driveSystem = body.driveSystem || undefined;
    const mainConfig = body.mainConfig || undefined;
    const netWeight = body.netWeight ? Number(body.netWeight) : undefined;
    const overallLength = body.overallLength ? Number(body.overallLength) : undefined;
    const overallWidth = body.overallWidth ? Number(body.overallWidth) : undefined;
    const overallHeight = body.overallHeight ? Number(body.overallHeight) : undefined;

    // 决定是否使用V4引擎
    const shouldUseV4 = useV4 !== false; // 默认使用V4

    // 支持两种模式：传 productId 自动获取产品数据 / 手动输入参数
    let input: ValuationInput;

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          brand: true,
          category: true,
          internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
          images: { orderBy: { sortOrder: "asc" } },
          videos: { orderBy: { sortOrder: "asc" } },
        },
      });

      if (!product) {
        return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
      }

      const intlPrice = product.internationalPrices[0] || null;

      // 合并数据库字段和请求体字段（请求体优先）
      input = {
        brand: brand || product.brand?.nameZh || "",
        modelName: modelName || product.modelName || "",
        category: category || product.category?.nameZh || "",
        year: year || product.year || 2020,
        workingHours: workingHours ?? product.workingHours ?? undefined,
        condition: condition || product.condition || "good",
        priceCny: priceCny || product.priceCny || undefined,
        foreignPriceCny: intlPrice?.priceForeignCny || undefined,
        location: product.location || undefined,

        // V4: 从数据库读取图片和视频
        imageUrls: imageUrls.length > 0 ? imageUrls : product.images?.map((img: any) => img.url) || [],
        videoUrls: videoUrls.length > 0 ? videoUrls : product.videos?.map((vid: any) => vid.url) || [],

        // V4: 从数据库读取规格字段
        enginePower: enginePower ?? product.enginePower ?? undefined,
        driveSystem: driveSystem ?? product.driveSystem ?? undefined,
        mainConfig: mainConfig ?? product.mainConfig ?? undefined,
        netWeight: netWeight ?? product.netWeight ?? undefined,
        overallLength: overallLength ?? product.overallLength ?? undefined,
        overallWidth: overallWidth ?? product.overallWidth ?? undefined,
        overallHeight: overallHeight ?? product.overallHeight ?? undefined,
      };
    } else {
      // 手动输入
      if (!brand || !category || !year) {
        return NextResponse.json({ success: false, error: "缺少必要参数: brand, category, year" }, { status: 400 });
      }
      input = {
        brand: brand || "",
        modelName: modelName || "",
        category: category || "",
        year: Number(year) || 2020,
        workingHours: workingHours ? Number(workingHours) : undefined,
        condition: condition || "good",
        priceCny: priceCny ? Number(priceCny) : undefined,

        // V4 新增字段
        imageUrls,
        videoUrls,
        enginePower,
        driveSystem,
        mainConfig,
        netWeight,
        overallLength,
        overallWidth,
        overallHeight,
      };
    }

    // 执行估值
    let result: ValuationResult;

    if (shouldUseV4) {
      // V4 引擎：支持多模态输入
      
      // 1. 图片分析（如果提供了图片且未跳过）
      let visualResult = undefined;
      if (!skipImageAnalysis && input.imageUrls && input.imageUrls.length > 0) {
        try {
          visualResult = await analyzeProductImages(input.imageUrls);
        } catch (error) {
          console.warn("[Valuation V4] 图片分析失败，降级到V2:", error);
        }
      }

      // 2. 视频分析（如果提供了视频URL）
      let videoAnalysisResult = undefined;
      if (input.videoUrls && input.videoUrls.length > 0) {
        try {
          const videoFullUrl = getVideoUrl(input.videoUrls[0]);
          if (videoFullUrl) {
            videoAnalysisResult = await analyzeVideo(videoFullUrl);
            console.log("[Valuation V4] 视频分析完成:", {
              qualityScore: videoAnalysisResult.qualityScore,
              engineSoundStatus: videoAnalysisResult.engineSoundStatus,
              mechanismSmoothness: videoAnalysisResult.mechanismSmoothness,
            });
          }
        } catch (error) {
          console.warn("[Valuation V4] 视频分析失败，降级到无视频:", error);
        }
      }

      // 3. 将视频分析结果注入input
      if (videoAnalysisResult) {
        input.videoAnalysisResult = videoAnalysisResult;
      }

      // 4. 调用 V4 估值函数
      result = await calculateValuationV4(input, visualResult);
    } else {
      // V2 引擎：传统估值
      result = calculateValuation(input);
    }

    return NextResponse.json({
      success: true,
      version: result.version,
      data: result,
      
      // V4 额外元信息
      meta: {
        engine: shouldUseV4 ? "v4" : "v2",
        imageAnalyzed: shouldUseV4 && result.usedV4Condition,
        specFieldsCount: [
          input.enginePower,
          input.driveSystem,
          input.mainConfig,
          input.netWeight,
          input.overallLength,
          input.overallWidth,
          input.overallHeight
        ].filter(f => f !== undefined && f !== null && f !== "").length,
      },
    });
  } catch (error) {
    console.error("Valuation error:", error);
    return NextResponse.json(
      { success: false, error: "估值失败，请稍后重试" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/valuation?productId=xxx
 * 
 * 快速查询接口（仅支持 productId）
 * V4 支持：自动使用V4引擎（如果产品有图片）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const useV4Param = searchParams.get("useV4");
  const skipImageAnalysisParam = searchParams.get("skipImageAnalysis");

  if (!productId) {
    return NextResponse.json({ success: false, error: "需要 productId 参数" }, { status: 400 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
        category: true,
        internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
        images: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
    }

    const intlPrice = product.internationalPrices[0] || null;

    const input: ValuationInput = {
      brand: product.brand?.nameZh || "",
      modelName: product.modelName || "",
      category: product.category?.nameZh || "",
      year: product.year || 2020,
      workingHours: product.workingHours ?? undefined,
      condition: product.condition || "good",
      priceCny: product.priceCny || undefined,
      foreignPriceCny: intlPrice?.priceForeignCny || undefined,
      location: product.location || undefined,

      // V4: 从数据库读取图片和视频
      imageUrls: product.images?.map((img: any) => img.url) || [],
      videoUrls: product.videos?.map((vid: any) => vid.url) || [],

      // V4: 从数据库读取规格字段
      enginePower: product.enginePower ?? undefined,
      driveSystem: product.driveSystem ?? undefined,
      mainConfig: product.mainConfig ?? undefined,
      netWeight: product.netWeight ?? undefined,
      overallLength: product.overallLength ?? undefined,
      overallWidth: product.overallWidth ?? undefined,
      overallHeight: product.overallHeight ?? undefined,
    };

    // 决定是否使用V4
    const shouldUseV4 = useV4Param !== "false"; // 默认true

    // 执行估值
    let result: ValuationResult;

    if (shouldUseV4) {
      // V4: 图片分析
      let visualResult = undefined;
      if (skipImageAnalysisParam !== "true" && input.imageUrls && input.imageUrls.length > 0) {
        try {
          visualResult = await analyzeProductImages(input.imageUrls);
        } catch (error) {
          console.warn("[Valuation V4 GET] 图片分析失败，降级到V2:", error);
        }
      }

      // V4: 视频分析
      let videoAnalysisResult = undefined;
      if (input.videoUrls && input.videoUrls.length > 0) {
        try {
          const videoFullUrl = getVideoUrl(input.videoUrls[0]);
          if (videoFullUrl) {
            videoAnalysisResult = await analyzeVideo(videoFullUrl);
          }
        } catch (error) {
          console.warn("[Valuation V4 GET] 视频分析失败:", error);
        }
      }
      if (videoAnalysisResult) {
        input.videoAnalysisResult = videoAnalysisResult;
      }

      result = await calculateValuationV4(input, visualResult);
    } else {
      result = calculateValuation(input);
    }

    return NextResponse.json({
      success: true,
      version: result.version,
      data: result,
      meta: {
        engine: shouldUseV4 ? "v4" : "v2",
        imageAnalyzed: shouldUseV4 && result.usedV4Condition,
      },
    });
  } catch (error) {
    console.error("Valuation GET error:", error);
    return NextResponse.json(
      { success: false, error: "估值失败" },
      { status: 500 }
    );
  }
}
