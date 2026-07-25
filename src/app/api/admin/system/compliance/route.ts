/**
 * 超管专属：数据出境合规看板（P1-b）
 * GET /api/admin/system/compliance
 *
 * 指标口径：
 *   - crossBorderRecipients = distinct EmailSendLog.recipientHash WHERE provider='resend'
 *     （console 为本地降级不计；国内通道不计；仅 resend 计为出境）
 *   - threshold = 100000（10 万人阈值）
 *   - providers = 各 provider 发送次数分布
 * 双层校验：middleware SUPER_ADMIN_PATHS 网关 + 本处 requireSuperAdmin。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, getComplianceMetrics } from "@/lib/admin/system";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const data = await getComplianceMetrics();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin/system/compliance] 查询失败:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
