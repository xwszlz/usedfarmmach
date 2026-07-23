/**
 * POST /api/auth/reset-password（阶段 1，任务 T08）
 *
 * 重构要点（替换阶段 0 的 DB resetToken 方案）：
 *   1) 令牌改为 JWT（purpose=reset_password，由 forgot-password 签发）；
 *   2) 校验令牌 → 比对 user.email 与 token.email 一致（防 token 错位）；
 *   3) "改密即失效"：token 内嵌 passwordHash 的 SHA-256 摘要，
 *      与当前 user.passwordHash 摘要比对，不一致（已改密）即拒；
 *   4) 更新 passwordHash，并清空历史 DB resetToken（防御性）；
 *   5) 不改动 emailVerified（仅 magic-link 回调置 true，见设计决策 #5）。
 *
 * 与前端 reset-password-form 的请求体一致：{ token, newPassword }。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { verifyEmailToken, sha256 } from "@/lib/email-token";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body as {
      token?: string;
      newPassword?: string;
    };

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, error: "缺少令牌或新密码" },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "密码至少6位" },
        { status: 400 }
      );
    }

    // 校验 JWT 令牌（purpose 必须匹配）
    const result = verifyEmailToken(token, "reset_password");
    if (!result) {
      return NextResponse.json(
        { success: false, error: "令牌无效或已过期，请重新申请" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "令牌无效或已过期，请重新申请" },
        { status: 400 }
      );
    }

    // 邮箱一致性（防 token 被错位使用到别的账号）
    if (
      !user.email ||
      user.email.toLowerCase() !== result.email.toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, error: "令牌与账号不匹配，请重新申请" },
        { status: 400 }
      );
    }

    // "改密即失效"：比对 passwordHash 摘要（用户已改密则旧链接作废）
    // 设计 §3.8：令牌内嵌的 passwordHash 摘要与当前用户不符，返回 401（拒绝，文案保留）。
    if (result.pwdHash && sha256(user.passwordHash) !== result.pwdHash) {
      return NextResponse.json(
        { success: false, error: "密码已变更，请重新申请重置" },
        { status: 401 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // 防御性清空历史 DB 令牌（避免与新 JWT 方案混用）
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "密码重置成功，请使用新密码登录",
    });
  } catch (error: unknown) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
