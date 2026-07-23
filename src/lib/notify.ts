/**
 * 通知层（阶段 0）
 *
 * - createInAppNotification：真实写入 Notification 模型（站内信）
 * - sendWechatSubscribeMessage：stub（小程序订阅消息，阶段 1/2 接入）
 *
 * 共享知识 §7：管理员重置只走站内信（写 Notification）+ 订阅消息 stub，不发邮件。
 */
import { prisma } from "@/lib/db";

/** 站内信输入 */
export interface InAppNotificationInput {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/** 写站内信（Notification 模型） */
export async function createInAppNotification(input: InAppNotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    },
  });
}

/** 小程序订阅消息输入 */
export interface WechatSubscribeInput {
  userId: string;
  templateId: string;
  data: Record<string, unknown>;
}

/**
 * 小程序订阅消息（stub）。
 * 阶段 0 仅留接口；调用即返回未实现，不抛错。
 */
export async function sendWechatSubscribeMessage(
  _input: WechatSubscribeInput
): Promise<{ delivered: false; reason: "not_implemented" }> {
  return { delivered: false, reason: "not_implemented" };
}
