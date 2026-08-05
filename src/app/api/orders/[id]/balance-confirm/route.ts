/**
 * POST /api/orders/[id]/balance-confirm
 * 神雕后台确认尾款到账（线下对公转账无法自动回调，需手动确认）
 *
 * 仅 admin/super_admin 可调用。
 * 调用后订单从 deposit_paid → escrow（全款付清，进入担保期，可发货）。
 *
 * 入参: { transferRef? }  银行流水号（可选，记录到 metadata）
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { confirmBalancePaid, ESCROW_STATUS } from "@/lib/escrow";
import { prisma } from "@/lib/db";

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

    // 仅管理员可确认尾款到账
    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "无权限操作" }, { status: 403 });
    }

    // 预校验订单状态
    const order = await prisma.escrowOrder.findUnique({
      where: { id: params.id },
      select: { id: true, orderNo: true, paymentStatus: true, depositAmount: true, balanceAmount: true },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: "订单不存在" }, { status: 404 });
    }
    if (order.paymentStatus !== ESCROW_STATUS.DEPOSIT_PAID) {
      return NextResponse.json({
        success: false,
        error: `当前状态 ${order.paymentStatus} 不允许确认尾款（需为 deposit_paid）`,
      }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { transferRef } = body;

    // 确认尾款 → 全款付清 → 进入担保期
    await confirmBalancePaid(params.id);

    // 记录银行流水号到 metadata
    if (transferRef) {
      const existing = await prisma.escrowOrder.findUnique({
        where: { id: params.id },
        select: { metadata: true },
      });
      const meta = existing?.metadata ? JSON.parse(existing.metadata) : {};
      meta.balanceTransferRef = transferRef;
      await prisma.escrowOrder.update({
        where: { id: params.id },
        data: { metadata: JSON.stringify(meta) },
      });
    }

    return NextResponse.json({
      success: true,
      message: "尾款已确认到账，全款付清，订单进入担保期",
      data: {
        orderId: params.id,
        orderNo: order.orderNo,
        paymentStatus: ESCROW_STATUS.ESCROW,
      },
    });
  } catch (error) {
    console.error("[orders/balance-confirm] 失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "确认尾款失败" },
      { status: 500 }
    );
  }
}
