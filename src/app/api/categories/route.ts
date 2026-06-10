import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";
import { toSlug } from "@/lib/slug";

export const revalidate = 300;

/** GET /api/categories?slug=xxx — 查询单个分类+其产品 */
/** GET /api/categories — 列出所有分类（含slug） */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (slug) {
      // 查找匹配slug的分类
      const allCategories = await prisma.category.findMany();
      const category = allCategories.find(c => toSlug(c.nameEn) === slug);

      if (!category) {
        return NextResponse.json(
          { success: false, error: "Category not found" },
          { status: 404 }
        );
      }

      // 获取该分类下的产品
      const products = await prisma.product.findMany({
        where: { categoryId: category.id, status: "active" },
        include: {
          brand: true,
          category: true,
          images: { where: { isPrimary: true }, take: 1 },
          internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
        },
        orderBy: { priceCny: "desc" },
      });

      const processedProducts = products.map(p => ({
        ...p,
        images: p.images?.map(img => ({ ...img, url: getImageUrl(img.url) })) || [],
      }));

      // 获取子分类
      const children = allCategories
        .filter(c => c.parentId === category.id)
        .map(c => ({ ...c, slug: toSlug(c.nameEn) }));

      return NextResponse.json({
        success: true,
        data: {
          category: {
            ...category,
            slug: toSlug(category.nameEn),
            productCount: products.length,
          },
          children,
          products: processedProducts,
        },
      });
    }

    // 无 slug 参数 → 返回所有分类列表（仅顶级）
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: { _count: { select: { products: { where: { status: "active" } } } } },
      orderBy: { nameEn: "asc" },
    });

    const data = categories.map(c => ({
      id: c.id,
      nameZh: c.nameZh,
      nameEn: c.nameEn,
      nameRu: c.nameRu,
      slug: toSlug(c.nameEn),
      productCount: c._count.products,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Categories API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
