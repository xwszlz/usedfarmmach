import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";

import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

import { computeAiCost, deductCredits, type AiCostBreakdown } from "@/lib/credits/spend";
import { getBillingCountry } from "@/lib/credits/fx";
import { drainUsage } from "@/lib/credits/usage-collector";

import { calculateValuation, calculateValuationV4, type ValuationInput, type ValuationResult } from "@/lib/valuation/formulas";

import { getValuationIntelligence } from "@/lib/valuation/intelligence";

import {
  analyzeProductImages,
  conditionCodeLabelText,
  scoreToConditionCode,
  type ConditionCode,
  type VisualValuationResult,
} from "@/lib/valuation/image-analyzer";

import { analyzeVideos, type VideoAnalysisResult } from "@/lib/valuation/video-analyzer";

import { getVideoUrl } from "@/lib/image-url";
import { resolveValuationCodes } from "@/lib/valuation/resolve-codes";
// 游客限流键：站点感知的 IP 取值链 + 匿名哈希（详见该模块头注释）
import { getClientIpHash } from "@/lib/valuation/client-ip";

// 2026-11 AI 输出质量专项：真正的「结论层」（文本大模型）+ 8 语种解析
import { generateValuationNarrative, type ValuationNarrative } from "@/lib/valuation/narrative";
import { isDomesticBrandSupported } from "@/lib/valuation/brand-data";
import { resolveAiLocale, type AiLocale } from "@/lib/i18n/ai-locale";



export const dynamic = "force-dynamic";

/**
 * 单次估值的最长执行时间（秒）。**只有 Vercel 读这个常量**；
 * `.cn` 跑在 ECS nginx 后面，真正的上限是 `deploy/nginx/conf.d/cn.conf` 的 proxy_read_timeout。
 *
 * 串行链路的**理论最坏**耗时（每段都是 ark-client 的超时，且 429/5xx 会重试一次）：
 *   视觉分析 5 图**并行**（MAX_ANALYZE_IMAGES=5）：≈76s（并行不随时长涨；但若豆包侧限流
 *     把并行压成串行，最坏会退化成 5×76s=380s —— 这是视觉段自身没有总预算的既有风险）
 *   视频分析（如有）：75s × 2 = 150s
 *   结论叙述：见下方 NARRATIVE_TIMEOUT_MS
 * ⇒ 剩给叙述层的预算必须动态计算，不足就直接跳过（返回 narrative: null），
 *   绝不能让结论层拖垮整个估值请求。
 */
export const maxDuration = 240;

/** 单次估值请求的总预算（毫秒）。低于 maxDuration 与 nginx 330s，留出序列化/写响应余量 */
const VALUATION_TOTAL_BUDGET_MS = 200_000;

/** 结论叙述层的**上限**超时（实际取「剩余预算」与它的较小值） */
const NARRATIVE_TIMEOUT_MS = 90_000;

/** 剩余预算低于此值时直接跳过结论层（跑一半超时比没有结论更糟） */
const NARRATIVE_MIN_BUDGET_MS = 25_000;



// ============================================================

// P0 留资引擎：游客限流 + 区间化模糊结果

// 游客（无 token）每日限 3 次，返回 ±12% 区间价；留资（邮箱）后经

// /api/valuation/unlock 解锁精确值。登录用户逻辑完全不变。

// TODO: 限流计数目前为内存 Map（单实例有效），迁移 Redis（INCR + EXPIRE）

//       以支持多实例部署与重启后保留。

// 另：限流键 `getClientIpHash()` 已抽到 `@/lib/valuation/client-ip`（route 文件只能导出

//     HTTP 方法/路由配置，纯函数留在本文件无法单测）。抽出的同时修掉了取值链的伪造漏洞：

//     旧实现「优先取 x-forwarded-for 首段」在 `.cn` 上可被伪造 —— nginx 用

//     `$proxy_add_x_forwarded_for` 把客户端自带的 XFF 原样保留在前、真实 IP 追加到末尾，

