import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { productQuerySchema } from "@/lib/validators";
import { getImageUrl } from "@/lib/image-url";
import { cache, cacheKey } from "@/lib/cache";
import { stripContactFieldsFromList } from "@/lib/pii";
import {
  buildWebsiteVisibleWhere,
  applySearchQueryToWhere,
} from "@/lib/product-visibility";
import type { Prisma } from "@prisma/client";

// 必须动态渲染（.cn 构建期连空库）；force-dynamic 优先级更高，revalidate 是无效配置，已移除
export const dynamic = 'force-dynamic';

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
      // 命中缓存同样剥离：确保本次改动之前写入的脏数据不会流出
      stripContactFieldsFromList(
        ((cached as { data?: { data?: unknown[] } })?.data?.data ?? [])
      );
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
      country,
      province,
      city,
      condition,
      page,
      pageSize,
      sort,
    } = parsed.data;

    // 展示策略（2026-06-29 更新；2026-10-05 修复网站端可见性）：
    //   - 国际品牌的产品：通过小程序 / .cn 网站发布 → 手机+网站同时展示
    //   - 国产品牌的产品：通过小程序发布 → 仅在小程序展示，不在网站展示
    //   - 网站端：口径 = status='active' 且 非(小程序账号 ∧ 国产品牌)；
    //     改用 sellerId 标量比较（不再用可空的 seller.email），规避 SQL 三值逻辑把 email IS NULL 的产品静默丢弃；
    //     单一事实来源见 @/lib/product-visibility（与列表页 page.tsx 共用）
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
      // 网站调用：口径 = status='active' 且 非(小程序账号 ∧ 国产品牌)
      // 先解析小程序账号 id，再用 sellerId 比较；查不到则安全退化为「不排除任何人」。
      const miniappSeller = await prisma.user.findUnique({
        where: { email: MINIAPP_SELLER_EMAIL },
        select: { id: true },
      });
      var where: Record<string, unknown> = buildWebsiteVisibleWhere(
        miniappSeller?.id ?? null
      ) as unknown as Record<string, unknown>;
    }

    if (brand) {
      (where.AND as unknown[]) = (where.AND as unknown[]) || [];
      (where.AND as unknown[]).push({
        OR: [
          { brandId: brand },
          { brand: { nameZh: { contains: brand, mode: "insensitive" } } },
          { brand: { nameEn: { contains: brand, mode: "insensitive" } } },
        ],
      });
    }
    if (category) {
      (where.AND as unknown[]) = (where.AND as unknown[]) || [];
      (where.AND as unknown[]).push({
        OR: [
          { categoryId: category },
          { category: { nameZh: { contains: category, mode: "insensitive" } } },
          { category: { nameEn: { contains: category, mode: "insensitive" } } },
        ],
      });
    }
    if (condition) where.condition = condition;
    // 兼容旧参数：location 文本模糊匹配
    if (location) where.location = { contains: location, mode: "insensitive" };
    // 新参数：结构化产地筛选（country/province/city）
    if (country) {
      (where.AND as unknown[]) = (where.AND as unknown[]) || [];
      (where.AND as unknown[]).push({ country });
    }
    if (province) {
      (where.AND as unknown[]) = (where.AND as unknown[]) || [];
      (where.AND as unknown[]).push({
        OR: [
          { province: { equals: province, mode: "insensitive" } },
          // 兼容：如果 province 为 null，回退到 location 文本匹配
          { AND: [{ province: null }, { location: { contains: province, mode: "insensitive" } }] },
        ],
      });
    }
    if (city) {
      (where.AND as unknown[]) = (where.AND as unknown[]) || [];
      (where.AND as unknown[]).push({
        OR: [
          { city: { equals: city, mode: "insensitive" } },
          { AND: [{ city: null }, { location: { contains: city, mode: "insensitive" } }] },
        ],
      });
    }
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
    // ⚠️ 修复：搜索条件必须与「可见性 where」以 AND 组合，绝不能整体覆盖 where.OR
    //    （旧写法 `where.OR = [...]` 会顶掉 buildWebsiteVisibleWhere 的可见性 OR，
    //     导致带 ?q= 搜索时泄漏出本该隐藏的产品）。组合逻辑见 @/lib/product-visibility。
    if (query) {
      where = applySearchQueryToWhere(
        where as unknown as Prisma.ProductWhereInput,
        query
      ) as unknown as Record<string, unknown>;
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

    // 热度排序（rank）：需要全量查询后排序再分页
    const skip = (page - 1) * pageSize;

    if (sort === "rank") {
      const rankParams = {
        where: where as any,
        include: {
          brand: true,
          category: true,
          images: {
            // 给 product-card 的首图 404 降级留候选：取 5 张（去重后仍能剩 3 张，
            // 部分产品 sortOrder 1/2、2/3 指向同一个 URL）。
            // 二级键 id 必填：全库有 116 组 (productId, sortOrder) 并列，
            // 缺二级键时每次重生成可能换到另一批候选，表现为「刷新一次图就变」。
            orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
            take: 5,
          },
          videos: { select: { id: true, url: true } },
          internationalPrices: { orderBy: { sourceDate: "desc" as const }, take: 1 },
          seller: { select: { id: true, companyName: true, country: true } },
        },
      };
      
      // 查询所有匹配产品（include 会带出全部标量字段，viewCount / createdAt 天然在结果里）
      const allProducts = await prisma.product.findMany(rankParams);
      
      // 按真实热度稳定排序（老板 2026-11-01 拍板口径）：
      // viewCount DESC → createdAt DESC → id DESC。
      // 末级 id 是稳定键 —— 全库有 10 个 viewCount 取值并列（涉及 121 个 active 产品），
      // 没有稳定键时分页会出现「翻一页顺序就变」。
      // 不再使用 src/config/daily-report-ranking.ts 的写死名单（其中 5 个 ID 已不存在）。
      const sorted = [...allProducts].sort(
        (a, b) =>
          (b.viewCount ?? 0) - (a.viewCount ?? 0) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
      );
      
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
      
      stripContactFieldsFromList(processedData);
      
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
            images: {
              // 首图 404 降级候选（详见 rank 分支同名注释）
              orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
              take: 5,
            },
            videos: { select: { id: true, url: true } },
            internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
            seller: { select: { id: true, companyName: true, country: true } },
            auctions: {
              where: { status: "active" },
              select: { id: true, totalBids: true },
              take: 1,
            },
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
                images: {
                  // 首图 404 降级候选（详见 rank 分支同名注释）
                  orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
                  take: 5,
                },
                videos: { select: { id: true, url: true } },
                internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
                seller: { select: { id: true, companyName: true, country: true } },
                auctions: {
                  where: { status: "active" },
                  select: { id: true, totalBids: true },
                  take: 1,
                },
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
          images: {
            // 首图 404 降级候选（详见 rank 分支同名注释）
            orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
            take: 5,
          },
          videos: { select: { id: true, url: true } },
          internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
          seller: { select: { id: true, companyName: true, country: true } },
          auctions: {
            where: { status: "active" },
            select: { id: true, totalBids: true },
            take: 1,
          },
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

    stripContactFieldsFromList(processedData);

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
