/**
 * 内部 API：接收小程序云函数发布的产品数据
 * - 仅允许持有 INTERNAL_API_KEY 的请求调用
 * - 自动下载小程序云存储图片/视频，上传到 OSS
 * - 创建或复用品牌、品类，创建产品与图片/视频记录
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadBufferToOSS } from "@/lib/oss-upload";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";

const PUBLISH_COST = 1;

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
    if (existing) return existing.id;
  }
  if (brandName) {
    const existing = await prisma.brand.findFirst({ where: { nameZh: brandName } });
    if (existing) return existing.id;
    const created = await prisma.brand.create({
      data: {
        nameZh: brandName,
        nameEn: brandName,
        originCountry: "未知",
        isImported: false,
      },
    });
    return created.id;
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

async function downloadBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

async function getImageBuffer(src: string): Promise<{ buffer: Buffer; contentType: string }> {
  // 支持 base64 Data URI（小程序直传）
  if (src.startsWith("data:")) {
    const match = src.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) throw new Error(`Invalid data URI: ${src.substring(0, 100)}`);
    return {
      buffer: Buffer.from(match[2], "base64"),
      contentType: match[1],
    };
  }
  // 支持 HTTPS URL（云函数转传）
  return await downloadBuffer(src);
}

function guessExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/bmp": "bmp",
  };
  return map[mime] || "jpg";
}

export async function POST(request: NextRequest) {
  if (!requireApiKey(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
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
      descPower,
      descDrive,
      descEngineHours,
      descRollerHours,
      descHeader,
      descOther,
      priceCny,
      location,
      images = [],
      video,
    } = body;

    // 校验
    if (!modelName || !year || !priceCny || !location) {
      return NextResponse.json(
        { success: false, error: "请填写完整信息（型号、年份、价格、位置为必填）" },
        { status: 400 }
      );
    }
    if (!brandId && !brandName) {
      return NextResponse.json({ success: false, error: "请选择或输入品牌" }, { status: 400 });
    }
    if (!categoryId && !categoryName) {
      return NextResponse.json({ success: false, error: "请选择或输入品类" }, { status: 400 });
    }
    if (!images || images.length === 0) {
      return NextResponse.json({ success: false, error: "请至少上传一张图片" }, { status: 400 });
    }

    // 确定卖家
    const finalSellerId = sellerId || (await getOrCreateDefaultSeller());

    // 检查积分
    const user = await prisma.user.findUnique({ where: { id: finalSellerId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "卖家不存在" }, { status: 404 });
    }
    if (user.credits < PUBLISH_COST) {
      return NextResponse.json(
        { success: false, error: "积分不足", credits: user.credits, required: PUBLISH_COST },
        { status: 403 }
      );
    }

    // 解析品牌/品类
    const [finalBrandId, finalCategoryId] = await Promise.all([
      resolveBrand(brandId, brandName),
      resolveCategory(categoryId, categoryName),
    ]);

    // 组装描述（与网站格式一致）
    const descParts = [];
    if (descPower) descParts.push(`马力：${descPower}`);
    if (descDrive) descParts.push(`驱动：${descDrive}`);
    if (descHeader) descParts.push(`割台：${descHeader}`);
    if (descEngineHours) descParts.push(`发动机小时：${descEngineHours}`);
    if (descRollerHours) descParts.push(`轧辊小时：${descRollerHours}`);
    if (descOther) descParts.push(descOther);
    const descriptionZh = descParts.join("\n") || null;

    // 创建产品
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
        status: "active",
      },
    });

    const folder = `uploads/products/${product.id}`;

    // 上传图片
    for (let i = 0; i < images.length; i++) {
      try {
        const { buffer, contentType } = await getImageBuffer(images[i]);
        const ext = guessExtFromMime(contentType);
        const key = `${folder}/image_${i}_${Date.now()}.${ext}`;
        const url = await uploadBufferToOSS(key, buffer, contentType);
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: url.replace("https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com", ""),
            sortOrder: i,
            isPrimary: i === 0,
          },
        });
      } catch (err) {
        console.error(`[internal/products] image upload failed: ${images[i].substring(0, 100)}`, err);
      }
    }

    // 上传视频
    if (video) {
      try {
        const { buffer, contentType } = await downloadBuffer(video);
        const ext = guessExtFromMime(contentType);
        const key = `${folder}/video_${Date.now()}.${ext}`;
        const url = await uploadBufferToOSS(key, buffer, contentType);
        await prisma.productVideo.create({
          data: {
            productId: product.id,
            url: url.replace("https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com", ""),
            sortOrder: 0,
            title: `${modelName} 运转视频`,
          },
        });
      } catch (err) {
        console.error(`[internal/products] video upload failed: ${video}`, err);
      }
    }

    // 扣积分
    await prisma.user.update({
      where: { id: finalSellerId },
      data: { credits: { decrement: PUBLISH_COST } },
    });

    // 记录来源（可选，未来可做 openid 映射）
    console.log(`[internal/products] created from miniapp, openid=${openid || "unknown"}, productId=${product.id}`);

    return NextResponse.json({
      success: true,
      data: {
        id: product.id,
        sellerId: finalSellerId,
        creditsRemaining: user.credits - PUBLISH_COST,
      },
    });
  } catch (error) {
    console.error("[internal/products] error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
