/**
 * 邮件服务商路由策略（P1 · D2：SITE-first）
 *
 * - SITE=cn：受件人属地完全不参与判定，一律走 config 选定的境内通道
 *   （tencent_ses；缺凭证 console 降级，绝不回退 Resend）。
 * - SITE=com：才调用 isDomestic() 兜底；境内收件人仍走 console（保留既有安全下限），
 *   其余按 config 走 Resend / console。
 *
 * isDomestic() 函数体保持原样不动（红线：不改属地判定逻辑，只改调用顺序）。
 */
import { ConsoleProvider, type EmailProvider } from "./provider";
import { resolveMailConfig, createProvider, type MailSiteConfig } from "./config";

export interface RoutingUser {
  country?: string | null;
  preferredLanguage?: string;
}

export interface ProviderSelection {
  provider: EmailProvider;
  name: string;
}

/** 判定是否国内收件人（原样保留，不动判定逻辑） */
function isDomestic(user: RoutingUser): boolean {
  return (
    user.country === "CN" ||
    ((!user.country || user.country === "") && user.preferredLanguage === "zh")
  );
}

/**
 * 按「构建站 + 属地」选择邮件服务商。
 * cfg 缺省时内部 resolveMailConfig()，便于单测/外部兼容单参数调用。
 */
export async function selectProviderForUser(
  user: RoutingUser,
  cfg: MailSiteConfig = resolveMailConfig()
): Promise<ProviderSelection> {
  if (cfg.site === "cn") {
    // 数据不出境：属地不参与，config 已保证这里只可能是 SES/Console
    const provider = await createProvider(cfg);
    return { provider, name: provider.name };
  }

  // .com 分支：保留既有境内 console 安全下限
  if (isDomestic(user)) {
    return { provider: new ConsoleProvider(cfg.fromEmail), name: "console" };
  }

  const provider = await createProvider(cfg);
  return { provider, name: provider.name };
}
