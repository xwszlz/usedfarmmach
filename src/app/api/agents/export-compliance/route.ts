/**
 * POST  /api/agents/export-compliance   触发出口合规分析
 * GET   /api/agents/export-compliance   查询 Agent 支持的国家/品牌/HS编码
 *
 * Auth：Bearer CRON_API_KEY（必填；env 缺失即 fail-closed，无开发环境放行）
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
  // ⚠️ 安全约定（务必保留）：这里【绝不】为密钥设置默认值兜底。
  // 原先"非生产环境完全不校验 + 生产环境用 dev-secret-key 兜底"两者都是绕过面。
  // env 缺失即不可比对（fail-closed）。
  const apiKey = process.env.CRON_API_KEY;
  const auth = req.headers.get("Authorization");
  if (!apiKey || !auth || !auth.startsWith("Bearer ") || auth.substring(7) !== apiKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
