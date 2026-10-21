import { NextRequest, NextResponse } from "next/server";
import { matchInternalApiKey } from "@/lib/internal-api-key-auth";
import { ExchangeRateService } from "@/lib/services/exchange-rate-service";

export const dynamic = "force-dynamic"; // 防 .cn 构建期静态固化
export const maxDuration = 60;

/**
 * POST/GET /api/cron/update-exchange-rates
 * 定时（vercel.json: 0 2 * * *）或手动触发汇率全量刷新并落库。
 *
 * 鉴权与 keep-alive / update-prices / benchmark / daily-report 保持一致：
 * Vercel Cron 不支持自定义请求头，故走 URL query ?token=，
 * 接受 CRON_API_KEY 或 INTERNAL_API_KEY（fail-closed：env 缺失即 401）。
 */
function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const cronApiKey = process.env.CRON_API_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (cronApiKey && token === cronApiKey) return true;
  // 双值匹配：INTERNAL_API_KEY（当前）或 INTERNAL_API_KEY_PREVIOUS（过渡期）任一命中即放行。
  if (matchInternalApiKey(token) !== null) return true;
  if (cronSecret && token === cronSecret) return true;
  return false;
}

async function runUpdate(): Promise<NextResponse> {
  try {
    const svc = new ExchangeRateService();
    const result = await svc.refreshAllRates();
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json({
      success: true,
      message: "汇率数据已更新",
      data: result.data,
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error("汇率更新API错误:", error);
    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// Vercel Cron 实际以 GET 触发
export async function GET(request: NextRequest) {
  const queryToken = request.nextUrl.searchParams.get("token");
  const authHeader = request.headers.get("authorization");
  const token =
    queryToken ||
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null);
  if (!isValidToken(token)) {
    return NextResponse.json({ success: false, error: "缺少或无效的授权信息" }, { status: 401 });
  }
  return runUpdate();
}

// 手动触发（Bearer 风格，便于本地/脚本触发）
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "缺少授权信息" }, { status: 401 });
  }
  const token = authHeader.substring(7);
  // 复用 isValidToken（CRON_API_KEY / INTERNAL_API_KEY / CRON_SECRET 任一匹配即放行，fail-closed）
  if (!isValidToken(token)) {
    return NextResponse.json({ success: false, error: "无效的API密钥" }, { status: 401 });
  }
  return runUpdate();
}
