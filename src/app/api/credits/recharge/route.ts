import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * 积分充值 / 会员升级（模拟支付）
 * POST /api/credits/recharge
 * Body: { amount: number, type: 'credits' | 'membership', tier?: string, months?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, amount, tier, months } = body;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // 模拟支付成功，直接处理
    if (type === "credits") {
      // 充值积分
      const rechargeAmount = Number(amount) || 0;
      if (rechargeAmount <= 0) {
        return NextResponse.json(
          { success: false, error: "Invalid amount" },
          { status: 400 }
        );
      }

      const [updatedUser, _] = await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { credits: { increment: rechargeAmount } },
          select: { id: true, credits: true },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: user.id,
            type: "recharge",
            amount: rechargeAmount,
            balance: user.credits + rechargeAmount,
            reason: "积分充值",
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: { credits: updatedUser.credits },
        message: "充值成功（模拟）",
      });
    }

    if (type === "membership") {
      // 会员升级
      const validTiers = ["basic", "premium", "enterprise"];
      const targetTier = tier || "basic";
      if (!validTiers.includes(targetTier)) {
        return NextResponse.json(
          { success: false, error: "Invalid tier" },
          { status: 400 }
        );
      }

      const durationMonths = Number(months) || 1;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          membershipTier: targetTier,
          membershipExpiresAt: expiresAt,
        },
      });

      return NextResponse.json({
        success: true,
        data: { tier: targetTier, expiresAt },
        message: "会员升级成功（模拟）",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Recharge error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
