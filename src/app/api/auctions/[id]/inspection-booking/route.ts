/**
 * 议价报名 + 验车预约 API
 * POST /api/auctions/[id]/inspection-booking
 * GET  /api/auctions/[id]/inspection-booking  — 获取报名列表（卖家）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// 创建议价报名
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    let userId: string | null = null;
    if (token) {
      const user = await getUserFromToken(token);
      if (user) userId = user.id;
    }

    const body = await request.json();
    const { name, phone, preferredDate, flawConfirmed, riskConfirmed } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: "Name and phone are required" },
        { status: 400 }
      );
    }

    if (!flawConfirmed || !riskConfirmed) {
      return NextResponse.json(
        { success: false, error: "Must confirm flaws and risks" },
        { status: 400 }
      );
    }

    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: {
        product: { include: { brand: true } },
        seller: true,
      },
    });

    if (!auction) {
      return NextResponse.json(
        { success: false, error: "Auction not found" },
        { status: 404 }
      );
    }

    // 不能给自己的设备报名
    if (userId && auction.sellerId === userId) {
      return NextResponse.json(
        { success: false, error: "Cannot book inspection on your own product" },
        { status: 403 }
      );
    }

    // 检查是否已报名（同一手机号或同一用户）
    const existing = await prisma.inspectionBooking.findFirst({
      where: {
        auctionId: params.id,
        OR: [
          { phone },
          ...(userId ? [{ userId }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Already registered for this bargain" },
        { status: 409 }
      );
    }

    const booking = await prisma.inspectionBooking.create({
      data: {
        auctionId: params.id,
        userId,
        name,
        phone,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        flawConfirmed: true,
        riskConfirmed: true,
        depositAmount: auction.deposit || null,
        status: "pending",
      },
    });

    // 邮件通知卖家
    try {
      const sellerEmail = auction.seller.email || "jiusei0319@gmail.com";
      const productName = auction.product.brand
        ? `${auction.product.brand.nameZh} ${auction.product.modelName}`
        : auction.product.modelName;

      await sendEmail({
        to: sellerEmail,
        subject: `[议价报名] ${name} - ${productName}`,
        html: `
          <h2>新的议价报名</h2>
          <p><strong>公告编号：</strong>${auction.announcementNo || auction.bargainNo}</p>
          <p><strong>标的物：</strong>${productName}</p>
          <p><strong>报名人：</strong>${name}</p>
          <p><strong>手机号：</strong>${phone}</p>
          <p><strong>期望验车日期：</strong>${preferredDate || "未指定"}</p>
          <p><strong>已知瑕疵确认：</strong>已确认</p>
          <p><strong>风险自担确认：</strong>已确认</p>
          <hr>
          <p>请登录管理后台查看详情并确认保证金缴纳。</p>
        `,
        text: `议价报名：${name} ${phone} - ${productName}`,
      });
    } catch (emailErr) {
      console.error("Email notification failed:", emailErr);
    }

    return NextResponse.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Inspection booking error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create booking" },
      { status: 500 }
    );
  }
}

// 获取报名列表（卖家用）
export async function GET(
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

    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
    });

    if (!auction) {
      return NextResponse.json(
        { error: "Auction not found" },
        { status: 404 }
      );
    }

    // 只有卖家或管理员可以查看报名列表
    if (auction.sellerId !== user.id && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const bookings = await prisma.inspectionBooking.findMany({
      where: { auctionId: params.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: bookings,
      count: bookings.length,
      depositPaidCount: bookings.filter((b) => b.depositPaid).length,
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
