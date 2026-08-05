/**
 * 邮件发送动作封装（阶段 1，任务 T05/T06/T10）
 *
 * 统一收口"发验证邮件 / 发补全提醒"等动作，避免各路由重复拼接令牌与链接。
 * 复用：signEmailToken（email-token）+ sendEmail（email 门面）+ rateLimit（rate-limit）。
 *
 * 调用方职责：
 *   - 先确保 user 存在且邮箱已设置；
 *   - 自行决定"已验证是否还要发"（本函数只负责发 + 按邮箱限流）。
 */
import { signEmailToken } from "./email-token";
import { sendEmail } from "./email";
import { rateLimit, rateLimitKeys } from "./rate-limit";

/** 发送结果 */
export interface SendVerificationEmailResult {
  ok: boolean;
  rateLimited: boolean;
}

/**
 * 发送邮箱验证邮件（verify_email 令牌）。
 * 限流：按邮箱每小时 ≤3（与本人触发接口 send-verify-email 同源 key）。
 * @param origin 站点 origin（用于拼绝对链接，如 https://usedfarmmach.com）
 */
export async function sendVerificationEmail(opts: {
  userId: string;
  email: string;
  locale: string;
  origin: string;
  ip?: string;
}): Promise<SendVerificationEmailResult> {
  const rl = await rateLimit({
    key: rateLimitKeys.sendVerifyEmail(opts.email),
    windowSec: 3600,
    max: 3,
  });
  if (!rl.allowed) {
    return { ok: false, rateLimited: true };
  }

  const emailToken = signEmailToken({
    userId: opts.userId,
    email: opts.email,
    purpose: "verify_email",
  });
  const link = `${opts.origin}/${opts.locale}/auth/verify-email?token=${emailToken}`;

  await sendEmail({
    to: opts.email,
    template: "verifyEmail",
    vars: { link, expiresMin: "1440" },
    userId: opts.userId,
    ip: opts.ip,
    locale: opts.locale,
  });

  return { ok: true, rateLimited: false };
}
