/**
 * 邮件发送服务 — 基于 Resend
 * 免费层：3000封/月，足够密码重置使用
 * 文档：https://resend.com/docs/api-reference/emails/send-email
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * 发送邮件
 * 如果未配置 RESEND_API_KEY，则降级为控制台日志（开发环境）
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // 开发环境降级：打印到控制台
    console.warn("[email] RESEND_API_KEY not set, skipping email send:");
    console.warn(`[email] To: ${to}, Subject: ${subject}`);
    console.warn(`[email] Text: ${text || "(no text version)"}`);
    return false;
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `神雕农机 <${fromEmail}>`,
        to: [to],
        subject,
        html,
        text: text || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[email] Resend API error:", response.status, errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[email] Send failed:", error);
    return false;
  }
}

/**
 * 发送密码重置邮件
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  locale: string = "zh"
): Promise<boolean> {
  const isZh = locale === "zh";
  const subject = isZh ? "神雕农机 — 密码重置" : "UsedFarmMach — Password Reset";

  const html = isZh
    ? `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">神雕农机 — 密码重置</h2>
      <p>您好，</p>
      <p>我们收到了您的密码重置请求。请点击下方链接重置密码：</p>
      <p style="margin: 20px 0;">
        <a href="${resetLink}"
           style="display: inline-block; padding: 10px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          重置密码
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">此链接 30 分钟内有效。</p>
      <p style="color: #6b7280; font-size: 14px;">如果您没有请求重置密码，请忽略此邮件。</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">神雕农机 UsedFarmMach.com</p>
    </div>
  `
    : `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">UsedFarmMach — Password Reset</h2>
      <p>Hello,</p>
      <p>We received a password reset request. Click the link below to reset your password:</p>
      <p style="margin: 20px 0;">
        <a href="${resetLink}"
           style="display: inline-block; padding: 10px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Reset Password
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 30 minutes.</p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">UsedFarmMach.com</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text: `${isZh ? "重置密码链接" : "Reset password link"}: ${resetLink}` });
}

/**
 * 发送询盘通知给管理员
 */
export async function notifyInquiry(data: {
  productName: string;
  buyerName: string;
  buyerContact: string;
  buyerMessage: string;
}): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || "jiusei0319@gmail.com";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a365d;">新的询盘通知</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; background: #f7fafc; font-weight: bold;">产品</td>
            <td style="padding: 8px;">${data.productName}</td></tr>
        <tr><td style="padding: 8px; background: #f7fafc; font-weight: bold;">询盘人</td>
            <td style="padding: 8px;">${data.buyerName}</td></tr>
        <tr><td style="padding: 8px; background: #f7fafc; font-weight: bold;">联系方式</td>
            <td style="padding: 8px;">${data.buyerContact}</td></tr>
        <tr><td style="padding: 8px; background: #f7fafc; font-weight: bold;">留言</td>
            <td style="padding: 8px;">${data.buyerMessage}</td></tr>
      </table>
      <p style="color: #718096; font-size: 12px; margin-top: 20px;">
        来自 神雕农机 (usedfarmmach.com)
      </p>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `[询盘] ${data.productName} - ${data.buyerName}`,
    html,
    text: `新询盘 - 产品: ${data.productName}, 询盘人: ${data.buyerName}, 联系方式: ${data.buyerContact}, 留言: ${data.buyerMessage}`,
  });
}
