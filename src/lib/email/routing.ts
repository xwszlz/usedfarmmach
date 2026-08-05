/**
 * 邮件服务商路由策略（P1-c C1 路由框架，T01/T04）
 *
 * 设计：业务代码（sendTemplateEmail）零改动，路由判定在抽象层完成。
 * 按【收件人属地 / 语言】选择 provider：
 *   - 国内（country==='CN' 或 空且 locale==='zh'）→ 国内通道
 *   - 其他 → Resend（境外）
 * 合规红线：备案前国内通道一律降级 ConsoleProvider，绝不真正出境 / 绝不落明文 PII。
 */
import { ConsoleProvider, ResendProvider, type EmailProvider } from "./provider";

export interface RoutingUser {
  country?: string | null;
  preferredLanguage?: string;
}

/** 判定是否国内收件人 */
function isDomestic(user: RoutingUser): boolean {
  return (
    user.country === "CN" ||
    ((!user.country || user.country === "") && user.preferredLanguage === "zh")
  );
}

/**
 * 按收件人属地选择邮件服务商（C1 版本）。
 * - 国内：真实国内发送需 ICP+域名备案（C2）。备案前一律降级 ConsoleProvider，
 *   保证不发信、不真正出境，满足「绝不出境」红线。
 * - 国际：Resend；无 key 降级 ConsoleProvider。
 */
export function selectProviderForUser(
  user: RoutingUser,
): { provider: EmailProvider; name: string } {
  const from = process.env.EMAIL_FROM || "no-reply@usedfarmmach.com";
  const domestic = isDomestic(user);

  if (domestic) {
    // C1：国内通道接入点已注册（见 provider.ts 的 createDomesticProvider），
    // 但真实发送需备案后由 C2 启用。备案前统一降级 console，绝不出境。
    return { provider: new ConsoleProvider(from), name: "console" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { provider: new ConsoleProvider(from), name: "console" };
  }
  return { provider: new ResendProvider(apiKey, from), name: "resend" };
}
