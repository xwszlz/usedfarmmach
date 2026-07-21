/**
 * 卖家产品编辑 API
 * - GET: 获取单个产品详情（含所有图片，用于编辑页）
 * - PUT: 更新产品信息
 *
 * 权限：仅产品 owner（sellerId === userId）可操作
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { buildLocationText } from "@/lib/location-parser";

export const dynamic = "force-dynamic";

/** 从请求头解析当前用户身份 */
function getSeller(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  return verifyToken(token);
}

// GET — 获取单个产品详情（含所有图片）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seller = getSeller(request);
    if (!seller) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const { id } = params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, nameZh: true, nameEn: true, isChineseBrand: true } },
        category: { select: { id: true, nameZh: true, nameEn: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "产品不存在" },
        { status: 404 }
      );
    }

    if (product.sellerId !== seller.userId) {
      return NextResponse.json(
        { success: false, error: "无权查看此产品" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    console.error("[GET /api/seller/products/[id]]", error);
    return NextResponse.json(
      { success: false, error: error.message || "获取失败" },
      { status: 500 }
    );
  }
}

// PUT — 更新产品信息
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seller = getSeller(request);
    if (!seller) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const { id } = params;

    // 验证产品归属
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "产品不存在" },
        { status: 404 }
      );
    }
    if (existing.sellerId !== seller.userId) {
      return NextResponse.json(
        { success: false, error: "无权修改此产品" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      brandName, modelName, year, workingHours, engineType, enginePower,
      driveSystem, mainConfig, overallLength, overallWidth, overallHeight,
      netWeight, condition, priceCny,
      category, country, province, city, location,
    } = body;

    // ── 品牌解析：brandName → brandId ──
    let brandId: string | undefined;
    if (brandName !== undefined && brandName !== "") {
      const existingBrand = await prisma.brand.findFirst({
        where: { nameZh: brandName },
      });
      if (existingBrand) {
        brandId = existingBrand.id;
      } else {
        const created = await prisma.brand.create({
          data: {
            nameZh: brandName,
            nameEn: brandName,
            originCountry: "未知",
            isChineseBrand: false,
          },
        });
        brandId = created.id;
      }
    }

    // ── 品类解析：category → categoryId ──
    let categoryId: string | undefined;
    if (category !== undefined && category !== "") {
      const existingCat = await prisma.category.findFirst({
        where: { nameZh: category },
      });
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const created = await prisma.category.create({
          data: { nameZh: category, nameEn: category },
        });
        categoryId = created.id;
      }
    }

    // ── 产地处理：如果有结构化字段但 location 为空，自动生成 ──
    let finalLocation = location;
    if (
      (!finalLocation || finalLocation.trim() === "") &&
      (country || province || city)
    ) {
      finalLocation = buildLocationText(country, province, city);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(brandId !== undefined && { brandId }),
        ...(categoryId !== undefined && { categoryId }),
        ...(modelName !== undefined && { modelName }),
        ...(year !== undefined && { year: Number(year) }),
        ...(workingHours !== undefined && {
          workingHours: workingHours ? Number(workingHours) : null,
        }),
        ...(engineType !== undefined && { engineType }),
        ...(enginePower !== undefined && {
          enginePower: enginePower ? Number(enginePower) : null,
        }),
        ...(driveSystem !== undefined && { driveSystem }),
        ...(mainConfig !== undefined && { mainConfig }),
        ...(overallLength !== undefined && {
          overallLength: overallLength ? Number(overallLength) : null,
        }),
        ...(overallWidth !== undefined && {
          overallWidth: overallWidth ? Number(overallWidth) : null,
        }),
        ...(overallHeight !== undefined && {
          overallHeight: overallHeight ? Number(overallHeight) : null,
        }),
        ...(netWeight !== undefined && {
          netWeight: netWeight ? Number(netWeight) : null,
        }),
        ...(condition !== undefined && { condition }),
        ...(priceCny !== undefined && { priceCny: Number(priceCny) }),
        ...(country !== undefined && { country }),
        ...(province !== undefined && { province }),
        ...(city !== undefined && { city }),
        ...(finalLocation !== undefined && { location: finalLocation }),
        ...(priceCny !== undefined && {
          priceUsd: Math.round(Number(priceCny) / 7.25),
        }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[PUT /api/seller/products/[id]]", error);
    return NextResponse.json(
      { success: false, error: error.message || "保存失败" },
      { status: 500 }
    );
  }
}
