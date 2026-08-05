/**
 * Admin: 显示完整邮箱（带审计留痕）
 * POST /api/admin/users/[id]/reveal-email  { purpose?: string }
 *
 * 仅 super_admin / admin 可调用；调用即写 PiiAuditLog 后再返回明文 email。
 * 列表默认不下发明文（已在 Server Component 脱敏），此处仅按需返回。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { getQuotaUser, consumeQuota, quotaExceededResponse } from "@/lib/quota";
import { writePiiAuditLog } from "@/lib/audit";

/** 角色门禁：仅 admin / super_admin */
async function checkAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  });
  if (!user || !["admin", "super_admin"].includes(user.role)) return null;
  return payload;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await checkAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  // ── P1-a 额度闸门：查看联系方式计 actor 的 viewContact 额度 ──
  const qUser = await getQuotaUser(admin.userId);
  if (qUser) {
    const q = await consumeQuota(qUser, "viewContact");
    if (!q.ok) {
      return quotaExceededResponse(q.resetAt);
    }
  }

  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const purpose = typeof body?.purpose === "string" ? body.purpose : null;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
  }

  // 写审计：谁、何时、读了哪个用户的哪个字段、用途
  await writePiiAuditLog({
    actorId: admin.userId,
    targetUserId: id,
    field: "email",
    action: "view_full",
    purpose,
  });

  return NextResponse.json({ success: true, data: { email: target.email } });
}
