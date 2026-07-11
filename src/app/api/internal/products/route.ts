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
import { prisma } from "@/lib/db";
import { uploadBufferToOSS } from "@/lib/oss-upload";
import { hashPassword } from "@/lib/auth";
import { matchPortByLocation } from "@/lib/port-matcher";
import { calculateValuationV4, type ValuationInput } from "@/lib/valuation/formulas";
import { analyzeProductImages } from "@/lib/valuation/image-analyzer";
import { analyzeVideo, calculateVideoFactor } from "@/lib/valuation/video-analyzer";
import { getDetailImageUrl, getVideoUrl } from "@/lib/image-url";
import axios from "axios";
import crypto from "crypto";
import { checkContent, isBlocked } from "@/lib/wechat-sec-check";

// Vercel Serverless Function 超时延长至300秒（Pro计划上限）
// 小程序可能同时上传多张大图+视频，60秒不够用
export const maxDuration = 300;

const PUBLISH_COST = 1;

// 小程序通过 oss-token 直传到该 OSS bucket，URL 形如
// https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/uploads/products/xxx.jpg
// 已经是最终地址，后端无需再下载重传
const OSS_HOST = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";

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

function requireApiKey(req: NextRequest) {
  const key = getApiKey(req);
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    throw new Error("INTERNAL_API_KEY not configured on server");
  }
  if (!key || key !== expected) {
    return null;
  }
  return true;
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
 * 从 HTTPS URL 下载文件到 Buffer（仅支持 URL，不支持 Data URI）
 */
async function downloadBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { buffer: Buffer.from(arrayBuffer), contentType };
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
  // HTTPS URL 回退到 downloadBuffer
  return await downloadBuffer(src);
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

  if (!requireApiKey(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
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
      // 地图选点坐标（wx.chooseLocation），用于物流与地图展示
      latitude,
      longitude,
      images = [],
      video,
      // autoAI: 小程序提交时设为true，触发服务端自动AI识别+估值
      autoAI = false,
      photoLabels,
    } = body;

    // 港口自动匹配：如果未指定港口，根据位置自动匹配
    const finalTradePort = tradePort || (location ? matchPortByLocation(location) : '青岛');
    const finalEnginePower = enginePower ?? descPower;
    const finalEngineType = engineType ?? null;
    const finalDriveSystem = driveSystem ?? descDrive ?? null;
    const finalMainConfig = mainConfig ?? descHeader ?? null;
    const finalNetWeight = netWeight ?? null;

    // ── 校验 ──
    if (!modelName || !year || !priceCny || !location) {
      return NextResponse.json(
        { success: false, error: "请填写完整信息（型号、年份、价格、位置为必填）", code: "VALIDATION_ERROR" },
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
    const finalSellerId = sellerId || (await getOrCreateDefaultSeller());

    // ── 检查积分 ──
    const user = await prisma.user.findUnique({ where: { id: finalSellerId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "卖家不存在", code: "SELLER_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (user.credits < PUBLISH_COST) {
      return NextResponse.json(
        { success: false, error: "积分不足", credits: user.credits, required: PUBLISH_COST, code: "INSUFFICIENT_CREDITS" },
        { status: 403 }
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
        year: Number(year),
        workingHours: null,
        condition,
        priceCny: Number(priceCny),
        priceUsd: Math.round(Number(priceCny) / 7.25),
        location: location || "",
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

        if (src.startsWith(OSS_HOST)) {
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

    // ── Step 5: 上传视频（如有）──
    // OSS 直传模式：小程序已通过 wx.uploadFile 把视频直传到 OSS，
    // 此时 video 字段为完整 HTTPS URL，应直接复用入库，避免在 Vercel
    // Serverless 内再次下载大文件导致超时/内存溢出（视频静默丢失根因）。
    // 同时保留对 base64 Data URI 旧模式的兼容。
    if (video) {
      const vidStart = Date.now();
      try {
        let videoUrlForDb: string;

        if (video.startsWith("https://") || video.startsWith("http://")) {
          // ✅ OSS 直传新模式：video 已经是完整的 HTTP(S) URL
          // 直接使用该 URL 创建 ProductVideo 记录，无需下载再上传
          videoUrlForDb = video; // 保持完整 OSS URL
          console.log(`[internal/products] step-5 video is direct OSS URL, reusing: ${videoUrlForDb}`);
        } else {
          // 兼容旧模式：base64 Data URI 格式
          const { buffer, contentType } = await getDataUriBuffer(video);
          const ext = guessExtFromMime(contentType);
          const key = `${folder}/video_${Date.now()}.${ext}`;
          const uploadedUrl = await uploadBufferToOSS(key, buffer, contentType);
          videoUrlForDb = uploadedUrl; // 直接存储完整 OSS URL
        }

        await prisma.productVideo.create({
          data: {
            productId: product.id,
            url: videoUrlForDb,
            sortOrder: 0,
            title: `${modelName} 运转视频`,
          },
        });
        console.log(`[internal/products] step-5 video saved OK in ${Date.now() - vidStart}ms, url=${videoUrlForDb}`);
      } catch (err) {
        // 视频失败不阻塞产品发布（非核心功能），仅记录日志
        const vidErrDetail = extractErrorMessage(err);
        console.error(`[internal/products] step-5 video FAILED in ${Date.now() - vidStart}ms: src=${String(video).substring(0, 100)}, error=${vidErrDetail}`, err);
      }
    }

    // ── Step 6: 扣除积分 ──
    const t6 = Date.now();
    await prisma.user.update({
      where: { id: finalSellerId },
      data: { credits: { decrement: PUBLISH_COST } },
    });
    console.log(`[internal/products] step-6 credits deducted in ${Date.now() - t6}ms`);

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

        // 7b. AI 识别（调用 GPT-4o-mini 多模态识别）
        let recognizedData: Record<string, any> | null = null;
        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        if (OPENROUTER_API_KEY && imageFullUrls.length > 0) {
          try {
            const recognizeResponse = await axios.post(
              "https://openrouter.ai/api/v1/chat/completions",
              {
                model: "openai/gpt-4o-mini",
                messages: [{
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `你是一位资深二手农业机械专家。请根据提供的农机图片，识别以下信息，以 JSON 格式返回。
返回字段：brand, modelName, year, enginePower, engineType, driveSystem, overallLength, overallWidth, overallHeight, netWeight, mainConfig, workingHours, condition, confidence
无法识别的字段设为 null。只返回 JSON。`,
                    },
                    ...imageFullUrls.slice(0, 8).map(url => ({
                      type: "image_url" as const,
                      image_url: { url },
                    })),
                  ],
                }],
                response_format: { type: "json_object" },
                max_tokens: 800,
              },
              {
                headers: {
                  Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://usedfarmmach.com",
                  "X-Title": "Internal Product AutoAI",
                },
                timeout: 45000,
              }
            );

            const aiText = (recognizeResponse.data as any).choices?.[0]?.message?.content || "";
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
                estimatedPriceUsd: Math.round(valuationResult.estimatedValue / 7.25),
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
        creditsRemaining: user.credits - PUBLISH_COST,
        status: productStatus,
        isImported,
        aiEnhanced,
        aiValuation: aiValuationResult,
        message: isImported
          ? "国际品牌，手机+网站同时展示"
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
