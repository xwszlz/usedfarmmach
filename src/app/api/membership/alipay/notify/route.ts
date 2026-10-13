/**
 * POST /api/membership/alipay/notify
 * 支付宝积分充值异步回调（.cn）——路径保持不变（商户平台 notify URL 已指向此处）
 * 验签 → 校验 trade_status / 金额 → 给用户加积分
 *
 * 会员订阅产品已下架（2026-10）：会员订单分支移除；历史 M 前缀订单直接确认忽略。
 *
 * 支付宝要求：处理成功必须原样输出 `success` 七个字母（不带引号、不带 BOM），
 * 否则支付宝会认为失败并按 4m/10m/10m/1h/2h/6h/15h... 重投（最多 8 次）。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isConfigured as alipayConfigured, verifyCallback } from "@/lib/alipay";
import { isCreditOutTradeNo, parseCreditOutTradeNo } from "@/lib/credits/recharge-order";
import { grantRecharge } from "@/lib/credits/grant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  // —— 积分充值订单（R 前缀）：1 元 = 1 积分，直接加积分，不走会员逻辑 ——
  if (isCreditOutTradeNo(params.out_trade_no)) {
    const pc = parseCreditOutTradeNo(params.out_trade_no);
    if (!pc) {
      console.error("[Recharge/AlipayNotify] 无法解析积分订单号:", params.out_trade_no);
      return okText();
    }
    const rawPb = typeof params.passback_params === "string" ? params.passback_params : "";
    let uid = "";
    try {
      uid = rawPb ? decodeURIComponent(rawPb) : "";
    } catch {
      uid = rawPb;
    }
    if (!uid) {
      console.error(`[需人工补单][Recharge/AlipayNotify] 缺少 passback_params。order=${params.out_trade_no} credits=${pc.credits}`);
      return okText();
    }
    const paid = Number(params.total_amount);
    if (!Number.isFinite(paid) || paid !== pc.credits) {
      console.error(`[Recharge/AlipayNotify] 金额不符 order=${params.out_trade_no} paid=${params.total_amount} expected=${pc.credits}`);
      return failText(400);
    }
    try {
      const txId = params.trade_no || params.out_trade_no;
      const dup = await prisma.creditTransaction.findFirst({
        where: { type: "recharge", relatedId: txId },
      });
      if (dup) return okText();
      await grantRecharge(uid, pc.credits, "alipay_recharge", txId);
      console.log(`[Recharge/AlipayNotify] 充值成功 user=${uid} credits=${pc.credits} order=${params.out_trade_no}`);
      return okText();
    } catch (err) {
      console.error("[Recharge/AlipayNotify] 写库失败:", err);
      return failText();
    }
  }

  // —— 非积分订单（历史会员订单 M 前缀）：会员产品已下架，不再处理；直接确认避免支付宝重投 ——
  console.log("[Recharge/AlipayNotify] 非积分充值订单，忽略:", params.out_trade_no);
  return okText();
}
