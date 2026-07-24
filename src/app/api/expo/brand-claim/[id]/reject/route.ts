import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * 品牌认领拒绝 API
 * POST /api/expo/brand-claim/[id]/reject
 *
 * 将 pending 的 brand_claim 状态改为 rejected
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claim = await prisma.expoRegistration.findUnique({ where: { id } });
    if (!claim) {
      return NextResponse.json({ success: false, error: "Claim not found" }, { status: 404 });
    }
    if (claim.status !== "pending") {
      return NextResponse.json({ success: false, error: `Claim already ${claim.status}` }, { status: 400 });
    }

    await prisma.expoRegistration.update({
      where: { id },
      data: { status: "rejected" },
    });

    return NextResponse.json({
      success: true,
      message: "Claim rejected",
    });
  } catch (error) {
    console.error("Reject error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}