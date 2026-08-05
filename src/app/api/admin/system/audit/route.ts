/**
 * 超管专属：审计日志查询（P1-b）
 * GET /api/admin/system/audit?type=pii_audit|email_send&page=&pageSize=&actorId=&targetUserId=&action=&provider=
 *
 * 双层校验：middleware SUPER_ADMIN_PATHS 网关 + 本处 requireSuperAdmin。
 * 只读：查 PiiAuditLog（角色变更/查看联系方式等）与 EmailSendLog（发信记录）。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, getAuditLogs } from "@/lib/admin/system";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") as "pii_audit" | "email_send" | null) ?? undefined;
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const actorId = searchParams.get("actorId") || undefined;
    const targetUserId = searchParams.get("targetUserId") || undefined;
    const action = searchParams.get("action") || undefined;
    const provider = searchParams.get("provider") || undefined;

    const data = await getAuditLogs({
      type,
      page,
      pageSize,
      actorId,
      targetUserId,
      action,
      provider,
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin/system/audit] 查询失败:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
