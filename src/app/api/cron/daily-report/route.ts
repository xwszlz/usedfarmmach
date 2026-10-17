/**
 * GET /api/cron/daily-report?token=INTERNAL_API_KEY
 *
 * Vercel Cron 入口（每天 07:45 北京 = 前一天 23:45 UTC）。
 * 聚合当日数据并生成《跨境套利日报》写入 public/daily-reports/。
 */
import { NextRequest, NextResponse } from "next/server";
import { matchInternalApiKey } from "@/lib/internal-api-key-auth";
import { generateDailyReport } from "@/lib/daily-report/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 读取期望的 cron 触发密钥（CRON_API_KEY / CRON_SECRET）。
 * INTERNAL_API_KEY（含过渡期 INTERNAL_API_KEY_PREVIOUS）由 matchInternalApiKey 单独校验。
 *
 * ⚠️ 安全约定（务必保留）：这里【绝不】为密钥设置默认值兜底。
 * 本项目已发现同类问题：若写成 `process.env.INTERNAL_API_KEY || "dev-secret-key"`，
 * 当生产环境漏配密钥时，`?token=dev-secret-key` 会退化成万能钥匙。
 * 因此这里在两个 cron 环境变量都未配置、且 INTERNAL_API_KEY 系列也未配置时，
 * 由调用方 fail-closed（拒绝所有请求）。
 */
function resolveValidTokens(): string[] {
  // INTERNAL_API_KEY / INTERNAL_API_KEY_PREVIOUS 由 matchInternalApiKey 单独校验（支持过渡期双值）。
  return [process.env.CRON_API_KEY, process.env.CRON_SECRET].filter(
    (k): k is string => Boolean(k)
  );
}

/**
 * 校验 token 是否合法：CRON_API_KEY / CRON_SECRET 任一匹配即放行；
 * INTERNAL_API_KEY（含过渡期 INTERNAL_API_KEY_PREVIOUS）命中亦放行。fail-closed。
 */
function isValidToken(token: string): boolean {
  if (!token) return false;
  if (resolveValidTokens().includes(token)) return true;
  if (matchInternalApiKey(token) !== null) return true;
  return false;
}

/** 从 query(?token=) 或 Authorization: Bearer 头中提取调用方凭证。 */
function extractToken(req: NextRequest): string {
  const queryToken = req.nextUrl.searchParams.get("token") || "";
  const bearerToken = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
  return queryToken || bearerToken;
}

export async function GET(request: NextRequest) {
  // fail-closed：密钥未配置时绝不放行，也绝不使用任何默认值兜底。
  const cronTokens = resolveValidTokens();
  const internalConfigured = Boolean(
    process.env.INTERNAL_API_KEY || process.env.INTERNAL_API_KEY_PREVIOUS
  );
  if (cronTokens.length === 0 && !internalConfigured) {
    return NextResponse.json(
      { ok: false, error: "Server misconfigured: INTERNAL_API_KEY / CRON_API_KEY / CRON_SECRET is not set" },
      { status: 500 }
    );
  }
  if (!isValidToken(extractToken(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  try {
    const result = await generateDailyReport(date);
    return NextResponse.json({
      ok: true,
      date,
      generatedBy: result.generatedBy,
      filePath: result.filePath,
      message: `跨境套利日报已生成（${result.generatedBy}）`,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
