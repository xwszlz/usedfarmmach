/**
 * POST /api/billing/refund （实际路径：src/app/api/(com)/billing/refund）
 * 发起 Paddle 退款（仅 .com 国际站，需 super_admin；全额退款）。
 *
 * 红线：
 *  - 仅 .com 站；PADDLE_API_KEY 缺失一律 401，绝不静默继续（Fail-closed）。
 *  - 仅处理 Paddle 退款；.cn 的微信/支付宝退款走各自通道，与此路由无关。
 *  - Paddle 部分退款需逐 item 指定 item_id + amount，形状不简单，
 *    本路由只做全额退款；部分退款请到 Paddle 后台操作。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isComSite } from "@/config/site";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { isConfigured, refundPaddleTransaction } from "@/lib/payments/paddle";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function requireSuperAdmin(req: NextRequest): Promise<string | null> {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  });
  if (!user || user.role !== "super_admin") return null;
  return payload.userId;
}

export async function POST(request: NextRequest) {
  // 仅 .com 站
  if (!isComSite()) {
    return NextResponse.json(
      { success: false, error: "Not found", code: "SITE_NOT_SUPPORTED" },
      { status: 404 }
    );
  }

  // Fail-closed：Paddle 未配置直接 401（绝不静默继续）
  if (!isConfigured()) {
    return NextResponse.json(
      { success: false, error: "支付未配置", code: "PAYMENT_NOT_CONFIGURED" },
      { status: 401 }
    );
  }

  const adminId = await requireSuperAdmin(request);
  if (!adminId) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const transactionId =
      typeof json?.transactionId === "string" ? json.transactionId : undefined;
    const reason = typeof json?.reason === "string" ? json.reason : undefined;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "需要提供 transactionId", code: "INVALID_PARAMS" },
        { status: 400 }
      );
    }

    const result = await refundPaddleTransaction({ transactionId, reason });

    // 即时对账：把对应 BillingOrder 标记为 refunded（webhook adjustment.created 会再确认）
    const existing = await prisma.billingOrder.findFirst({
      where: { paddleTransactionId: transactionId },
    });
    if (existing) {
      await prisma.billingOrder.update({
        where: { id: existing.id },
        data: { status: "refunded" },
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[Billing/Refund] 错误:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "退款失败" },
      { status: 500 }
    );
  }
}
