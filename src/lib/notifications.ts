import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { siteConfig } from "@/config/site";

export type NotificationType =
  | "inquiry_new_offer"
  | "inquiry_seller_quote"
  | "inquiry_accepted"
  | "inquiry_rejected"
  | "inquiry_booking"
  | "profile_reminder";

/**
 * 创建站内通知，并（对关键动作）附带邮件提醒。
 * link 仅存相对路径（如 /seller/inquiries），由前端按当前语言前缀渲染；
 * 邮件正文里的绝对链接在发送时按「站点 origin + 收件人 locale」补全，
 * 避免硬编码 .com（.cn 用户被引到境外站）与缺 locale 前缀导致 404。
 */
export async function createNotification({
  userId,
  type,
  title,
  body,
  link,
  email,
  origin,
  locale,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  email?: string | null;
  /** 站点 origin（如 https://usedfarmmach.cn）；由调用方从 request.nextUrl.origin 传入 */
  origin?: string;
  /** 收件人语种（如 zh）；缺省回退 "zh" */
  locale?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body, link },
    });

    // 关键动作附带邮件提醒
    const emailTypes: NotificationType[] = [
      "inquiry_new_offer",
      "inquiry_seller_quote",
      "inquiry_accepted",
    ];
    if (email && emailTypes.includes(type)) {
      // 邮件里的绝对链接：站点感知 origin + 收件人 locale + 相对 link。
      // 注意：落库的 link 仍是相对路径（站内信由前端 notification-bell 补 `/${locale}` 前缀），
      // 这里生成的 href 只用于邮件正文，避免硬编码 .com 与缺 locale 前缀导致 404。
      const mailOrigin =
        origin ||
        process.env.NEXT_PUBLIC_APP_URL ||
        `https://${siteConfig.domains.primary}`;
      const mailLocale = locale || "zh";
      const href = link ? `${mailOrigin}/${mailLocale}${link}` : null;

      await sendEmail({
        to: email,
        subject: title,
        html: `<div style="font-family:sans-serif;line-height:1.6">${title}${
          body ? `<p>${body}</p>` : ""
        }${href ? `<p><a href="${href}">查看详情</a></p>` : ""}</div>`,
      });
    }
  } catch (e) {
    console.error("[createNotification] error:", e);
  }
}
