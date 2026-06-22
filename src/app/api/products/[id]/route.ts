import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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