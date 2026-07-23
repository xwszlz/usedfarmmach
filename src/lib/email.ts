/**
 * 邮件发送门面（阶段 1，任务 T02）
 *
 * 双模式 facade（向后兼容 + 阶段 1 模板）：
 *   1) 旧式原始发送 sendEmail({ to, subject, html, text }) → Promise<boolean>
 *      —— 供阶段 0 既有 7 处调用（询盘告警 / 订阅 / 拍卖等）无缝复用，行为不变。
 *   2) 阶段 1 模板发送 sendEmail({ to, template, vars, userId?, ip?, locale? }) → Promise<{ok,error?}>
 *      —— 经 provider 抽象渲染模板、发信、写 EmailSendLog（收件邮箱 SHA-256 摘要）。
 *
 * 合规（共享知识 §6/§12）：模板发送不写 PiiAuditLog（非人读 PII），
 * 改写 EmailSendLog（仅存收件邮箱 hash），避免二次扩散 PII。
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import {
  ResendProvider,
  ConsoleProvider,
  AliyunDirectMailProvider,
  TencentSesProvider,
  type EmailProvider,
} from "./email/provider";
import {
  renderVerifyEmail,
  renderResetPassword,
  renderCompleteProfileReminder,
} from "./email/templates";

// ─── 阶段 1 模板类型 ───────────────────────────────────────
export type EmailTemplateName =
  | "verifyEmail"
  | "resetPassword"
  | "completeProfileReminder";

/** 阶段 1 模板发信选项 */
export interface SendEmailOptions {
  to: string;
  template: EmailTemplateName;
  vars: Record<string, string>;
  userId?: string;
  ip?: string;
  locale?: string;
}

/** 旧式原始发信参数（向后兼容） */
export interface LegacySendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** 邮件类型 → EmailSendLog.type 映射 */
const TYPE_MAP: Record<EmailTemplateName, string> = {
  verifyEmail: "verify_email",
  resetPassword: "reset_password",
  completeProfileReminder: "complete_profile_reminder",
};

/** SHA-256（小写十六进制），用于收件邮箱摘要，绝不存明文 */
export function sha256Email(input: string): string {
  return createHash("sha256").update(input.toLowerCase()).digest("hex");
}

/** 按 env 选择 provider（缺 key 时降级 console） */
function selectProvider(): { provider: EmailProvider; name: string } {
  const env = (process.env.EMAIL_PROVIDER || "resend").toLowerCase();
  const from = process.env.EMAIL_FROM || "no-reply@usedfarmmach.com";
  const apiKey = process.env.RESEND_API_KEY;

  switch (env) {
    case "aliyun_directmail":
      return { provider: new AliyunDirectMailProvider(), name: "aliyun_directmail" };
    case "tencent_ses":
      return { provider: new TencentSesProvider(), name: "tencent_ses" };
    case "resend":
    default:
      if (!apiKey) {
        // 降级：本地 / 测试环境无 key 时打到 console，保证流程可跑通
        return { provider: new ConsoleProvider(from), name: "console" };
      }
      return { provider: new ResendProvider(apiKey, from), name: "resend" };
  }
}

/**
 * 旧式原始发送（向后兼容阶段 0 既有调用）。
 * 未配置 RESEND_API_KEY 时降级为控制台日志（开发环境）。
 */
async function sendRawEmail(
  params: LegacySendEmailParams
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // 开发环境降级：打印到控制台
    // eslint-disable-next-line no-console
    console.warn("[email] RESEND_API_KEY not set, skipping email send:");
    // eslint-disable-next-line no-console
    console.warn(`[email] To: ${params.to}, Subject: ${params.subject}`);
    // eslint-disable-next-line no-console
    console.warn(`[email] Text: ${params.text || "(no text version)"}`);
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
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      // eslint-disable-next-line no-console
      console.error("[email] Resend API error:", response.status, errorData);
      return false;
    }

    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[email] Send failed:", error);
    return false;
  }
}

/**
 * 阶段 1 模板发信：渲染模板 → 选 provider → 发信 → 写 EmailSendLog。
 * 不论成功失败均写日志（status=sent/failed），便于排查与合规追溯。
 */