//     首段完全由攻击者控制 ⇒ 每请求换一个随机 XFF 就等于每次都是"新访客"，

//     而游客估值不扣积分 ⇒ 视觉 + 文本双模型可被无限白嫖。

//     现在的链路是「x-real-ip 优先；.cn 回退 XFF 末段；.com 回退 XFF 首段」，

//     ⚠️ 它依赖 nginx 的 `proxy_set_header X-Real-IP $remote_addr`，部署侧不得移除。

// ============================================================

const GUEST_DAILY_LIMIT = 3;

const GUEST_WINDOW_MS = 24 * 60 * 60 * 1000; // 滚动 24 小时窗口

const guestValuationCounters = new Map<string, { count: number; resetAt: number }>();

/** 估值放行的最低积分门槛：预检只看够不够门槛，实际扣多少由算完后的真实 token 用量决定 */
const VALUATION_MIN_CREDITS = 1;

/**
 * 从 referer / 路径推断 locale（历史实现，保留能力不删）。
 *
 * 2026-11 起 `locale` 的唯一主入口是 `resolveAiLocale()`（见 POST 内 `aiLocale`）——
 * 它覆盖 referer 之外还有 body.locale / IP 国家 / accept-language，且会按站点收敛语种。
 * 本函数仅在 `aiLocale` 理论上取不到值时兜底（正常路径不会走到），
 * 之所以保留而不是删除：它是 rechargeUrl 语种的历史口径，删掉会丢失一条可回溯的推断路径。
 */
