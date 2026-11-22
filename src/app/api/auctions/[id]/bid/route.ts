/**
 * 询价/报价 API（合规改造版）
 * POST /api/auctions/[id]/bid
 * { amount: number }
 *
 * 改造要点（根据法务审查报告）：
 * 1. 移除最低启动人数检查 — 不再有"满N人启动"
 * 2. 移除必须确认报名+保证金才能报价的限制 — 平台不设保证金
 * 3. 报价金额只校验 > 0，不校验是否高于当前最高价 — 非竞价模式
 * 4. 保留基础校验：登录、不能给自己报价、询价状态active
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { resolveInquiryRecipient } from "@/lib/products/contact-visibility";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid offer amount" }, { status: 400 });
    }

    const bargain = await prisma.auction.findUnique({
      where: { id: params.id },
      include: {
        seller: { select: { id: true, email: true, preferredLanguage: true } },
        product: {
          select: {
            modelName: true,
            brand: { select: { nameZh: true, nameEn: true } },
            // 2026-11-22：询价通知优先发到卖家验证过的联系邮箱（原实现只发 seller.email，
            // 卖家在发布页填的邮箱填了也收不到询价，是真实线上 bug）
            contactEmail: true,
            contactEmailPublic: true,
            contactEmailVerifiedAt: true,
          },
        },
      },
    });

    if (!bargain) {
      return NextResponse.json({ error: "Bargain not found" }, { status: 404 });
    }

    // 检查询价状态
    if (bargain.status !== "active") {
      return NextResponse.json(
        { error: "This inquiry is no longer active" },
        { status: 400 }
      );
    }

    // 不能给自己的设备报价
    if (bargain.sellerId === user.id) {
      return NextResponse.json(
        { error: "Cannot make an offer on your own product" },
        { status: 403 }
      );
    }

    // 合规改造：不再检查报名状态和保证金
    // 买家可自由报价，保证金由买卖双方自行约定（平台不介入）

    // 创建报价（询价模式：不要求高于当前最高价）
    const bid = await prisma.bid.create({
      data: {
        auctionId: params.id,
        bidderId: user.id,
        amount: parseFloat(amount),
      },
    });

    // 更新询价统计
    const bidCount = await prisma.bid.count({
      where: { auctionId: params.id },
    });
    const bidderCount = await prisma.bid.groupBy({
      by: ["bidderId"],
      where: { auctionId: params.id },
    });

    await prisma.auction.update({
      where: { id: params.id },
      data: {
        totalBids: bidCount,
        totalBidders: bidderCount.length,
      },
    });

    // 通知卖家收到新报价（站内信 + 邮件）
    const pName = `${bargain.product.brand?.nameZh || bargain.product.brand?.nameEn || ""} ${bargain.product.modelName}`.trim();
    // 收件人优先级：已验证的 contactEmail > 账号邮箱（未验证的 contactEmail 永不投递）
    const recipient = resolveInquiryRecipient({
      product: bargain.product,
      sellerEmail: bargain.seller.email,
    });
    await createNotification({
      userId: bargain.sellerId,
      type: "inquiry_new_offer",
      title: "收到新的询价报价",
      body: `${pName}：买家报价 ¥${parseFloat(amount).toLocaleString()}`,
      link: "/seller/inquiries",
      email: recipient.email,
      // 卖家点「回复」直接回到买家（.cn 无 inbound 解析，只能填买家真实邮箱；
      // 代价是卖家能看到买家邮箱，P2 才在 .com 侧做匿名转发）
      replyTo: user.email,
      origin: request.nextUrl.origin,
      locale: bargain.seller.preferredLanguage || "zh",
    });

    return NextResponse.json({
      success: true,
      data: bid,
      message: "Offer submitted successfully. Seller will review and respond.",
    });
  } catch (error) {
    console.error("Offer error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit offer" },
      { status: 500 }
    );
  }
}
