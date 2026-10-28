/**
 * POST /api/credits/recharge —— 积分充值下单入口（双站）
 *
 * 老板口径：取消 4 档会员，改为「积分中心 + 积分充值」。
 *   - 全球统一购买力：**1 元人民币 = 100 积分**。.cn 直接 1 元 = 100 积分；
 *     .com 收美元，按当日人民币汇率折回人民币后再换积分（见 `creditsFromLocalAmount`）。
 *   - .cn（境内）：走微信 Native / 支付宝 预下单（普通商户直收增值服务费，
 *     红线：绝不走收付通/服务商/资金托管，不碰分账/二清）。
 *   - .com（国际）：走 Paddle Checkout（一次性支付，Paddle 为 MoR）。
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
import { creditsFromLocalAmount } from "@/lib/credits/fx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// 上限按「积分」计：10,000,000 积分 = 人民币等值 ¥100,000（1 元 = 100 积分），语义自洽
const MAX_CREDITS = 10_000_000; // = ¥100,000 × 100 积分/元

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
      // 全球统一口径：1 元人民币 = 100 积分。收美元必须按汇率折回人民币再换积分，
      // 否则 $1 只买到 100 积分（= ¥1），比 .cn 用户少拿 6.69 倍。
      const amountCents = Math.round(amount * 100);
      const credits = creditsFromLocalAmount(amount, "USD");
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
        // 实付金额与发放积分解耦：这里传真实金额（分），金额绝不等于 credits
        amountCents,
        currency: "USD",
      });
      return NextResponse.json({
        success: true,
        data: { type: "paddle", credits, transactionId },
      });
    }

    // .cn：1 元 = 100 积分。金额先归一到「分」，令积分与实付分值严格相等，
    // 避免 floor/round 不一致触发回调 amount mismatch（用户已付款却不到账）。
    //
    // 历史 bug（本次修复）：下单时积分用 Math.floor(amount*100)、实付用 Math.round(amount*100)，
    // 浮点误差下两者会差 1 分（如 1.15*100 = 114.99999999999999 → floor 114 / round 115），
    // 回调侧「实付分 !== credits」判不符 ⇒ 微信重投 15 次后放弃，钱到账但积分不到账。
    // 现在两者共用同一个 amountCents，物理上不可能再不一致。
    const amountCents = Math.round(amount * 100);
    const credits = amountCents;
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
      // 微信要「分」：直接复用 amountCents（= credits），不再二次 Math.round(amount*100)
      const { code_url } = await createNativeOrder(
        outTradeNo,
        amountCents, // 单位：分
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
    // 支付宝要「元」：由 amountCents 反算，保证与 credits 严格同源
    // （回调侧按 `Number(total_amount) === pc.credits / 100` 校验）
    const { qr_code } = await createPrecreateOrder(
      outTradeNo,
      amountCents / 100, // 单位：元
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
