/**
 * POST /api/cron/update-prices  — 手动调用（Authorization Bearer 头验证）
 * GET  /api/cron/update-prices  — Vercel Cron 自动调用（URL query token 验证）
 *
 * 触发 #3 国际价格采集 Agent 跑一次
 *
 * 这是 Agent 调度的 cron 入口；同时 #3 Agent 自身也提供
 * 更细粒度的 POST /api/agents/price-intel
 */
import { NextRequest, NextResponse } from "next/server";
import { priceIntelAgent } from "@/lib/agents/price-intel/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 校验 token 是否合法
 * 同时支持 CRON_API_KEY 和 INTERNAL_API_KEY 两种密钥
 */
function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;

  // 开发环境直接放行 dev-secret-key
  const cronApiKey = process.env.CRON_API_KEY || "dev-secret-key";
  const internalApiKey = process.env.INTERNAL_API_KEY;

  // 非生产环境放行 dev-secret-key（方便本地调试）
  if (token === cronApiKey) return true;
  if (internalApiKey && token === internalApiKey) return true;

  // 生产环境严格要求匹配
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  // 非生产环境且 token 等于 dev-secret-key 也放行
  return token === "dev-secret-key";
}

/**
 * 价格更新核心执行逻辑（GET / POST 共用）
 */
async function executePriceUpdate(body: Record<string, unknown> = {}) {
  const result = await priceIntelAgent.run({
    sources: Array.isArray(body.sources) ? (body.sources as any) : undefined,
    maxFilesPerSource:
      typeof body.maxFilesPerSource === "number" ? body.maxFilesPerSource : 3,
    force: !!body.force,
    dryRun: !!body.dryRun,
    targetDate:
      typeof body.targetDate === "string" ? body.targetDate : undefined,
  });

  return NextResponse.json(
    {
      success: result.ok,
      message: result.ok
        ? `Agent 完成：采集 ${result.totalCollected}，新增 ${result.totalImported}，更新 ${result.totalUpdated}，跳过 ${result.totalSkipped}`
        : `Agent 失败：${result.error}`,
      agentResult: result,
    },
    { status: result.ok ? 200 : 500 }
  );
}

/**
 * GET /api/cron/update-prices
 * Vercel Cron Jobs 自动调用（GET 请求，token 通过 URL query 传递）
 *
 * Vercel Cron 不支持自定义请求头，因此通过 ?token=xxx 进行身份验证。
 * schedule: "0 23 * * 0" → 每周日 23:00 UTC = 每周一 07:00 UTC+8
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!isValidToken(token)) {
    return NextResponse.json(
      { success: false, error: "缺少或无效的授权信息" },
      { status: 401 }
    );
  }

  try {
    return await executePriceUpdate();
  } catch (error) {
    console.error("价格更新 Agent 异常 (GET):", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "内部服务器错误",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/update-prices
 * 手动调用（Authorization: Bearer <token> 头验证）
 */
export async function POST(request: NextRequest) {
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
    // 同时检查 INTERNAL_API_KEY
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey || token !== internalApiKey) {
      return NextResponse.json(
        { success: false, error: "无效的API密钥" },
        { status: 401 }
      );
    }
  }

  try {
    // 解析 body（可选 sources / maxFilesPerSource / force / dryRun）
    let body: Record<string, unknown> = {};
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        /* ignore */
      }
    }

    return await executePriceUpdate(body);
  } catch (error) {
    console.error("价格更新 Agent 异常:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "内部服务器错误",
      },
      { status: 500 }
    );
  }
}
