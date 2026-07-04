import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * 推送通知发送 API（定时任务触发）
 * POST /api/notifications/send — 检查并发送通知
 *
 * 触发方式：
 * 1. Vercel Cron Jobs (vercel.json 配置)
 * 2. 手动调用
 *
 * 逻辑：
 * 1. 查找所有 notificationEnabled=true 的 Follow 记录
 * 2. 查找该卖家在上次检查后发布的新产品
 * 3. 通过微信API发送订阅消息
 */

const WECHAT_TEMPLATE_IDS = {
  NEW_PRODUCT: "tmpl_new_product_001",      // 新品通知模板
  SEARCH_MATCH: "tmpl_search_match_001",     // 搜索匹配模板
};

export async function POST(req: NextRequest) {
  try {
    // 验证调用权限（API密钥或Vercel Cron）
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    let notificationsSent = 0;
    let notificationsChecked = 0;

    // 1. 检查关注卖家的用户的新品通知
    const follows = await prisma.follow.findMany({
      where: { notificationEnabled: true },
      include: {
        seller: { select: { id: true, companyName: true, wxOpenid: true } },
        user: { select: { id: true, wxOpenid: true } },
      },
      take: 100,
    });

    for (const follow of follows) {
      notificationsChecked++;
      
      // 查找该卖家在最近24小时内发布的新产品
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const newProducts = await prisma.product.findMany({
        where: {
          sellerId: follow.sellerId,
          status: "active",
          createdAt: { gte: oneDayAgo },
        },
        select: { id: true, modelName: true, priceCny: true, brand: { select: { nameZh: true, nameEn: true } } },
        take: 5,
      });

      if (newProducts.length === 0) continue;

      // 检查是否已发送过通知（避免重复）
      // 使用ProductNotification记录（如果有的话）
      // 这里简化处理

      if (follow.user.wxOpenid) {
        // 调用微信API发送订阅消息
        for (const product of newProducts) {
          await sendWechatSubscribeMessage(follow.user.wxOpenid, WECHAT_TEMPLATE_IDS.NEW_PRODUCT, {
            thing1: { value: `${product.brand?.nameZh || product.brand?.nameEn || ""} ${product.modelName}`.trim() },
            thing2: { value: follow.seller.companyName || "卖家" },
            amount3: { value: product.priceCny ? `¥${product.priceCny.toLocaleString()}` : "面议" },
            time4: { value: new Date().toLocaleString("zh-CN") },
          });
          notificationsSent++;
        }
      }
    }

    // 2. 检查保存搜索的新匹配产品通知
    const savedSearches = await prisma.savedSearch.findMany({
      where: { notifyOnNew: true },
      include: {
        user: { select: { id: true, wxOpenid: true } },
      },
      take: 50,
    });

    for (const search of savedSearches) {
      notificationsChecked++;
      
      if (!search.user.wxOpenid) continue;

      // 解析搜索条件并查询匹配的新产品
      const searchCriteria = search.filters as any;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const where: any = {
        status: "active",
        createdAt: { gte: oneDayAgo },
      };

      if (searchCriteria?.brandId) where.brandId = searchCriteria.brandId;
      if (searchCriteria?.categoryId) where.categoryId = searchCriteria.categoryId;
      if (searchCriteria?.minPrice || searchCriteria?.maxPrice) {
        where.priceCny = {};
        if (searchCriteria?.minPrice) where.priceCny.gte = searchCriteria.minPrice;
        if (searchCriteria?.maxPrice) where.priceCny.lte = searchCriteria.maxPrice;
      }

      const matchingProducts = await prisma.product.findMany({
        where,
        take: 3,
        select: { id: true, modelName: true, priceCny: true },
      });

      if (matchingProducts.length === 0) continue;

      await sendWechatSubscribeMessage(search.user.wxOpenid, WECHAT_TEMPLATE_IDS.SEARCH_MATCH, {
        thing1: { value: search.name || "保存的搜索" },
        thing2: { value: `${matchingProducts.length}个新匹配` },
        time3: { value: new Date().toLocaleString("zh-CN") },
      });
      notificationsSent++;
    }

    return NextResponse.json({
      success: true,
      data: {
        notificationsChecked,
        notificationsSent,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Send notifications error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 调用微信API发送订阅消息
 */
async function sendWechatSubscribeMessage(
  openid: string,
  templateId: string,
  data: Record<string, { value: string }>
) {
  try {
    const accessToken = await getWechatAccessToken();
    if (!accessToken) {
      console.error("Failed to get WeChat access token");
      return;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
    const body = {
      touser: openid,
      template_id: templateId,
      // page: "pages/index/index",
      data,
      miniprogram_state: "formal", // formal | trial | developer
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await res.json();
    if (result.errcode !== 0) {
      console.error("WeChat subscribe message error:", result);
    }
  } catch (error) {
    console.error("Send WeChat message error:", error);
  }
}

/**
 * 获取微信access_token
 */
async function getWechatAccessToken(): Promise<string | null> {
  try {
    const appId = process.env.WX_APP_ID;
    const appSecret = process.env.WX_APP_SECRET;
    if (!appId || !appSecret) return null;

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}
