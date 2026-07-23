/**
 * 邮件模板（阶段 1，任务 T02）
 *
 * 纯函数：输入 vars → 返回 { subject, html, text }。
 * html 使用内联样式（兼容各邮件客户端）；text 为纯文本降级。
 * 语言经 locale 选择（至少 zh/en，与站点 8 语言策略一致，先 zh/en）。
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface BaseVars {
  link: string;
  locale: string;
}

/** 包裹通用邮件外壳（内联样式，兼容邮件客户端） */
function wrapShell(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <tr><td style="background:#0f766e;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:600;">
            神雕农机 · AgriTrade
          </td></tr>
          <tr><td style="padding:28px 24px;color:#1f2937;">
            <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">${title}</h2>
            ${contentHtml}
          </td></tr>
          <tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #eee;color:#9ca3af;font-size:12px;">
            本邮件由系统自动发送，请勿直接回复。如非本人操作，请忽略本邮件。
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** 邮箱验证邮件 */
export function renderVerifyEmail(
  vars: BaseVars & { expiresMin: number }
): EmailTemplate {
  const isZh = vars.locale !== "en";
  const subject = isZh ? "请验证您的神雕农机邮箱" : "Verify your AgriTrade email";
  const title = isZh ? "验证您的邮箱" : "Verify your email";
  const intro = isZh
    ? "感谢您使用神雕农机。请点击下方按钮验证您的邮箱地址，验证后即可使用找回密码等功能。"
    : "Thank you for using AgriTrade. Please click the button below to verify your email address. Once verified, you can use features like password recovery.";
  const expire = isZh
    ? `本链接有效期为 ${vars.expiresMin} 分钟。`
    : `This link expires in ${vars.expiresMin} minutes.`;
  const buttonText = isZh ? "验证邮箱" : "Verify Email";

  const contentHtml = `
    <p style="margin:0 0 16px;line-height:1.6;color:#374151;font-size:14px;">${intro}</p>
    <p style="margin:0 0 20px;text-align:center;">
      <a href="${vars.link}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">${buttonText}</a>
    </p>
    <p style="margin:0 0 8px;line-height:1.6;color:#6b7280;font-size:13px;">${expire}</p>
    <p style="margin:0;line-height:1.6;color:#9ca3af;font-size:12px;word-break:break-all;">${vars.link}</p>`;

  const text = `${title}\n${intro}\n${expire}\n${vars.link}`;
  return { subject, html: wrapShell(title, contentHtml), text };
}

/** 密码重置邮件 */
export function renderResetPassword(
  vars: BaseVars & { expiresMin: number }
): EmailTemplate {
  const isZh = vars.locale !== "en";
  const subject = isZh ? "神雕农机 · 密码重置链接" : "AgriTrade · Password reset link";
  const title = isZh ? "重置您的密码" : "Reset your password";
  const intro = isZh
    ? "我们收到了您的密码重置请求。请点击下方按钮设置新密码。如果您没有请求重置密码，请忽略本邮件。"
    : "We received a request to reset your password. Click the button below to set a new password. If you did not request this, please ignore this email.";
  const expire = isZh
    ? `本链接有效期为 ${vars.expiresMin} 分钟，且仅可使用一次。`
    : `This link expires in ${vars.expiresMin} minutes and can be used only once.`;
  const buttonText = isZh ? "重置密码" : "Reset Password";

  const contentHtml = `
    <p style="margin:0 0 16px;line-height:1.6;color:#374151;font-size:14px;">${intro}</p>
    <p style="margin:0 0 20px;text-align:center;">
      <a href="${vars.link}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">${buttonText}</a>
    </p>
    <p style="margin:0 0 8px;line-height:1.6;color:#6b7280;font-size:13px;">${expire}</p>
    <p style="margin:0;line-height:1.6;color:#9ca3af;font-size:12px;word-break:break-all;">${vars.link}</p>`;

  const text = `${title}\n${intro}\n${expire}\n${vars.link}`;
  return { subject, html: wrapShell(title, contentHtml), text };
}

/** 资料补全提醒邮件 */
export function renderCompleteProfileReminder(
  vars: BaseVars
): EmailTemplate {
  const isZh = vars.locale !== "en";
  const subject = isZh ? "请补全您的神雕农机资料" : "Complete your AgriTrade profile";
  const title = isZh ? "补全您的资料" : "Complete your profile";
  const intro = isZh
    ? "为了给您提供更好的服务（如找回密码、接收重要通知），建议您补全以下资料：公司名称、国家/地区等。补全并验证邮箱，还可领取积分奖励。"
    : "To serve you better (e.g. password recovery, important notifications), we recommend completing your profile: company name, country/region, and more. Completing and verifying your email also earns you credit rewards.";
  const buttonText = isZh ? "去补全资料" : "Complete Profile";

  const contentHtml = `
    <p style="margin:0 0 16px;line-height:1.6;color:#374151;font-size:14px;">${intro}</p>
    <p style="margin:0;text-align:center;">
      <a href="${vars.link}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">${buttonText}</a>
    </p>`;

  const text = `${title}\n${intro}\n${vars.link}`;
  return { subject, html: wrapShell(title, contentHtml), text };
}
