// 会员订单号编解码：在无 attach/passback 字段时，用 out_trade_no 回传
// tier + 计费周期 + userId + 下单时间，供 /api/membership/checkout 与微信/支付宝回调共享。
import type { MembershipTier } from "@/lib/permissions";
import type { BillingCycle } from "./pricing";

/** 周期短码：m=月付，y=年付（订单号里出现，需保持极短） */
const CYCLE_CODE: Record<BillingCycle, string> = { monthly: "m", yearly: "y" };
const CODE_TO_CYCLE: Record<string, BillingCycle> = { m: "monthly", y: "yearly" };

/** 生成商户订单号：MEM-{tier}-{m|y}-{userId}-{timestamp} */
export function buildOutTradeNo(
  tier: string,
  userId: string,
  cycle: BillingCycle = "yearly"
): string {
  return `MEM-${tier}-${CYCLE_CODE[cycle] || "y"}-${userId}-${Date.now()}`;
}

/** 解析商户订单号 → { tier, cycle, userId, orderTs }；格式不符返回 null */
export function parseOutTradeNo(
  outTradeNo: string | null | undefined
): {
  tier: MembershipTier;
  cycle: BillingCycle;
  userId: string;
  orderTs: number;
} | null {
  const m = /^MEM-(basic|premium|enterprise)-([my])-(.+)-(\d+)$/.exec(outTradeNo || "");
  if (!m) return null;
  return {
    tier: m[1] as MembershipTier,
    cycle: CODE_TO_CYCLE[m[2]] || "yearly",
    userId: m[3],
    orderTs: Number(m[4]),
  };
}
