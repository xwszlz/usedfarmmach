import { NextRequest, NextResponse } from "next/server";
import { TopArbitrageService } from "@/lib/services/top-arbitrage-service";
import type { ArbitrageTopItem, TopArbitrageResponse } from "@/types/arbitrage";

// 强制动态渲染，避免静态生成问题
export const dynamic = 'force-dynamic';

/**
 * GET /api/arbitrage/top-products
 * 获取套利榜单API
 * 
 * 查询参数：
 * - limit: 返回数量（默认10）
 * - minProfitMargin: 最低利润率百分比（默认15）
 * 
 * 响应格式：
 * {
 *   success: boolean,
 *   data: TopArbitrageResponse,
 *   error?: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const minProfitMargin = parseInt(searchParams.get("minProfitMargin") || "15", 10);
    
    // 参数验证
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, error: "参数 limit 必须是 1-100 之间的整数" },
        { status: 400 }
      );
    }
    
    if (isNaN(minProfitMargin) || minProfitMargin < 0 || minProfitMargin > 100) {
      return NextResponse.json(
        { success: false, error: "参数 minProfitMargin 必须是 0-100 之间的整数" },
        { status: 400 }
      );
    }
    
    // 创建服务实例并获取榜单
    const service = new TopArbitrageService();
    // 注意：方法参数名可能是 minPriceDiff，对应 minProfitMargin
    const topProducts: ArbitrageTopItem[] = await service.calculateTopProducts(limit, minProfitMargin);
    
    // 计算摘要统计
    const totalCount = topProducts.length;
    const avgProfitMargin = totalCount > 0 
      ? topProducts.reduce((sum, item) => sum + (item.profitMargin ?? 0), 0) / totalCount
      : 0;
    const maxProfitMargin = totalCount > 0
      ? Math.max(...topProducts.map(item => item.profitMargin ?? 0))
      : 0;
    
    // 构建响应
    const response: TopArbitrageResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        generatedAt: new Date().toISOString(),
        products: topProducts,
        summary: {
          totalProducts: totalCount,
          averagePriceDiff: avgProfitMargin,
          maxPriceDiff: maxProfitMargin,
          minPriceDiff: minProfitMargin,
          highOpportunityCount: topProducts.filter(item => item.arbitrageLevel === 'high').length,
          mediumOpportunityCount: topProducts.filter(item => item.arbitrageLevel === 'medium').length,
          lowOpportunityCount: topProducts.filter(item => item.arbitrageLevel === 'low').length,
          totalEstimatedProfit: topProducts.reduce((sum, item) => sum + (item.estimatedProfit ?? 0), 0),
          averageProfitMargin: avgProfitMargin
        }
      }
    };
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    console.error("套利榜单API错误:", error);
    
    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}