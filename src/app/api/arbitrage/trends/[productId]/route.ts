import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/arbitrage/trends/[productId]
 * 获取产品价格趋势API
 * 
 * 路径参数：
 * - productId: 产品ID
 * 
 * 查询参数：
 * - days: 时间范围天数（默认30）
 * 
 * 响应格式：
 * {
 *   success: boolean,
 *   data: {
 *     productId: string,
 *     dates: string[],          // 日期字符串 (YYYY-MM-DD)
 *     domesticPrices: number[], // 国内价格(CNY)
 *     internationalPrices: number[], // 国际价格(CNY)
 *     spreads: number[],        // 价差(CNY)
 *   },
 *   error?: string
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const days = parseInt(searchParams.get("days") || "30", 10);
    
    // 参数验证
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "缺少产品ID" },
        { status: 400 }
      );
    }
    
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { success: false, error: "参数 days 必须是 1-365 之间的整数" },
        { status: 400 }
      );
    }
    
    // TODO: 这里应该从数据库或缓存中获取真实的价格历史数据
    // 目前先返回模拟数据，后续实现真实数据源
    
    const dates: string[] = [];
    const domesticPrices: number[] = [];
    const internationalPrices: number[] = [];
    const spreads: number[] = [];
    
    const now = new Date();
    const baseDomesticPrice = 500000; // 基准国内价格
    const baseInternationalPrice = 450000; // 基准国际价格
    
    // 生成模拟数据
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
      
      // 添加一些随机波动
      const domesticVariation = 1 + (Math.random() * 0.1 - 0.05); // ±5%
      const internationalVariation = 1 + (Math.random() * 0.15 - 0.075); // ±7.5%
      
      const domesticPrice = Math.round(baseDomesticPrice * domesticVariation / 1000) * 1000;
      const internationalPrice = Math.round(baseInternationalPrice * internationalVariation / 1000) * 1000;
      const spread = internationalPrice - domesticPrice;
      
      domesticPrices.push(domesticPrice);
      internationalPrices.push(internationalPrice);
      spreads.push(spread);
    }
    
    const response = {
      productId,
      dates,
      domesticPrices,
      internationalPrices,
      spreads
    };
    
    return NextResponse.json({
      success: true,
      data: response,
      note: "当前为模拟数据，真实数据功能待实现"
    }, { status: 200 });
    
  } catch (error) {
    console.error("价格趋势API错误:", error);
    
    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}