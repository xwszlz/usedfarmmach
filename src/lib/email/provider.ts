/**
 * 邮件发送 Provider 抽象层（阶段 1，任务 T02）
 *
 * 共享知识 §2：所有邮件经 src/lib/email.ts 门面发出，组件/路由禁止直接 new Resend()。
 * 新增服务商只需在此加实现类 + 在 email.ts 注册，业务代码零改动。
 *
 * 阶段 1 仅 resend 生效；当 RESEND_API_KEY 缺失时，email.ts 自动降级为
 * ConsoleProvider（把渲染后的邮件打到 server console），保证本地开发与测试流程跑通。
 */
// 类型仅用于编译期；运行时经动态 import("resend") 延迟加载，
// 仅当启用 ResendProvider 且 resend 已安装时才真正解析模块，
// 避免本地未安装 resend 时模块加载失败（见 src/types/resend.d.ts）。
import type { Resend } from "resend";

/** 发送输入 */
export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
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

/** Resend Provider（Resend Node SDK，API key 走 env RESEND_API_KEY） */
export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend | null = null;
  private readonly apiKey: string;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(input: EmailInput): Promise<EmailSendResult> {
    // 延迟加载 resend（仅真正发信时构造），避免未安装即触发模块解析。
    const { Resend } = await import("resend");
    if (!this.client) {
      this.client = new Resend(this.apiKey);
    }

    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      const message =
        typeof error === "string"
          ? error
          : (error as { message?: string }).message;
      throw new Error(message || "Resend send failed");
    }

    return { id: data?.id ?? null, provider: this.name };
  }
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

/**
 * 腾讯云 SES Provider（阶段 2 / ICP 备案后启用，先留接口）。
 */
export class TencentSesProvider implements EmailProvider {
  readonly name = "tencent_ses";
  async send(_input: EmailInput): Promise<EmailSendResult> {
    throw new Error("Tencent SES provider is not implemented yet");
  }
}
