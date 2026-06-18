/**
 * POST /api/cron/update-prices
 * 触发 #3 国际价格采集 Agent 跑一次
 *
 * 这是 Agent 调度的 cron 入口；同时 #3 Agent 自身也提供
 * 更细粒度的 POST /api/agents/price-intel
 */
import { NextRequest, NextResponse } from "next/server";
import { priceIntelAgent } from "@/lib/agents/price-intel/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
    return NextResponse.json(
      { success: false, error: "无效的API密钥" },
      { status: 401 }
    );
  }

  try {
    // 解析 body（可选 sources / maxFilesPerSource / force / dryRun）
    let body: Record<string, unknown> = {};
    const text = await request.text();
    if (text) {
      try { body = JSON.parse(text); } catch { /* ignore */ }
    }

    const result = await priceIntelAgent.run({
      sources: Array.isArray(body.sources) ? body.sources as any : undefined,
      maxFilesPerSource: typeof body.maxFilesPerSource === "number" ? body.maxFilesPerSource : 3,
      force: !!body.force,
      dryRun: !!body.dryRun,
      targetDate: typeof body.targetDate === "string" ? body.targetDate : undefined,
    });

    return NextResponse.json({
      success: result.ok,
      message: result.ok
        ? `Agent 完成：采集 ${result.totalCollected}，新增 ${result.totalImported}，更新 ${result.totalUpdated}，跳过 ${result.totalSkipped}`
        : `Agent 失败：${result.error}`,
      agentResult: result,
    }, { status: result.ok ? 200 : 500 });
  } catch (error) {
    console.error("价格更新 Agent 异常:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "内部服务器错误" },
      { status: 500 }
    );
  }
}
