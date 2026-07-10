import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { productQuerySchema } from "@/lib/validators";
import { getImageUrl } from "@/lib/image-url";
import { sortByDailyRank } from "@/config/daily-report-ranking";
import { cache, cacheKey } from "@/lib/cache";

// ISR: 每5分钟重新验证
export const dynamic = 'force-dynamic';
export const revalidate = 300;

// ✅ Round3 修复: Vercel Serverless 超时延长到30秒
// 原因: 此接口执行复杂查询（多表 JOIN: product+brand+category+images+videos+internationalPrices+seller）
//       + 有图/无图分页策略需 2-4 次 DB 查询 + Neon 免费层冷启动 2-5s
//       Vercel 默认 10s 在数据量增大或冷启动时容易超时 → ERR_TIMED_OUT
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    // 小程序调用时带 includeMiniapp=true，包含待审核的国产农机
    const includeMiniapp = searchParams.get("includeMiniapp") === "true";

    // 缓存 key：按完整 URL 参数生成，TTL 60 秒
    const cacheKeyString = cacheKey("products", request.url);
    // 小程序模式不缓存（待审核产品变化快）
    const cached = includeMiniapp ? null : await cache.get(cacheKeyString);
    if (cached) {
      return NextResponse.json(cached);
    }

    const parsed = productQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      query,
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

    // 展示策略（2026-06-29 更新）：
    //   - 国际品牌的产品：通过小程序发布 → 手机+网站同时展示
    //   - 国产品牌的产品：通过小程序发布 → 仅在小程序展示，不在网站展示
    //   - 网站端：排除 miniprogram 发布的国产品牌（seller=miniprogram + brand.isImported=false）
    //   - 小程序端：展示所有 active + miniprogram 的全部产品
    const MINIAPP_SELLER_EMAIL = "miniprogram@shendiao.com";

    if (includeMiniapp) {
      // 小程序调用：显示所有 active + miniprogram 发布的全部产品（含国产）
      var where: Record<string, unknown> = {
        OR: [
          { status: "active" },
          { AND: [{ status: "draft" }, { seller: { email: MINIAPP_SELLER_EMAIL } }] },
        ],
      };
    } else {
      // 网站调用：显示 active 产品，但排除「miniprogram 发布的国产品牌」
      // 即：允许 miniprogram 的国际品牌产品，禁止 miniprogram 的国产品牌产品
      var where: Record<string, unknown> = {
        OR: [
          // 非 miniprogram 来源的所有 active 产品
          { AND: [{ status: "active" }, { NOT: { seller: { email: MINIAPP_SELLER_EMAIL } } }] },
          // miniprogram 来源的国际品牌产品（brand.isImported=true）
          { AND: [{ status: "active" }, { seller: { email: MINIAPP_SELLER_EMAIL } }, { brand: { isImported: true } }] },
        ],
      };
    }

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

    // 万能搜索：匹配型号、品牌名、品类名、描述
    if (query) {
      where.OR = [
        { modelName: { contains: query, mode: "insensitive" } },
        { brand: { nameZh: { contains: query, mode: "insensitive" } } },
        { brand: { nameEn: { contains: query, mode: "insensitive" } } },
        { category: { nameZh: { contains: query, mode: "insensitive" } } },
        { category: { nameEn: { contains: query, mode: "insensitive" } } },
        { descriptionZh: { contains: query, mode: "insensitive" } },
        { descriptionEn: { contains: query, mode: "insensitive" } },
        { location: { contains: query, mode: "insensitive" } },
      ];
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

    // 日报排名排序：需要全量查询后按排名排序再分页
    const skip = (page - 1) * pageSize;

    if (sort === "rank") {
      const rankParams = {
        where: where as any,
        include: {
          brand: true,
          category: true,
          images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
          videos: { select: { id: true, url: true } },
          internationalPrices: { orderBy: { sourceDate: "desc" as const }, take: 1 },
          seller: { select: { id: true, companyName: true, country: true } },
        },
      };
      
      // 查询所有匹配产品
      const allProducts = await prisma.product.findMany(rankParams);
      
      // 按日报排名排序
      const sorted = sortByDailyRank(allProducts);
      
      // 分页
      const paged = sorted.slice(skip, skip + pageSize);
      const total = sorted.length;
      
      // 转换图片URL
      const processedData = paged.map(product => ({
        ...product,
        images: product.images?.map(img => ({
          ...img,
          url: getImageUrl(img.url)
        })) || []
      }));
      
      const rankResponse = {
        success: true,
        data: {
          data: processedData,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
      await cache.set(cacheKeyString, rankResponse, 60);
      return NextResponse.json(rankResponse);
    }

    // 分两次查询：有图片的优先，没图片的放后面
    // 先查有图片的产品总数和没图片的产品总数
    const [withImgCount, withoutImgCount] = await Promise.all([
      prisma.product.count({ where: { ...where, images: { some: {} } } }),
      prisma.product.count({ where: { ...where, images: { none: {} } } }),
    ]);

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
            images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
            videos: { select: { id: true, url: true } },
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
                images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
                videos: { select: { id: true, url: true } },
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
          images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
          videos: { select: { id: true, url: true } },
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

    const listResponse = {
      success: true,
      data: {
        data: processedData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
    await cache.set(cacheKeyString, listResponse, 60);
    return NextResponse.json(listResponse);
  } catch (error) {
    console.error("Products list error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
