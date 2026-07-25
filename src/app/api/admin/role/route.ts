/**
 * Admin: 用户角色管理（P1-b 超管专属，改造旧端点）
 * POST /api/admin/role { userId, role, reason? }
 *
 * - 仅 super_admin 可调用（双层：middleware SUPER_ADMIN_PATHS 网关 + 本处再校验）
 * - 目标角色集含 super_admin / partner_limited
 * - 设为 super_admin 前校验数量上限（SUPER_ADMIN_MAX），达上限返回 409 SUPER_ADMIN_CAP
 * - 成功写 user.role + 写 PiiAuditLog（操作留痕）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { writePiiAuditLog } from "@/lib/audit";
import { ROLE_SET, SUPER_ADMIN_MAX } from "@/lib/permissions";

/** 仅 super_admin 放行；否则返回 null */
async function checkSuperAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  });
  if (!user || user.role !== "super_admin") return null;
  return payload;
}

export async function POST(request: NextRequest) {
  const admin = await checkSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const { userId, role, reason } = await request.json();
    if (!ROLE_SET.includes(role as (typeof ROLE_SET)[number])) {
      return NextResponse.json({ success: false, error: "无效角色" }, { status: 400 });
    }

    // 设为 super_admin 前校验数量上限（排除目标自身，避免重设已有超管被拒）
    if (role === "super_admin") {
      const count = await prisma.user.count({
        where: { role: "super_admin", NOT: { id: userId } },
      });
      if (count >= SUPER_ADMIN_MAX) {
        return NextResponse.json(
          {
            success: false,
            code: "SUPER_ADMIN_CAP",
            error: `超级管理员数量已达上限 ${SUPER_ADMIN_MAX}`,
          },
          { status: 409 },
        );
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    // 操作留痕（PII 最小化：仅操作人/对象 id + 字段/动作/用途）
    await writePiiAuditLog({
      actorId: admin.userId,
      targetUserId: userId,
      field: "role",
      action: "role_change",
      purpose: reason ?? null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}
