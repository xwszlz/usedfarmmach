/**
 * 超管专属：数据出境合规看板（P1-b）
 * GET /api/admin/system/compliance
 *
 * 指标口径：
 *   - crossBorderRecipients = distinct EmailSendLog.recipientHash WHERE provider='resend'
 *     （仅 resend 计出境；P1 起 .cn 的 tencent_ses 属境内通道、console 为本地降级，均不计出境）
 *   - threshold = 100000（10 万人阈值）
 *   - providers = 各 provider 发送次数分布
 * 双层校验：middleware SUPER_ADMIN_PATHS 网关 + 本处 requireSuperAdmin。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, getComplianceMetrics } from "@/lib/admin/system";
import { isComSite } from "@/config/site";
import { crossBorderAssessment } from "@/lib/compliance/cross-border";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const base = await getComplianceMetrics();
    // .cn 站数据不出境，不调用跨境自评估；.com 站补充 crossBorder 指标
    const data = isComSite()
      ? { ...base, crossBorder: await crossBorderAssessment() }
      : { ...base, crossBorder: null };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin/system/compliance] 查询失败:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
