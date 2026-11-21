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
import { SITE, siteConfigMap, type SiteVariant } from "@/config/site";
import { ConsoleProvider, TencentSesProvider } from "./provider";
import type { EmailProvider } from "./provider";

export type ProviderKind = "resend" | "tencent_ses" | "console" | "aliyun_directmail";

export interface MailSiteConfig {
  site: SiteVariant;
  providerKind: ProviderKind;
  /** .cn=support@shendiaotech.cn / .com=support@usedfarmmach.com（= supportEmail，单一真源见 site.ts） */
  fromEmail: string;
  /** env SEND_FROM_NAME ?? "UsedFarmMach"(.com) / "神雕农机"(.cn) */
  fromName: string;
  /** env EMAIL_REPLY_TO ?? supportEmail（默认回落客服地址，客户点回复直达 Inbox） */
  replyTo?: string;
  /** .cn=support@shendiaotech.cn / .com=support@usedfarmmach.com（不带 notify. 前缀） */
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
  // 单一真源：发件人与客服地址都取自 siteConfigMap，避免与 site.ts 双份硬编码漂移。
  const siteCfg = siteConfigMap[site];
  const fromEmail = siteCfg.systemFromEmail;
  const supportEmail = siteCfg.supportEmail;
  // 显示名按站分流：.com 面向海外用英文品牌名，.cn 用中文品牌名。
  const fromName =
    process.env.SEND_FROM_NAME || (site === "cn" ? "神雕农机" : "UsedFarmMach");
  // 回复地址默认回落客服邮箱：客户点「回复」直达 support 收件箱，不再石沉大海。
  const replyTo = process.env.EMAIL_REPLY_TO || supportEmail;

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
        // 🔴 默认值 = **腾讯企业邮**（exmail），不是腾讯云 SES（qcloudmail）。
        //    2026-11-21 老板改用企业微信企业邮免费版：IMAP imap.exmail.qq.com:993、
        //    SMTP smtp.exmail.qq.com:465(SSL)。两者账号体系完全不同，连错服务器
        //    表现是 `535 Authentication failed`，看起来像密码错、其实地址错。
        //    环境变量名沿用 TENCENT_SES_* 是为了不破坏既有部署，语义已是「腾讯系 SMTP」。
        host: process.env.TENCENT_SES_SMTP_HOST || "smtp.exmail.qq.com",
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
    // 显示名必须拼进 From 头：Resend 只收完整 header，不像 SES 那样分 from/fromName 两参。
    // env 里已带 "<...>" 的（历史写法）原样透传，避免二次包装成 "Name <Name <addr>>"。
    if (/<[^>]+>/.test(cfg.fromEmail)) {
      return new ResendProvider(apiKey, cfg.fromEmail, cfg.replyTo);
    }
    const fromHeader = cfg.fromName
      ? `${cfg.fromName} <${cfg.fromEmail}>`
      : cfg.fromEmail;
    return new ResendProvider(apiKey, fromHeader, cfg.replyTo);
  }
  return new ConsoleProvider(cfg.fromEmail);
}
