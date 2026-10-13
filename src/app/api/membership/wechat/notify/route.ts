/**
 * POST /api/membership/wechat/notify
 * 微信支付积分充值异步回调（.cn）——路径保持不变（商户平台 notify URL 已指向此处）
 * 解密 resource → 解析 out_trade_no → 校验金额 → 给用户加积分
 *
 * 会员订阅产品已下架（2026-10）：会员订单分支移除；历史 M 前缀订单直接确认忽略。
 *
 * ⚠️ 返回语义（微信按 HTTP 状态码 + code 决定是否重投，最多 15 次 / 约 24h 后停止）：
 *   - 2xx + code=SUCCESS → 微信认为成功，不再重投
 *   - 非 2xx 或 code=FAIL → 微信按 15s/15s/30s/3m/10m/20m/30m/30m/30m/60m/3h/6h/6h... 重投
 *   因此「配置错误 / 解密失败 / 写库失败」必须返回 FAIL，
 *   否则用户付了钱却不开通，而且没有任何告警。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isConfigured as wechatConfigured, decryptCallbackResource } from "@/lib/wechat-pay";
import { isCreditOutTradeNo, parseCreditOutTradeNo } from "@/lib/credits/recharge-order";
import { grantRecharge } from "@/lib/credits/grant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function ok(message = "ok") {
  return NextResponse.json({ code: "SUCCESS", message });
}

/** 让微信重投的失败应答 */
function fail(message: string, status = 500) {
  return NextResponse.json({ code: "FAIL", message }, { status });
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return fail("invalid json", 400);
  }

  const resource = body?.resource;

  // 未配置：只有「确实是微信发来的加密通知」才值得让微信重投（配置修复后能自动补单）；
  // 否则（伪造/探测请求）直接吞掉，避免刷日志。
  if (!wechatConfigured()) {
    if (resource?.ciphertext) {
      console.error(
        "[Membership/WechatNotify] 收到微信通知但支付未配置，请检查 WECHAT_* 环境变量是否丢失"
      );
      return fail("not configured");
    }
    return ok("not configured");
  }

  if (!resource?.ciphertext) {
    console.error("[Membership/WechatNotify] 通知缺少 resource.ciphertext:", body);
    return ok("missing resource");
  }

  // ---- 解密：失败 = API V3 密钥配错 / 平台证书问题，必须让微信重投并留痕 ----
  let data: Record<string, any>;
  try {
    data = decryptCallbackResource(
      resource.ciphertext,
      resource.associated_data || "",
      resource.nonce || ""
    );
  } catch (err) {
    console.error(
      "[Membership/WechatNotify] resource 解密失败，请检查 WECHAT_API_V3_KEY 是否为 32 字节且与商户平台一致:",
      err
    );
    return fail("decrypt failed");
  }

  if (data.trade_state !== "SUCCESS") {
    return ok("ignored");
  }

  // —— 积分充值订单（R 前缀）：1 元 = 1 积分，直接加积分，不走会员逻辑 ——
  if (isCreditOutTradeNo(data.out_trade_no)) {
    const pc = parseCreditOutTradeNo(data.out_trade_no);
    if (!pc) {
      console.error("[Recharge/WechatNotify] 无法解析积分订单号:", data.out_trade_no);
      return ok("bad credit order");
    }
    const uid = typeof data.attach === "string" ? data.attach : "";
    if (!uid) {
      console.error(`[需人工补单][Recharge/WechatNotify] 缺少 attach，无法定位用户。order=${data.out_trade_no} credits=${pc.credits}`);
      return ok("missing attach");
    }
    if (data.amount) {
      const paidCents = Number(data.amount.total);
      if (!Number.isFinite(paidCents) || paidCents !== pc.credits * 100) {
        console.error(`[Recharge/WechatNotify] 金额不符 order=${data.out_trade_no} paid=${data.amount.total} expected=${pc.credits * 100}`);
        return fail("amount mismatch");
      }
    }
    try {
      const txId = data.transaction_id || data.out_trade_no;
      const dup = await prisma.creditTransaction.findFirst({
        where: { type: "recharge", relatedId: txId },
      });
      if (dup) return ok("duplicate");
      await grantRecharge(uid, pc.credits, "wechat_recharge", txId);
      console.log(`[Recharge/WechatNotify] 充值成功 user=${uid} credits=${pc.credits} order=${data.out_trade_no}`);
      return ok();
    } catch (err) {
      console.error("[Recharge/WechatNotify] 写库失败:", err);
      return fail("db error");
    }
  }

  // —— 非积分订单（历史会员订单 M 前缀）：会员产品已下架，不再处理；直接确认避免微信无限重投 ——
  console.log("[Recharge/WechatNotify] 非积分充值订单，忽略:", data.out_trade_no);
  return ok("ignored order");
}
