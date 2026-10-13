// 积分充值订单号编解码（.cn 微信/支付宝）
//
// 微信 out_trade_no 硬约束：长度 6~32，仅允许数字/字母/_-*。
// 积分充值订单号格式：R{13位时间戳}_{积分数}_{4位随机}
//   —— 前缀 R（Recharge），与会员单 M 前缀区分；userId 走 attach / passback_params。
// 例：R1757320000000_100_A3F1  —— 固定 ≤ 27 字符，远低于微信 32 上限。
//
// 与会员订单号（lib/membership/order.ts）互不冲突：会员单以 M 开头，积分单以 R 开头。

const MAX_CREDITS = 100_000_000;

function random4(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
}

/** 生成积分充值商户订单号：R{ts}_{credits}_{rand4} */
export function buildCreditOutTradeNo(credits: number): string {
  const c = Math.max(1, Math.floor(credits));
  return `R${Date.now()}_${c}_${random4()}`;
}

/** 是否为积分充值订单号（R 前缀） */
export function isCreditOutTradeNo(s: string | null | undefined): boolean {
  return typeof s === "string" && s.startsWith("R");
}

/**
 * 解析积分充值订单号 → { credits, orderTs }；格式不符返回 null。
 * userId 请从回调的 attach / passback_params 取，不在订单号里。
 */
export function parseCreditOutTradeNo(
  s: string | null | undefined
): { credits: number; orderTs: number } | null {
  if (!s) return null;
  // 积分数最多 8 位（¥100,000 × 100 = 10,000,000）
  const m = /^R(\d{13})_(\d{1,8})_([A-Z0-9]{4})$/.exec(s);
  if (!m) return null;
  const orderTs = Number(m[1]);
  const credits = Number(m[2]);
  if (!Number.isFinite(orderTs) || !Number.isFinite(credits)) return null;
  if (credits <= 0 || credits > MAX_CREDITS) return null;
  return { credits, orderTs };
}
