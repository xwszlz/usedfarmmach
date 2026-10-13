/**
 * Paddle 支付集成（仅 .com 国际站使用；本版仅 USD）
 *
 * 职责：
 *  - 创建 Paddle Billing Transaction（积分充值 / 会员订阅 / 增值包）
 *  - 提供 Webhook 验签入口（供 /api/webhooks/paddle 使用）
 *
 * 红线：
 *  - Paddle 是 Merchant of Record（MoR）：法律上的「销售方」是 Paddle，我们是 vendor。
 *    全球 VAT/GST 由 Paddle 负责计算、代收并代缴；本站既不申报、也不代持这笔税。
 *    收费标的是 AI 估值 / 套利日报 / 销售策略这类「信息服务费」，不是农机交易佣金。
 *  - 本文件只负责「创建结账 + 验签」，真实资金流在 Paddle 闭环，网站永不直接收单。
 *  - 仅当 isComSite() 时由路由层启用；本文件不主动读取 SITE，由调用方守卫。
 *  - 不写 CreditTransaction / 不增发额度；加积分由 /api/webhooks/paddle 路由负责。
 *
 * 依赖：不引入任何第三方 SDK。验签用 Node 内置 crypto，HTTP 用全局 fetch，
 * 以满足「本次改造不新增 npm 依赖」的约束（因此不碰 package.json）。
 *
 * ⚠️ 上线前置条件（需在 Paddle 后台由老板确认，详见交付报告）：
 *  1. transaction.checkout.url 返回的并不是 Paddle 托管收银台，而是
 *     「本站已审批域名 + _ptxn=<transaction id>」的支付链接；该落地页必须加载
 *     Paddle.js，才会自动弹出结账浮层。前端直接 window.location.href 跳转，
 *     只会回到本站页面而不会打开收银台。
 *  2. 内联价格（non-catalog product + non-catalog price）是否被当前 Paddle 账号
 *     接受，需实测；若不接受，配置 PADDLE_PRICE_ID_CREDITS_USD 走目录价格即可。
 *  3. items[].price.product.tax_category 暂取 "digital-goods"（数字信息服务），
 *     最终口径以 Paddle 后台审核为准。
 */

import crypto from "crypto";
import { isComSite } from "@/config/site";
import { getMembershipUsdCents } from "@/lib/membership/pricing";

/** 支持的币种（本版 .com 只支持 USD） */
export type PaddleCurrency = "USD";

/** Paddle 是否已配置（PADDLE_API_KEY 存在） */
export function isConfigured(): boolean {
  return !!process.env.PADDLE_API_KEY;
}

