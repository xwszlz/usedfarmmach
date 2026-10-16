import { NextRequest, NextResponse } from "next/server";
import { DashboardInputSchema } from "@/lib/agents/data-dashboard/types";
import { dataDashboardAgent } from "@/lib/agents/data-dashboard/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * 🔒 P0 止血：Bearer API Key 鉴权（与 seller-scout 同范式，fail-closed）。
 * 接受 INTERNAL_API_KEY 或 CRON_API_KEY（运行时经环境变量注入，仓库内不存明文）。
 * 缺失密钥或 Bearer 不匹配一律 401，绝不兜底放行。
 */
function requireBearer(req: NextRequest): NextResponse | null {
  const keys = [process.env.INTERNAL_API_KEY, process.env.CRON_API_KEY].filter(
    (k): k is string => Boolean(k)
  );
  const auth = req.headers.get("Authorization");
  if (keys.length === 0 || !auth || !auth.startsWith("Bearer ") || !keys.includes(auth.substring(7))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const authFail = requireBearer(request);
  if (authFail) return authFail;

  let body: unknown = {};
  try { const text = await request.text(); body = text ? JSON.parse(text) : {}; }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = DashboardInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const result = await dataDashboardAgent.run(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  const authFail = requireBearer(request);
  if (authFail) return authFail;

  const overview = await dataDashboardAgent.getSchedulingOverview();
  return NextResponse.json(overview);
}
