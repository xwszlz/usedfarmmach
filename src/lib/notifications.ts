import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export type NotificationType =
  | "inquiry_new_offer"
  | "inquiry_seller_quote"
  | "inquiry_accepted"
  | "inquiry_rejected"
  | "inquiry_booking"
  | "profile_reminder";

/**
 * 创建站内通知，并（对关键动作）附带邮件提醒。
 * link 仅存相对路径（如 /seller/inquiries），由前端按当前语言前缀渲染。
 */
export async function createNotification({
  userId,
  type,
  title,
  body,
  link,
  email,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  email?: string | null;
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
      await sendEmail({
        to: email,
        subject: title,
        html: `<div style="font-family:sans-serif;line-height:1.6">${title}${
          body ? `<p>${body}</p>` : ""
        }${link ? `<p><a href="https://usedfarmmach.com${link}">查看详情</a></p>` : ""}</div>`,
      });
    }
  } catch (e) {
    console.error("[createNotification] error:", e);
  }
}
