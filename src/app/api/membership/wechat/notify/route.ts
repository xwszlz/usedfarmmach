/**
 * POST /api/membership/wechat/notify
 * 微信支付会员订阅异步回调（.cn）
 * 解密 resource → 解析 out_trade_no → 校验金额 → 按周期升级/续费会员
 *
 * 红线：仅做「会员有效期回写」，绝不碰资金托管/分账。
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
import { parseOutTradeNo } from "@/lib/membership/order";
import { getMembershipCnyCents, CYCLE_DAYS } from "@/lib/membership/pricing";
import type { MembershipTier } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 3600 * 1000;
/** 档位高低排序：已持高档时不得被低档购买覆盖降级 */
const TIER_RANK: Record<string, number> = { free: 0, basic: 1, premium: 2, enterprise: 3 };

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

  const parsed = parseOutTradeNo(data.out_trade_no);
  if (!parsed) {
    console.error("[Membership/WechatNotify] 订单号无法解析:", data.out_trade_no);
    return ok("unknown order");
  }
  const { tier, cycle, orderTs } = parsed;

  // userId 由下单时的 attach 字段携带（订单号只有 20 字符装不下 cuid），微信回调原样返回
  const userId = typeof data.attach === "string" ? data.attach : "";
  if (!userId) {
    // 拿不到用户就只能留痕等人工补单，返回 SUCCESS 避免微信无限重投
    console.error(
      `[需人工补单][Membership/WechatNotify] 回调缺少 attach，无法定位用户。` +
        `order=${data.out_trade_no} tier=${tier} cycle=${cycle} transaction=${data.transaction_id || "-"}`
    );
    return ok("missing attach");
  }
  const cycleMs = (CYCLE_DAYS[cycle] || 365) * DAY_MS;

  // ---- 金额校验：单位均为「分」。amount 存在但取不到合法值 = 异常，拒绝开通 ----
  const expectedCents = getMembershipCnyCents(tier, cycle);
  if (data.amount) {
    const paidCents = Number(data.amount.total);
    if (!Number.isFinite(paidCents) || paidCents !== expectedCents) {
      console.error(
        `[Membership/WechatNotify] 金额不符 order=${data.out_trade_no} paid=${data.amount.total} expected=${expectedCents}`
      );
      return fail("amount mismatch");
    }
  }

  // ---- 写库：失败必须返回 FAIL 让微信重投 ----
  try {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { membershipTier: true, membershipExpiresAt: true },
    });

    // 幂等去重（尚无 MembershipOrder 表，用推断式去重；Phase 2 再落真实订单表）：
    // 上次落库的「基准时间」= 当前有效期 - 本单周期。若该基准落在 [下单时间, 现在] 区间内，
    // 说明这一单的效果已经体现过，是微信重复投递，直接忽略，避免多送一个周期。
    //   - 新购：有效期为空或已过期 → 不命中 → 正常开通
    //   - 正常续费：新单的下单时间晚于上次回调 → 基准 < 下单时间 → 不命中 → 正常顺延
    //   - 重复投递：同一单下单时间不变 → 基准 >= 下单时间 → 命中 → 忽略
    const expiryMs = current?.membershipExpiresAt
      ? new Date(current.membershipExpiresAt).getTime()
      : 0;
    if (expiryMs > 0) {
      const baseApplied = expiryMs - cycleMs;
      if (baseApplied >= orderTs - 60_000 && baseApplied <= Date.now() + 60_000) {
        console.log(`[Membership/WechatNotify] 重复通知已忽略 order=${data.out_trade_no}`);
        return ok("duplicate");
      }
    }

    // 续费语义：剩余有效期 > 0 则在其基础上顺延一个周期，已过期则从今天起算。
    const baseTs = expiryMs > Date.now() ? expiryMs : Date.now();

    // 防降级：已持有更高档位时保留高档位（仍按新单顺延有效期，不让用户吃亏）
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
      `[Membership/WechatNotify] 开通成功 user=${userId} tier=${finalTier} cycle=${cycle}${
        finalTier !== tier ? `(购买${tier}，保留高档)` : ""
      } order=${data.out_trade_no} transaction=${data.transaction_id || "-"}`
    );
    return ok();
  } catch (err) {
    console.error("[Membership/WechatNotify] 写库失败:", err);
    return fail("db error");
  }
}
