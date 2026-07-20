/**
 * 卖家确认保证金收款 API
 * POST /api/auctions/[id]/deposit/confirm
 * { bookingId }
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

    // 通知报名人保证金已确认
    try {
      if (booking.userId) {
        const bidder = await prisma.user.findUnique({
          where: { id: booking.userId },
        });
        if (bidder?.email) {
          await sendEmail({
            to: bidder.email,
            subject: `[保证金确认] 议价资格已开通 - ${booking.auction.title}`,
            html: `
              <h2>保证金已确认</h2>
              <p>您的保证金已由卖家确认，议价资格已开通。</p>
              <p><strong>议价编号：</strong>${booking.auction.bargainNo}</p>
              <p><strong>标的物：</strong>${booking.auction.title}</p>
              ${booking.auction.startTime ? `<p><strong>议价开始时间：</strong>${new Date(booking.auction.startTime).toLocaleString("zh-CN")}</p>` : `<p><strong>启动条件：</strong>确认报名满${booking.auction.minParticipants || 3}人即启动</p>`}
              <p>请在议价启动后准时参与。</p>
            `,
            text: `保证金已确认，议价资格已开通。议价编号：${booking.auction.bargainNo}`,
          });
        }
      }
    } catch (emailErr) {
      console.error("Email notification failed:", emailErr);
    }

    // 检查是否达到最低启动人数
    const confirmedCount = await prisma.inspectionBooking.count({
      where: {
        auctionId: params.id,
        depositPaid: true,
        status: "confirmed",
      },
    });

    const auction = booking.auction;
    const minParticipants = auction.minParticipants || 3;

    if (confirmedCount >= minParticipants) {
      // 达到最低人数，通知所有已确认的报名者
      const confirmedBookings = await prisma.inspectionBooking.findMany({
        where: {
          auctionId: params.id,
          depositPaid: true,
          status: "confirmed",
        },
        include: { user: true },
      });

      for (const cb of confirmedBookings) {
        if (cb.user?.email) {
          try {
            await sendEmail({
              to: cb.user.email,
              subject: `[议价启动] 满${minParticipants}人，议价即将开始 - ${auction.title}`,
              html: `
                <h2>议价已启动</h2>
                <p>报名人数已达${confirmedCount}人（最低${minParticipants}人），议价已正式启动，您可以立即出价。</p>
                <p><strong>议价编号：</strong>${auction.bargainNo}</p>
                <p><strong>标的物：</strong>${auction.title}</p>
                ${auction.startTime ? `<p><strong>议价开始时间：</strong>${new Date(auction.startTime).toLocaleString("zh-CN")}</p>` : ""}
                <p>请立即登录议价大厅出价。</p>
              `,
              text: `议价启动通知：满${minParticipants}人，议价即将开始。`,
            });
          } catch (e) {
            console.error("Notify bidder failed:", e);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: updated,
      confirmedCount,
      minReached: confirmedCount >= minParticipants,
      minParticipants,
    });
  } catch (error) {
    console.error("Deposit confirm error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to confirm deposit" },
      { status: 500 }
    );
  }
}
