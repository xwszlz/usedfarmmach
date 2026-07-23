/**
 * POST /api/admin/send-complete-reminder（阶段 1，任务 T10）
 *
 * 存量用户引导：管理员对"待补全"用户批量/单发"补全资料"提醒。
 * 双通道（绝不导出 / 群发明文 PII）：
 *   1) 站内信：createNotification（仅落库 userId，不落明文邮箱）；
 *   2) 邮件：sendEmail({ template:"completeProfileReminder" })，写 EmailSendLog（仅存邮箱 hash）。
 *
 * 权限：仅 admin / super_admin（与用户管理门禁一致，T07）。
 * 限流：按 userId 每小时 ≤2（防误点 / 骚扰）。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { rateLimit, rateLimitKeys } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // 1) 鉴权：Bearer / cookie
    const token = getTokenFromHeaders(request.headers);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "未登录" },
        { status: 401 }
      );
    }

    // 2) 角色门禁：仅 admin / super_admin
    const actor = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    });
    if (!actor || !["admin", "super_admin"].includes(actor.role)) {
      return NextResponse.json(
        { success: false, error: "无权限" },
        { status: 403 }
      );
    }

    // 3) 解析参数
    const body = await request.json();
    const { userId } = (body ?? {}) as { userId?: string };
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, error: "缺少 userId" },
        { status: 400 }
      );
    }

    // 4) 限流：按目标用户每小时 ≤2
    const rl = await rateLimit({
      key: rateLimitKeys.adminReminder(userId),
      windowSec: 3600,
      max: 2,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "操作过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    // 5) 取目标用户（仅取必要字段，不向客户端返回明文 PII）
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, preferredLanguage: true },
    });
    if (!target) {
      return NextResponse.json(
        { success: false, error: "用户不存在" },
        { status: 404 }
      );
    }
    if (!target.email) {
      return NextResponse.json(
        { success: false, error: "该用户未设置邮箱，无法发送提醒" },
        { status: 400 }
      );
    }

    const locale = target.preferredLanguage || "zh";
    const link = `${request.nextUrl.origin}/${locale}/account/complete-profile`;

    // 6) 双通道：站内信 + 邮件（绝不导出 / 群发明文 PII）
    await createNotification({
      userId: target.id,
      type: "profile_reminder",
      title: locale === "en" ? "Complete your profile" : "请补全您的资料",
      body: locale === "en"
        ? "Complete your company, country and verify your email to unlock more features and credit rewards."
        : "补全公司名称、国家/地区并验证邮箱，解锁更多功能与积分奖励。",
      link: "/account/complete-profile",
    });

    await sendEmail({
      to: target.email,
      template: "completeProfileReminder",
      vars: { link },
      userId: target.id,
      locale,
    });

    return NextResponse.json({
      success: true,
      message: "已发送补全提醒（站内信 + 邮件）",
    });
  } catch (error: unknown) {
    console.error("send-complete-reminder error:", error);
    return NextResponse.json(
      { success: false, error: "发送失败，请稍后重试" },
      { status: 500 }
    );
  }
}
