/**
 * POST  /api/agents/price-intel   触发 Agent 跑一次
 * GET   /api/agents/price-intel   查询状态
 *
 * Auth：Bearer CRON_API_KEY（生产）/ 开放（dev）
 *
 * Body:
 *   {
 *     sources?: ["snapshot","brief","daily_md","manual"],
 *     maxFilesPerSource?: number,        // 默认 3
 *     force?: boolean,                   // 强制重写
 *     dryRun?: boolean,                  // 只看不写
 *     targetDate?: "20260615"            // 回填指定日
 *   }
 *
 * Response (POST):
 *   PriceIntelResult
 *
 * Response (GET):
 *   PriceIntelStatus
 */
import { NextRequest, NextResponse } from "next/server";
import { PriceIntelInputSchema } from "@/lib/agents/price-intel/types";
import { priceIntelAgent } from "@/lib/agents/price-intel/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function checkAuth(req: NextRequest): NextResponse | null {
  const apiKey = process.env.CRON_API_KEY || "dev-secret-key";
  const auth = req.headers.get("Authorization");
  if (process.env.NODE_ENV === "production") {
    if (!auth || !auth.startsWith("Bearer ") || auth.substring(7) !== apiKey) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PriceIntelInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      error: "Invalid input",
      details: parsed.error.flatten(),
    }, { status: 400 });
  }

  const result = await priceIntelAgent.run(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;
  const status = await priceIntelAgent.getStatus();
  return NextResponse.json(status);
}
