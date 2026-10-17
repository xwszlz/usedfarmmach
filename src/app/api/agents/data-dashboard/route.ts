import { NextRequest, NextResponse } from "next/server";
import { matchInternalApiKey } from "@/lib/internal-api-key-auth";
import { DashboardInputSchema } from "@/lib/agents/data-dashboard/types";
import { dataDashboardAgent } from "@/lib/agents/data-dashboard/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * 🔒 P0 止血：Bearer API Key 鉴权（与 seller-scout 同范式，fail-closed）。
 * 接受 INTERNAL_API_KEY（含过渡期 INTERNAL_API_KEY_PREVIOUS）或 CRON_API_KEY（运行时经环境变量注入，仓库内不存明文）。
 * 缺失密钥或 Bearer 不匹配一律 401，绝不兜底放行。
 */
function requireBearer(req: NextRequest): NextResponse | null {
  const cronApiKey = process.env.CRON_API_KEY;
  const auth = req.headers.get("Authorization");
  const presented = auth && auth.startsWith("Bearer ") ? auth.substring(7) : null;
  // 双值匹配：INTERNAL_API_KEY / INTERNAL_API_KEY_PREVIOUS（过渡期）任一命中即放行；同时保留 CRON_API_KEY。
  const internalMatch = matchInternalApiKey(presented);
  const cronOk = !!cronApiKey && presented === cronApiKey;
  if (!presented || (internalMatch === null && !cronOk)) {
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
