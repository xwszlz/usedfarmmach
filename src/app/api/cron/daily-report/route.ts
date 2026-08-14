/**
 * GET /api/cron/daily-report?token=INTERNAL_API_KEY
 *
 * Vercel Cron 入口（每天 07:30 北京 = 前一天 23:30 UTC）。
 * 聚合当日数据并生成《跨境套利日报》写入 public/daily-reports/。
 */
import { NextRequest, NextResponse } from "next/server";
import { generateDailyReport } from "@/lib/daily-report/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isValidToken(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get("token") || "";
  const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
  const valid = process.env.INTERNAL_API_KEY || process.env.CRON_API_KEY || "dev-secret-key";
  return token === valid || apiKey === valid;
}

export async function GET(request: NextRequest) {
  if (!isValidToken(request)) {
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
