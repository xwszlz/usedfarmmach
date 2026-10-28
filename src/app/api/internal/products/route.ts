/**

 * 内部 API：接收小程序发布的产品数据

 * - 仅允许持有 INTERNAL_API_KEY 的请求调用

 * - 支持客户端发送 base64 Data URI（新版小程序）或 HTTPS URL（旧版兼容）

 * - 自动上传图片/视频到 OSS，创建产品与关联记录

 * - 所有图片上传失败时回滚（删除孤儿产品）

 *

 * ⚠️ 此接口执行耗时较长（多张 base64 图片上传OSS），

 *    已设置 maxDuration=60 避免 Vercel 默认10s超时。

 */

import { NextRequest, NextResponse } from "next/server";
import { matchInternalApiKey } from "@/lib/internal-api-key-auth";
import { cnyToUsd, getUsdPerCny } from "@/lib/exchange-rate";

import { prisma } from "@/lib/db";

import { uploadBufferToOSS, isOwnOssUrl } from "@/lib/oss-upload";
import { downloadGuardedImage } from "@/lib/net/download-image";
import { MAX_IMAGE_BYTES, MAX_UPLOAD_IMAGE_BYTES } from "@/lib/net/ssrf-guard";

import { hashPassword, verifyToken, getTokenFromHeaders } from "@/lib/auth";

import { matchPortByLocation } from "@/lib/port-matcher";

import { calculateValuationV4, type ValuationInput } from "@/lib/valuation/formulas";

import { resolveValuationCodes } from "@/lib/valuation/resolve-codes";

import { analyzeProductImages } from "@/lib/valuation/image-analyzer";

import { analyzeVideo, calculateVideoFactor } from "@/lib/valuation/video-analyzer";
import { chatCompletionDoubao, getArkVisionModelId } from "@/lib/ai/ark-client";
import { drainUsage } from "@/lib/credits/usage-collector";

import { getDetailImageUrl, getVideoUrl } from "@/lib/image-url";


import crypto from "crypto";

import { checkContent, isBlocked } from "@/lib/wechat-sec-check";

import { checkDuplicateProduct, fireVideoModeration, MAX_VIDEOS_PER_PRODUCT, MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_FILE_SIZE_BYTES } from "@/lib/content-moderation";
import { translateProductOnPublish } from "@/lib/services/product-translation";



// Vercel Serverless Function 超时延长至300秒（Pro计划上限）

// 小程序可能同时上传多张大图+视频，60秒不够用

export const maxDuration = 300;



// 小程序通过 oss-token 直传到该 OSS bucket，URL 形如

// https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/uploads/products/xxx.jpg

// 已经是最终地址，后端无需再下载重传

// 判断"是否自有 OSS 地址"已改用 isOwnOssUrl()（解析后精确比 hostname）。
// 原来这里存的是带 scheme 的整条前缀，配 startsWith 使用 —— 可被
// `https://<host>.evil.tld/x` 这类地址绕过，把外部 URL 冒充成小程序直传产物。



// 国际农机品牌列表（中英文）

const INTERNATIONAL_BRANDS = new Set([

  // 欧美品牌

  "claas", "克拉斯", "class",

  "john deere", "约翰迪尔", "john deere",

  "new holland", "纽荷兰", "凯斯纽荷兰",

  "case ih", "凯斯",

  "fendt", "芬特",

  "massey ferguson", "麦赛福格森",

  "deutz-fahr", "道依茨法尔", "道依茨",

  "krone", "科罗尼", "克朗",

  "jcb",

  "valtra", "维美德",

  "lemken", "雷肯",

  "grimme", "格立莫",

  "amazone", "阿玛松",

  "poettinger", "波廷格",

  "kverneland", "库恩",

  "kuhn",

  "claydon",

  "horsch", "豪狮",

  "kubota", "久保田",

  "yanmar", "洋马",

  "iseki", "井关",

  "shibaura",

]);



function isInternationalBrand(brandName: string | undefined): boolean {

  if (!brandName) return false;

  const lower = brandName.toLowerCase().trim();

  // 精确匹配

  if (INTERNATIONAL_BRANDS.has(lower)) return true;

  // 部分匹配（如 "claas jaguar" 匹配 "claas"）

  for (const ib of INTERNATIONAL_BRANDS) {

    if (ib.length >= 4 && (lower.includes(ib) || ib.includes(lower))) return true;

  }

  return false;

}



function getApiKey(req: NextRequest): string | null {

  const header = req.headers.get("x-api-key");

  if (header) return header;

  try {

    // 部分旧版云函数可能把 key 放在 body 里，这里不作为主入口

  } catch {

    // ignore

  }

  return null;

}



function requireApiKey(req: NextRequest): true | null {
  const key = getApiKey(req);
  // 双值匹配：同时接受当前 INTERNAL_API_KEY 与过渡期 INTERNAL_API_KEY_PREVIOUS（fail-closed）。
  return matchInternalApiKey(key) !== null ? true : null;
}

/**
 * 发布鉴权：兼容两类调用方
 *  1) 服务端任务：x-api-key（INTERNAL_API_KEY / PREVIOUS）——保持原行为，不绑定用户
 *  2) 小程序：Authorization: Bearer <JWT>（wx.login → code2session 签发）——绑定真实用户
 *
 * hadInvalidToken：客户端确实带了 Bearer 但校验失败（过期/无效），
 * 仅用于让小程序拿到「请重新登录」文案；无凭证与 x-api-key 不匹配时保持原响应体。
 */
