/**
 * POST /api/auth/forgot-password（阶段 1，任务 T07）
 *
 * 重构要点（替换阶段 0 的 DB resetToken 方案）：
 *   1) 令牌改为 JWT（purpose=reset_password，内嵌 passwordHash 的 SHA-256 摘要，
 *      实现"改密即失效"——reset-password 校验 pwdHash 摘要，不一致即拒）；
 *   2) 经新门面 sendEmail({ template:"resetPassword" }) 发信，写 EmailSendLog（仅存邮箱 hash）；
 *   3) 统一口径：无论账号是否存在 / 是否验证，均返回"若该账号存在，已发送指引"，
 *      绝不泄露邮箱 / 用户名是否注册（防枚举攻击）；
 *   4) 仅对"已验证邮箱"的用户真正发信（未验证 / 无邮箱静默返回同口径）；
 *   5) 限流：按 IP（60s≤10）+ 按邮箱（1h≤3），复用 cache.ts。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signEmailToken, sha256 } from "@/lib/email-token";
import { sendEmail } from "@/lib/email";
import { rateLimit, rateLimitKeys } from "@/lib/rate-limit";

/** 取客户端 IP（X-Forwarded-For 优先，回退 X-Real-IP） */
function getClientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") || undefined;
}

/** 统一成功口径（不泄露账号是否存在） */
const SUCCESS_MESSAGE = "如果该账号存在且绑定了已验证邮箱，重置链接已发送，请查收邮件（注意垃圾邮件文件夹）。";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier } = body as { identifier?: string }; // username or email

    if (!identifier || typeof identifier !== "string" || identifier.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "请输入用户名或邮箱" },
        { status: 400 }
      );
    }

    // 限流（IP 维度，先拦暴力枚举）
    const ip = getClientIp(request) ?? "unknown";
    const ipRl = await rateLimit({
      key: rateLimitKeys.forgotPasswordIp(ip),
      windowSec: 60,
      max: 10,
    });
    if (!ipRl.allowed) {
      return NextResponse.json(
        { success: false, error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    // 查找用户（用户名或邮箱）
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        preferredLanguage: true,
        passwordHash: true,
      },
    });

    // 统一口径：无论是否存在，客户端始终收到成功响应（防枚举）
    const okResponse = NextResponse.json({ success: true, message: SUCCESS_MESSAGE });

    // 仅对已验证邮箱的用户真正发信（未验证 / 无邮箱静默跳过）
    if (user && user.email && user.emailVerified) {
      // 按邮箱限流（1h≤3）
      const emailRl = await rateLimit({
        key: rateLimitKeys.forgotPasswordEmail(user.email),
        windowSec: 3600,
        max: 3,
      });
      if (emailRl.allowed) {
        const pwdHashDigest = sha256(user.passwordHash);
        const token = signEmailToken({
          userId: user.id,
          email: user.email,
          purpose: "reset_password",
          pwdHash: pwdHashDigest,
        });
        const locale = user.preferredLanguage || "zh";
        const link = `${request.nextUrl.origin}/${locale}/auth/reset-password?token=${token}`;

        await sendEmail({
          to: user.email,
          template: "resetPassword",
          vars: { link, expiresMin: "30" },
          userId: user.id,
          ip,
          locale,
        });
      } else {
        // 限流命中也静默——仍返回统一口径，不暴露限流细节
        console.warn("[forgot-password] email rate-limited, skip send:", user.id);
      }
    }

    return okResponse;
  } catch (error: unknown) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
