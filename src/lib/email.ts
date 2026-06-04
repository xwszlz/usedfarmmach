/**
 * 邮件发送服务
 * 使用 QQ邮箱SMTP 发送邮件
 * 配置在 .env 或 .env.local 中：
 *   SMTP_HOST=smtp.qq.com
 *   SMTP_PORT=465
 *   SMTP_USER=932133255@qq.com
 *   SMTP_PASS=你的QQ邮箱授权码
 *   ADMIN_EMAIL=932133255@qq.com
 */
import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST || 'smtp.qq.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '465');
const smtpUser = process.env.SMTP_USER || '932133255@qq.com';
const smtpPass = process.env.SMTP_PASS;
const adminEmail = process.env.ADMIN_EMAIL || '932133255@qq.com';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (!smtpPass) {
      console.warn('[Email] SMTP_PASS 未配置，邮件功能不可用');
      return null;
    }
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }
  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/** 发送邮件 */
export async function sendEmail(options: EmailOptions) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email] 跳过发送（未配置）: ${options.subject} -> ${options.to}`);
    return { success: false, reason: 'SMTP_PASS not configured' };
  }

  try {
    const info = await t.sendMail({
      from: `"神雕农机" <${smtpUser}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    console.log(`[Email] 发送成功: ${options.subject} -> ${options.to} (id=${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[Email] 发送失败: ${options.subject} -> ${options.to}`, error.message);
    return { success: false, error: error.message };
  }
}

/** 发送询盘通知给管理员 */
export async function notifyInquiry(data: {
  productName: string;
  buyerName: string;
  buyerContact: string;
  buyerMessage: string;
}) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a365d;">🔔 新的询盘通知</h2>
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
        来自 神雕农机二手平台 (usedfarmmach.cn)
      </p>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `[询盘] ${data.productName} - ${data.buyerName}`,
    html,
  });
}
