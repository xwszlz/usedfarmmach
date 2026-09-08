// 会员订单号编解码
//
// ⚠️ 微信 out_trade_no 硬约束：长度 6~32，仅允许数字/字母/_-*。
//    早期版本把 userId(cuid 25 位) 拼进订单号（MEM-basic-m-<userId>-<ts>）会到 ~51 字符，
//    微信直接返回 PARAM_ERROR「商户订单号错误」。
//    现改为：订单号只带「档位 + 周期 + 时间戳 + 随机」，固定 20 字符；
//    userId 改由微信 attach 字段携带（下单时传入，回调原样返回，上限 128 字符）。
import type { MembershipTier } from "@/lib/permissions";
import type { BillingCycle } from "./pricing";

const TIER_CODE: Record<string, string> = { basic: "B", premium: "P", enterprise: "E" };
const CODE_TO_TIER: Record<string, MembershipTier> = {
  B: "basic",
  P: "premium",
  E: "enterprise",
};
const CYCLE_CODE: Record<BillingCycle, string> = { monthly: "M", yearly: "Y" };
const CODE_TO_CYCLE: Record<string, BillingCycle> = { M: "monthly", Y: "yearly" };

/** 4 位随机后缀，避免同一毫秒内重复下单撞号 */
function random4(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
}

/**
 * 生成商户订单号：M{档位}{周期}{13位时间戳}{4位随机}
 * 例：MPM1757320000000A3F1 → 固定 20 字符，远低于微信 32 上限
 */
export function buildOutTradeNo(tier: string, cycle: BillingCycle = "yearly"): string {
  const t = TIER_CODE[tier] || "B";
  const c = CYCLE_CODE[cycle] || "Y";
  return `M${t}${c}${Date.now()}${random4()}`;
}

/** 解析商户订单号 → { tier, cycle, orderTs }；格式不符返回 null
 *  userId 请从回调的 attach 字段取，不在订单号里 */
export function parseOutTradeNo(
  outTradeNo: string | null | undefined
): { tier: MembershipTier; cycle: BillingCycle; orderTs: number } | null {
  const m = /^M([BPE])([MY])(\d{13})([0-9A-Z]{4})$/.exec(outTradeNo || "");
  if (!m) return null;
  return {
    tier: CODE_TO_TIER[m[1]],
    cycle: CODE_TO_CYCLE[m[2]],
    orderTs: Number(m[3]),
  };
}
