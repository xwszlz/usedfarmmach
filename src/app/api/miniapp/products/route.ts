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

// ========== SCP 智能首图选择器（与 auto-upload-product.js 同分） ==========
const POSITIVE_KW = ["fm","FM","cover","main","主图","全景","全貌","外观","整体","侧面","side","front","rear","back"];
const NEGATIVE_KW = ["铭牌","label","ce ","ce_","cert","证书","标贴","内饰","内景","仪表","方向盘","dashboard","interior","detail","细节","部件","零件","滚筒","皮带","挂钩","局部","close","特写"];

function scpScoreImage(filename: string): number {
  const name = filename.toLowerCase();
  let score = 50;
  for (const kw of POSITIVE_KW) { if (name.includes(kw.toLowerCase())) { score += kw === "fm" || kw === "FM" ? 50 : 25; break; } }
  for (const kw of NEGATIVE_KW) { if (name.includes(kw.toLowerCase())) score -= 30; }
  return Math.max(0, Math.min(100, score));
}

/**
 * SCP: 创建完图片后自动优化 — 选最佳整机图作为首图
 * 确保 sortOrder=0 且 isPrimary=true 的图是最高分的
 */
async function autoOptimizeCover(productId: string, imageUrls: string[]) {
  if (!imageUrls || imageUrls.length <= 1) return; // 0或1张图无需优化

  // 评分排序
  const scored = imageUrls.map((url, idx) => ({
    url,
    fname: url.split("/").pop() || `img_${idx}`,
    score: scpScoreImage(url),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const firstUrl = imageUrls[0];

  // 如果第一张已经是最佳，无需调整
  if (best.url === firstUrl && best.score >= 70) return;

  // 更新DB：设最佳图为 isPrimary=true
  await prisma.productImage.updateMany({
    where: { productId, url: best.url },
    data: { isPrimary: true, sortOrder: 0 },
  });
  // 取消其他
  await prisma.productImage.updateMany({
    where: { productId, url: { not: best.url }, isPrimary: true },
    data: { isPrimary: false },
  });
  // 重排其余sortOrder
  const allImages = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
  let sortIdx = 0;
  for (const img of allImages) {
    if (img.url !== best.url) {
      sortIdx++;
      await prisma.productImage.update({
        where: { id: img.id },
        data: { sortOrder: sortIdx },
      });
    }
  }

  console.log(`[SCP] 产品 ${productId} 首图已优化 → ${best.fname} (score=${best.score})`);
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

      // ✨ SCP 自动优化封面 — 选最佳整机图作为首图
      try {
        await autoOptimizeCover(product.id, body.images);
      } catch (scpError) {
        console.error("[SCP] 封面优化失败（不影响产品创建）:", scpError);
      }
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
