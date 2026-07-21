/**
 * 卖家产品管理 API
 * - GET: 产品列表
 * - POST: 发布新产品（支持自定义品牌/品类 + 图片/视频上传）
 *
 * 审核流程：重复检测 → 上传图片 → 微信内容安全 → AI农机图片审核 → 创建产品
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { uploadFileToOSS } from "@/lib/oss-upload";
import { buildLocationText } from "@/lib/location-parser";
import { checkContent, isBlocked } from "@/lib/wechat-sec-check";
import { checkDuplicateProduct, fireVideoModeration, MAX_VIDEOS_PER_PRODUCT, MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_FILE_SIZE_BYTES } from "@/lib/content-moderation";

// 图片上传 + AI审核需要较长时间
export const maxDuration = 120;

const PUBLISH_COST = 1;

function getSeller(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload;
}

// GET - 卖家产品列表
export async function GET(request: NextRequest) {
  const seller = getSeller(request);
  if (!seller) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { sellerId: seller.userId },
    include: {
      brand: { select: { nameZh: true, nameEn: true } },
      category: { select: { nameZh: true, nameEn: true } },
      images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
      _count: { select: { inquiries: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: products });
}

// POST - 发布新产品（multipart/form-data）
export async function POST(request: NextRequest) {
  const seller = getSeller(request);
  if (!seller) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });

  try {
    const formData = await request.formData();

    // === 解析文本字段 ===
    const brandId = formData.get("brandId")?.toString();
    const brandName = formData.get("brandName")?.toString();
    const categoryId = formData.get("categoryId")?.toString();
    const categoryName = formData.get("categoryName")?.toString();
    const modelName = formData.get("modelName")?.toString();
    const yearStr = formData.get("year")?.toString();
    const workingHoursStr = formData.get("workingHours")?.toString();
    const condition = formData.get("condition")?.toString() || "good";
    const priceCnyStr = formData.get("priceCny")?.toString();
    const location = formData.get("location")?.toString();
    const country = formData.get("country")?.toString() || null;
    const province = formData.get("province")?.toString() || null;
    const city = formData.get("city")?.toString() || null;
    const isChineseBrandStr = formData.get("isChineseBrand")?.toString();
    const isChineseBrand = isChineseBrandStr === "true";

    // 结构化描述
    const descPower = formData.get("descPower")?.toString();
    const descDrive = formData.get("descDrive")?.toString();
    const descHeader = formData.get("descHeader")?.toString();
    const descEngineHours = formData.get("descEngineHours")?.toString();
    const descRollerHours = formData.get("descRollerHours")?.toString();
    const descOther = formData.get("descOther")?.toString();

    // 新规格字段
    const enginePower = formData.get("enginePower")?.toString();
    const engineType = formData.get("engineType")?.toString();
    const driveSystem = formData.get("driveSystem")?.toString();
    const overallLength = formData.get("overallLength")?.toString();
    const overallWidth = formData.get("overallWidth")?.toString();
    const overallHeight = formData.get("overallHeight")?.toString();
    const netWeight = formData.get("netWeight")?.toString();
    const mainConfig = formData.get("mainConfig")?.toString();
    const priceMode = formData.get("priceMode")?.toString();
    const tradeTerm = formData.get("tradeTerm")?.toString();
    const tradePort = formData.get("tradePort")?.toString();

    // 自动生成 location 显示文本（如果结构化字段已提供但 location 为空）
    let finalLocation = location;
    if ((!finalLocation || finalLocation.trim() === "") && (country || province || city)) {
      finalLocation = buildLocationText(country, province, city);
    }

    // 校验
    if (!modelName || !yearStr || !priceCnyStr || !finalLocation) {
      return NextResponse.json({ success: false, error: "请填写完整信息（型号、年份、价格、位置为必填）" }, { status: 400 });
    }
    if (!brandId && !brandName) return NextResponse.json({ success: false, error: "请选择或输入品牌" }, { status: 400 });
    if (!categoryId && !categoryName) return NextResponse.json({ success: false, error: "请选择或输入品类" }, { status: 400 });

    // === 解析品牌 ===
    let finalBrandId = brandId;
    if (!finalBrandId && brandName) {
      const existing = await prisma.brand.findFirst({ where: { nameZh: brandName } });
      if (existing) {
        finalBrandId = existing.id;
      } else {
        const created = await prisma.brand.create({ data: { nameZh: brandName, nameEn: brandName, originCountry: isChineseBrand ? "中国" : "未知", isChineseBrand } });
        finalBrandId = created.id;
      }
    }

    // === 解析品类 ===
    let finalCategoryId = categoryId;
    if (!finalCategoryId && categoryName) {
      const existing = await prisma.category.findFirst({ where: { nameZh: categoryName } });
      if (existing) {
        finalCategoryId = existing.id;
      } else {
        const created = await prisma.category.create({ data: { nameZh: categoryName, nameEn: categoryName } });
        finalCategoryId = created.id;
      }
    }

    // === 组装描述 ===
    const descParts = [];
    if (descPower) descParts.push(`马力：${descPower}`);
    if (descDrive) descParts.push(`驱动：${descDrive}`);
    if (descHeader) descParts.push(`割台：${descHeader}`);
    if (descEngineHours) descParts.push(`发动机小时：${descEngineHours}`);
    if (descRollerHours) descParts.push(`轧辊小时：${descRollerHours}`);
    if (descOther) descParts.push(descOther);
    const descriptionZh = descParts.join("\n");

    // === 检查积分 ===
    const user = await prisma.user.findUnique({ where: { id: seller.userId } });
    if (!user) return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
    if (user.credits < PUBLISH_COST) {
      return NextResponse.json({ success: false, error: `积分不足，当前 ${user.credits} 积分，发布需 ${PUBLISH_COST} 积分`, credits: user.credits, required: PUBLISH_COST }, { status: 403 });
    }

    // === 重复产品检测 ===
    if (finalBrandId) {
      const dupCheck = await checkDuplicateProduct(
        seller.userId,
        finalBrandId,
        modelName,
        Number(yearStr)
      );
      if (dupCheck.isDuplicate) {
        return NextResponse.json(
          { success: false, error: dupCheck.message || "检测到重复产品，请勿重复发布", code: "DUPLICATE_PRODUCT" },
          { status: 409 }
        );
      }
    }

    // === 图片上传（兼容前端直传 OSS 和旧版 FormData 两种模式）===
    const directImageUrls = formData.get("imageUrls")?.toString();
    let uploadedImageUrls: string[];

    if (directImageUrls) {
      // 新方案：前端已直传 OSS，只传 URL
      try {
        uploadedImageUrls = JSON.parse(directImageUrls);
      } catch {
        return NextResponse.json({ success: false, error: "imageUrls 格式错误" }, { status: 400 });
      }
    } else {
      // 旧方案：从 FormData 获取文件并上传到 OSS
      const imageFiles = formData.getAll("images") as File[];
      const validImages = imageFiles.filter((f) => f.size > 0);
      const tempFolder = `uploads/tmp/${Date.now()}_${seller.userId}`;
      uploadedImageUrls = [];
      for (let i = 0; i < validImages.length; i++) {
        const { url } = await uploadFileToOSS(validImages[i], tempFolder);
        uploadedImageUrls.push(url);
      }
    }

    // === 内容安全检测（微信 sec-check）===
    const secTextParts = [brandName, categoryName, modelName, descOther, finalLocation, descPower, descDrive, descHeader]
      .filter(Boolean).join("\n");
    try {
      const { text: textResult, images: imageResult } = await checkContent(secTextParts, uploadedImageUrls);
      if (isBlocked(textResult.suggest)) {
        return NextResponse.json(
          { success: false, error: "发布内容含违规信息，请修改后重试", code: "CONTENT_SECURITY_VIOLATION" },
          { status: 400 }
        );
      }
      if (!imageResult.allPass) {
        return NextResponse.json(
          { success: false, error: "图片含违规信息，请修改后重试", code: "CONTENT_SECURITY_VIOLATION" },
          { status: 400 }
        );
      }
    } catch (secErr) {
      console.error("[seller/products] 内容安全检测异常（非阻塞）:", secErr instanceof Error ? secErr.message : String(secErr));
    }

    // === 创建产品 ===
    const product = await prisma.product.create({
      data: {
        sellerId: seller.userId,
        brandId: finalBrandId!,
        categoryId: finalCategoryId!,
        modelName,
        year: Number(yearStr),
        workingHours: workingHoursStr ? Number(workingHoursStr) : null,
        condition,
        priceCny: Number(priceCnyStr),
        priceUsd: Math.round(Number(priceCnyStr) / 7.25),
        location: finalLocation || "",
        country,
        province,
        city,
        descriptionZh: descriptionZh || null,
        status: "active",
        enginePower: enginePower ? Number(enginePower) : null,
        engineType: engineType || null,
        driveSystem: driveSystem || null,
        overallLength: overallLength ? Number(overallLength) : null,
        overallWidth: overallWidth ? Number(overallWidth) : null,
        overallHeight: overallHeight ? Number(overallHeight) : null,
        netWeight: netWeight ? Number(netWeight) : null,
        mainConfig: mainConfig || null,
        priceMode: priceMode || "por",
        tradeTerm: tradeTerm || "FOB",
        tradePort: tradePort || null,
      },
    });

    // === 关联已上传的图片到产品 ===
    for (let i = 0; i < uploadedImageUrls.length; i++) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: uploadedImageUrls[i],
          sortOrder: i === 0 ? -1 : i,
          isPrimary: i === 0,
        },
      });
    }

    // === 上传视频（兼容前端直传 OSS 和旧版 FormData 两种模式）===
    const directVideoUrls = formData.get("videoUrls")?.toString();
    let savedVideoRecords: { id: string; url: string }[] = [];

    if (directVideoUrls) {
      // 新方案：前端已直传 OSS，只传 URL
      let videoUrls: string[];
      try {
        videoUrls = JSON.parse(directVideoUrls);
      } catch {
        return NextResponse.json({ success: false, error: "videoUrls 格式错误" }, { status: 400 });
      }

      if (videoUrls.length > MAX_VIDEOS_PER_PRODUCT) {
        return NextResponse.json(
          { success: false, error: `最多上传 ${MAX_VIDEOS_PER_PRODUCT} 个视频`, code: "TOO_MANY_VIDEOS" },
          { status: 400 }
        );
      }

      // 读取前端传来的视频时长
      const videoDurationsStr = formData.get("videoDurations")?.toString();
      let durations: number[] = [];
      if (videoDurationsStr) {
        try { durations = JSON.parse(videoDurationsStr); } catch { /* ignore */ }
      }

      for (let vi = 0; vi < videoUrls.length; vi++) {
        const videoUrl = videoUrls[vi];
        const videoDuration = durations[vi] ?? null;
        if (videoDuration != null && videoDuration > MAX_VIDEO_DURATION_SECONDS) {
          return NextResponse.json(
            { success: false, error: `视频时长不能超过 ${MAX_VIDEO_DURATION_SECONDS} 秒`, code: "VIDEO_TOO_LONG" },
            { status: 400 }
          );
        }

        const videoRecord = await prisma.productVideo.create({
          data: {
            productId: product.id,
            url: videoUrl,
            sortOrder: vi,
            title: `${modelName} 视频${videoUrls.length > 1 ? vi + 1 : ""}`,
            duration: videoDuration,
            fileSize: 0,
            moderationStatus: "pending",
          },
        });
        savedVideoRecords.push({ id: videoRecord.id, url: videoUrl });
      }
    } else {
      // 旧方案：从 FormData 获取文件并上传到 OSS
      const videoFiles = formData.getAll("videos") as File[];
      const oldVideoFile = formData.get("video") as File | null;
      const allVideoFiles = [
        ...videoFiles.filter((f) => f.size > 0),
        ...(oldVideoFile && oldVideoFile.size > 0 && videoFiles.length === 0 ? [oldVideoFile] : []),
      ];

      if (allVideoFiles.length > MAX_VIDEOS_PER_PRODUCT) {
        return NextResponse.json(
          { success: false, error: `最多上传 ${MAX_VIDEOS_PER_PRODUCT} 个视频`, code: "TOO_MANY_VIDEOS" },
          { status: 400 }
        );
      }

      for (let vi = 0; vi < allVideoFiles.length; vi++) {
        const vf = allVideoFiles[vi];
        if (vf.size > MAX_VIDEO_FILE_SIZE_BYTES) {
          return NextResponse.json(
            { success: false, error: `视频文件不能超过 ${Math.round(MAX_VIDEO_FILE_SIZE_BYTES / 1024 / 1024)}MB（${vf.name}）`, code: "VIDEO_TOO_LARGE" },
            { status: 400 }
          );
        }

        const videoFolder = `uploads/products/${product.id}`;
        const { url: videoUrl } = await uploadFileToOSS(vf, videoFolder);

        const videoDurationsStr = formData.get("videoDurations")?.toString();
        let videoDuration: number | null = null;
        if (videoDurationsStr) {
          try {
            const durations = JSON.parse(videoDurationsStr) as number[];
            if (durations[vi] != null) {
              videoDuration = Number(durations[vi]);
              if (videoDuration > MAX_VIDEO_DURATION_SECONDS) {
                return NextResponse.json(
                  { success: false, error: `视频时长不能超过 ${MAX_VIDEO_DURATION_SECONDS} 秒（${vf.name}）`, code: "VIDEO_TOO_LONG" },
                  { status: 400 }
                );
              }
            }
          } catch { /* ignore */ }
        }

        const videoRecord = await prisma.productVideo.create({
          data: {
            productId: product.id,
            url: videoUrl,
            sortOrder: vi,
            title: `${modelName} 视频${allVideoFiles.length > 1 ? vi + 1 : ""}`,
            duration: videoDuration,
            fileSize: vf.size,
            moderationStatus: "pending",
          },
        });
        savedVideoRecords.push({ id: videoRecord.id, url: videoUrl });
      }
    }

    // 异步触发视频内容审核（fire-and-forget）
    if (savedVideoRecords.length > 0) {
      fireVideoModeration(savedVideoRecords);
    }

    // === 扣除积分 ===
    await prisma.user.update({ where: { id: seller.userId }, data: { credits: { decrement: PUBLISH_COST } } });

    return NextResponse.json({
      success: true,
      data: product,
      creditsRemaining: user.credits - PUBLISH_COST,
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json({ success: false, error: "发布失败，请稍后重试" }, { status: 500 });
  }
}
