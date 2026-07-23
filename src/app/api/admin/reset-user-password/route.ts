/**
 * Admin: 管理员手动重置用户密码（仅 admin / super_admin）
 * POST /api/admin/reset-user-password  { userId, newPassword? }
 *
 * newPassword 可不传 → 服务端生成随机密码。
 * 重置后仅站内信通知（写 Notification），订阅消息为 stub；不发邮件（方案 5.1）。
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { adminResetPasswordSchema } from "@/lib/validators";
import { createInAppNotification, sendWechatSubscribeMessage } from "@/lib/notify";

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

export async function POST(request: NextRequest) {
  const admin = await checkAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = adminResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }
    const { userId, newPassword } = parsed.data;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
    }

    // 服务端生成随机密码（若未提供）
    const resolvedPassword =
      newPassword && newPassword.length > 0
        ? newPassword
        : `sd${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await bcrypt.hash(resolvedPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // 仅站内信通知（不发邮件）；订阅消息为 stub
    await createInAppNotification({
      userId,
      type: "password_reset",
      title: "您的密码已被管理员重置",
      body: "请尽快登录并修改为您自己的密码。",
      link: "/account",
    });
    await sendWechatSubscribeMessage({
      userId,
      templateId: "password_reset",
      data: {},
    });

    return NextResponse.json({ success: true, data: { notified: true } });
  } catch (error: any) {
    console.error("[reset-user-password] 失败:", error);
    return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}
