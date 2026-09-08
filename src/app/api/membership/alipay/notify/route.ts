/**
 * POST /api/membership/alipay/notify
 * 支付宝会员订阅异步回调（.cn）
 * 验签 → 校验 trade_status / 金额 → 按周期升级/续费会员
 *
 * 红线：仅做「会员有效期回写」，绝不碰资金托管/分账。
 *
 * 支付宝要求：处理成功必须原样输出 `success` 七个字母（不带引号、不带 BOM），
 * 否则支付宝会认为失败并按 4m/10m/10m/1h/2h/6h/15h... 重投（最多 8 次）。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isConfigured as alipayConfigured, verifyCallback } from "@/lib/alipay";
import { parseOutTradeNo } from "@/lib/membership/order";
import { getMembershipCny, CYCLE_DAYS } from "@/lib/membership/pricing";
import type { MembershipTier } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 3600 * 1000;
const TIER_RANK: Record<string, number> = { free: 0, basic: 1, premium: 2, enterprise: 3 };

/** 支付宝要求的成功应答：必须是纯文本 success */
function okText() {
  return new NextResponse("success", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function failText(status = 500) {
  return new NextResponse("fail", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  if (!alipayConfigured()) {
    // 未配置：吞掉即可，支付宝重投也无意义
    return okText();
  }

  // 支付宝以 application/x-www-form-urlencoded 提交
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });

  if (!verifyCallback(params)) {
    console.error("[Membership/AlipayNotify] 验签失败:", params.out_trade_no);
    return failText(400);
  }

  const tradeStatus = params.trade_status;
  if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
    return okText();
  }

  const parsed = parseOutTradeNo(params.out_trade_no);
  if (!parsed) {
    console.error("[Membership/AlipayNotify] 订单号无法解析:", params.out_trade_no);
    return okText();
  }
  const { tier, cycle, orderTs } = parsed;

  // userId 由下单时的 passback_params 携带（支付宝异步通知原样返回，且是 URL 编码的）
  const rawPassback = typeof params.passback_params === "string" ? params.passback_params : "";
  let userId = "";
  try {
    userId = rawPassback ? decodeURIComponent(rawPassback) : "";
  } catch {
    userId = rawPassback;
  }
  if (!userId) {
    console.error(
      `[需人工补单][Membership/AlipayNotify] 回调缺少 passback_params，无法定位用户。` +
        `order=${params.out_trade_no} tier=${tier} cycle=${cycle}`
    );
    return okText();
  }
  const cycleMs = (CYCLE_DAYS[cycle] || 365) * DAY_MS;

  // 金额校验（支付宝 total_amount 单位为「元」）
  const paid = Number(params.total_amount);
  const expected = getMembershipCny(tier, cycle);
  if (!Number.isFinite(paid) || paid !== expected) {
    console.error(
      `[Membership/AlipayNotify] 金额不符 order=${params.out_trade_no} paid=${params.total_amount} expected=${expected}`
    );
    return failText(400);
  }

  try {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { membershipTier: true, membershipExpiresAt: true },
    });

    // 幂等去重（与微信回调同一套推断式逻辑，详见 wechat/notify）
    const expiryMs = current?.membershipExpiresAt
      ? new Date(current.membershipExpiresAt).getTime()
      : 0;
    if (expiryMs > 0) {
      const baseApplied = expiryMs - cycleMs;
      if (baseApplied >= orderTs - 60_000 && baseApplied <= Date.now() + 60_000) {
        return okText();
      }
    }

    const baseTs = expiryMs > Date.now() ? expiryMs : Date.now();
    const currentRank = TIER_RANK[current?.membershipTier || "free"] ?? 0;
    const buyRank = TIER_RANK[tier] ?? 0;
    const finalTier: MembershipTier =
      currentRank > buyRank ? (current!.membershipTier as MembershipTier) : tier;

    await prisma.user.update({
      where: { id: userId },
      data: {
        membershipTier: finalTier,
        membershipExpiresAt: new Date(baseTs + cycleMs),
      },
    });

    console.log(
      `[Membership/AlipayNotify] 开通成功 user=${userId} tier=${finalTier} cycle=${cycle} order=${params.out_trade_no}`
    );
    return okText();
  } catch (err) {
    console.error("[Membership/AlipayNotify] 写库失败:", err);
    return failText();
  }
}
