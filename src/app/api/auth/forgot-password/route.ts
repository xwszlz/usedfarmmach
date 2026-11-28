/**
 * POST /api/auth/forgot-password（阶段 1，任务 T07）
 *
 * 重构要点（替换阶段 0 的 DB resetToken 方案）：
 *   1) 令牌改为 JWT（purpose=reset_password，内嵌 passwordHash 的 SHA-256 摘要，
 *      实现"改密即失效"——reset-password 校验 pwdHash 摘要，不一致即拒）；
 *   2) 经新门面 sendEmail({ template:"resetPassword" }) 发信，写 EmailSendLog（仅存邮箱 hash）；
 *   3) 统一口径：无论账号是否存在 / 是否验证，均返回"若该账号存在，已发送指引"，
 *      绝不泄露邮箱 / 用户名是否注册（防枚举攻击）；
 *   4) 仅对「已设置邮箱」的用户真正发信（无邮箱静默返回同口径）。
 *      ⚠️ 2026-11-28 变更：不再要求 emailVerified —— 见下方发信分支的注释。
 *   5) 限流：按 IP（1h≤5）+ 按邮箱（1h≤3），复用 cache.ts。
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

/**
 * 统一成功口径（不泄露账号是否存在）。
 * 2026-11-28：随发信条件放宽，「已验证邮箱」改为「填写了邮箱」——
 * 措辞不能停留在旧规则上，否则用户会以为必须先验证邮箱才能找回。
 */
const SUCCESS_MESSAGE = "如果该账号存在且填写了邮箱，重置链接已发送，请查收邮件（注意垃圾邮件文件夹）。";

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
      windowSec: 3600,
      max: 5,
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

    // 发信条件（2026-11-28 放宽）：只要账号存在且填了邮箱就发，**不再要求 emailVerified**。
    //
    // 为什么必须放宽：注册流程写入的是 emailVerified=false（要用户点验证链接才置 true），
    // 而这里原先只给「已验证」的发信 ⇒ 新注册用户永远收不到重置邮件，
    // 页面却照样提示「已发送」—— 用户看到的是一个永远等不到结果的死循环。
    //
    // 安全性没有降低：能收到这封信本身就证明对该邮箱有控制权；
    // 「重置密码」本质就是一次邮箱所有权验证，与是否提前验证过无关。
    // 滥用防护仍在：IP 1h≤5 + 邮箱 1h≤3 双限流，且响应统一口径、不泄露账号是否存在。
    if (user && user.email) {
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
