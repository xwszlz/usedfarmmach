/**
 * POST /api/membership/checkout
 * .cn 国内站会员购买入口：微信 Native 扫码（人民币，普通商户直收增值信息服务费）
 *
 * 守卫：
 *  - 必须登录
 *  - 仅付费档（排除 free）
 *  - 仅 .cn（.com 国际站走既有的 /api/(com)/billing/checkout → Stripe，本路由不介入）
 *  - 通道未配置 → 503 PAYMENT_NOT_CONFIGURED（前端据此降级为邮箱收集）
 *
 * 红线：会员费 = 增值信息服务费，走普通商户直收；
 *       绝不走 WECHAT_PAY_*（收付通/服务商/资金托管），绝不碰分账/二清。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { isComSite } from "@/config/site";
import { isConfigured as wechatConfigured, createNativeOrder } from "@/lib/wechat-pay";
import { isConfigured as alipayConfigured, createPrecreateOrder } from "@/lib/alipay";
import { getMembershipCny, getMembershipCnyCents } from "@/lib/membership/pricing";
import { buildOutTradeNo } from "@/lib/membership/order";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  tier: z.enum(["basic", "premium", "enterprise"]),
  channel: z.enum(["wechat", "alipay"]),
  cycle: z.enum(["monthly", "yearly"]).default("yearly"),
});

export async function POST(request: NextRequest) {
  try {
    // .com 国际站：会员走既有 Stripe 通道，本路由不介入（避免两套价格/两条链路打架）
    if (isComSite()) {
      return NextResponse.json(
        {
          success: false,
          error: "国际站请走 /api/billing/checkout",
          code: "SITE_NOT_SUPPORTED",
        },
        { status: 400 }
      );
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "参数错误", code: "INVALID_PARAMS" },
        { status: 400 }
      );
    }
    const { tier, channel, cycle } = parsed.data;

    const amountCents = getMembershipCnyCents(tier, cycle);
    if (amountCents <= 0) {
      return NextResponse.json(
        { success: false, error: "无效档位", code: "INVALID_TIER" },
        { status: 400 }
      );
    }

    const outTradeNo = buildOutTradeNo(tier, user.id, cycle);
    const cycleLabel = cycle === "yearly" ? "年费" : "月费";
    const description = `神雕农机会员${cycleLabel}`;
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.cn";
    const notifyWechat = `${base}/api/membership/wechat/notify`;
    const notifyAlipay = `${base}/api/membership/alipay/notify`;

    if (channel === "wechat") {
      if (!wechatConfigured()) {
        return NextResponse.json(
          { success: false, error: "微信支付未配置", code: "PAYMENT_NOT_CONFIGURED" },
          { status: 503 }
        );
      }
      const { code_url } = await createNativeOrder(
        outTradeNo,
        amountCents,
        description,
        notifyWechat
      );
      return NextResponse.json({
        success: true,
        data: { type: "wechat", codeUrl: code_url, outTradeNo, amountCents },
      });
    }

    // 支付宝：商户密钥尚未申请，配置缺失时按 503 降级
    if (!alipayConfigured()) {
      return NextResponse.json(
        { success: false, error: "支付宝未配置", code: "PAYMENT_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    const { qr_code } = await createPrecreateOrder(
      outTradeNo,
      getMembershipCny(tier, cycle),
      description,
      notifyAlipay
    );
    return NextResponse.json({
      success: true,
      data: { type: "alipay", codeUrl: qr_code, outTradeNo, amountCents },
    });
  } catch (error: any) {
    console.error("[Membership/Checkout] 错误:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "创建订单失败" },
      { status: 500 }
    );
  }
}
