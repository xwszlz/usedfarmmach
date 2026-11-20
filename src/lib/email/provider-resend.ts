/**
 * Resend Provider —— 仅 .com 构建可用（P1 · D3 构建期隔离）
 *
 * 本文件由 provider.ts 迁出，只在 config.ts 的非 cn 分支动态 import。
 * .cn 构建时该分支由编译器整段消除，产物中不含 Resend 端点。
 *
 * ⚠️ 为什么直连 REST、不用 npm 包 `resend`（2026-11-20 线上事故复盘）：
 * 旧实现是一个「包名走变量 + 让打包器忽略」的动态 import（webpackIgnore 注释），
 * 这样确实绕开了 webpack，但也**同时**让 Vercel 的 @vercel/nft 依赖追踪看不见它，
 * 函数产物里没有 node_modules/resend，运行时抛 ERR_MODULE_NOT_FOUND:
 * Cannot find package 'resend'，而该异常又被 src/lib/email.ts 的 try/catch 吞掉，
 * 导致「发信功能自上线起从未成功过一次，但所有接口都返回 success:true」。
 *
 * 改直连 REST 后：
 *   1. 零 npm 依赖 ⇒ 不可能再出现「nft 追踪不到包」这一类故障；
 *   2. 省掉 resend SDK 及其 @react-email/render 依赖树，函数体积更小；
 *   3. 错误信息带 HTTP 状态码与原报文，排障不再靠猜。
 */
import type { EmailInput, EmailProvider, EmailSendResult } from "./provider";

/** Resend 发信端点（官方 REST，无需 SDK） */
const RESEND_ENDPOINT = "https://api.resend.com/emails";
/** 单次发信超时：Vercel 函数默认 10s，留出余量后主动中断，避免整体挂死 */
const SEND_TIMEOUT_MS = 8_000;

interface ResendSuccessBody {
  id?: string;
}
interface ResendErrorBody {
  message?: string;
  name?: string;
  statusCode?: number;
}

/** Resend 邮件服务商（API key 走 env RESEND_API_KEY） */
export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private readonly apiKey: string;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(apiKey: string, from: string, replyTo?: string) {
    this.apiKey = apiKey;
    this.from = from;
    this.replyTo = replyTo;
  }

  async send(input: EmailInput): Promise<EmailSendResult> {
    const replyTo = input.replyTo ?? this.replyTo;

    const payload: Record<string, unknown> = {
      from: this.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    };
    // Resend REST 用 snake_case（reply_to），与 SDK 的 camelCase 不同，别写错。
    if (input.text) payload.text = input.text;
    if (replyTo) payload.reply_to = replyTo;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    try {
      let res: Response;
      try {
        res = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Resend 请求未完成（网络/超时 ${SEND_TIMEOUT_MS}ms）: ${reason}`);
      }

      const raw = await res.text();
      let body: unknown = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        // 非 JSON 响应（网关错误页等）保留原文，下面按状态码报错
      }

      if (!res.ok) {
        const message =
          (body as ResendErrorBody | null)?.message ||
          raw.slice(0, 500) ||
          res.statusText ||
          "unknown error";
        throw new Error(`Resend 拒收（HTTP ${res.status}）: ${message}`);
      }

      const id = (body as ResendSuccessBody | null)?.id;
      return { id: typeof id === "string" ? id : null, provider: this.name };
    } finally {
      clearTimeout(timer);
    }
  }
}
