import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { ArbitrageCalculator } from "@/lib/services/arbitrage-calculator";
import { cache, cacheKey } from "@/lib/cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const includeArbitrage = searchParams.get("includeArbitrage") !== "false"; // 默认true
    const arbitrageQuantity = parseInt(searchParams.get("quantity") || "1", 10);

    // 缓存 key：按产品ID + 是否含套利，TTL 300 秒
    const cacheKeyString = cacheKey(
      "product",
      `${id}${includeArbitrage ? ":arbitrage" : ""}`
    );
    const cached = await cache.get(cacheKeyString);
    if (cached) {
      return NextResponse.json(cached);
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        videos: true,
        seller: { select: { id: true, companyName: true, country: true } },
        internationalPrices: {
          orderBy: { sourceDate: "desc" },
          take: 1,
        },
      },
    });

    if (!product || product.status !== "active") {
      const notFoundResponse = {
        success: false,
        error: "Product not found",
      };
      await cache.set(cacheKeyString, notFoundResponse, 60);
      return NextResponse.json(notFoundResponse, { status: 404 });
    }

    // 构建基本响应数据
    const responseData: any = { ...product };

    // 如果需要包含套利数据
    if (includeArbitrage) {
      try {
        const calculator = new ArbitrageCalculator();
        
        // 如果存在国际价格，使用最新的一条
        const latestInternationalPrice = product.internationalPrices?.[0];
        
        const arbitrageParams = {
          productId: id,
          quantity: arbitrageQuantity,
          // 可以传递国际价格和货币（如果存在）
          ...(latestInternationalPrice && latestInternationalPrice.priceForeignRaw !== null ? {
            foreignPrice: latestInternationalPrice.priceForeignRaw,
            foreignCurrency: latestInternationalPrice.currency as any,
          } : {})
        };

        const arbitrageResult = await calculator.calculateArbitrage(arbitrageParams);
        
        // 添加套利数据到响应
        responseData.arbitrage = arbitrageResult;
      } catch (arbitrageError) {
        console.warn("套利计算失败:", arbitrageError);
        // 套利计算失败时仍返回产品数据，但不包含套利信息
        responseData.arbitrage = {
          error: "套利计算失败",
          message: arbitrageError instanceof Error ? arbitrageError.message : "未知错误"
        };
      }
    }

    const detailResponse = { 
      success: true, 
      data: responseData 
    };
    await cache.set(cacheKeyString, detailResponse, 300);
    return NextResponse.json(detailResponse);
  } catch (error) {
    console.error("Product detail error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: 编辑产品（admin / super_admin / editor 可操作）
 * 支持修改：modelName, year, workingHours, condition, priceCny, location, descriptionZh, brandId, categoryId, status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Token 无效" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  });
  if (!user || !["admin", "super_admin", "editor"].includes(user.role)) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.modelName !== undefined) updateData.modelName = String(body.modelName);
    if (body.year !== undefined) updateData.year = Number(body.year);
    if (body.workingHours !== undefined) updateData.workingHours = body.workingHours === null ? null : Number(body.workingHours);
    if (body.condition !== undefined) updateData.condition = String(body.condition);
    if (body.priceCny !== undefined) {
      const priceCny = Number(body.priceCny);
      updateData.priceCny = priceCny;
      updateData.priceUsd = Math.round(priceCny / 7.25);
    }
    if (body.location !== undefined) updateData.location = String(body.location);
    if (body.descriptionZh !== undefined) updateData.descriptionZh = body.descriptionZh === null ? null : String(body.descriptionZh);
    if (body.brandId !== undefined) updateData.brandId = String(body.brandId);
    if (body.categoryId !== undefined) updateData.categoryId = String(body.categoryId);
    if (body.status !== undefined) updateData.status = String(body.status);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: "没有需要更新的字段" }, { status: 400 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    await cache.del(cacheKey("product", id));
    await cache.del(cacheKey("product", `${id}:arbitrage`));

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Product update error:", error);
    return NextResponse.json(
      { success: false, error: "更新失败" },
      { status: 500 }
    );
  }
}