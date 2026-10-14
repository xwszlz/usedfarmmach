import { NextRequest, NextResponse } from "next/server";

import { createHash } from "crypto";

import { prisma } from "@/lib/db";

import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

import { computeAiCost, deductCredits, type AiCostBreakdown } from "@/lib/credits/spend";
import { drainUsage } from "@/lib/credits/usage-collector";

import { calculateValuation, calculateValuationV4, type ValuationInput, type ValuationResult } from "@/lib/valuation/formulas";

import { getValuationIntelligence } from "@/lib/valuation/intelligence";

import { analyzeProductImages } from "@/lib/valuation/image-analyzer";

import { analyzeVideo } from "@/lib/valuation/video-analyzer";

import { getVideoUrl } from "@/lib/image-url";
import { resolveValuationCodes } from "@/lib/valuation/resolve-codes";



export const dynamic = "force-dynamic";



// ============================================================

// P0 留资引擎：游客限流 + 区间化模糊结果

// 游客（无 token）每日限 3 次，返回 ±12% 区间价；留资（邮箱）后经

// /api/valuation/unlock 解锁精确值。登录用户逻辑完全不变。

// TODO: 限流计数目前为内存 Map（单实例有效），迁移 Redis（INCR + EXPIRE）

//       以支持多实例部署与重启后保留。

// ============================================================

const GUEST_DAILY_LIMIT = 3;

const GUEST_WINDOW_MS = 24 * 60 * 60 * 1000; // 滚动 24 小时窗口

const guestValuationCounters = new Map<string, { count: number; resetAt: number }>();

/** 估值放行的最低积分门槛：预检只看够不够门槛，实际扣多少由算完后的真实 token 用量决定 */
const VALUATION_MIN_CREDITS = 1;

/** 从 referer / 路径推断 locale（与 quota guard / 各 AI 路由保持一致） */
function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) {
    return m[1];
  }
  return "zh";
}



function getClientIpHash(headers: Headers): string {

  const ip =

    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||

    headers.get("x-real-ip") ||

    "unknown";

  return createHash("sha256").update(`valuation-gate:${ip}`).digest("hex");

}



/** 游客每日限流检查：未超限返回 true（并计数），超限返回 false */

function checkGuestDailyLimit(ipHash: string): boolean {

  const now = Date.now();

  const entry = guestValuationCounters.get(ipHash);

  if (!entry || entry.resetAt <= now) {

    guestValuationCounters.set(ipHash, { count: 1, resetAt: now + GUEST_WINDOW_MS });

    return true;

  }

  if (entry.count >= GUEST_DAILY_LIMIT) return false;

  entry.count += 1;

  return true;

}



/** 把精确估值转换为游客可见的区间化模糊结果（±12%，拆解字段置 null） */

