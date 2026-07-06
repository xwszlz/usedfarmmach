/**
 * POST /api/escrow/orders/[id]/confirm
 * 买家确认收货 → 进入自动放款倒计时
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { buyerConfirmReceipt } from "@/lib/escrow";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    await buyerConfirmReceipt(params.id, user.id);

    return NextResponse.json({
      success: true,
      message: "已确认收货，3天后自动放款给卖家",
    });

  } catch (error: any) {
    console.error("[Escrow/Confirm] 错误:", error);
    return NextResponse.json(
      { success: false, error: error.message || "确认收货失败" },
      { status: 500 }
    );
  }
}
