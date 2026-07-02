/**
 * 卖家产品管理 API
 * - GET: 产品列表
 * - POST: 发布新产品（支持自定义品牌/品类 + 图片/视频上传）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { uploadFileToOSS } from "@/lib/oss-upload";

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
      images: { where: { isPrimary: true }, take: 1 },
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

    // 校验
    if (!modelName || !yearStr || !priceCnyStr || !location) {
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
        const created = await prisma.brand.create({ data: { nameZh: brandName, nameEn: brandName, originCountry: "未知" } });
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
        location: location || "",
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

    // === 上传产品图片（多张）===
    const imageFiles = formData.getAll("images") as File[];
    const validImages = imageFiles.filter((f) => f.size > 0);

    if (validImages.length > 0) {
      const folder = `uploads/products/${product.id}`;
      for (let i = 0; i < validImages.length; i++) {
        const { key } = await uploadFileToOSS(validImages[i], folder);
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: `/${key}`,
            sortOrder: i === 0 ? -1 : i,
            isPrimary: i === 0,
          },
        });
      }
    }

    // === 上传视频 ===
    const videoFile = formData.get("video") as File | null;
    if (videoFile && videoFile.size > 0) {
      const folder = `uploads/products/${product.id}`;
      const { url: videoUrl, key: videoKey } = await uploadFileToOSS(videoFile, folder);
      await prisma.productVideo.create({
        data: { productId: product.id, url: `/${videoKey}`, sortOrder: 0, title: `${modelName} 运转视频` },
      });
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
