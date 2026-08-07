/**
 * 产品详情页「适配零部件」API
 *
 * GET /api/products/[id]/compatible-parts
 *
 * 按产品品牌运行时反查 CompatibleMachine 匹配的配件列表。
 * 匹配策略：品牌级精确匹配 → 通用件兜底（详见 parts-catalog.ts）。
 * force-dynamic 保证配件库存实时性。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCompatiblePartsForProduct } from "@/lib/parts-catalog";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "8", 10)));

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        modelName: true,
        brand: { select: { nameEn: true, nameZh: true } },
      },
    });

    if (!product || !product.brand) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const result = await getCompatiblePartsForProduct({
      brandEn: product.brand.nameEn,
      brandZh: product.brand.nameZh,
      modelName: product.modelName,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: {
        parts: result.parts,
        matchedBy: result.matchedBy,
        matchDetail: result.matchDetail,
        product: {
          id: product.id,
          modelName: product.modelName,
          brand: product.brand.nameEn || product.brand.nameZh,
        },
      },
    });
  } catch (error) {
    console.error("Compatible parts API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch compatible parts" },
      { status: 500 }
    );
  }
}
