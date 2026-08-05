import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST — add showcase item to booth (from existing product or manual)
export async function POST(request: NextRequest) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token无效" }, { status: 401 });

  const body = await request.json();
  const { boothId, productId, ...manualData } = body;

  if (!boothId) return NextResponse.json({ success: false, error: "缺少展位ID" }, { status: 400 });

  // Verify booth ownership
  const booth = await prisma.booth.findUnique({ where: { id: boothId } });
  if (!booth || booth.merchantId !== payload.userId) {
    return NextResponse.json({ success: false, error: "无权操作此展位" }, { status: 403 });
  }

  let itemData: Record<string, unknown> = {
    boothId,
    status: "published",
  };

  if (productId) {
    // Import from existing Product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        brand: { select: { nameZh: true, nameEn: true } },
        category: { select: { nameZh: true, nameEn: true } },
      },
    });

    if (!product) return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });

    itemData = {
      ...itemData,
      productId,
      deviceType: product.category?.nameZh || product.category?.nameEn || "other",
      brand: product.brand?.nameZh || product.brand?.nameEn || null,
      model: product.modelName,
      year: product.year,
      workingHours: product.workingHours,
      condition: product.condition,
      price: product.priceCny,
      currency: "CNY",
      images: product.images.map((img) => img.url),
      description: product.descriptionZh || product.descriptionEn || null,
    };
  } else {
    // Manual entry
    itemData = {
      ...itemData,
      deviceType: manualData.deviceType || "other",
      brand: manualData.brand || null,
      model: manualData.model || null,
      year: manualData.year ? parseInt(manualData.year) : null,
      workingHours: manualData.workingHours ? parseInt(manualData.workingHours) : null,
      condition: manualData.condition || null,
      price: manualData.price ? parseFloat(manualData.price) : null,
      currency: manualData.currency || "CNY",
      images: manualData.images || [],
      videos: manualData.videos || [],
      description: manualData.description || null,
    };
  }

  // Get next sortIndex
  const maxSort = await prisma.showcaseItem.aggregate({
    where: { boothId },
    _max: { sortIndex: true },
  });

  const item = await prisma.showcaseItem.create({
    data: { ...itemData, sortIndex: (maxSort._max.sortIndex || 0) + 1 } as any,
  });

  return NextResponse.json({ success: true, data: item });
}

// PATCH — update item (sortIndex, status, etc.)
export async function PATCH(request: NextRequest) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token无效" }, { status: 401 });

  const body = await request.json();
  const { id, boothId, ...updateData } = body;

  if (!id) return NextResponse.json({ success: false, error: "缺少展品ID" }, { status: 400 });

  // Verify ownership via booth
  const item = await prisma.showcaseItem.findUnique({
    where: { id },
    include: { booth: { select: { merchantId: true } } },
  });
  if (!item || item.booth.merchantId !== payload.userId) {
    return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 });
  }

  const allowed = ["sortIndex", "status", "brand", "model", "year", "workingHours", "condition", "price", "description", "images", "videos"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updateData) data[key] = updateData[key];
  }

  const updated = await prisma.showcaseItem.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: updated });
}

// DELETE — remove showcase item
export async function DELETE(request: NextRequest) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token无效" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "缺少展品ID" }, { status: 400 });

  // Verify ownership
  const item = await prisma.showcaseItem.findUnique({
    where: { id },
    include: { booth: { select: { merchantId: true } } },
  });
  if (!item || item.booth.merchantId !== payload.userId) {
    return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 });
  }

  await prisma.showcaseItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
