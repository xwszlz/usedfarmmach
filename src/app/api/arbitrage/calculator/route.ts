import { NextRequest, NextResponse } from "next/server";
import { ArbitrageCalculator } from "@/lib/services/arbitrage-calculator";
import type { ArbitrageCalculatorParams, ArbitrageResult } from "@/types/arbitrage";

/**
 * POST /api/arbitrage/calculator
 * 套利计算API
 * 
 * 请求体格式：
 * {
 *   productId: string,
 *   domesticPrice?: number,
 *   foreignPrice?: number,
 *   foreignCurrency?: CurrencyCode,
 *   shippingCost?: number,
 *   shippingCostPercentage?: number,
 *   importTaxRate?: number,
 *   insuranceRate?: number,
 *   otherCosts?: number,
 *   exchangeRate?: number,
 *   quantity?: number,
 *   includeAnalysis?: boolean
 * }
 * 
 * 响应格式：
 * {
 *   success: boolean,
 *   data?: ArbitrageResult,
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: ArbitrageCalculatorParams = await request.json();
    
    // 基本参数验证
    if (!body.productId) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数：productId" },
        { status: 400 }
      );
    }

    // 创建计算器实例并计算套利
    const calculator = new ArbitrageCalculator();
    const result: ArbitrageResult = await calculator.calculateArbitrage(body);

    return NextResponse.json({
      success: true,
      data: result
    }, { status: 200 });

  } catch (error) {
    console.error("套利计算API错误:", error);
    
    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}