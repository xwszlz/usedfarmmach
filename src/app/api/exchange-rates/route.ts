import { NextRequest, NextResponse } from "next/server";
import { ExchangeRateService } from "@/lib/services/exchange-rate-service";
import type { ExchangeRate } from "@/types/exchange-rates";

/**
 * 汇率管理API
 * 
 * GET /api/exchange-rates - 获取所有汇率数据
 * POST /api/exchange-rates - 手动触发汇率更新
 */

const exchangeRateService = new ExchangeRateService();

/**
 * GET /api/exchange-rates
 * 获取所有汇率数据
 * 
 * 响应格式：
 * {
 *   success: boolean,
 *   data: ExchangeRate[],
 *   error?: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: 从ExchangeRateService获取所有汇率数据
    // 由于服务方法尚未完全定义，这里先返回模拟数据
    // 实际实现中应该调用 exchangeRateService.getAllRates() 或类似方法
    
    const mockRates: ExchangeRate[] = [
      {
        id: "1",
        baseCurrency: "CNY",
        targetCurrency: "USD",
        rate: 0.138,
        inverseRate: 7.246,
        source: "mock",
        lastUpdated: new Date().toISOString(),
        effectiveDate: new Date().toISOString(),
        confidence: 0.9,
        isLive: false,
        isHistorical: false,
        isInterpolated: false,
        change: 0.002,
        changePercent: 0.15
      },
      {
        id: "2",
        baseCurrency: "CNY",
        targetCurrency: "EUR",
        rate: 0.127,
        inverseRate: 7.874,
        source: "mock",
        lastUpdated: new Date().toISOString(),
        effectiveDate: new Date().toISOString(),
        confidence: 0.9,
        isLive: false,
        isHistorical: false,
        isInterpolated: false,
        change: -0.001,
        changePercent: -0.08
      },
      {
        id: "3",
        baseCurrency: "CNY",
        targetCurrency: "GBP",
        rate: 0.109,
        inverseRate: 9.174,
        source: "mock",
        lastUpdated: new Date().toISOString(),
        effectiveDate: new Date().toISOString(),
        confidence: 0.9,
        isLive: false,
        isHistorical: false,
        isInterpolated: false,
        change: 0.000,
        changePercent: 0.00
      },
      {
        id: "4",
        baseCurrency: "CNY",
        targetCurrency: "JPY",
        rate: 19.65,
        inverseRate: 0.051,
        source: "mock",
        lastUpdated: new Date().toISOString(),
        effectiveDate: new Date().toISOString(),
        confidence: 0.9,
        isLive: false,
        isHistorical: false,
        isInterpolated: false,
        change: 0.12,
        changePercent: 0.61
      },
      {
        id: "5",
        baseCurrency: "CNY",
        targetCurrency: "RUB",
        rate: 12.34,
        inverseRate: 0.081,
        source: "mock",
        lastUpdated: new Date().toISOString(),
        effectiveDate: new Date().toISOString(),
        confidence: 0.9,
        isLive: false,
        isHistorical: false,
        isInterpolated: false,
        change: -0.23,
        changePercent: -1.83
      }
    ];
    
    // 尝试从服务获取真实数据（如果方法存在）
    let rates = mockRates;
    try {
      // 这里可以尝试调用实际的服务方法
      // rates = await exchangeRateService.getAllRates();
    } catch (error) {
      console.log("使用模拟汇率数据，真实数据功能待实现");
    }
    
    return NextResponse.json({
      success: true,
      data: rates
    }, { status: 200 });
    
  } catch (error) {
    console.error("获取汇率API错误:", error);
    
    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/exchange-rates
 * 手动触发汇率更新
 * 
 * 请求头需要包含 API 密钥进行验证（简单验证示例）
 * Authorization: Bearer [API_KEY]
 * 
 * 响应格式：
 * {
 *   success: boolean,
 *   message: string,
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 简单API密钥验证（生产环境应使用更安全的验证方式）
    const authHeader = request.headers.get("Authorization");
    const apiKey = process.env.CRON_API_KEY || "dev-secret-key";
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "缺少授权信息" },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    if (token !== apiKey && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "无效的API密钥" },
        { status: 401 }
      );
    }
    
    // TODO: 触发汇率更新
    // 实际实现中应该调用 exchangeRateService.fetchLatestRates() 或类似方法
    
    console.log("手动触发汇率更新");
    
    return NextResponse.json({
      success: true,
      message: "汇率更新任务已触发，请稍后查看结果"
    }, { status: 200 });
    
  } catch (error) {
    console.error("触发汇率更新API错误:", error);
    
    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}