function getPublisherAuth(req: NextRequest): {
  ok: boolean;
  userId?: string;
  hadInvalidToken?: boolean;
} {
  if (requireApiKey(req)) return { ok: true };
  const token = getTokenFromHeaders(req.headers);
  if (token) {
    const payload = verifyToken(token);
    if (payload?.userId) return { ok: true, userId: payload.userId };
    return { ok: false, hadInvalidToken: true };
  }
  return { ok: false };
}



async function getOrCreateDefaultSeller() {

  const email = "miniprogram@shendiao.com";

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) return user.id;



  const randomPassword = crypto.randomBytes(32).toString("hex");

  const passwordHash = await hashPassword(randomPassword);

  const created = await prisma.user.create({

    data: {

      email,

      username: "miniprogram",

      passwordHash,

      role: "seller",

      companyName: "小程序发布",

      country: "CN",

      preferredLanguage: "zh",

      credits: 999999, // 系统账号，避免发布积分不足

      isActive: true,

    },

  });

  return created.id;

}



async function resolveBrand(brandId?: string, brandName?: string) {

  if (brandId) {

    const existing = await prisma.brand.findUnique({ where: { id: brandId } });

    if (existing) return existing;

  }

  if (brandName) {

    const existing = await prisma.brand.findFirst({ where: { nameZh: brandName } });

    if (existing) return existing;

    const isImported = isInternationalBrand(brandName);

    const created = await prisma.brand.create({

      data: {

        nameZh: brandName,

        nameEn: brandName,

        originCountry: isImported ? "进口" : "中国",

        isImported,

      },

    });

    return created;

  }

  throw new Error("brandId 和 brandName 至少提供一个");

}



async function resolveCategory(categoryId?: string, categoryName?: string) {

  if (categoryId) {

    const existing = await prisma.category.findUnique({ where: { id: categoryId } });

    if (existing) return existing.id;

  }

  if (categoryName) {

    const existing = await prisma.category.findFirst({ where: { nameZh: categoryName } });

    if (existing) return existing.id;

    const created = await prisma.category.create({

      data: { nameZh: categoryName, nameEn: categoryName },

    });

    return created.id;

  }

  throw new Error("categoryId 和 categoryName 至少提供一个");

}





/**

 * 从 Data URI 或 HTTPS URL 中提取 Buffer

 * - 支持 base64 Data URI（新版小程序：data:image/jpeg;base64,... / data:video/mp4;base64,...）

 * - 支持 HTTPS URL（旧版兼容：云函数转传）

 *

 * 🐛 Bug 1 修复（R4）：

 *   旧代码用 getImageBuffer() 只匹配 image/* 的 Data URI，

 *   新版小程序发送的视频是 data:video/mp4;base64,... 格式。

 *   现在统一为 getDataUriBuffer()，正则改为 [a-zA-Z/+-]+ 兼容所有 MIME 类型。

 */

async function getDataUriBuffer(src: string): Promise<{ buffer: Buffer; contentType: string }> {

  if (src.startsWith("data:")) {

    const match = src.match(/^data:([a-zA-Z/+-]+);base64,(.+)$/);

    if (!match) throw new Error(`Invalid data URI format: ${src.substring(0, 120)}`);

    return {

      buffer: Buffer.from(match[2], "base64"),

      contentType: match[1],

    };

  }

  // HTTPS URL 回退到带守卫的下载（商品图要落 OSS，按 30MB 的落盘口径，而不是送模型的 12MB）。
  // 原来这里是裸 fetch + redirect:"follow"：任意登录用户传内网地址即可让服务器代取，
  // 且响应会经 uploadBufferToOSS 固化成公开可访问对象（可下载/分享/被索引/长期留存）。
  return await downloadGuardedImage(src, {
    maxBytes: MAX_UPLOAD_IMAGE_BYTES,
    defaultContentType: "application/octet-stream",
  });

}



function guessExtFromMime(mime: string): string {

  const map: Record<string, string> = {

    "image/jpeg": "jpg",

    "image/png": "png",

    "image/webp": "webp",

    "image/gif": "gif",

    "image/bmp": "bmp",

    "video/mp4": "mp4",

    "video/quicktime": "mov",

  };

  return map[mime] || "jpg";

}



/**

 * 安全提取错误消息 — 兼容 Error 实例、字符串、对象、null/undefined 等

 *

 * 🐛 Bug 3 修复（R4）：

 *   旧代码 error instanceof Error ? error.message : "Internal server error"

 *   当 error 是字符串、对象或非标准类型时，message 可能为 undefined → 客户端收到 falsy 值

 *   显示"服务器返回异常"。现在覆盖所有边界情况。

 */

function extractErrorMessage(error: unknown): string {

  if (error instanceof Error) {

    // 处理嵌套 cause（如 Prisma/Vercel 错误链）

    if (error.cause instanceof Error) {

      return `${error.message} (原因: ${error.cause.message})`;

    }

    return error.message;

  }

  if (typeof error === "string") return error;

  if (error && typeof error === "object") {

    // 处理 { message: "..." } 或 { error: { message: "..." } }

    const obj = error as Record<string, unknown>;

    if (typeof obj.message === "string") return obj.message;

    if (typeof obj.error === "string") return obj.error;

    if (obj.error && typeof obj.error === "object" && typeof (obj.error as Record<string, unknown>).message === "string") {

      return (obj.error as Record<string, unknown>).message as string;

    }

  }

  // 兜底序列化

  try {

    const str = JSON.stringify(error);

    return str && str !== "null" && str !== "undefined" ? str : "Unknown server error";

  } catch {

    return "Unknown server error";

  }

}



