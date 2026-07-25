/**
 * 超管专属：系统配置查看（P1-b，只读）
 * GET /api/admin/system/config
 *
 * 返回环境变量 / 功能开关 / 邮件服务商状态（仅展示，无写入）。
 * 双层校验：middleware SUPER_ADMIN_PATHS 网关 + 本处 requireSuperAdmin。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, getSystemConfig } from "@/lib/admin/system";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: getSystemConfig() });
}