function toBlurredValuation(result: ValuationResult) {

  const mid = Math.round(result.estimatedValue);

  return {

    priceMid: mid,

    priceLow: Math.round(mid * 0.88),

    priceHigh: Math.round(mid * 1.12),

    confidence: Math.round((result.confidenceScore ?? 0.7) * 100),

    blurred: true,

    // 留资解锁后才可见的字段（游客侧一律置 null，防绕过）

    details: null as null,

    analysis: null as null,

    basePrice: null as null,

    brandFactor: null as null,

    yearFactor: null as null,

    conditionFactor: null as null,

  };

}



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

    const { productId, brand, modelName, category, year, workingHours, condition, priceCny, useV4, skipImageAnalysis, engineBrand, tradeChannel } = body;



    // ── 积分计费 ①：预检（本步不扣分）——登录 + 余额 ≥ VALUATION_MIN_CREDITS 才放行 ──
    // 真正的扣分在估值算完之后，按本请求内 LLM 的【真实 token 用量】执行（见下方 ②）。
    // 游客逻辑不变（保留 IP 限流 + 区间化模糊结果）。

    const token = getTokenFromHeaders(request.headers);

    let isAuthenticated = false;
    let authUserId: string | null = null;

    if (token) {

      const payload = verifyToken(token);

      if (payload) {

        isAuthenticated = true;
        authUserId = payload.userId;

        const creditRow = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { credits: true },
        });
        const balanceNow = creditRow?.credits ?? 0;

        if (balanceNow < VALUATION_MIN_CREDITS) {
          const locale = getLocaleFromRequest(request);
          return NextResponse.json(
            {
              success: false,
              error: "积分不足，请先充值",
              code: "INSUFFICIENT_CREDITS",
              rechargeUrl: `/${locale}/credits`,
              required: VALUATION_MIN_CREDITS,
              balance: balanceNow,
            },
            { status: 402 }
          );
        }

      }

    }



    // ── P0 留资引擎：游客限流（无有效 token 时按 IP 哈希限 3 次/天）──

    if (!isAuthenticated) {

      const ipHash = getClientIpHash(request.headers);

      if (!checkGuestDailyLimit(ipHash)) {

        return NextResponse.json(

          {

            success: false,

            error: "DAILY_LIMIT_REACHED",

            message: "valuationGate.limitReached",

          },

          { status: 429 }

        );

      }

    }





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



      // T04: 解析主数据 code（纯只读，失败降级为 null → 名匹配兜底）
      const resolvedCodes = await resolveValuationCodes(
        {
          brandId: product.brandId,
          categoryId: product.categoryId,
          brandName: product.brand?.nameZh || null,
          categoryName: product.category?.nameZh || null,
          modelName: product.modelName,
        },
        prisma
      );

      console.log("[Valuation V4] 产品数据:", {

        productId,

        imageCount: product.images?.length || 0,

        videoCount: product.videos?.length || 0,

        hasEnginePower: !!product.enginePower,

        hasDriveSystem: !!product.driveSystem,

      });



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

        // T04: 主数据 code 维度（解析层结果，公式内优先使用）
        brandCode: resolvedCodes.brandCode ?? undefined,
        categoryCode: resolvedCodes.categoryCode ?? undefined,
        modelCode: resolvedCodes.modelCode ?? undefined,
        brandValueFactor: resolvedCodes.brandValueFactor,
        modelPopularityFactor: resolvedCodes.modelPopularityFactor,



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

        // Phase 1：发动机品牌 + 买卖渠道
        engineBrand: engineBrand || undefined,
        tradeChannel: tradeChannel || undefined,

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

        // Phase 1：发动机品牌 + 买卖渠道
        engineBrand: engineBrand || undefined,
        tradeChannel: tradeChannel || undefined,

      };

    }


    // 真实交易情报切片（基于 866 万条补贴数据的顶级报告原料，仅服务端加载）
    const intelRegion = body.region || input.location || undefined;
    const intelligence = getValuationIntelligence(
      input.brand,
      input.category,
      input.modelName,
      intelRegion,
    );

    // 执行估值

    let result: ValuationResult;



    if (shouldUseV4) {

      // V4 引擎：支持多模态输入

      

      // 1. 图片分析（如果提供了图片且未跳过）

      let visualResult = undefined;

      console.log("[Valuation V4] 图片分析检查:", {

        skipImageAnalysis,

        imageUrlsCount: input.imageUrls?.length || 0,

        imageUrls: input.imageUrls?.slice(0, 2), // 只打印前2个URL

      });

      

      if (!skipImageAnalysis && input.imageUrls && input.imageUrls.length > 0) {

        try {

          console.log("[Valuation V4] 开始图片分析, URLs:", input.imageUrls.length);

          visualResult = await analyzeProductImages(input.imageUrls);

          console.log("[Valuation V4] 图片分析完成:", {

            visualConditionScore: visualResult.visualConditionScore,

            usedV4Condition: visualResult.usedV4Condition,

            imageConfidence: visualResult.imageConfidence,

          });

        } catch (error) {

          console.warn("[Valuation V4] 图片分析失败，降级到V2:", error);

        }

      } else {

        console.log("[Valuation V4] 跳过图片分析:", {

          reason: skipImageAnalysis ? "用户跳过" : "无图片URL",

        });

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



    // ── 积分计费 ②：估值算完后，按本请求内 LLM 的【真实 token 用量】扣分 ──
    // 用量由 image-analyzer / video-analyzer 在拿到 provider usage 后经 usage-collector 归集。
    // 只扣一次：把全部记录按模型分组算成本后求和，再一次 deductCredits。
    // 无论如何都要 drain：模块级数组是本进程的，游客/异常分支不 drain 会跨请求串账。
    const usage = drainUsage();
    if (authUserId) {
      const perModel: AiCostBreakdown[] = usage.map((u) =>
        computeAiCost({
          model: u.model,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
        })
      );
      const totalPoints = perModel.reduce((sum, c) => sum + c.points, 0);

      const billingBreakdown = {
        models: perModel.map((c, i) => ({
          ...c,
          // provider 没给 usage 时为 true —— breakdown 里能看出这笔是估的还是实测的
          estimated: usage[i]?.estimated === true,
        })),
        totalPoints,
        usageCount: usage.length,
      };

      const deduction = await deductCredits(
        authUserId,
        totalPoints,
        "AI估值",
        billingBreakdown as unknown as Record<string, unknown>
      );

      // 扣分失败（多为并发下余额被别处扣掉）：仍然返回结果，但带上计费失败标记，
      // 不阻断用户已算出来的结果（LLM 已消耗，结果已产出）。
      if (!deduction.ok) {
        console.error(
          `[Valuation] 计费失败 user=${authUserId} required=${deduction.required} balance=${deduction.credits}`
        );
      }
    }



    // ── P0 留资引擎：游客返回区间化模糊结果（留资后经 unlock 接口解锁精确值）──

    if (!isAuthenticated) {

      return NextResponse.json({

        success: true,

        blurred: true,

        intelligence,

        data: toBlurredValuation(result),

        meta: {

          engine: shouldUseV4 ? "v4" : "v2",

          guest: true,

        },

      });

    }



    // 登录用户：照旧返回完整精确结果（响应增加 blurred: false 标识）

    return NextResponse.json({

      success: true,

      blurred: false,

      intelligence,

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



    // T04: 解析主数据 code（纯只读，失败降级为 null → 名匹配兜底）
    const resolvedCodes = await resolveValuationCodes(
      {
        brandId: product.brandId,
        categoryId: product.categoryId,
        brandName: product.brand?.nameZh || null,
        categoryName: product.category?.nameZh || null,
        modelName: product.modelName,
      },
      prisma
    );

    console.log("[Valuation V4 GET] 产品数据:", {

      productId,

      imageCount: product.images?.length || 0,

      videoCount: product.videos?.length || 0,

      hasEnginePower: !!product.enginePower,

      hasDriveSystem: !!product.driveSystem,

    });



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

      // T04: 主数据 code 维度（解析层结果，公式内优先使用）
      brandCode: resolvedCodes.brandCode ?? undefined,
      categoryCode: resolvedCodes.categoryCode ?? undefined,
      modelCode: resolvedCodes.modelCode ?? undefined,
      brandValueFactor: resolvedCodes.brandValueFactor,
      modelPopularityFactor: resolvedCodes.modelPopularityFactor,



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



    // GET 分支不计费（无登录态 / 小程序只读查询），但必须 drain：
    // usage-collector 是模块级数组，不清会串到下一个请求。
    drainUsage();



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

