/**
 * 邮件配置真相源（P1 · D2 / D3）
 *
 * SITE-first 决定 provider / from / replyTo / 凭证降级：
 *   - SITE=cn  → tencent_ses（缺凭证则 console，绝不回退 Resend）
 *   - SITE=com → resend（缺 key 则 console）
 *
 * Resend 只在非 cn 分支动态 import；CN_BUILD_GUARD 为构建期常量，
 * .cn 产物中该分支被 webpack/Terser 整段消除（D3 构建期隔离）。
 */
import { SITE, type SiteVariant } from "@/config/site";
import { ConsoleProvider, TencentSesProvider } from "./provider";
import type { EmailProvider } from "./provider";

export type ProviderKind = "resend" | "tencent_ses" | "console" | "aliyun_directmail";

export interface MailSiteConfig {
  site: SiteVariant;
  providerKind: ProviderKind;
  /** no-reply@notify.usedfarmmach.{com|cn} */
  fromEmail: string;
  /** env SEND_FROM_NAME ?? "神雕农机" */
  fromName: string;
  /** env EMAIL_REPLY_TO，未配置则 undefined（默认不设 header） */
  replyTo?: string;
  /** support@usedfarmmach.{com|cn}（不带 notify. 前缀） */
  supportEmail: string;
  /** true = console 降级（缺凭证），不发真信 */
  degraded: boolean;
}

/**
 * 构建期硬守卫：next.config.js 的 env 注入会把 process.env.SITE 内联为字面量，
 * 故 .cn 产物中本常量折叠为 true，其后的 Resend 动态 import 分支被整段消除。
 * 这是「服务端统一从 @/config/site 读 SITE」约定的唯一例外，仅用于依赖消除。
 */
const CN_BUILD_GUARD: boolean = process.env.SITE === "cn";

/** 是否为 .cn 构建（供调用方只读判断） */
export function isCnBuild(): boolean {
  return CN_BUILD_GUARD || SITE === "cn";
}

/** 解析当前构建的邮件配置（纯读 env，无副作用） */
export function resolveMailConfig(): MailSiteConfig {
  const site: SiteVariant = SITE;
  const fromEmail = site === "cn"
    ? "no-reply@notify.usedfarmmach.cn"
    : "no-reply@notify.usedfarmmach.com";
  const supportEmail = site === "cn"
    ? "support@usedfarmmach.cn"
    : "support@usedfarmmach.com";
  const fromName = process.env.SEND_FROM_NAME || "神雕农机";
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;

  if (site === "cn") {
    const user = process.env.TENCENT_SES_SMTP_USER;
    const pass = process.env.TENCENT_SES_SMTP_PASS;
    const ready = Boolean(user && pass);
    return {
      site,
      providerKind: ready ? "tencent_ses" : "console",
      fromEmail,
      fromName,
      replyTo,
      supportEmail,
      degraded: !ready,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const ready = Boolean(apiKey);
  return {
    site,
    providerKind: ready ? "resend" : "console",
    fromEmail,
    fromName,
    replyTo,
    supportEmail,
    degraded: !ready,
  };
}

/** 按配置构造 provider；凭证缺失时一律 console，绝不真发 */
export async function createProvider(cfg: MailSiteConfig): Promise<EmailProvider> {
  if (CN_BUILD_GUARD || SITE === "cn") {
    // .cn 构建：此分支恒真，下方 Resend 分支由编译器消除（D3）。
    if (cfg.providerKind === "tencent_ses") {
      return new TencentSesProvider({
        user: process.env.TENCENT_SES_SMTP_USER || "",
        pass: process.env.TENCENT_SES_SMTP_PASS || "",
        host: process.env.TENCENT_SES_SMTP_HOST || "smtp.qcloudmail.com",
        port: Number(process.env.TENCENT_SES_SMTP_PORT || "465"),
        from: cfg.fromEmail,
        fromName: cfg.fromName,
        replyTo: cfg.replyTo,
      });
    }
    return new ConsoleProvider(cfg.fromEmail);
  }

  // .com 分支：.cn 产物中不存在以下代码
  if (cfg.providerKind === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return new ConsoleProvider(cfg.fromEmail);
    const { ResendProvider } = await import("./provider-resend");
    return new ResendProvider(apiKey, cfg.fromEmail, cfg.replyTo);
  }
  return new ConsoleProvider(cfg.fromEmail);
}
