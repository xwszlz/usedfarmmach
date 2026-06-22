import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier } = body; // username or email

    if (!identifier) {
      return NextResponse.json(
        { success: false, error: "请输入用户名或邮箱" },
        { status: 400 }
      );
    }

    // 查找用户（用户名或邮箱）
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
      select: { id: true, email: true, username: true, preferredLanguage: true },
    });

    // 安全考虑：无论用户是否存在，都返回成功（防止枚举攻击）
    if (!user || !user.email) {
      return NextResponse.json({
        success: true,
        message: "如果该账号存在且绑定了邮箱，重置链接已发送",
      });
    }

    // 生成重置令牌（30分钟有效）
    const crypto = await import("crypto");
    const resetToken = crypto.randomUUID();
    const resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    });

    // 构建重置链接
    const locale = user.preferredLanguage || "zh";
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://usedfarmmach.com";
    const resetLink = `${baseUrl}/${locale}/auth/reset-password?token=${resetToken}`;

    // 发送邮件
    const sent = await sendPasswordResetEmail(user.email, resetLink, locale);

    if (!sent) {
      // 邮件发送失败，但不暴露给用户
      console.warn("[forgot-password] Email send failed for user:", user.id);
    }

    return NextResponse.json({
      success: true,
      message: "如果该账号存在且绑定了邮箱，重置链接已发送",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
