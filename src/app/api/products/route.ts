import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { productQuerySchema } from "@/lib/validators";
import { getImageUrl } from "@/lib/image-url";

// 强制动态渲染，避免静态生成问题
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const parsed = productQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      brand,
      category,
      yearMin,
      yearMax,
      priceMin,
      priceMax,
      location,
      condition,
      page,
      pageSize,
      sort,
    } = parsed.data;

    const where: Record<string, unknown> = {
      status: "active",
    };

    if (brand) where.brandId = brand;
    if (category) where.categoryId = category;
    if (condition) where.condition = condition;
    if (location) where.location = { contains: location, mode: "insensitive" };
    if (yearMin || yearMax) {
      where.year = {};
      if (yearMin) (where.year as Record<string, number>).gte = yearMin;
      if (yearMax) (where.year as Record<string, number>).lte = yearMax;
    }
    if (priceMin || priceMax) {
      where.priceCny = {};
      if (priceMin) (where.priceCny as Record<string, number>).gte = priceMin;
      if (priceMax) (where.priceCny as Record<string, number>).lte = priceMax;
    }

    const orderBy: Record<string, string> = {};
    switch (sort) {
      case "newest":
        orderBy.createdAt = "desc";
        break;
      case "priceLow":
        orderBy.priceCny = "asc";
        break;
      case "priceHigh":
        orderBy.priceCny = "desc";
        break;
      case "yearNew":
        orderBy.year = "desc";
        break;
      case "hoursLow":
        orderBy.workingHours = "asc";
        break;
    }

    // 分两次查询：有图片的优先，没图片的放后面
    // 先查有图片的产品总数和没图片的产品总数
    const [withImgCount, withoutImgCount] = await Promise.all([
      prisma.product.count({ where: { ...where, images: { some: {} } } }),
      prisma.product.count({ where: { ...where, images: { none: {} } } }),
    ]);

    const skip = (page - 1) * pageSize;
    let data;

    if (skip < withImgCount) {
      // 当前页有有图片的产品
      const takeFromWithImg = Math.min(pageSize, withImgCount - skip);
      const takeFromWithoutImg = pageSize - takeFromWithImg;

      const [withImg, withoutImg] = await Promise.all([
        prisma.product.findMany({
          where: { ...where, images: { some: {} } },
          include: {
            brand: true,
            category: true,
            images: { where: { isPrimary: true }, take: 1 },
            videos: { select: { id: true } },
            internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
            seller: { select: { id: true, companyName: true, country: true } },
          },
          orderBy,
          skip,
          take: takeFromWithImg,
        }),
        takeFromWithoutImg > 0
          ? prisma.product.findMany({
              where: { ...where, images: { none: {} } },
              include: {
                brand: true,
                category: true,
                images: { where: { isPrimary: true }, take: 1 },
                videos: { select: { id: true } },
                internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
                seller: { select: { id: true, companyName: true, country: true } },
              },
              orderBy,
              take: takeFromWithoutImg,
            })
          : [],
      ]);
      data = [...withImg, ...withoutImg];
    } else {
      // 当前页全是没图片的产品
      const withoutImgSkip = skip - withImgCount;
      data = await prisma.product.findMany({
        where: { ...where, images: { none: {} } },
        include: {
          brand: true,
          category: true,
          images: { where: { isPrimary: true }, take: 1 },
          videos: { select: { id: true } },
          internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
          seller: { select: { id: true, companyName: true, country: true } },
        },
        orderBy,
        skip: withoutImgSkip,
        take: pageSize,
      });
    }

    const total = withImgCount + withoutImgCount;

    // 转换图片URL为完整的OSS地址
    const processedData = data.map(product => {
      return {
        ...product,
        // 转换图片URL
        images: product.images?.map(img => ({
          ...img,
          url: getImageUrl(img.url)
        })) || []
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        data: processedData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Products list error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
