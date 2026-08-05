/**
 * POST /api/orders/[id]/confirm
 * 小程序买家确认收货（神雕自营模型：确认后进入线下结算倒计时）
 *
 * 内部复用 lib/escrow 的 buyerConfirmReceipt（校验 buyerId + ESCROW 状态）。
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
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    await buyerConfirmReceipt(params.id, user.id);

    return NextResponse.json({
      success: true,
      message: "已确认收货，神雕将按协议向寄售方结算",
    });
  } catch (error) {
    console.error("[orders/confirm] 失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "确认收货失败" },
      { status: 500 }
    );
  }
}
