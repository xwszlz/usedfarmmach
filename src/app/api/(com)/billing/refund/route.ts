/**
 * POST /api/billing/refund （实际路径：src/app/api/(com)/billing/refund）
 * 发起 Stripe 退款（仅 .com 国际站，需 super_admin）。
 *
 * 红线：
 *  - 仅 .com 站；STRIPE_SECRET_KEY 缺失一律 401，绝不静默继续（Fail-closed）。
 *  - 仅处理 Stripe 退款；.cn 的微信/支付宝退款走各自通道，与此路由无关。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isComSite } from "@/config/site";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { isConfigured, refundStripeCharge } from "@/lib/payments/stripe";

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

  // Fail-closed：Stripe 未配置直接 401（绝不静默继续）
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
    const paymentIntentId =
      typeof json?.paymentIntentId === "string" ? json.paymentIntentId : undefined;
    const chargeId = typeof json?.chargeId === "string" ? json.chargeId : undefined;
    const amount = typeof json?.amount === "number" ? json.amount : undefined;
    const reason =
      json?.reason === "duplicate" ||
      json?.reason === "fraudulent" ||
      json?.reason === "requested_by_customer"
        ? json.reason
        : undefined;

    if (!paymentIntentId && !chargeId) {
      return NextResponse.json(
        { success: false, error: "需要提供 paymentIntentId 或 chargeId", code: "INVALID_PARAMS" },
        { status: 400 }
      );
    }

    const result = await refundStripeCharge({ paymentIntentId, chargeId, amount, reason });

    // 即时对账：把对应 BillingOrder 标记为 refunded（webhook charge.refunded 会再确认）
    const existing = paymentIntentId
      ? await prisma.billingOrder.findFirst({ where: { stripePaymentIntentId: paymentIntentId } })
      : await prisma.billingOrder.findFirst({ where: { stripeChargeId: chargeId! } });
    if (existing) {
      await prisma.billingOrder.update({
        where: { id: existing.id },
        data: {
          status: "refunded",
          stripeChargeId: chargeId ?? existing.stripeChargeId,
        },
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
