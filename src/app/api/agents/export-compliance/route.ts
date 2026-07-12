/**
 * POST  /api/agents/export-compliance   触发出口合规分析
 * GET   /api/agents/export-compliance   查询 Agent 支持的国家/品牌/HS编码
 *
 * Auth：Bearer CRON_API_KEY（生产）/ 开放（dev）
 *
 * Body (POST):
 *   {
 *     productId?: string,            // 站内产品ID
 *     brandId?: string,              // 品牌ID
 *     brandName?: string,            // 品牌名（中/英）
 *     modelName?: string,            // 型号
 *     purchasePriceCny?: number,     // 采购价（人民币）
 *     year?: number,                 // 年份
 *     category?: string,             // 品类
 *     targetCountries?: string[],    // 目标国（默认全部）
 *     dryRun?: boolean               // 只看不写
 *   }
 *
 * Response (POST):
 *   ExportComplianceResult
 *
 * Response (GET):
 *   ExportComplianceStatus
 */
import { NextRequest, NextResponse } from "next/server";
import { ExportComplianceInputSchema } from "@/lib/agents/export-compliance/types";
import { exportComplianceAgent } from "@/lib/agents/export-compliance/agent";

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

  const parsed = ExportComplianceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      error: "Invalid input",
      details: parsed.error.flatten(),
    }, { status: 400 });
  }

  const result = await exportComplianceAgent.run(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;
  const status = await exportComplianceAgent.getStatus();
  return NextResponse.json(status);
}
