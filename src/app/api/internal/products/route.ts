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
import crypto from "crypto";

// Vercel Serverless Function 超时延长至60秒（默认10秒不够用）
export const maxDuration = 60;

const PUBLISH_COST = 1;

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
 */
async function getDataUriBuffer(src: string): Promise<{ buffer: Buffer; contentType: string }> {
  // 支持 base64 Data URI（新版小程序直传）— 兼容 image 和 video
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([a-zA-Z/+-]+);base64,(.+)$/);
    if (!match) throw new Error(`Invalid data URI format: ${src.substring(0, 120)}`);
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
  const t0 = Date.now();

  if (!requireApiKey(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const t1 = Date.now();
    console.log(`[internal/products] body parsed in ${t1 - t0}ms`);
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
    const [brandRecord, finalCategoryId] = await Promise.all([
      resolveBrand(brandId, brandName),
      resolveCategory(categoryId, categoryName),
    ]);
    const finalBrandId = brandRecord.id;
    const isImported = brandRecord.isImported || isInternationalBrand(brandName || brandRecord.nameZh);

    // 品牌是国际品牌 → 自动通过（status: active）；国产 → 待审核（status: draft）
    const productStatus = isImported ? "active" : "draft";

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
        status: productStatus,
      },
    });
    const t2 = Date.now();
    console.log(`[internal/products] product created (id=${product.id}) in ${t2 - t1}ms`);

    const folder = `uploads/products/${product.id}`;

    // 上传图片
    let imagesUploaded = 0;
    for (let i = 0; i < images.length; i++) {
      try {
        const ti0 = Date.now();
        const { buffer, contentType } = await getDataUriBuffer(images[i]);
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
        imagesUploaded++;
        console.log(`[internal/products] image[${i}] uploaded in ${Date.now() - ti0}ms`);
      } catch (err) {
        console.error(`[internal/products] image upload failed: ${images[i].substring(0, 100)}`, err);
      }
    }

    // 所有图片上传失败 → 回滚（删除孤儿产品）
    if (imagesUploaded === 0) {
      await prisma.product.delete({ where: { id: product.id } });
      return NextResponse.json(
        { success: false, error: "所有图片上传失败", code: "ALL_IMAGES_FAILED" },
        { status: 400 }
      );
    }

    // 上传视频
    if (video) {
      try {
        const tv0 = Date.now();
        // ⚠️ 使用 getDataUriBuffer（支持 base64 Data URI + URL），而非 downloadBuffer（仅支持 URL）
        const { buffer, contentType } = await getDataUriBuffer(video);
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
        console.log(`[internal/products] video uploaded in ${Date.now() - tv0}ms`);
      } catch (err) {
        console.error(`[internal/products] video upload failed: ${video.substring(0, 100)}`, err);
      }
    }

    // 扣积分
    await prisma.user.update({
      where: { id: finalSellerId },
      data: { credits: { decrement: PUBLISH_COST } },
    });

    // 记录来源（可选，未来可做 openid 映射）
    console.log(`[internal/products] created from miniapp, openid=${openid || "unknown"}, productId=${product.id}, status=${productStatus}, isImported=${isImported}`);
    console.log(`[internal/products] TOTAL time: ${Date.now() - t0}ms`);

    return NextResponse.json({
      success: true,
      data: {
        id: product.id,
        sellerId: finalSellerId,
        creditsRemaining: user.credits - PUBLISH_COST,
        status: productStatus,
        isImported,
        message: isImported ? "国际品牌，自动上架" : "国产品牌，审核中，通过后将自动上架",
      },
    });
  } catch (error) {
    const errMsg = String(error?.message || error || "Unknown error");
    console.error("[internal/products] error:", errMsg);
    return NextResponse.json(
      { success: false, error: errMsg, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
