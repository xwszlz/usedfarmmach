/**
 * POST /api/billing/checkout  （实际路径：src/app/api/(com)/billing/checkout）
 * 创建 Paddle Transaction（会员订阅 / 增值包，仅 .com 国际站，只收 USD）
 *
 * 守卫：
 *  - 必须登录（getUserFromRequest）
 *  - 仅 .com 站（非 .com 返回 404）
 *  - Paddle 未配置（PADDLE_API_KEY 缺失）返回 503 { code: "PAYMENT_NOT_CONFIGURED" }
 *
 * 响应信封：{ success, data } / { success:false, error, code }
 *
 * 口径：Paddle 是 Merchant of Record（MoR），本路由只负责「创建结账」，
 * 真实资金流在 Paddle 闭环，网站永不直接收单；仅 .com 站启用。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { isComSite } from "@/config/site";
import {
  createMembershipTransaction,
  isConfigured,
  isPaddlePlan,
} from "@/lib/payments/paddle";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  plan: z.string(),
  cycle: z.enum(["monthly", "yearly"]),
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

    const { plan, cycle } = parsed.data;
    if (!isPaddlePlan(plan)) {
      return NextResponse.json(
        { success: false, error: "不支持的套餐", code: "INVALID_PLAN" },
        { status: 400 }
      );
    }

    const result = await createMembershipTransaction({
      userId: user.id,
      plan,
      cycle,
    });

    return NextResponse.json({
      success: true,
      data: { checkoutUrl: result.checkoutUrl, transactionId: result.transactionId },
    });
  } catch (error: any) {
    console.error("[Billing/Checkout] 错误:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "创建收银台失败" },
      { status: 500 }
    );
  }
}