/** API 基址：PADDLE_ENV=sandbox 走沙箱，缺省（含 production）走生产 */
function getApiBase(): string {
  return process.env.PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

/** 域名（结账回跳用）；与支付模块 getSiteDomain() 保持同一口径 */
function getSiteDomain(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
}

/**
 * 创建「积分充值」Paddle Transaction（一次性支付，仅 .com）。
 * 口径：$1 = 100 积分 => 1 积分 = $0.01 = 1 分，故「积分充值 c 积分」= c 美分
 *      （c = floor(美元金额 × 100)，数值上就是最小货币单位「分」，无需再乘 100）。
 * custom_data.plan = "credit_recharge" 供 webhook 识别后加积分。
 *
 * 价格模式二选一（防御性）：
 *  - 配了 PADDLE_PRICE_ID_CREDITS_USD → 走目录价格（items[].price_id）
 *  - 未配 → 走内联价格（items[].price + price.product，即 non-catalog）
 *    原因：老板尚未在 Paddle 后台建 Product/Price，内联价格可先跑通，
 *    建好后填 env 即可切换，无需改代码。
 */
export async function createCreditRechargeTransaction(input: {
  userId: string;
  credits: number;
  currency: PaddleCurrency;
}): Promise<{ checkoutUrl: string; transactionId: string }> {
  if (!isComSite()) {
    throw new Error("Paddle 仅在国际站(.com)启用");
  }
  if (!isConfigured()) {
    throw new Error("Paddle 未配置");
  }

  const { userId, credits, currency } = input;
  const c = Math.max(1, Math.floor(credits));
  // $1 = 100 积分 -> 1 积分 = 1 分：c 本身已是「分」（最小货币单位）
  const unitAmount = c;
  const domain = getSiteDomain();

  const priceId = process.env.PADDLE_PRICE_ID_CREDITS_USD;
  const items = [
    priceId
      ? { quantity: 1, price_id: priceId }
      : {
          quantity: 1,
          price: {
            name: `积分充值 ${c} 积分`,
            description: `Credit recharge ${c} credits ($1 = 100 credits)`,
            // Paddle 要求 amount 为字符串形式的最小货币单位整数
            unit_price: { amount: String(unitAmount), currency_code: currency },
            // non-catalog product：与 price 同级嵌套在 price 内（Paddle API v1）
            product: {
              name: "AI 信息服务积分充值",
              description:
                "AI 估值 / 套利日报 / 销售策略等信息服务的预付费积分（信息服务费，非实物、非交易佣金）",
              tax_category: "digital-goods",
            },
          },
        },
  ];

  const res = await fetch(`${getApiBase()}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items,
      currency_code: currency,
      custom_data: {
        plan: "credit_recharge",
        site: "com",
        userId,
        credits: c,
      },
      checkout: { url: `${domain}/credits?recharge=success` },
    }),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.error?.detail ?? text.slice(0, 500);
    throw new Error(`Paddle 创建交易失败 status=${res.status} body=${detail}`);
  }

  const checkoutUrl: string | undefined = data?.data?.checkout?.url;
  const transactionId: string | undefined = data?.data?.id;
  if (!checkoutUrl || !transactionId) {
    throw new Error(
      `Paddle 创建交易响应缺少 checkout.url / id：${text.slice(0, 500)}`
    );
  }

  return { checkoutUrl, transactionId };
}

/**
 * 校验 Paddle Webhook 签名。
 * 签名头 paddle-signature 形如：ts=1671552777;h1=<hex hmac>
 * 验签：HMAC-SHA256(secret, `${ts}:${rawBody}`) 的 hex 与 h1 做常量时间比较。
 *
 * 红线（Fail-closed）：PADDLE_WEBHOOK_SECRET 缺失直接抛错，绝不静默放过。
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): { ts: string; h1: string } {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("PADDLE_WEBHOOK_SECRET 未配置，无法验签 Paddle Webhook");
  }

  let ts = "";
  let h1 = "";
  for (const part of signature.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === "ts") ts = val;
    if (key === "h1") h1 = val;
  }
  if (!ts || !h1) {
    throw new Error("Paddle 签名头格式非法：缺少 ts 或 h1");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}:${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(h1, "utf8");
  // 先判长度再比：timingSafeEqual 长度不等会抛异常
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Paddle Webhook 验签失败");
  }

  return { ts, h1 };
}

// ============================================================
// 会员订阅 / 增值包（.com 支付链路迁移至 Paddle；计划名与旧支付 SKU 同名，前端无感）
// ============================================================

/** 会员/增值包计划（与旧支付 SKU 同名，前端无感） */
export type PaddlePlan =
  | "valuation_pack"
  | "intel_pack"
  | "premium"
  | "enterprise";

/** 计划元信息：收费模式 / 会员等级 / UsageLog action */
export const PADDLE_SKU: Record<
  PaddlePlan,
  {
    /** subscription = 订阅续费；payment = 一次性支付 */
    mode: "payment" | "subscription";
    tier: "basic" | "premium" | "enterprise";
    action: "aiValuation" | "intel" | "membership";
  }
> = {
  valuation_pack: { mode: "payment", tier: "basic", action: "aiValuation" },
  intel_pack: { mode: "payment", tier: "basic", action: "intel" },
  premium: { mode: "subscription", tier: "premium", action: "membership" },
  enterprise: { mode: "subscription", tier: "enterprise", action: "membership" },
};

/** 计划展示名（Paddle 收银台 / 账单展示） */
const PADDLE_PLAN_NAME: Record<PaddlePlan, string> = {
  valuation_pack: "AI 估值增值包",
  intel_pack: "市场情报增值包",
  premium: "Premium 会员订阅",
  enterprise: "Enterprise 会员订阅",
};

/** 计划 → 会员等级映射（webhook 升级用） */
export function mapPlanToMembershipTier(
  plan: PaddlePlan
): "basic" | "premium" | "enterprise" {
  return PADDLE_SKU[plan].tier;
}

/** 计划 → UsageLog action 映射（webhook 记用量用） */
export function mapPlanToUsageAction(
  plan: PaddlePlan
): "aiValuation" | "intel" | "membership" {
  return PADDLE_SKU[plan].action;
}

export function isPaddlePlan(value: unknown): value is PaddlePlan {
  return typeof value === "string" && value in PADDLE_SKU;
}

/**
 * 创建「会员订阅 / 增值包」Paddle Transaction（仅 .com）。
 *
 * 金额必须取自唯一价格源 @/lib/membership/pricing 的 getMembershipUsdCents（美元价），
 * 再换算为最小货币单位（分）：unitAmount = getMembershipUsdCents(tier, cycle) * 100。
 * ⚠️ 这修正了一个现存 bug：旧支付 SKU 表 premium=$19 / enterprise=$99，
 *    而页面展示的是 pricing.ts 的 $29 / $79 / $299（页面显示价与实扣价不一致）；
 *    迁移后以 pricing.ts（页面同源）为准，杜绝「显示 A 价、扣 B 价」。
 *
 * 价格模式二选一（防御性，与积分充值一致）：
 *  - 订阅档：配了 PADDLE_PRICE_ID_MEMBERSHIP_<TIER>_<CYCLE> 走目录价格
 *    （如 PADDLE_PRICE_ID_MEMBERSHIP_PREMIUM_MONTHLY / ..._PREMIUM_YEARLY）；
 *  - 未配 → 走内联价格（non-catalog）。订阅内联价带 billing_cycle
 *    （interval: month|year, frequency: 1），一次性档不带。
 *
 * custom_data: { plan, site: "com", userId, tier, cycle } 供 webhook 履约识别。
 */
export async function createMembershipTransaction(input: {
  userId: string;
  plan: PaddlePlan;
  cycle: "monthly" | "yearly";
}): Promise<{ checkoutUrl: string; transactionId: string }> {
  if (!isComSite()) {
    throw new Error("Paddle 仅在国际站(.com)启用");
  }
  if (!isConfigured()) {
    throw new Error("Paddle 未配置");
  }

  const { userId, plan, cycle } = input;
  const meta = PADDLE_SKU[plan];
  const domain = getSiteDomain();
  // 唯一价格源：pricing.ts 的美元价（元）→ 分（最小货币单位）
  const unitAmount = getMembershipUsdCents(meta.tier, cycle) * 100;

  // 订阅档 env 价格 ID（未配则内联）；一次性档无目录价概念，恒定内联
  const priceId =
    meta.mode === "subscription"
      ? process.env[
          `PADDLE_PRICE_ID_MEMBERSHIP_${meta.tier.toUpperCase()}_${cycle.toUpperCase()}`
        ]
      : undefined;

  const items = [
    priceId
      ? { quantity: 1, price_id: priceId }
      : {
          quantity: 1,
          price: {
            name: PADDLE_PLAN_NAME[plan],
            description: `神雕农机 ${PADDLE_PLAN_NAME[plan]}（${cycle === "yearly" ? "年付" : "月付"}）`,
            // Paddle 要求 amount 为字符串形式的最小货币单位整数
            unit_price: { amount: String(unitAmount), currency_code: "USD" },
            // 订阅档：内联 recurring 价需显式声明计费周期（Paddle API v1 形状）
            ...(meta.mode === "subscription"
              ? {
                  billing_cycle: {
                    interval: cycle === "yearly" ? "year" : "month",
                    frequency: 1,
                  },
                }
              : {}),
            // non-catalog product：与 price 同级嵌套在 price 内（Paddle API v1）
            product: {
              name: "神雕农机会员与增值服务",
              description:
                "AI 估值 / 套利日报 / 销售策略等信息服务的会员订阅与增值包（信息服务费，非实物、非交易佣金）",
              tax_category: "digital-goods",
            },
          },
        },
  ];

  const res = await fetch(`${getApiBase()}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items,
      currency_code: "USD",
      custom_data: {
        plan,
        site: "com",
        userId,
        tier: meta.tier,
        cycle,
      },
      checkout: { url: `${domain}/billing/success` },
    }),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.error?.detail ?? text.slice(0, 500);
    throw new Error(`Paddle 创建交易失败 status=${res.status} body=${detail}`);
  }

  const checkoutUrl: string | undefined = data?.data?.checkout?.url;
  const transactionId: string | undefined = data?.data?.id;
  if (!checkoutUrl || !transactionId) {
    throw new Error(
      `Paddle 创建交易响应缺少 checkout.url / id：${text.slice(0, 500)}`
    );
  }

  return { checkoutUrl, transactionId };
}

