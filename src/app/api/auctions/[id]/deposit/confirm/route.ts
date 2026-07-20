/**
 * 卖家确认诚意金收款 API
 * POST /api/auctions/[id]/deposit/confirm
 * { bookingId }
 *
 * 合规改造：诚意金由买卖双方自行约定，平台仅提供通知工具
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

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
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "Booking ID is required" },
        { status: 400 }
      );
    }

    const booking = await prisma.inspectionBooking.findUnique({
      where: { id: bookingId },
      include: { auction: true },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    // 验证权限：只有卖家或管理员可以确认
    if (booking.auction.sellerId !== user.id && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    if (!booking.depositProofUrl) {
      return NextResponse.json(
        { success: false, error: "No deposit proof uploaded" },
        { status: 400 }
      );
    }

    const updated = await prisma.inspectionBooking.update({
      where: { id: bookingId },
      data: {
        depositPaid: true,
        depositConfirmedAt: new Date(),
        status: "confirmed",
      },
    });

    // 通知报名人诚意金已确认
    try {
      if (booking.userId) {
        const bidder = await prisma.user.findUnique({
          where: { id: booking.userId },
        });
        if (bidder?.email) {
          await sendEmail({
            to: bidder.email,
            subject: `[诚意金确认] 询价资格已开通 - ${booking.auction.title}`,
            html: `
              <h2>诚意金已确认</h2>
              <p>您的诚意金已由卖家确认，您现在可以提交报价了。</p>
              <p><strong>询价编号：</strong>${booking.auction.bargainNo}</p>
              <p><strong>标的物：</strong>${booking.auction.title}</p>
              <p>请在询价页面提交您的报价。卖家将审阅后决定是否接受。</p>
            `,
            text: `诚意金已确认，询价资格已开通。询价编号：${booking.auction.bargainNo}`,
          });
        }
      }
    } catch (emailErr) {
      console.error("Email notification failed:", emailErr);
    }

    return NextResponse.json({
      success: true,
      data: updated,
      confirmedCount: 0,
      minReached: false,
      minParticipants: 0,
    });
  } catch (error) {
    console.error("Deposit confirm error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to confirm deposit" },
      { status: 500 }
    );
  }
}
