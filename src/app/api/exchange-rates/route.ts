import { NextRequest, NextResponse } from "next/server";
import { ExchangeRateService } from "@/lib/services/exchange-rate-service";
import { SUPPORTED_CURRENCIES } from "@/config/exchange-rates";
import type { ExchangeRate } from "@/types/exchange-rates";

/**
 * 汇率管理API
 *
 * GET  /api/exchange-rates - 获取全部货币相对 CNY 的汇率（实时库值 + 静态兜底，无 mock）
 * POST /api/exchange-rates - 手动触发汇率刷新（Authorization: Bearer CRON_API_KEY，fail-closed）
 */

const exchangeRateService = new ExchangeRateService();

export const dynamic = "force-dynamic"; // 防 .cn 构建期静态固化，详见 scripts/check-route-dynamic.mjs

/**
 * GET /api/exchange-rates
 * 返回全部支持货币相对 CNY 的汇率（CNY 恒为 1）。
 */
export async function GET(request: NextRequest) {
  try {
    const { base, rates, source, fetchedAt } = await exchangeRateService.getAllRates();
    const data: ExchangeRate[] = SUPPORTED_CURRENCIES.map((c, i) => {
      const rate = rates[c] ?? 1;
      return {
        id: String(i + 1),
        baseCurrency: base,
        targetCurrency: c,
        rate,
        inverseRate: rate ? 1 / rate : 1,
        source,
        lastUpdated: fetchedAt,
        effectiveDate: fetchedAt,
        confidence: source === "db-live" ? 0.9 : 0.5,
        isLive: source === "db-live",
        isHistorical: false,
        isInterpolated: false,
        change: 0,
        changePercent: 0,
      };
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error("获取汇率API错误:", error);
    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/exchange-rates
 * 手动触发汇率刷新（实时源拉取并落库）。
 * Authorization: Bearer [CRON_API_KEY]，fail-closed。
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    // ⚠️ 绝不为密钥设置默认值兜底，env 缺失即 fail-closed。
    const apiKey = process.env.CRON_API_KEY;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "缺少授权信息" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    if (!apiKey || token !== apiKey) {
      return NextResponse.json({ success: false, error: "无效的API密钥" }, { status: 401 });
    }

    const result = await exchangeRateService.refreshAllRates();
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: "汇率已刷新",
      data: result.data,
    }, { status: 200 });
  } catch (error) {
    console.error("触发汇率更新API错误:", error);
    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
