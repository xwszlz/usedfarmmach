/**
 * Stripe 支付集成（仅 .com 国际站使用，仅外币）
 *
 * 职责：
 *  - 创建 Stripe Checkout Session（增值服务费 / 会员订阅）
 *  - 提供 Webhook 验签入口（供 /api/webhooks/stripe 使用）
 *
 * 红线：
 *  - 本文件只负责「生成收银台链接」，真实资金流在 Stripe 闭环，网站永不直接收单。
 *  - 仅当 isComSite() 时由路由层启用；本文件不主动读取 SITE，由调用方守卫。
 *  - 不写 CreditTransaction / 额度增发；会员升级与 UsageLog 由 webhook 路由负责。
 *
 * 依赖：stripe（已加入 package.json）
 * 若沙箱无网络导致 stripe 未安装，需要 src/types/payments.d.ts 提供最小环境声明，
 * 否则 tsc 会报「找不到模块 "stripe"」。
 */

import Stripe from "stripe";
import { isComSite, SITE } from "@/config/site";
import { prisma } from "@/lib/db";

/** 支持的计划（SKU） */
export type StripePlan =
  | "valuation_pack"
  | "intel_pack"
  | "premium"
  | "enterprise";

/** 支持的外币 */
export type StripeCurrency = "USD" | "EUR" | "GBP";

/** 单个 SKU 的元信息（价格在文件内定义，单位：分） */
interface PlanMeta {
  /** 展示名称 */
  name: string;
  /** Checkout 模式：订阅 or 一次性支付 */
  mode: "subscription" | "payment";
  /** 各币种单价（分） */
  prices: Record<StripeCurrency, number>;
}

/**
 * SKU 价格表（中心化管理）
 * - valuation_pack / intel_pack：单次增值包，mode=payment
 * - premium / enterprise：会员订阅，mode=subscription
 */
export const SKU: Record<StripePlan, PlanMeta> = {
  valuation_pack: {
    name: "AI 估值增值包",
    mode: "payment",
    prices: { USD: 2900, EUR: 2700, GBP: 2400 },
  },
  intel_pack: {
    name: "市场情报增值包",
    mode: "payment",
    prices: { USD: 4900, EUR: 4500, GBP: 4100 },
  },
  premium: {
    name: "Premium 会员",
    mode: "subscription",
    prices: { USD: 1900, EUR: 1700, GBP: 1600 },
  },
  enterprise: {
    name: "Enterprise 会员",
    mode: "subscription",
    prices: { USD: 9900, EUR: 9000, GBP: 8400 },
  },
};

/** 计划 → 会员等级映射（webhook 升级用） */
const PLAN_TO_TIER: Record<StripePlan, "basic" | "premium" | "enterprise"> = {
  valuation_pack: "basic",
  intel_pack: "basic",
  premium: "premium",
  enterprise: "enterprise",
};

/** 计划 → UsageLog action 映射（仅增值包写 UsageLog） */
const PLAN_TO_ACTION: Record<StripePlan, "aiValuation" | "intel" | "membership"> = {
  valuation_pack: "aiValuation",
  intel_pack: "intel",
  premium: "membership",
  enterprise: "membership",
};

export function isStripePlan(value: unknown): value is StripePlan {
  return typeof value === "string" && value in SKU;
}

export function isStripeCurrency(value: unknown): value is StripeCurrency {
  return value === "USD" || value === "EUR" || value === "GBP";
}

/** 计划 → 会员等级 */
export function mapPlanToMembershipTier(plan: StripePlan): "basic" | "premium" | "enterprise" {
  return PLAN_TO_TIER[plan];
}

/** 计划 → UsageLog action */
export function mapPlanToUsageAction(plan: StripePlan): "aiValuation" | "intel" | "membership" {
  return PLAN_TO_ACTION[plan];
}

/**
 * 写入/更新 BillingOrder（.com + Stripe 下单留痕，含 site / provider 归因）。
 * 幂等：按 stripeSessionId upsert。供 createCheckoutSession 与 webhook 共用，
 * 确保无论下单还是支付回调，都能定位到「这是一笔 .com 站、走 Stripe 的订单」。
 *
 * 红线：site 取运行期 SITE（.com 站恒为 "com"），provider 固定 "stripe"；
 *       本文件不涉及 wechat/alipay——那些是 .cn 站的合法通道，与此模型无关。
 */
export async function recordBillingOrder(input: {
  userId: string;
  plan: StripePlan;
  sku?: string;
  currency: string;
  amount: number;
  sessionId: string;
  paymentIntentId?: string | null;
  subscriptionId?: string | null;
  status?: "created" | "completed" | "refunded" | "failed";
}): Promise<void> {
  const site = SITE; // 由构建期/运行期 SITE 决定；.com 站恒为 "com"
  await prisma.billingOrder.upsert({
    where: { stripeSessionId: input.sessionId },
    update: {
      status: input.status ?? "created",
      stripePaymentIntentId: input.paymentIntentId ?? undefined,
      stripeSubscriptionId: input.subscriptionId ?? undefined,
    },
    create: {
      userId: input.userId,
      site,
      provider: "stripe",
      plan: input.plan,
      sku: input.sku ?? input.plan,
      amount: input.amount,
      currency: input.currency,
      status: input.status ?? "created",
      stripeSessionId: input.sessionId,
      stripePaymentIntentId: input.paymentIntentId ?? null,
      stripeSubscriptionId: input.subscriptionId ?? null,
    },
  });
}

