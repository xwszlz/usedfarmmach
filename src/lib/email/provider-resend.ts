/**
 * Resend Provider —— 仅 .com 构建可用（P1 · D3 构建期隔离）
 *
 * 本文件由 provider.ts 迁出，只在 config.ts 的非 cn 分支动态 import。
 * .cn 构建时该分支由编译器整段消除，产物中不含 Resend SDK / api.resend.com。
 */
import type { Resend } from "resend";
import type { EmailInput, EmailProvider, EmailSendResult } from "./provider";

/** Resend 邮件服务商（API key 走 env RESEND_API_KEY） */
export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend | null = null;
  private readonly apiKey: string;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(apiKey: string, from: string, replyTo?: string) {
    this.apiKey = apiKey;
    this.from = from;
    this.replyTo = replyTo;
  }

  async send(input: EmailInput): Promise<EmailSendResult> {
    // D3 构建期隔离：webpackIgnore 让 SDK 在运行时从 node_modules 加载，
    // 不生成包含 api.resend.com 的 async chunk（.cn 产物物理零命中）。
    const resendPkg = "resend";
    const { Resend } = (await import(/* webpackIgnore: true */ resendPkg)) as typeof import("resend");
    if (!this.client) {
      this.client = new Resend(this.apiKey);
    }

    const replyTo = input.replyTo ?? this.replyTo;
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(replyTo ? { replyTo } : {}),
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
