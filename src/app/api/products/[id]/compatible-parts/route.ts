/**
 * 产品详情页「适配零部件」API
 *
 * GET /api/products/[id]/compatible-parts
 *
 * 适配零部件数据来源（按优先级）：
 *  1. MachinePart 精选配对层（97 台二手农机人工/脚本配对，优先）
 *  2. 品牌级精确匹配 → 通用件兜底（CompatibleMachine / Part 目录，详见 parts-catalog.ts）
 * force-dynamic 保证配件库存实时性。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCompatiblePartsForProduct, getMachinePairedParts } from "@/lib/parts-catalog";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "8", 10)));

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

    // 优先：整机精选配对层（MachinePart，97 台二手农机配对数据）
    const paired = await getMachinePairedParts(id, limit);
    if (paired.length > 0) {
      const total = await prisma.machinePart.count({ where: { machineId: id } });
      return NextResponse.json({
        success: true,
        data: {
          parts: paired,
          total,
          matchedBy: "brand",
          matchDetail: {
            brand: product.brand.nameEn || product.brand.nameZh,
            model: product.modelName,
          },
          product: {
            id: product.id,
            modelName: product.modelName,
            brand: product.brand.nameEn || product.brand.nameZh,
          },
        },
      });
    }

    // 兜底：按品牌/通用件反查（CompatibleMachine / Part 目录）
    let total = 0;
    const brandMatchedCount = await prisma.compatibleMachine.findMany({
      where: { brand: { in: [product.brand.nameEn, product.brand.nameZh].filter(Boolean) } },
      select: { partId: true },
      distinct: ["partId"],
    });
    if (brandMatchedCount.length > 0) {
      total = brandMatchedCount.length;
    } else {
      const GENERIC_BRANDS = ["SKF", "Bosch", "通用", "Generic", "Standard"];
      total = await prisma.part.count({
        where: { isActive: true, brand: { in: GENERIC_BRANDS } },
      });
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
        total,
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
