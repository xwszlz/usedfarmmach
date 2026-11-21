/**
 * 邮件发送 Provider 抽象层（P1 · T02）
 *
 * 本文件只保留运行时抽象与「国内/降级」实现；ResendProvider 已迁出到
 * provider-resend.ts，仅由 config.ts 在非 cn 分支动态 import（D3 构建期隔离）。
 * 所有邮件经 src/lib/email.ts 门面发出，组件/路由禁止直接 new Resend()/createTransport()。
 */
import { resolveMailConfig } from "./config";

/** 发送输入 */
export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/** 发送结果 */
export interface EmailSendResult {
  id: string | null;
  provider: string;
}

/** 邮件 Provider 接口 */
export interface EmailProvider {
  readonly name: string;
  send(input: EmailInput): Promise<EmailSendResult>;
}

/**
 * Console Provider：RESEND_API_KEY 缺失时的降级方案。
 * 把渲染后的邮件（to/subject/text）打印到 server console，不真正外发，
 * 便于本地开发 / 测试完整跑通流程（无需真实 key）。
 */
export class ConsoleProvider implements EmailProvider {
  readonly name = "console";
  private readonly from: string;

  constructor(from: string) {
    this.from = from;
  }

  async send(input: EmailInput): Promise<EmailSendResult> {
    // eslint-disable-next-line no-console
    console.log(
      `[Email:Console] from=${this.from} to=${input.to} subject=${input.subject}`
    );
    // eslint-disable-next-line no-console
    console.log(`[Email:Console] text:\n${input.text ?? ""}`);
    return { id: `console_${Date.now()}`, provider: this.name };
  }
}

/**
 * 阿里云 DirectMail Provider（阶段 2 / ICP 备案后启用，先留接口）。
 */
export class AliyunDirectMailProvider implements EmailProvider {
  readonly name = "aliyun_directmail";
  async send(_input: EmailInput): Promise<EmailSendResult> {
    throw new Error("Aliyun DirectMail provider is not implemented yet");
  }
}

/** 腾讯云 SES SMTP 连接参数（授权码，不是 SecretKey） */
export interface TencentSesConfig {
  user: string;
  pass: string;
  host: string;
  port: number;
  from: string;
  fromName?: string;
  replyTo?: string;
}

/**
 * 腾讯云 SES Provider（P1 · D3）
 * 动态 import nodemailer → createTransport(465/SSL) → sendMail()；
 * 错误向上抛，由 facade 写 failed 日志。
 */
export class TencentSesProvider implements EmailProvider {
  readonly name = "tencent_ses";
  private readonly cfg: TencentSesConfig;

  constructor(cfg: TencentSesConfig) {
    this.cfg = cfg;
  }

  async send(input: EmailInput): Promise<EmailSendResult> {
    const mod = await import("nodemailer");
    const transport = (
      mod as unknown as {
        createTransport: (opts: Record<string, unknown>) => {
          sendMail: (mail: Record<string, unknown>) => Promise<{ messageId?: string }>;
        };
      }
    ).createTransport({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: true,
      auth: { user: this.cfg.user, pass: this.cfg.pass },
    });

    const from = this.cfg.fromName
      ? `${this.cfg.fromName} <${this.cfg.from}>`
      : this.cfg.from;
    const replyTo = input.replyTo ?? this.cfg.replyTo;
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(replyTo ? { replyTo } : {}),
    });

    return { id: typeof info.messageId === "string" ? info.messageId : null, provider: this.name };
  }
}

/**
 * 国内 provider 工厂（保留导出兼容）；P1 起委托 resolveMailConfig()，
 * .cn 直接返回 SES / Console，不再使用 EMAIL_PROVIDER_DOMESTIC 作为路由主依据。
 */
export function createDomesticProvider(): EmailProvider {
  const cfg = resolveMailConfig();
  if (cfg.site === "cn" && cfg.providerKind === "tencent_ses") {
    return new TencentSesProvider({
      user: process.env.TENCENT_SES_SMTP_USER || "",
      pass: process.env.TENCENT_SES_SMTP_PASS || "",
      // 默认值与企业邮对齐（2026-11-21）：见 config.ts 同处说明，漏填 HOST 也不会连错服务器。
      host: process.env.TENCENT_SES_SMTP_HOST || "smtp.exmail.qq.com",
      port: Number(process.env.TENCENT_SES_SMTP_PORT || "465"),
      from: cfg.fromEmail,
      fromName: cfg.fromName,
      replyTo: cfg.replyTo,
    });
  }
  return new ConsoleProvider(cfg.fromEmail);
}
