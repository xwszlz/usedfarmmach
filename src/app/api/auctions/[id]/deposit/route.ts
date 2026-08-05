/**
 * 保证金凭证上传 API
 * POST /api/auctions/[id]/deposit
 * { bookingId, proofUrl }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

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
    const { bookingId, proofUrl } = body;

    if (!bookingId || !proofUrl) {
      return NextResponse.json(
        { success: false, error: "Booking ID and proof URL are required" },
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

    // 验证权限：只有报名人自己或管理员可以上传凭证
    if (booking.userId && booking.userId !== user.id && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const updated = await prisma.inspectionBooking.update({
      where: { id: bookingId },
      data: {
        depositProofUrl: proofUrl,
        status: "deposit_paid",
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Deposit proof uploaded, awaiting seller confirmation",
    });
  } catch (error) {
    console.error("Deposit upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload deposit proof" },
      { status: 500 }
    );
  }
}