export interface RefundResult {
  refundId: string;
  status: string;
  amount: number | null;
}

/**
 * 发起 Stripe 退款（部分或全额）。
 *
 * 红线（Fail-closed）：未配置 STRIPE_SECRET_KEY 一律抛错，绝不静默继续；
 * 需要提供 paymentIntentId 或 chargeId 之一，二者皆缺则抛错。
 */
export async function refundStripeCharge(input: {
  paymentIntentId?: string;
  chargeId?: string;
  amount?: number; // 单位：分，缺省为全额退款
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}): Promise<RefundResult> {
  if (!isConfigured()) {
    throw new Error("Stripe 未配置，无法发起退款");
  }
  if (!input.paymentIntentId && !input.chargeId) {
    throw new Error("退款需要提供 paymentIntentId 或 chargeId");
  }
  const refund = await getStripe().refunds.create({
    ...(input.paymentIntentId
      ? { payment_intent: input.paymentIntentId }
      : { charge: input.chargeId as string }),
    ...(input.amount != null ? { amount: input.amount } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  });
  return {
    refundId: refund.id,
    status: refund.status ?? "pending",
    amount: refund.amount,
  };
}

/** 域名（成功/取消回跳用） */
function getSiteDomain(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";
}

/** Stripe 是否已配置（STRIPE_SECRET_KEY 存在） */
export function isConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let stripeInstance: Stripe | null = null;

/** 懒加载 Stripe 客户端（避免无密钥时构造报错） */
function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY 未配置，无法创建 Stripe 客户端");
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

export interface CreateCheckoutSessionInput {
  userId: string;
  plan: StripePlan;
  currency: StripeCurrency;
  /** 已存在的 Stripe customer id（可选，由调用方 upsert 后传入） */
  stripeCustomerId?: string;
  /** 透传 SKU 标识（可选，默认取 plan） */
  sku?: string;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  sessionUrl: string | null;
}

/**
 * 创建 Stripe Checkout Session。
 * 使用 price_data 内联价格，避免依赖预创建的 Stripe Price ID。
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
  if (!isComSite()) {
    throw new Error("Stripe 仅在国际站(.com)启用");
  }
  if (!isConfigured()) {
    throw new Error("Stripe 未配置");
  }

  const { userId, plan, currency, stripeCustomerId, sku } = input;
  const meta = SKU[plan];
  const amount = meta.prices[currency];
  const domain = getSiteDomain();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: amount,
        product_data: {
          name: meta.name,
          metadata: { plan, site: "com", sku: sku ?? plan },
        },
        ...(meta.mode === "subscription"
          ? { recurring: { interval: "month" } }
          : {}),
      },
    },
  ];

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: meta.mode,
    client_reference_id: userId,
    line_items: lineItems,
    success_url: `${domain}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${domain}/billing/cancel`,
    metadata: { plan, site: "com", sku: sku ?? plan },
    ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
    ...(meta.mode === "subscription"
      ? {
          subscription_data: {
            metadata: { plan, site: "com" },
          },
        }
      : {}),
  };

  const session = await getStripe().checkout.sessions.create(params);

  // 一次性支付：session.payment_intent 立即可见；订阅：session.subscription 立即可见。
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  // 留痕：.com + Stripe 下单记录（幂等；webhook 后续会更新为 completed/refunded）
  await recordBillingOrder({
    userId,
    plan,
    sku,
    currency,
    amount,
    sessionId: session.id,
    paymentIntentId,
    subscriptionId,
    status: "created",
  });

  return {
    sessionId: session.id,
    sessionUrl: session.url,
  };
}

/**
 * 获取或创建 Stripe Customer，并写/更新本地 StripeCustomer 关联。
 * 幂等：按 userId 查重，存在则直接返回已缓存的 stripeCustomerId。
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email?: string | null
): Promise<string> {
  if (!isComSite()) {
    throw new Error("Stripe 仅在国际站(.com)启用");
  }
  if (!isConfigured()) {
    throw new Error("Stripe 未配置");
  }

  const existing = await prisma.stripeCustomer.findUnique({ where: { userId } });
  if (existing) return existing.stripeCustomerId;

  const customer = await getStripe().customers.create({
    metadata: { userId, site: "com" },
    ...(email ? { email } : {}),
  });

  const created = await prisma.stripeCustomer.create({
    data: { userId, stripeCustomerId: customer.id },
  });
  return created.stripeCustomerId;
}

/** 获取 Stripe 订阅详情（webhook 取 current_period_end 用） */
export async function retrieveStripeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!isConfigured()) return null;
  try {
    return await getStripe().subscriptions.retrieve(subscriptionId);
  } catch {
    return null;
  }
}

/**
 * 验签 Stripe Webhook 原始请求体。
 * 必须在路由内用 `await request.text()` 取到原始 body 后调用。
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET 未配置，无法验签 Webhook");
  }
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}
