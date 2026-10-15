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

  // 解析或自动创建展位（自主发布农机：卖家无需预先由管理员分配展位即可发布）
  let booth = boothId ? await prisma.booth.findUnique({ where: { id: boothId } }) : null;
  if (!booth || booth.merchantId !== payload.userId) {
    const expo =
      (await prisma.expo.findFirst({ where: { status: "active" }, orderBy: { startDate: "asc" } })) ??
      (await prisma.expo.findFirst({ orderBy: { startDate: "asc" } }));
    let expoId = expo?.id;
    if (!expoId) {
      const created = await prisma.expo.create({
        data: { name: "自主发布展厅", slug: "self-publish-" + Date.now(), type: "self", status: "active", startDate: new Date() },
      });
      expoId = created.id;
    }
    const u = await prisma.user.findUnique({ where: { id: payload.userId }, select: { companyName: true } });
    booth = await prisma.booth.create({
      data: {
        expoId,
        merchantId: payload.userId,
        name: u?.companyName || "我的展位",
        hall: "comprehensive",
        pavilion: "china",
        tier: "standard",
        status: "published",
        template: "standard",
      },
    });
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
    // Manual entry — 自主发布新机（itemType 默认 new，提交即上线）
    itemData = {
      ...itemData,
      deviceType: manualData.deviceType || "other",
      brand: manualData.brand || null,
      brandId: manualData.brandId || null,
      model: manualData.model || null,
      series: manualData.series || null,
      year: manualData.year ? parseInt(manualData.year) : null,
      launchYear: manualData.launchYear ? parseInt(manualData.launchYear) : null,
      workingHours: manualData.workingHours ? parseInt(manualData.workingHours) : null,
      condition: manualData.condition || "new",
      price: manualData.price ? parseFloat(manualData.price) : null,
      msrpCny: manualData.msrpCny != null ? parseFloat(manualData.msrpCny) : null,
      msrpUsd: manualData.msrpUsd != null ? parseFloat(manualData.msrpUsd) : null,
      currency: manualData.currency || "CNY",
      origin: manualData.origin || null,
      isChineseMade: manualData.isChineseMade ?? null,
      machineTier: manualData.machineTier || null,
      priceRange: manualData.priceRange || null,
      images: manualData.images || [],
      videos: manualData.videos || [],
      description: manualData.description || null,
      descriptionZh: manualData.descriptionZh || null,
      descriptionEn: manualData.descriptionEn || null,
      descriptionRu: manualData.descriptionRu || null,
      descriptionEs: manualData.descriptionEs || null,
      descriptionFr: manualData.descriptionFr || null,
      descriptionPt: manualData.descriptionPt || null,
      descriptionHi: manualData.descriptionHi || null,
      descriptionAr: manualData.descriptionAr || null,
      brochureUrl: manualData.brochureUrl || null,
      arModelUrl: manualData.arModelUrl || null,
      specs: manualData.specs || null,
      country: manualData.country || null,
      itemType: manualData.itemType || "new",
      isNewLaunch: manualData.isNewLaunch ?? true,
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

  const allowed = ["sortIndex", "status", "brand", "brandId", "model", "series", "year", "launchYear", "workingHours", "condition", "price", "msrpCny", "msrpUsd", "currency", "origin", "isChineseMade", "machineTier", "priceRange", "images", "videos", "description", "descriptionZh", "descriptionEn", "descriptionRu", "descriptionEs", "descriptionFr", "descriptionPt", "descriptionHi", "descriptionAr", "brochureUrl", "arModelUrl", "specs", "country", "itemType", "isNewLaunch"];
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
