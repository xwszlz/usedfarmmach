/**
 * POST /api/billing/checkout  （实际路径：src/app/api/(com)/billing/checkout）
 * 创建 Stripe Checkout Session（增值服务费 / 会员订阅，仅外币）
 *
 * 守卫：
 *  - 必须登录（getUserFromRequest）
 *  - 仅 .com 站（非 .com 返回 404）
 *  - Stripe 未配置返回 503 { code: "PAYMENT_NOT_CONFIGURED" }
 *
 * 响应信封：{ success, data } / { success:false, error, code }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { isComSite } from "@/config/site";
import {
  createCheckoutSession,
  getOrCreateStripeCustomer,
  isConfigured,
  isStripeCurrency,
  isStripePlan,
} from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  plan: z.string(),
  currency: z.string(),
  sku: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 仅 .com 站
    if (!isComSite()) {
      return NextResponse.json(
        { success: false, error: "Not found", code: "SITE_NOT_SUPPORTED" },
        { status: 404 }
      );
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (!isConfigured()) {
      return NextResponse.json(
        { success: false, error: "支付未配置", code: "PAYMENT_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "参数错误", code: "INVALID_PARAMS" },
        { status: 400 }
      );
    }

    const { plan, currency, sku } = parsed.data;
    if (!isStripePlan(plan)) {
      return NextResponse.json(
        { success: false, error: "不支持的套餐", code: "INVALID_PLAN" },
        { status: 400 }
      );
    }
    if (!isStripeCurrency(currency)) {
      return NextResponse.json(
        { success: false, error: "不支持的币种", code: "INVALID_CURRENCY" },
        { status: 400 }
      );
    }

    // 获取/创建 Stripe Customer（幂等）
    const stripeCustomerId = await getOrCreateStripeCustomer(user.id, user.email);

    const result = await createCheckoutSession({
      userId: user.id,
      plan,
      currency,
      stripeCustomerId,
      sku,
    });

    return NextResponse.json({
      success: true,
      data: { sessionId: result.sessionId, sessionUrl: result.sessionUrl },
    });
  } catch (error: any) {
    console.error("[Billing/Checkout] 错误:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "创建收银台失败" },
      { status: 500 }
    );
  }
}