/**
 * 发起 Paddle 退款（全额）。
 *
 * POST {apiBase}/adjustments，body: { action: "refund", transaction_id, reason }。
 *
 * 注意：Paddle 的部分退款需要逐 item 指定 item_id + amount（adjustments 的
 * items[] 数组），形状并不简单；本函数只做全额退款，部分退款请到 Paddle 后台操作。
 * reason 缺省 "requested_by_customer"。
 */
export async function refundPaddleTransaction(input: {
  transactionId: string;
  reason?: string;
}): Promise<{ refundId: string; status: string }> {
  if (!isConfigured()) {
    throw new Error("Paddle 未配置，无法发起退款");
  }

  const res = await fetch(`${getApiBase()}/adjustments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "refund",
      transaction_id: input.transactionId,
      reason: input.reason ?? "requested_by_customer",
    }),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.error?.detail ?? text.slice(0, 500);
    throw new Error(`Paddle 创建退款失败 status=${res.status} body=${detail}`);
  }

  const refundId: string | undefined = data?.data?.id;
  const status: string = data?.data?.status ?? "pending_approval";
  if (!refundId) {
    throw new Error(`Paddle 退款响应缺少 id：${text.slice(0, 500)}`);
  }

  return { refundId, status };
}

/**
 * 查询 Paddle 订阅（webhook 取 current_billing_period.ends_at 用）。
 * 返回 ISO 字符串或 null；失败返回 null 不抛（webhook 有 CYCLE_DAYS 兜底）。
 */
export async function getPaddleSubscription(
  subscriptionId: string
): Promise<string | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${getApiBase()}/subscriptions/${subscriptionId}`, {
      headers: {
        Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const data: any = await res.json().catch(() => null);
    const endsAt: string | undefined = data?.data?.current_billing_period?.ends_at;
    return endsAt ?? null;
  } catch {
    return null;
  }
}
