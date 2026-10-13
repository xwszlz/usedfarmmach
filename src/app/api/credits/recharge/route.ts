/**
 * POST /api/credits/recharge —— 积分充值下单入口（双站）
 *
 * 老板口径：取消 4 档会员，改为「积分中心 + 积分充值」。
 *   - .cn（境内）：1 元 = 1 积分；走微信 Native / 支付宝 预下单（普通商户直收增值服务费，
 *     红线：绝不走收付通/服务商/资金托管，不碰分账/二清）。
 *   - .com（国际）：1 美元 = 1 积分；走 Paddle Checkout（一次性支付，Paddle 为 MoR）。
 *
 * 注意：本端点只负责【创建支付订单】，真正的【加积分】在支付回调里做：
 *   - .cn → /api/membership/wechat/notify、/api/membership/alipay/notify
 *   - .com → /api/webhooks/paddle
 * 因此本端点绝不直接改 User.credits / CreditTransaction（沿用 P0 I-5 止血红线）。
 *
 * 幂等：支付回调按 支付流水号 / 订单号 去重（见各回调实现）。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { isComSite } from "@/config/site";
import { isConfigured as wechatConfigured, createNativeOrder } from "@/lib/wechat-pay";
import { isConfigured as alipayConfigured, createPrecreateOrder } from "@/lib/alipay";
import {
  isConfigured as paddleConfigured,
  createCreditRechargeTransaction,
} from "@/lib/payments/paddle";
import { buildCreditOutTradeNo } from "@/lib/credits/recharge-order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CREDITS = 100_000;

const bodySchema = z.object({
  /** .cn：人民币元；.com：美元 */
  amount: z.number().positive(),
  /** .cn 用：wechat | alipay（缺省 wechat） */
  channel: z.enum(["wechat", "alipay"]).optional(),
  /** .com 用：本版固定 USD；保留入参仅为兼容已发出的请求体 */
  currency: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "参数错误", code: "INVALID_PARAMS" },
        { status: 400 }
      );
    }
    const { amount, channel, currency } = parsed.data;

    if (isComSite()) {
      // $1 = 1 积分
      const credits = Math.floor(amount);
      if (credits < 1 || credits > MAX_CREDITS) {
        return NextResponse.json({ success: false, error: "金额超出范围" }, { status: 400 });
      }
      if (!paddleConfigured()) {
        return NextResponse.json(
          { success: false, error: "支付未配置", code: "PAYMENT_NOT_CONFIGURED" },
          { status: 503 }
        );
      }
      // 本版 .com 固定 USD（前端从不传 currency）；currency 保留在 zod schema 里
      // 仅为兼容已发出的请求体，此处不再消费。
      // 只把 transactionId 交给前端（Paddle.js 用它打开结账浮层）。
      // 不返回 checkout.url：那是「本站域名 + _ptxn=<id>」的支付链接而非收银台，
      // 交给前端跳转会让用户回到本站而付不了款。
      const { transactionId } = await createCreditRechargeTransaction({
        userId: user.id,
        credits,
        currency: "USD",
      });
      return NextResponse.json({
        success: true,
        data: { type: "paddle", credits, transactionId },
      });
    }

    // .cn：1 元 = 1 积分
    const credits = Math.floor(amount);
    if (credits < 1 || credits > MAX_CREDITS) {
      return NextResponse.json({ success: false, error: "金额超出范围" }, { status: 400 });
    }
    const ch = channel || "wechat";
    const outTradeNo = buildCreditOutTradeNo(credits);
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.cn";
    const description = `神雕农机积分充值 ${credits} 积分`;

    if (ch === "wechat") {
      if (!wechatConfigured()) {
        return NextResponse.json(
          { success: false, error: "微信支付未配置", code: "PAYMENT_NOT_CONFIGURED" },
          { status: 503 }
        );
      }
      const { code_url } = await createNativeOrder(
        outTradeNo,
        credits * 100, // 单位：分
        description,
        `${base}/api/membership/wechat/notify`,
        user.id // attach：回调原样返回，用于定位用户
      );
      return NextResponse.json({
        success: true,
        data: { type: "wechat", codeUrl: code_url, outTradeNo, credits },
      });
    }

    // 支付宝：未配置按 503 降级
    if (!alipayConfigured()) {
      return NextResponse.json(
        { success: false, error: "支付宝未配置", code: "PAYMENT_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    const { qr_code } = await createPrecreateOrder(
      outTradeNo,
      credits, // 单位：元
      description,
      `${base}/api/membership/alipay/notify`,
      user.id // passback_params：异步通知原样返回
    );
    return NextResponse.json({
      success: true,
      data: { type: "alipay", codeUrl: qr_code, outTradeNo, credits },
    });
  } catch (error: any) {
    console.error("[Credits/Recharge] 错误:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "创建充值订单失败" },
      { status: 500 }
    );
  }
}
