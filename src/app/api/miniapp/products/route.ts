import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * 小程序 API — 产品列表 & 创建
 * 认证：Header `x-miniapp-key` 校验
 */

function requireAuth(req: NextRequest) {
  const envKey = process.env.MINIAPP_API_KEY;
  // 环境变量未配置时自动放行（首次部署模式）
  if (!envKey) return true;
  const key = req.headers.get("x-miniapp-key");
  return key === envKey;
}

// 产品图片基础字段
const productInclude = {
  brand: { select: { nameZh: true, nameEn: true } },
  category: { select: { nameZh: true, nameEn: true } },
  images: { select: { url: true, isPrimary: true }, orderBy: { sortOrder: "asc" as const } },
  videos: { select: { url: true }, take: 1 },
};

// ========== GET 产品列表 ==========
export async function GET(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const brandId = searchParams.get("brandId");
  const categoryId = searchParams.get("categoryId");
  const status = searchParams.get("status") || "active";

  const where: Record<string, unknown> = { status };
  if (brandId) where.brandId = brandId;
  if (categoryId) where.categoryId = categoryId;

  try {
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const list = products.map((p) => ({
      id: p.id,
      brand: p.brand?.nameZh || "",
      modelName: p.modelName,
      year: p.year,
      workingHours: p.workingHours,
      condition: p.condition,
      priceCny: p.priceCny,
      location: p.location,
      category: p.category?.nameZh || "",
      cover: p.images.find((i) => i.isPrimary)?.url || p.images[0]?.url || "",
      imageCount: p.images.length,
      hasVideo: p.videos.length > 0,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: { total, page, pageSize, list },
    });
  } catch (error) {
    console.error("miniapp products GET error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// ========== POST 创建产品 ==========
export async function POST(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // 必填字段校验
    const required = ["brandId", "categoryId", "modelName", "priceCny", "location"];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // 创建产品
    const product = await prisma.product.create({
      data: {
        sellerId: body.sellerId || "miniapp_default",
        brandId: body.brandId,
        categoryId: body.categoryId,
        modelName: body.modelName,
        year: body.year || new Date().getFullYear(),
        workingHours: body.workingHours || null,
        condition: body.condition || "good",
        priceCny: body.priceCny,
        priceUsd: body.priceUsd || null,
        location: body.location,
        descriptionZh: body.descriptionZh || "",
        descriptionEn: body.descriptionEn || "",
        descriptionRu: body.descriptionRu || "",
        status: "active",
      },
    });

    // 如果有图片，创建图片记录
    if (body.images && Array.isArray(body.images)) {
      await prisma.productImage.createMany({
        data: body.images.map((url: string, i: number) => ({
          productId: product.id,
          url,
          sortOrder: i,
          isPrimary: i === 0,
        })),
      });
    }

    // 如果有视频，创建视频记录
    if (body.videos && Array.isArray(body.videos)) {
      await prisma.productVideo.createMany({
        data: body.videos.map((url: string, i: number) => ({
          productId: product.id,
          url,
          sortOrder: i,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: { id: product.id, modelName: product.modelName },
      message: "产品发布成功！网站同步展示中。",
    });
  } catch (error) {
    console.error("miniapp products POST error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