function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) {
    return m[1];
  }
  return "zh";
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

 *   - imageDataUris?: string[] 本地压缩图（`data:image/...;base64,...`），直传视觉模型

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

    // 本次请求的总 deadline：结论层只能用「剩余预算」，视觉/视频花掉的时间必须先扣掉
    const requestDeadline = Date.now() + VALUATION_TOTAL_BUDGET_MS;

    const body = await request.json();

    const { productId, brand, modelName, category, year, workingHours, condition, priceCny, useV4, skipImageAnalysis, engineBrand, tradeChannel } = body;

    // ── AI 输出语种（8 语种基建，commit b3fb475）──
    // 优先级：body.locale（前端 next-intl 当前路由语言）→ IP 国家 → accept-language → referer → 站点默认，
    // 且 .cn 会被收敛到 zh/en。视觉分析的 analysis 文案、结论叙述、rechargeUrl 三处必须同源，
    // 否则会出现「俄语报告 + 中文充值页」这种自相矛盾的体验。
    const aiLocale: AiLocale = resolveAiLocale({
      bodyLocale: (body as { locale?: unknown } | null)?.locale,
      request,
    }).locale;



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
          // 语种与 AI 文案同源（aiLocale）；getLocaleFromRequest 仅理论兜底，正常不会走到
          const locale = aiLocale || getLocaleFromRequest(request);
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

    // 前端上传的本地压缩图以 data URI 直传（不上 CDN）。只放行 `data:image/*`，
    // 其余字符串一律丢弃，避免把任意内容当图片喂给视觉模型。
    const imageDataUris: string[] = Array.isArray(body.imageDataUris)
      ? (body.imageDataUris as unknown[]).filter(
          (u): u is string => typeof u === "string" && u.startsWith("data:image/")
        )
      : [];

    // 合并后的图片列表：data URI 在前（用户刚拍的实机照片），远程 URL 在后。
    // ⚠️ 国产渠道（.cn）只传 data URI，若此处不合并 ⇒ 图片分析被跳过 ⇒ 零 token ⇒ 估值零收费。
    const mergedImageUrls: string[] = [...imageDataUris, ...imageUrls];

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

        imageUrls: mergedImageUrls.length > 0 ? mergedImageUrls : product.images?.map((img: any) => img.url) || [],

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

        imageUrls: mergedImageUrls,

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

    // 视觉逐图明细要回传到响应（data.visual），故在引擎分支外声明；V2 分支恒为 undefined
    let visualResult: VisualValuationResult | undefined;

    /** 实际送去视觉模型分析的图片数（skipImageAnalysis / 无图时为 0） */
    let analyzedImageCount = 0;

    /**
     * 全视频聚合分析结果（`undefined` = 无视频 / 全部失败）。
     *
     * 类型显式写在引擎分支外：图片与视频现在是**两个并行 task 各自写入**，
     * 若沿用 `let x = undefined`（evolving any），TS 在跨闭包赋值时无法收窄，
     * 会退化成隐式 any 并把类型检查变成摆设。
     */
    let videoAnalysisResult: VideoAnalysisResult | undefined;



    if (shouldUseV4) {

      // V4 引擎：支持多模态输入

      

      // 概况日志：图片分析检查（真正的分析在下面与视频【并行】发起，见 imageAnalysisTask）

      console.log("[Valuation V4] 图片分析检查:", {

        skipImageAnalysis,

        imageUrlsCount: input.imageUrls?.length || 0,

        // 只打印前 2 个远程 URL；data URI（本地压缩图）只记数量，绝不打印 base64 正文
        imageUrls: (input.imageUrls || [])
          .filter((u) => !u.startsWith("data:"))
          .slice(0, 2),

        imageDataUriCount: (input.imageUrls || []).filter((u) => u.startsWith("data:")).length,

      });

      

      // ── 1 + 2. 图片分析与视频分析【并行】──
      //
      // 为什么必须并行：`.cn` 容器内实测（北京 → ark.cn-beijing 真实路径）视觉 5 图 110.2s、
      // 视频 1 条 61.6s，串行 = 171.8s；而本请求总预算只有 VALUATION_TOTAL_BUDGET_MS(200s)、
      // 结论叙述还要 90s（保底 25s）—— 串行后只剩 28.2s，直接低于保底线，结论叙述会被跳过
      // （见下方 narrative 预算闸）。而视频 3 条**并行**实测只要 54.5s，
      // 与图片段完全重叠后总墙钟 ≈ max(110.2, 54.5) ≈ 110s，结论叙述才有时间跑。
      //
      // 两段互不依赖（图片只写 visualResult，视频只写 videoAnalysisResult），
      // 且各自 try/catch 把异常吃在内部（任一失败只影响自己的结果），所以这里用 Promise.all 汇合：
      // 两个 task 都不会 reject，不存在「一个失败把另一个也拖垮」。
      const imageAnalysisTask = (async (): Promise<void> => {
        if (skipImageAnalysis || !input.imageUrls || input.imageUrls.length === 0) {
          console.log("[Valuation V4] 跳过图片分析:", {
            reason: skipImageAnalysis ? "用户跳过" : "无图片URL",
          });
          return;
        }
        try {
          console.log("[Valuation V4] 开始图片分析, URLs:", input.imageUrls.length);
          // 传 aiLocale：analysis 类说明文字按目标语种输出（conditionCode 枚举永远英文）
          visualResult = await analyzeProductImages(input.imageUrls, aiLocale);
          analyzedImageCount = visualResult.perImage?.length ?? 0;

          console.log("[Valuation V4] 图片分析完成:", {
            visualConditionScore: visualResult.visualConditionScore,
            usedV4Condition: visualResult.usedV4Condition,
            imageConfidence: visualResult.imageConfidence,
          });
        } catch (error) {
          console.warn("[Valuation V4] 图片分析失败，降级到V2:", error);
        }
      })();

      // 视频：循环**全部**视频（不再只取 `videoUrls[0]`），交给 analyzeVideos 内部并行 + 异常优先聚合。
      // 每条都先过 getVideoUrl() 转成可直接访问的地址（与原 `getVideoUrl(input.videoUrls[0])` 同一口径）；
      // 条数上限(MAX_ANALYZE_VIDEOS=3)在 analyzeVideos 内部夹，异常请求不会拖长耗时。
      const videoAnalysisTask = (async (): Promise<void> => {
        const videoFullUrls = (input.videoUrls ?? [])
          .map((url) => getVideoUrl(url))
          .filter((url) => url.length > 0);
        if (videoFullUrls.length === 0) {
          return;
        }
        try {
          videoAnalysisResult = await analyzeVideos(videoFullUrls, aiLocale);
          console.log("[Valuation V4] 视频分析完成:", {
            videoCount: videoFullUrls.length,
            qualityScore: videoAnalysisResult.qualityScore,
            engineSoundStatus: videoAnalysisResult.engineSoundStatus,
            mechanismSmoothness: videoAnalysisResult.mechanismSmoothness,
            degraded: videoAnalysisResult.degraded === true,
          });
        } catch (error) {
          console.warn("[Valuation V4] 视频分析失败，降级到无视频:", error);
        }
      })();

      await Promise.all([imageAnalysisTask, videoAnalysisTask]);

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



    // ── AI 结论叙述层（2026-11 新增）：只有已登录用户才生成 ──
    // 生成条件**只**看「是否已登录」，不含任何 .com 专属逻辑 —— .cn 与 .com 行为一致
    // （老板：`.cn` 的估值报告同样太简单）。游客看免费简化版（价格区间 + 基础视觉分）。
    //
    // 位置很关键：必须在本函数下面那次 drainUsage() 之前 —— narrative 内部用 recordUsage()
    // 归集 token，紧接着的 drainUsage() 会把它与视觉 token 合并成【一次】成本、一次扣费。
    // 失败一律返回 null，绝不阻断下面的价格结果返回。
    let narrative: ValuationNarrative | null = null;
    if (isAuthenticated) {
      // 剩余预算：视觉/视频已经花掉的时间必须先扣掉，超预算就跳过结论层而不是硬跑
      const remainingBudgetMs = requestDeadline - Date.now();
      const narrativeTimeoutMs = Math.min(NARRATIVE_TIMEOUT_MS, remainingBudgetMs - 5_000);

      if (narrativeTimeoutMs < NARRATIVE_MIN_BUDGET_MS) {
        console.warn(
          `[Valuation] 跳过结论叙述：剩余预算 ${remainingBudgetMs}ms 不足 ${NARRATIVE_MIN_BUDGET_MS}ms（视觉/视频已耗时过长），返回 narrative: null`
        );
      } else {
        const narrativeOut = await generateValuationNarrative({
          locale: aiLocale,
          result,
          intelligence,
          productMeta: {
            brand: input.brand,
            modelName: input.modelName,
            category: input.category,
            year: input.year,
            workingHours: input.workingHours ?? null,
            condition: input.condition ?? null,
            region: intelRegion ?? null,
            engineBrand: input.engineBrand ?? null,
            enginePower: input.enginePower ?? null,
            driveSystem: input.driveSystem ?? null,
            sellerAskingCny: input.priceCny ?? null,
            foreignPriceCny: input.foreignPriceCny ?? null,
            imageCount: analyzedImageCount,
            videoCount: input.videoUrls?.length ?? 0,
            perImage: visualResult?.perImage ?? [],
            visualConditionScore: visualResult?.visualConditionScore ?? null,
            visualConditionAnalysis: visualResult?.visualConditionAnalysis ?? null,
          },
          isChineseBrand: isDomesticBrandSupported(input.brand),
          // 动态预算：不允许结论层吃掉整个请求的时间（详见文件顶部 maxDuration 注释）
          timeoutMs: narrativeTimeoutMs,
        });
        narrative = narrativeOut.narrative;
        console.log(
          `[Valuation] 结论叙述: generated=${narrative !== null} locale=${aiLocale} budget=${narrativeTimeoutMs}ms in=${narrativeOut.usage.inputTokens} out=${narrativeOut.usage.outputTokens}`
        );
      }
    }

    // ── 视觉成色（data.visual）：英文枚举 + 本地化文案 + 逐图明细 ──
    // score 为 null 表示本次没有可用的视觉评估（跳过分析 / 全失败），前端据此隐藏该区块。
    const visualScore =
      visualResult && visualResult.visualConditionScore > 0 ? visualResult.visualConditionScore : null;
    const visualLabel: ConditionCode | null =
      visualResult?.conditionCode ?? (visualScore !== null ? scoreToConditionCode(visualScore) : null);
    const visualBase = {
      score: visualScore,
      label: visualLabel,
      labelText: visualLabel ? conditionCodeLabelText(visualLabel, aiLocale) : null,
      // 图片分析置信度（0-1）。`imageConfidence === 0` 表示「没有可用的视觉评估」，
      // 一律输出 null 而不是 0 —— 前端把它渲染成「置信度 0%」比不显示更糟（0% 是错误信息，
      // 真实含义是「没看图」）。有值时必须 > 0，故用 > 0 判定而不是 != null。
      confidence:
        visualResult && visualResult.imageConfidence > 0 ? visualResult.imageConfidence : null,
      imageCount: analyzedImageCount,
    };

    // ── 积分计费 ②：估值算完后，按本请求内 LLM 的【真实 token 用量】扣分 ──
    // 用量由 image-analyzer / video-analyzer 在拿到 provider usage 后经 usage-collector 归集。
    // 只扣一次：把全部记录按模型分组算成本后求和，再一次 deductCredits。
    // 无论如何都要 drain：模块级数组是本进程的，游客/异常分支不 drain 会跨请求串账。
    const usage = drainUsage();
    /**
     * 本次估值的计费摘要，登录用户成功响应里以 `billing` 字段返回（前端 page.tsx 读 `billing.points` / `billing.balance`）。
     * 无 LLM 用量（如 skipImageAnalysis）时为 null —— 不返回「扣 0 分」的噪音。
     */
    let billing: { points: number; balance: number } | null = null;
    if (authUserId) {
      const billingCountry = await getBillingCountry(authUserId);
      const perModel: AiCostBreakdown[] = usage.map((u) =>
        computeAiCost({
          model: u.model,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          billingCountry,
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
        // watchdog：计费失守必须能被运维 grep 到（含模型用量，便于核对是否 LLM 真被调用过）
        console.warn(
          `[Valuation][WATCHDOG] 计费失败 user=${authUserId} required=${deduction.required} balance=${deduction.credits} usage=${usage.length} images=${mergedImageUrls.length}`
        );
      } else if (totalPoints > 0 && (deduction.credits ?? 0) === 0) {
        // 扣分成功但余额归零：提示运营关注（下一单会被 402 拦住，属预期行为，但要可见）
        console.warn(
          `[Valuation][WATCHDOG] 余额归零 user=${authUserId} points=${totalPoints} usage=${usage.length}`
        );
      }

      // 只在实际产生费用时回传，避免前端每次都弹「本次消耗 0 积分」
      if (totalPoints > 0) {
        billing = { points: totalPoints, balance: deduction.credits ?? 0 };
      }
    }



    // ── P0 留资引擎：游客返回区间化模糊结果（留资后经 unlock 接口解锁精确值）──

    if (!isAuthenticated) {

      return NextResponse.json({

        success: true,

        blurred: true,

        intelligence,

        // 游客：价格区间化 + 无 AI 结论（付费差异点）+ 基础视觉分（不含逐图明细）
        data: {

          ...toBlurredValuation(result),

          narrative: null,

          visual: { ...visualBase, perImage: [] },

        },

        meta: {

          engine: shouldUseV4 ? "v4" : "v2",

          guest: true,

          aiLocale,

        },

      });

    }



    // 登录用户：照旧返回完整精确结果（响应增加 blurred: false 标识）

    return NextResponse.json({

      success: true,

      blurred: false,

      intelligence,

      version: result.version,

      // 只增不改：result 的全部字段保持原样，新增 narrative（AI 结论层，生成失败为 null）
      // 与 visual（视觉成色 + 逐图明细）。前端按这两个键渲染报告主体。
      data: {

        ...result,

        narrative,

        visual: { ...visualBase, perImage: visualResult?.perImage ?? [] },

      },

      // 计费可见化：本次估值按 LLM 真实用量扣了多少积分 + 扣后余额（无用量时为 null）
      // 字段名严格为 billing.points / billing.balance —— 前端 page.tsx 直接读这两个键。
      billing,



      // V4 额外元信息

      meta: {

        engine: shouldUseV4 ? "v4" : "v2",

        imageAnalyzed: shouldUseV4 && result.usedV4Condition,

        // 本次 AI 文案实际使用的语种（前端可用于排查「报告语言不对」的反馈）
        aiLocale,

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

    // GET 分支同理：图片/视频是两个并行 task 各自写入，声明必须提到 `if (shouldUseV4)` 之外
    // 并显式标注类型（evolving any 在跨闭包赋值时会被 TS 判成隐式 any，等于放弃类型检查）。
    let visualResult: VisualValuationResult | undefined;
    let videoAnalysisResult: VideoAnalysisResult | undefined;

    if (shouldUseV4) {

      // V4: 图片分析与视频分析【并行】（口径同 POST：串行会被 200s 总预算挤掉结论叙述）
      //
      // 并行只改「两段谁先谁后」，不改任何单段语义：
      //   - 图片段保留 `skipImageAnalysisParam` / 无图片 URL 的跳过分支（跳过时不发请求）；
      //   - 视频段同样循环**全部**视频（不再只取 [0]），条数上限在 analyzeVideos 内部夹；
      //   - 两段各自 try/catch，任一失败只影响自己的结果。
      const getImageAnalysisTask = (async (): Promise<void> => {
        if (skipImageAnalysisParam === "true" || !input.imageUrls || input.imageUrls.length === 0) {
          return;
        }
        try {
          visualResult = await analyzeProductImages(input.imageUrls);
        } catch (error) {
          console.warn("[Valuation V4 GET] 图片分析失败，降级到V2:", error);
        }
      })();

      // ⚠️ GET 分支保持既有语义：调视频分析**不传 locale**（历史行为，不在本单改造范围）
      const getVideoAnalysisTask = (async (): Promise<void> => {
        const videoFullUrls = (input.videoUrls ?? [])
          .map((url) => getVideoUrl(url))
          .filter((url) => url.length > 0);
        if (videoFullUrls.length === 0) {
          return;
        }
        try {
          videoAnalysisResult = await analyzeVideos(videoFullUrls);
          console.log("[Valuation V4 GET] 视频分析完成:", {
            videoCount: videoFullUrls.length,
            engineSoundStatus: videoAnalysisResult.engineSoundStatus,
            mechanismSmoothness: videoAnalysisResult.mechanismSmoothness,
            degraded: videoAnalysisResult.degraded === true,
          });
        } catch (error) {
          console.warn("[Valuation V4 GET] 视频分析失败:", error);
        }
      })();

      await Promise.all([getImageAnalysisTask, getVideoAnalysisTask]);

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

    // 真实成交情报切片（与 POST 同源，GET 也回传，供产品页报告渲染真实 P25~P75 区间）
    const intelRegion = input.location || undefined;
    const intelligence = getValuationIntelligence(
      input.brand,
      input.category,
      input.modelName,
      intelRegion,
    );

    // 数值系数公式串（与产品页客户端 buildFormula 同逻辑，服务端直接产出避免二次计算漂移）
    const fNum = (n: number | undefined | null) =>
      n === undefined || n === null || Number.isNaN(Number(n)) ? "?" : Number(n).toFixed(2);
    const formula =
      `估值 = 新机基准价 ¥${Math.round(result.basePrice || 0)} × 年份折旧 ${fNum((result as any).yearFactor)} × 工时因子 ${fNum((result as any).hoursFactor)} × 成色因子 ${fNum((result as any).conditionFactor)} × 市场因子 ${fNum((result as any).marketFactor)} × 品牌系数 ${fNum((result as any).brandFactor)} = ¥${Math.round(result.estimatedValue || 0)}`;

    return NextResponse.json({

      success: true,

      version: result.version,

      data: result,

      formula,

      intelligence,

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

