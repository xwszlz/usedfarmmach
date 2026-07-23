/**
 * POST /api/auth/send-verify-email（本人触发发送验证邮件，阶段 1，任务 T05）
 *
 * 鉴权：Bearer token（本人）。
 * 限流：按邮箱每小时 ≤3（rateLimitKeys.sendVerifyEmail）。
 *
 * 响应：
 *   200 { success:true, data:{ sent:true } }           已发送
 *   200 { success:true, data:{ sent:false } }          邮箱已验证，无需重发
 *   400 { success:false, error:"邮箱未设置" }
 *   401 { success:false, error:"未登录" }
 *   429 { success:false, error:"发送过于频繁，请稍后再试" }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { signEmailToken } from "@/lib/email-token";
import { sendEmail } from "@/lib/email";
import { rateLimit, rateLimitKeys } from "@/lib/rate-limit";

/** 取客户端 IP（用于审计 / 限流） */
function getClientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") || undefined;
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        preferredLanguage: true,
      },
    });
    if (!user || !user.email) {
      return NextResponse.json(
        { success: false, error: "邮箱未设置" },
        { status: 400 }
      );
    }
    if (user.emailVerified) {
      return NextResponse.json({ success: true, data: { sent: false } });
    }

    const ip = getClientIp(request);
    const rl = await rateLimit({
      key: rateLimitKeys.sendVerifyEmail(user.email),
      windowSec: 3600,
      max: 3,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "发送过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const locale = user.preferredLanguage || "zh";
    const emailToken = signEmailToken({
      userId: user.id,
      email: user.email,
      purpose: "verify_email",
    });
    const link = `${request.nextUrl.origin}/${locale}/auth/verify-email?token=${emailToken}`;

    await sendEmail({
      to: user.email,
      template: "verifyEmail",
      vars: { link, expiresMin: "1440" },
      userId: user.id,
      ip,
      locale,
    });

    return NextResponse.json({ success: true, data: { sent: true } });
  } catch (error: unknown) {
    console.error("send-verify-email error:", error);
    return NextResponse.json(
      { success: false, error: "发送失败，请稍后重试" },
      { status: 500 }
    );
  }
}
