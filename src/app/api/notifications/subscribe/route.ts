import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyTokenEdge } from "@/lib/auth-edge";

/**
 * 推送通知订阅 API
 * POST /api/notifications/subscribe — 用户订阅通知
 * GET /api/notifications/subscribe — 获取用户订阅状态
 */

// 通知类型
const NOTIFICATION_TYPES = {
  NEW_PRODUCT: "new_product",        // 关注卖家发布新品
  SEARCH_MATCH: "search_match",      // 保存搜索有新匹配
  PRICE_DROP: "price_drop",          // 收藏产品降价
  INQUIRY_REPLY: "inquiry_reply",    // 询价回复
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = await verifyTokenEdge(token);
    const userId = payload?.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { notificationType, enabled, openid, templateIds } = body;

    if (!notificationType) {
      return NextResponse.json(
        { success: false, error: "notificationType is required" },
        { status: 400 }
      );
    }

    // 保存订阅状态（使用User模型的扩展字段或单独表）
    // 这里简化处理，使用SavedSearch表的notificationEnabled字段
    // 或者在Follow表中增加notificationEnabled字段

    if (notificationType === NOTIFICATION_TYPES.NEW_PRODUCT) {
      // 更新所有关注关系的通知开关
      await prisma.follow.updateMany({
        where: { userId },
        data: { notificationEnabled: enabled },
      });
    } else if (notificationType === NOTIFICATION_TYPES.SEARCH_MATCH) {
      // 更新所有保存搜索的通知开关
      await prisma.savedSearch.updateMany({
        where: { userId },
        data: { notifyOnNew: enabled },
      });
    }

    // 保存用户的openid用于发送订阅消息
    if (openid) {
      await prisma.user.update({
        where: { id: userId },
        data: { wxOpenid: openid } as any,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        notificationType,
        enabled,
        message: enabled ? "订阅成功" : "已取消订阅",
      },
    });
  } catch (error) {
    console.error("Subscribe notification error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = await verifyTokenEdge(token);
    const userId = payload?.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    // 查询用户的通知订阅状态
    const [followCount, searchCount, followNotiEnabled, searchNotiEnabled] = await Promise.all([
      prisma.follow.count({ where: { userId } }),
      prisma.savedSearch.count({ where: { userId } }),
      prisma.follow.count({ where: { userId, notificationEnabled: true } }),
      prisma.savedSearch.count({ where: { userId, notifyOnNew: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: {
          [NOTIFICATION_TYPES.NEW_PRODUCT]: {
            enabled: followNotiEnabled > 0,
            count: followCount,
          },
          [NOTIFICATION_TYPES.SEARCH_MATCH]: {
            enabled: searchNotiEnabled > 0,
            count: searchCount,
          },
          [NOTIFICATION_TYPES.PRICE_DROP]: {
            enabled: false,
            count: 0,
          },
          [NOTIFICATION_TYPES.INQUIRY_REPLY]: {
            enabled: true,
            count: 0,
          },
        },
      },
    });
  } catch (error) {
    console.error("Get notification status error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