export async function POST(request: NextRequest) {

  const requestStartTime = Date.now();



  // 鉴权：x-api-key（服务端任务）或 Bearer JWT（小程序登录用户）
  const auth = getPublisherAuth(request);

  if (!auth.ok) {

    // 小程序带了 Bearer 但已失效 → 中文文案（publish.js 会直接 toast res.data.error）；
    // 其余情况（无凭证 / x-api-key 不匹配）保持原响应体不变。
    return NextResponse.json(

      auth.hadInvalidToken
        ? { success: false, error: "请重新登录", code: "UNAUTHORIZED" }
        : { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },

      { status: 401 }

    );

  }



  // 用于异常回滚：记录已创建但未完成的产品 ID

  let createdProductId: string | null = null;



  try {

    // ── Step 1: 解析请求体 ──

    const t1 = Date.now();

    const body = await request.json();

    console.log(`[internal/products] step-1 body parsed in ${Date.now() - t1}ms`);



    const {

      sellerId,

      openid,

      brandId,

      brandName,

      categoryId,

      categoryName,

      modelName,

      year,

      condition = "good",

      // 新字段名（对齐 Prisma schema）

      enginePower,

      engineType,

      driveSystem,

      mainConfig,

      netWeight,

      // 外形尺寸

      overallLength,

      overallWidth,

      overallHeight,

      // 贸易信息

      priceMode = 'por',

      tradeTerm = 'FOB',

      tradePort = '',

      // 旧字段名（向后兼容，优先级低于新字段名）

      descPower,

      descDrive,

      descEngineHours,

      descRollerHours,

      descHeader,

      descOther,

      priceCny,

      location,

      // P0-4：结构化产地（国内 province/city，国际仅 country）
      country,
      province,
      city,

      // P0-4：工作小时（发布者填写，0 合法）
      workingHours,

      // P0-4：卖家自留联系方式（替代平台统一号码，登录买家可见）
      contactName,
      contactPhone,
      contactWechat,
      contactEmail,

      // 地图选点坐标（wx.chooseLocation），用于物流与地图展示

      latitude,

      longitude,

      images = [],

      // 兼容旧版单视频字段 + 新版多视频字段

      video,

      videos = [],

      // autoAI: 小程序提交时设为true，触发服务端自动AI识别+估值

      autoAI = false,

      photoLabels,

    } = body;



    // 合并视频源：新版 videos 数组优先，旧版 video 兼容

    const allVideos: string[] = [];

    if (Array.isArray(videos) && videos.length > 0) {

      allVideos.push(...videos.filter((v: string) => typeof v === "string" && v.length > 0));

    }

    if (video && typeof video === "string" && !allVideos.includes(video)) {

      allVideos.push(video);

    }

    // 限制最多 3 个视频

    if (allVideos.length > MAX_VIDEOS_PER_PRODUCT) {

      return NextResponse.json(

        { success: false, error: `最多上传 ${MAX_VIDEOS_PER_PRODUCT} 个视频`, code: "TOO_MANY_VIDEOS" },

        { status: 400 }

      );

    }



    // 港口自动匹配：如果未指定港口，根据位置自动匹配

    const finalTradePort = tradePort || (location ? matchPortByLocation(location) : '青岛');

    const finalEnginePower = enginePower ?? descPower;

    const finalEngineType = engineType ?? null;

    const finalDriveSystem = driveSystem ?? descDrive ?? null;

    const finalMainConfig = mainConfig ?? descHeader ?? null;

    const finalNetWeight = netWeight ?? null;

    // P0-4：工时由发布者填写，0 合法；空/非数字落 null（不能把 0 当空值丢掉）
    const finalWorkingHours =
      workingHours === undefined || workingHours === null || workingHours === ""
        ? null
        : Number.isFinite(Number(workingHours))
          ? Math.max(0, Math.round(Number(workingHours)))
          : null;

    // P0-4：结构化产地与联系方式统一清洗（空串落 null，避免 DB 里出现 ""）
    const asOptionalText = (v: unknown): string | null =>
      typeof v === "string" && v.trim() !== "" ? v.trim() : null;



    // 年份可选（新机可能没有年份）：缺省取当前年份

    const finalYear = year ? Number(year) : new Date().getFullYear();



    // ── 校验 ──

    if (!modelName || !priceCny || !location) {

      return NextResponse.json(

        { success: false, error: "请填写完整信息（型号、价格、位置为必填）", code: "VALIDATION_ERROR" },

        { status: 400 }

      );

    }

    if (!brandId && !brandName) {

      return NextResponse.json(

        { success: false, error: "请选择或输入品牌", code: "VALIDATION_ERROR" },

        { status: 400 }

      );

    }

    if (!categoryId && !categoryName) {

      return NextResponse.json(

        { success: false, error: "请选择或输入品类", code: "VALIDATION_ERROR" },

        { status: 400 }

      );

    }

    if (!images || images.length === 0) {

      return NextResponse.json(

        { success: false, error: "请至少上传一张图片", code: "NO_IMAGES" },

        { status: 400 }

      );

    }



    // ── 内容安全检测（微信审核要求：UGC 发布前必须先检测）──

    const secTextParts = [

      brandName,

      categoryName,

      modelName,

      descOther,

      location,

      finalEnginePower,

      finalEngineType,

      finalDriveSystem,

      finalMainConfig,

    ].filter(Boolean).join("\n");



    // 只有 HTTPS URL 才检测；本地临时路径、base64 等不检测（上传阶段不应传本地路径）

    const secImageUrls = (images || []).filter(

      (src: string) => typeof src === "string" && src.startsWith("https://")

    );



    try {

      const { text: textResult, images: imageResult } = await checkContent(

        secTextParts,

        secImageUrls,

        openid

      );



      if (isBlocked(textResult.suggest)) {

        return NextResponse.json(

          {

            success: false,

            error: "发布内容含违规信息，请修改后重试",

            code: "CONTENT_SECURITY_VIOLATION",

            detail: "text",

          },

          { status: 400 }

        );

      }



      if (!imageResult.allPass) {

        return NextResponse.json(

          {

            success: false,

            error: "图片含违规信息，请修改后重试",

            code: "CONTENT_SECURITY_VIOLATION",

            detail: "image",

          },

          { status: 400 }

        );

      }

    } catch (secErr) {

      // 内容安全检测服务本身异常时，记录日志但不阻塞发布（避免微信侧临时问题导致业务完全停摆）

      console.error(

        "[internal/products] 内容安全检测异常（非阻塞）:",

        secErr instanceof Error ? secErr.message : String(secErr)

      );

    }



    // ── 确定卖家 ──

    // JWT 登录用户优先（防 body 伪造 sellerId）；x-api-key 调用方无 userId，行为不变
    const finalSellerId = auth.userId || sellerId || (await getOrCreateDefaultSeller());



    // ── 校验卖家存在（发布不再消耗积分）──

    const user = await prisma.user.findUnique({ where: { id: finalSellerId } });

    if (!user) {

      return NextResponse.json(

        { success: false, error: "卖家不存在", code: "SELLER_NOT_FOUND" },

        { status: 404 }

      );

    }



    // ── Step 2: 解析品牌/品类 ──

    const t2 = Date.now();

    const [brandRecord, finalCategoryId] = await Promise.all([

      resolveBrand(brandId, brandName),

      resolveCategory(categoryId, categoryName),

    ]);

    const finalBrandId = brandRecord.id;

    const isImported = brandRecord.isImported || isInternationalBrand(brandName || brandRecord.nameZh);

    console.log(`[internal/products] step-2 brand/category resolved in ${Date.now() - t2}ms, brand=${brandRecord.nameZh}, isImported=${isImported}`);



    // ── Step 2.5: 重复产品检测 ──

    const dupCheck = await checkDuplicateProduct(

      finalSellerId,

      finalBrandId,

      modelName,

      finalYear,

      undefined,

      {

        // 可区分特征：只要有任一不同即为另一台设备，放行发布

        // 工时已可填（P0-4）：同品牌/型号/年份/价格但工时差异大的是两台不同设备，必须参与比对

        signature: {

          condition: condition || null,

          priceCny: priceCny ? Number(priceCny) : null,

          enginePower: finalEnginePower ? Number(finalEnginePower) : null,

          workingHours: finalWorkingHours,

        },

      }

    );

    if (dupCheck.isDuplicate) {

      return NextResponse.json(

        {

          success: false,

          error: dupCheck.message || "检测到重复产品，请勿重复发布",

          code: "DUPLICATE_PRODUCT",

          existingProductId: dupCheck.existingProductId,

        },

        { status: 409 }

      );

    }



    // 品牌策略：国际品牌→手机+网站同时展示；国产品牌→只在手机端展示，不在网站展示

    // 所有产品统一设为 active（小程序内都能显示），网站端通过 brand.isImported 过滤

    const productStatus = "active"; // 统一 active，由网站 API 决定是否展示



    // ── 组装描述（与网站格式一致）──

    const descParts: string[] = [];

    if (finalEnginePower) descParts.push(`马力：${finalEnginePower}HP`);

    if (finalEngineType) descParts.push(`发动机：${finalEngineType}`);

    if (finalDriveSystem) descParts.push(`驱动：${finalDriveSystem}`);

    if (descEngineHours) descParts.push(`发动机小时：${descEngineHours}`);

    if (descRollerHours) descParts.push(`轧辊小时：${descRollerHours}`);

    if (finalMainConfig) descParts.push(`配置：${finalMainConfig}`);

    if (finalNetWeight) descParts.push(`净重：${finalNetWeight}kg`);

    if (overallLength || overallWidth || overallHeight) {

      descParts.push(`尺寸：${overallLength || '-'}×${overallWidth || '-'}×${overallHeight || '-'} mm`);

    }

    if (priceMode || tradeTerm || finalTradePort) {

      descParts.push(`贸易：${priceMode?.toUpperCase() || ''}/${tradeTerm || ''}/${finalTradePort || ''}`);

    }

    if (descOther) descParts.push(descOther);

    const descriptionZh = descParts.join("\n") || null;



    // ── Step 3: 创建产品 ──

    const t3 = Date.now();

    const product = await prisma.product.create({

      data: {

        sellerId: finalSellerId,

        brandId: finalBrandId,

        categoryId: finalCategoryId,

        modelName,

        year: finalYear,

        // P0-4：工时按发布者填写值落库（旧实现恒为 null，导致详情页显示「--」）
        workingHours: finalWorkingHours,

        condition,

        priceCny: Number(priceCny),

        priceUsd: cnyToUsd(Number(priceCny), await getUsdPerCny()),

        location: location || "",

        // P0-4：结构化产地（国内 province/city；国际仅 country，取 ISO 码）

        country: asOptionalText(country),

        province: asOptionalText(province),

        city: asOptionalText(city),

        // P0-4：卖家自留联系方式（替代平台统一号码）

        contactName: asOptionalText(contactName),

        contactPhone: asOptionalText(contactPhone),

        contactWechat: asOptionalText(contactWechat),

        contactEmail: asOptionalText(contactEmail),

        descriptionZh,

        status: productStatus,

        // 新字段写入数据库

        enginePower: finalEnginePower ? Number(finalEnginePower) : null,

        engineType: finalEngineType,

        driveSystem: finalDriveSystem,

        mainConfig: finalMainConfig,

        netWeight: finalNetWeight ? Number(finalNetWeight) : null,

        // 外形尺寸

        overallLength: overallLength ? Number(overallLength) : null,

        overallWidth: overallWidth ? Number(overallWidth) : null,

        overallHeight: overallHeight ? Number(overallHeight) : null,

        // 贸易信息

        priceMode,

        tradeTerm,

        tradePort: finalTradePort,

        // 地图选点坐标（用于物流与地图展示；可能为 null）

        latitude: (typeof latitude === "number" && !Number.isNaN(latitude)) ? latitude : null,

        longitude: (typeof longitude === "number" && !Number.isNaN(longitude)) ? longitude : null,

      },

    });

    createdProductId = product.id;

    console.log(`[internal/products] step-3 product created in ${Date.now() - t3}ms, id=${product.id}`);



    const folder = `uploads/products/${product.id}`;



    // ── Step 4: 处理图片（带失败计数 + 全部失败回滚）──

    // 小程序新版流程：前端已通过 oss-token 直传到 OSS，images 已是完整 OSS URL，

    // 直接入库即可，无需后端再下载重传（这是 120 秒超时的根因）。

    // 保留对 base64 Data URI / 外部 URL 旧模式的兼容。

    let uploadedImageCount = 0;

    let firstImageError: string | null = null; // 记录第一个失败的详细原因，用于诊断

    for (let i = 0; i < images.length; i++) {

      const imgStart = Date.now();

      try {

        const src = images[i];

        let url: string;



        if (isOwnOssUrl(src)) {

          // ✅ 小程序直传产物：直接复用 OSS URL

          url = src;

          console.log(`[internal/products] step-4 image[${i}] is direct OSS URL, skip re-upload: ${url}`);

        } else {

          // 兼容旧模式：base64 Data URI 或外部 URL → 下载后上传到 OSS

          const { buffer, contentType } = await getDataUriBuffer(src);

          const ext = guessExtFromMime(contentType);

          const key = `${folder}/image_${i}_${Date.now()}.${ext}`;

          console.log(`[internal/products] step-4 image[${i}] decoding OK, size=${buffer.length}bytes, type=${contentType}, uploading...`);

          url = await uploadBufferToOSS(key, buffer, contentType);

        }



        await prisma.productImage.create({

          data: {

            productId: product.id,

            url: url, // 直接存储完整 OSS URL

            sortOrder: i,

            isPrimary: i === 0,

          },

        });

        uploadedImageCount++;

        console.log(`[internal/products] step-4 image[${i}] saved OK in ${Date.now() - imgStart}ms`);

      } catch (err) {

        const errDetail = extractErrorMessage(err);

        const srcPreview = String(images[i]).substring(0, 120);

        console.error(

          `[internal/products] step-4 image[${i}] FAILED in ${Date.now() - imgStart}ms: ` +

          `src=${srcPreview}, error=${errDetail}`,

          err

        );

        // 只记录第一个错误的详细信息

        if (!firstImageError) {

          firstImageError = `[image ${i}] ${errDetail} (src preview: ${srcPreview})`;

        }

      }

    }



    // ⚠️ 问题 2 修复（R4）：所有图片上传失败 → 回滚产品并返回明确错误码

    if (uploadedImageCount === 0) {

      console.error(`[internal/products] step-4 ALL ${images.length} images FAILED, rolling back product ${product.id}. First error: ${firstImageError}`);

      try {

        await prisma.product.delete({ where: { id: product.id } });

        createdProductId = null; // 已回滚，catch 中无需再删

      } catch (delErr) {

        console.error(`[internal/products] rollback delete failed for ${product.id}:`, delErr);

      }

      return NextResponse.json(

        {

          success: false,

          error: "图片上传全部失败，请检查图片格式后重试",

          code: "ALL_IMAGES_FAILED",

          attempted: images.length,

          // 🔍 R6 修复：返回诊断信息，便于定位根因

          firstError: firstImageError || "未知错误（错误信息未被捕获）",

        },

        { status: 503 }

      );

    }

    console.log(`[internal/products] step-4 images done: ${uploadedImageCount}/${images.length} succeeded`);



    // ── Step 5: 上传视频（支持多个，最多3个）──

    // OSS 直传模式：小程序已通过 wx.uploadFile 把视频直传到 OSS，

    // 此时 video 字段为完整 HTTPS URL，应直接复用入库。

    // 同时保留对 base64 Data URI 旧模式的兼容。

    const savedVideoRecords: { id: string; url: string }[] = [];



    for (let vi = 0; vi < allVideos.length; vi++) {

      const vidSrc = allVideos[vi];

      const vidStart = Date.now();

      try {

        let videoUrlForDb: string;

        let videoSize: number | null = null;

        let videoDuration: number | null = null;



        if (vidSrc.startsWith("https://") || vidSrc.startsWith("http://")) {

          // ✅ OSS 直传新模式：video 已经是完整的 HTTP(S) URL

          videoUrlForDb = vidSrc;

          console.log(`[internal/products] step-5 video[${vi}] is direct OSS URL, reusing: ${videoUrlForDb.substring(0, 80)}...`);

        } else {

          // 兼容旧模式：base64 Data URI 格式

          const { buffer, contentType } = await getDataUriBuffer(vidSrc);

          videoSize = buffer.length;

          // 校验文件大小

          if (videoSize > MAX_VIDEO_FILE_SIZE_BYTES) {

            console.warn(`[internal/products] step-5 video[${vi}] exceeds size limit: ${videoSize} > ${MAX_VIDEO_FILE_SIZE_BYTES}, skipping`);

            continue;

          }

          const ext = guessExtFromMime(contentType);

          const key = `${folder}/video_${vi}_${Date.now()}.${ext}`;

          const uploadedUrl = await uploadBufferToOSS(key, buffer, contentType);

          videoUrlForDb = uploadedUrl;

        }



        // 读取视频时长（从 body 中的 videoDurations 数组，小程序前端提供）

        const videoDurations = body.videoDurations;

        if (Array.isArray(videoDurations) && videoDurations[vi] != null) {

          videoDuration = Number(videoDurations[vi]);

          // 校验时长

          if (videoDuration > MAX_VIDEO_DURATION_SECONDS) {

            console.warn(`[internal/products] step-5 video[${vi}] exceeds duration limit: ${videoDuration}s > ${MAX_VIDEO_DURATION_SECONDS}s, skipping`);

            continue;

          }

        }



        const videoRecord = await prisma.productVideo.create({

          data: {

            productId: product.id,

            url: videoUrlForDb,

            sortOrder: vi,

            title: `${modelName} 视频${allVideos.length > 1 ? vi + 1 : ""}`,

            duration: videoDuration,

            fileSize: videoSize,

            moderationStatus: "pending",

          },

        });

        savedVideoRecords.push({ id: videoRecord.id, url: videoUrlForDb });

        console.log(`[internal/products] step-5 video[${vi}] saved OK in ${Date.now() - vidStart}ms`);

      } catch (err) {

        const vidErrDetail = extractErrorMessage(err);

        console.error(`[internal/products] step-5 video[${vi}] FAILED in ${Date.now() - vidStart}ms: error=${vidErrDetail}`);

      }

    }



    // 异步触发视频内容审核（fire-and-forget，不阻塞发布流程）

    if (savedVideoRecords.length > 0) {

      fireVideoModeration(savedVideoRecords);

      console.log(`[internal/products] step-5 fired async moderation for ${savedVideoRecords.length} videos`);

    }



    // ── Step 7: autoAI 处理（小程序提交时触发）──

    let aiEnhanced = false;

    let aiValuationResult: any = null;



    if (autoAI) {

      const t7 = Date.now();

      console.log(`[internal/products] step-7 autoAI started for product ${product.id}`);



      try {

        // 7a. 获取已上传图片的完整URL

        const productImages = await prisma.productImage.findMany({

          where: { productId: product.id },

          orderBy: { sortOrder: "asc" },

        });

        const imageFullUrls = productImages.map(img => getDetailImageUrl(img.url));



        // 7b. AI 识别（统一豆包：火山方舟 ARK 视觉能力，OpenAI 兼容）
        // 豆包服务端下载公开图片 URL 会超时，故先在本服务把图片下载为 base64 data URI 再传入。

        let recognizedData: Record<string, any> | null = null;

        if (imageFullUrls.length > 0) {

          try {

            const model = getArkVisionModelId();

            const imageContents = (
              await Promise.all(
                imageFullUrls.slice(0, 8).map(async (url: string) => {
                  try {
                    // 同一批 images[] 的第二出口（入库后回读做 AI 识别）：必须同样过守卫，
                    // 否则第一处堵住、这里仍会把内网响应解成 base64 送进模型。
                    // 送模型口径 12MB（大图对识别无增益，只是白烧 token）。
                    const { buffer: imgBuf, contentType: imgType } = await downloadGuardedImage(url, {
                      maxBytes: MAX_IMAGE_BYTES,
                    });
                    const mime = imgType.split(";")[0];
                    const b64 = imgBuf.toString("base64");
                    return { type: "image_url" as const, image_url: { url: `data:${mime};base64,${b64}` } };
                  } catch {
                    return null;
                  }
                })
              )
            ).filter(
              (x): x is { type: "image_url"; image_url: { url: string } } => x !== null
            );

            const content: Array<Record<string, unknown>> = [
              {
                type: "text",
                text: `你是一位资深二手农业机械专家。请根据提供的农机图片，识别以下信息，以 JSON 格式返回。
返回字段：brand, modelName, year, enginePower, engineType, driveSystem, overallLength, overallWidth, overallHeight, netWeight, mainConfig, workingHours, condition, confidence
无法识别的字段设为 null。只返回 JSON。`,
              },
              ...imageContents,
            ];

            const result = await chatCompletionDoubao({ model, maxTokens: 800, messages: [{ role: "user", content }] });
            const aiText = result.text || "";

            try {

              recognizedData = JSON.parse(aiText);

            } catch {

              const jsonMatch = aiText.match(/\{[\s\S]*\}/);

              if (jsonMatch) recognizedData = JSON.parse(jsonMatch[0]);

            }

            console.log(`[internal/products] step-7a AI recognized: brand=${recognizedData?.brand}, model=${recognizedData?.modelName}, confidence=${recognizedData?.confidence}`);

          } catch (aiErr) {

            console.warn(`[internal/products] step-7a AI recognition failed (non-blocking):`, aiErr instanceof Error ? aiErr.message : String(aiErr));

          }

        }

        // 7c. 字段合并（用户优先 > AI补空）

        if (recognizedData) {

          const mergedUpdate: Record<string, any> = {};



          // AI补空：用户没填的字段用AI识别结果填充

          if (!modelName && recognizedData.modelName) mergedUpdate.modelName = recognizedData.modelName;

          if (!year && recognizedData.year) mergedUpdate.year = Number(recognizedData.year);

          if (!finalEnginePower && recognizedData.enginePower) mergedUpdate.enginePower = Number(recognizedData.enginePower);

          if (!finalEngineType && recognizedData.engineType) mergedUpdate.engineType = recognizedData.engineType;

          if (!finalDriveSystem && recognizedData.driveSystem) mergedUpdate.driveSystem = recognizedData.driveSystem;

          if (!overallLength && recognizedData.overallLength) mergedUpdate.overallLength = Number(recognizedData.overallLength);

          if (!overallWidth && recognizedData.overallWidth) mergedUpdate.overallWidth = Number(recognizedData.overallWidth);

          if (!overallHeight && recognizedData.overallHeight) mergedUpdate.overallHeight = Number(recognizedData.overallHeight);

          if (!finalNetWeight && recognizedData.netWeight) mergedUpdate.netWeight = Number(recognizedData.netWeight);

          if (!finalMainConfig && recognizedData.mainConfig) mergedUpdate.mainConfig = recognizedData.mainConfig;
          // 2026-10-17 补：把 AI 识别出的工时写入 DB。
          // 背景：AI prompt（第 1404 行返回字段清单）早已索要 workingHours，recognize 路由也返回该字段，
          // 但本「用户优先 > AI补空」合并名单此前遗漏了它 —— 识别结果被丢弃，DB 恒为 null。
          // 工时是工时折旧曲线的唯一真实输入（CATEGORY_ANNUAL_HOURS / HOURS_DEPRECIATION_CURVE）；
          // 缺这一行时，缺工时的机器只能走 age × A 合成工时，单机误差可达 ±40%。
          // 用户已填工时则不被 AI 覆盖（P0-4）：否则 1200h 会被识别成 800h 冲掉
          if (finalWorkingHours == null && recognizedData.workingHours != null && Number(recognizedData.workingHours) > 0) {
            mergedUpdate.workingHours = Math.round(Number(recognizedData.workingHours));
          }

          if (condition === "good" && recognizedData.condition && recognizedData.condition !== "good") {

            mergedUpdate.condition = recognizedData.condition;

          }



          // 标记为AI增强

          if (Object.keys(mergedUpdate).length > 0) {

            mergedUpdate.aiGenerated = true;

            await prisma.product.update({

              where: { id: product.id },

              data: mergedUpdate,

            });

            aiEnhanced = true;

            console.log(`[internal/products] step-7c product updated with AI fields:`, Object.keys(mergedUpdate).join(", "));

          }

        }



        // 7d. AI 估值（图片分析 + 视频分析 + 估值公式）

        try {

          // 获取更新后的产品数据

          const updatedProduct = await prisma.product.findUnique({

            where: { id: product.id },

            include: {

              brand: true,

              category: true,

              images: { orderBy: { sortOrder: "asc" } },

              videos: { orderBy: { sortOrder: "asc" } },

            },

          });



          if (updatedProduct) {

            // T04: 解析主数据 code（纯只读，失败降级为 null → 名匹配兜底）

            const resolvedCodes = await resolveValuationCodes(

              {

                brandId: updatedProduct.brandId,

                categoryId: updatedProduct.categoryId,

                brandName: updatedProduct.brand?.nameZh || null,

                categoryName: updatedProduct.category?.nameZh || null,

                modelName: updatedProduct.modelName,

              },

              prisma

            );



            // 图片分析

            let visualResult = undefined;

            if (imageFullUrls.length > 0) {

              try {

                visualResult = await analyzeProductImages(imageFullUrls);

              } catch (e) {

                console.warn("[internal/products] step-7d image analysis failed:", e);

              }

            }



            // 视频分析

            let videoAnalysisResult = undefined;

            if (updatedProduct.videos.length > 0) {

              try {

                const videoFullUrl = getVideoUrl(updatedProduct.videos[0].url);

                if (videoFullUrl) {

                  videoAnalysisResult = await analyzeVideo(videoFullUrl);

                  console.log("[internal/products] step-7d video analysis done:", videoAnalysisResult.engineSoundStatus);

                }

              } catch (e) {

                console.warn("[internal/products] step-7d video analysis failed:", e);

              }

            }

            // ── 用量归集收口 ──
            // analyzeProductImages / analyzeVideo 内部已 recordUsage（image-analyzer / video-analyzer），
            // 但本文件是内部批量管线：暂不计费（系统账号批量处理，计费口径待定），
            // 然而**必须 drain** —— usage-collector 是模块级数组，不 drain 会一直堆着，
            // 被下一个任意请求（recognize / valuation）drain 走 → 跨请求串账，
            // A 用户的 token 消耗算到 B 用户头上。参照 valuation/route.ts L985-988 GET 分支写法。
            drainUsage();



            // 估值计算

            const valuationInput: ValuationInput = {

              brand: updatedProduct.brand?.nameZh || brandName || "",

              modelName: updatedProduct.modelName,

              category: updatedProduct.category?.nameZh || categoryName || "",

              year: updatedProduct.year,

              workingHours: updatedProduct.workingHours ?? undefined,

              condition: updatedProduct.condition,

              priceCny: updatedProduct.priceCny,

              location: updatedProduct.location,

              // T04: 主数据 code 维度（解析层结果，公式内优先使用）

              brandCode: resolvedCodes.brandCode ?? undefined,

              categoryCode: resolvedCodes.categoryCode ?? undefined,

              modelCode: resolvedCodes.modelCode ?? undefined,

              brandValueFactor: resolvedCodes.brandValueFactor,

              modelPopularityFactor: resolvedCodes.modelPopularityFactor,

              imageUrls: imageFullUrls,

              videoUrls: updatedProduct.videos.map(v => v.url),

              enginePower: updatedProduct.enginePower ?? undefined,

              driveSystem: updatedProduct.driveSystem ?? undefined,

              mainConfig: updatedProduct.mainConfig ?? undefined,

              netWeight: updatedProduct.netWeight ?? undefined,

              overallLength: updatedProduct.overallLength ?? undefined,

              overallWidth: updatedProduct.overallWidth ?? undefined,

              overallHeight: updatedProduct.overallHeight ?? undefined,

            };



            if (videoAnalysisResult) {

              valuationInput.videoAnalysisResult = videoAnalysisResult;

            }



            const valuationResult = await calculateValuationV4(valuationInput, visualResult);

            aiValuationResult = {

              estimatedValue: valuationResult.estimatedValue,

              priceRange: valuationResult.priceRange,

              confidenceScore: valuationResult.confidenceScore,

              analysis: valuationResult.analysis,

              videoFactor: valuationResult.videoFactor,

            };



            // 保存估值记录

            await prisma.valuation.create({

              data: {

                productId: product.id,

                brandId: updatedProduct.brandId,

                modelName: updatedProduct.modelName,

                year: updatedProduct.year,

                workingHours: updatedProduct.workingHours,

                estimatedPriceCny: valuationResult.estimatedValue,

                estimatedPriceUsd: cnyToUsd(valuationResult.estimatedValue, await getUsdPerCny()),

                confidenceScore: valuationResult.confidenceScore,

                factors: JSON.stringify({

                  brandFactor: valuationResult.brandFactor,

                  yearFactor: valuationResult.yearFactor,

                  hoursFactor: valuationResult.hoursFactor,

                  conditionFactor: valuationResult.conditionFactor,

                  marketFactor: valuationResult.marketFactor,

                  specFactor: valuationResult.specFactor,

                  videoFactor: valuationResult.videoFactor,

                  details: valuationResult.details,

                }),

              },

            });



            console.log(`[internal/products] step-7d valuation done: ¥${Math.round(valuationResult.estimatedValue / 10000)}万 (confidence: ${valuationResult.confidenceScore})`);

          }

        } catch (valErr) {

          console.warn("[internal/products] step-7d valuation failed (non-blocking):", valErr instanceof Error ? valErr.message : String(valErr));

        }



        console.log(`[internal/products] step-7 autoAI completed in ${Date.now() - t7}ms, aiEnhanced=${aiEnhanced}`);

      } catch (autoAiErr) {

        // autoAI 整体失败不阻塞产品发布

        console.warn(`[internal/products] step-7 autoAI failed (non-blocking):`, autoAiErr instanceof Error ? autoAiErr.message : String(autoAiErr));

      }

    }



    // ── 自动 8 语翻译（非阻塞，失败降级，绝不影响发布）──
    try {
      await translateProductOnPublish(product.id);
    } catch (trErr) {
      console.error("[internal/products] 自动翻译异常（非阻塞）:", trErr instanceof Error ? trErr.message : String(trErr));
    }

    // ── 完成 ──

    const totalMs = Date.now() - requestStartTime;

    console.log(

      `[internal/products] ✅ TOTAL ${totalMs}ms | productId=${product.id}, ` +

      `status=${productStatus}, images=${uploadedImageCount}/${images.length}, ` +

      `video=${!!video}, openid=${openid || "unknown"}, isImported=${isImported}`

    );



    return NextResponse.json({

      success: true,

      data: {

        id: product.id,

        sellerId: finalSellerId,

        creditsRemaining: user.credits,

        status: productStatus,

        isImported,

        aiEnhanced,

        aiValuation: aiValuationResult,

        message: isImported

          ? "国际品牌，产品将同步至网站展示（可能有延迟）"

          : "国产品牌，仅在小程序展示",

      },

    });

  } catch (error) {

    // 🐛 Bug 3 修复（R4）+ 异常回滚

    const errorMessage = extractErrorMessage(error);

    console.error(`[internal/products] ❌ error after ${Date.now() - requestStartTime}ms:`, errorMessage);



    // 尝试回滚已创建但未完成的产品（防止孤儿产品）

    if (createdProductId) {

      try {

        await prisma.product.delete({ where: { id: createdProductId } });

        console.log(`[internal/products] rolled back orphan product ${createdProductId}`);

      } catch (rollbackErr) {

        console.error(`[internal/products] failed to rollback product ${createdProductId}:`, rollbackErr);

      }

    }



    return NextResponse.json(

      { success: false, error: errorMessage, code: "INTERNAL_ERROR" },

      { status: 500 }

    );

  }

}

