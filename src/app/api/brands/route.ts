import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";
import { toSlug } from "@/lib/slug";

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/** GET /api/brands — 列出所有品牌（含slug） */
/** GET /api/brands/[slug] — 查询单个品牌+其产品 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (slug) {
      // 查找匹配slug的品牌
      const allBrands = await prisma.brand.findMany();
      const brand = allBrands.find(b => toSlug(b.nameEn) === slug);

      if (!brand) {
        return NextResponse.json(
          { success: false, error: "Brand not found" },
          { status: 404 }
        );
      }

      // 获取该品牌下的产品
      const products = await prisma.product.findMany({
        where: { brandId: brand.id, status: "active" },
        include: {
          brand: true,
          category: true,
          images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
          internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
        },
        orderBy: { priceCny: "desc" },
      });

      const processedProducts = products.map(p => ({
        ...p,
        images: p.images?.map(img => ({ ...img, url: getImageUrl(img.url) })) || [],
      }));

      return NextResponse.json({
        success: true,
        data: {
          brand: {
            ...brand,
            slug: toSlug(brand.nameEn),
            productCount: products.length,
          },
          products: processedProducts,
        },
      });
    }

    // 无 slug 参数 → 返回所有品牌列表
    const brands = await prisma.brand.findMany({
      include: { _count: { select: { products: { where: { status: "active" } } } } },
      orderBy: { nameEn: "asc" },
    });

    const data = brands.map(b => ({
      ...b,
      slug: toSlug(b.nameEn),
      productCount: b._count.products,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Brands API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