async function sendTemplateEmail(
  opts: SendEmailOptions
): Promise<{ ok: boolean; error?: string }> {
  const locale = opts.locale || "zh";
  const template = opts.template;

  let subject = "";
  let html = "";
  let text = "";

  switch (template) {
    case "verifyEmail":
      {
        const r = renderVerifyEmail({
          link: opts.vars.link ?? "",
          expiresMin: Number(opts.vars.expiresMin ?? "1440"),
          locale,
        });
        subject = r.subject;
        html = r.html;
        text = r.text;
      }
      break;
    case "resetPassword":
      {
        const r = renderResetPassword({
          link: opts.vars.link ?? "",
          expiresMin: Number(opts.vars.expiresMin ?? "30"),
          locale,
        });
        subject = r.subject;
        html = r.html;
        text = r.text;
      }
      break;
    case "completeProfileReminder":
      {
        const r = renderCompleteProfileReminder({
          link: opts.vars.link ?? "",
          locale,
        });
        subject = r.subject;
        html = r.html;
        text = r.text;
      }
      break;
  }

  const selected = selectProvider();
  const providerName = selected.name;
  const recipientHash = sha256Email(opts.to);
  const type = TYPE_MAP[template];

  const writeLog = async (status: string): Promise<void> => {
    try {
      await prisma.emailSendLog.create({
        data: {
          userId: opts.userId ?? null,
          type,
          provider: providerName,
          recipientHash,
          status,
          ip: opts.ip ?? null,
        },
      });
    } catch (logErr) {
      // eslint-disable-next-line no-console
      console.error("[Email] 写 EmailSendLog 失败:", logErr);
    }
  };

  try {
    await selected.provider.send({ to: opts.to, subject, html, text });
    await writeLog("sent");
    return { ok: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown email error";
    // eslint-disable-next-line no-console
    console.error("[Email] 发送失败:", message);
    await writeLog("failed");
    return { ok: false, error: message };
  }
}

// ─── 重载 facade：双模式共存，调用方按入参自动匹配 ───
export async function sendEmail(
  params: LegacySendEmailParams
): Promise<boolean>;
export async function sendEmail(
  opts: SendEmailOptions
): Promise<{ ok: boolean; error?: string }>;
export async function sendEmail(
  params: LegacySendEmailParams | SendEmailOptions
): Promise<boolean | { ok: boolean; error?: string }> {
  if (params && typeof (params as SendEmailOptions).template === "string") {
    return sendTemplateEmail(params as SendEmailOptions);
  }
  return sendRawEmail(params as LegacySendEmailParams);
}

/**
 * 询盘管理员告警（阶段 0 既有能力；门面重构后恢复此导出，避免 inquiries/route.ts 编译失败）。
 * 采用旧式原始发信（LegacySendEmailParams）通知管理员，不写 EmailSendLog（非阶段 1 模板）。
 * 收件人为后台管理员邮箱（env ADMIN_EMAIL，缺省 jiusei0319@gmail.com）。
 */
export async function notifyInquiry(params: {
  productName: string;
  buyerName: string;
  buyerContact: string;
  buyerMessage: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || "jiusei0319@gmail.com";
  const subject = `[询盘] ${params.productName} - ${params.buyerName}`;
  const text =
    `产品：${params.productName}\n` +
    `买家：${params.buyerName}\n` +
    `联系方式：${params.buyerContact}\n` +
    `留言：${params.buyerMessage}`;
  const html =
    `<p><strong>产品：</strong>${escapeHtml(params.productName)}</p>` +
    `<p><strong>买家：</strong>${escapeHtml(params.buyerName)}</p>` +
    `<p><strong>联系方式：</strong>${escapeHtml(params.buyerContact)}</p>` +
    `<p><strong>留言：</strong>${escapeHtml(params.buyerMessage)}</p>`;
  try {
    await sendEmail({ to: adminEmail, subject, html, text });
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error("[email] notifyInquiry 发送失败:", err);
  }
}

/** 极简 HTML 转义，避免询盘内容注入邮件模板 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
