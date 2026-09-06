"use client";

/**
 * /membership 会员定价页（收银台）
 *
 * - 四档定价卡片（免费版列示作对比）
 * - isCnSite() 切换：.cn 显示 ¥ + 微信支付（即将开通）；.com 显示 $ + Stripe Checkout
 * - 月付/年付切换；年付展示划线价 + 上线期限时 9 折标
 * - 未登录 → 跳注册（带 redirect）；.com 已登录 → POST /api/billing/checkout；
 *   503（Stripe 未配）→ 降级邮箱收集（/api/subscribe, source=membership_waitlist）
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isCnSite } from "@/config/site";

type PaidTier = "basic" | "premium" | "enterprise";
type Tier = "free" | PaidTier;
type BillingCycle = "monthly" | "yearly";

/** 各档定价（老板拍板口径；年价已含 8.3 折） */
const PRICING: Record<
  "cn" | "com",
  { currency: string; plans: Record<PaidTier, { monthly: number; yearly: number }> }
> = {
  cn: {
    currency: "¥",
    plans: {
      basic: { monthly: 199, yearly: 1990 },
      premium: { monthly: 499, yearly: 4990 },
      enterprise: { monthly: 1999, yearly: 19990 },
    },
  },
  com: {
    currency: "$",
    plans: {
      basic: { monthly: 29, yearly: 290 },
      premium: { monthly: 79, yearly: 790 },
      enterprise: { monthly: 299, yearly: 2990 },
    },
  },
};

/** .com 会员档 → 现有 Stripe SKU（basic 无订阅 SKU，暂走增值包通道，实收以 SKU 中心表为准） */
const STRIPE_PLAN: Record<PaidTier, string> = {
  basic: "valuation_pack",
  premium: "premium",
  enterprise: "enterprise",
};

/** 上线期限时 9 折（年付，前端展示口径） */
const LIMITED_YEARLY_DISCOUNT = 0.9;

const TIER_ORDER: Tier[] = ["free", "basic", "premium", "enterprise"];
const HIGHLIGHT: PaidTier = "premium";

interface MeUser {
  membershipTier: string;
}

export function MembershipPricing({ locale }: { locale: string }) {
  const t = useTranslations("membership");
  const isCn = isCnSite();
  const siteKey: "cn" | "com" = isCn ? "cn" : "com";
  const { currency, plans } = PRICING[siteKey];

  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [user, setUser] = useState<MeUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [checkoutTier, setCheckoutTier] = useState<PaidTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<PaidTier | null>(null);
  const [showWaitlist, setShowWaitlist] = useState(false);

  // 未配 STRIPE_SECRET_KEY（.com 503）或 .cn 站：展示邮箱降级收集
  useEffect(() => {
    if (isCn) setShowWaitlist(true);
  }, [isCn]);

  useEffect(() => {
    fetch("/api/user/me", { method: "GET" })
      .then((res) => (res.status === 401 ? null : res.json()))
      .then((result) => {
        if (result && result.success) setUser(result.data);
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const currentTier = (user?.membershipTier || "free") as Tier;

  async function handleCheckout(tier: PaidTier) {
    setCheckoutTier(tier);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: STRIPE_PLAN[tier], currency: "USD" }),
      });
      if (res.status === 503) {
        // 支付通道未开放 → 降级邮箱收集
        setShowWaitlist(true);
        return;
      }
      const result = await res.json();
      if (result?.success && result?.data?.sessionUrl) {
        window.location.href = result.data.sessionUrl as string;
        return;
      }
      setCheckoutError(tier);
    } catch {
      setCheckoutError(tier);
    } finally {
      setCheckoutTier(null);
    }
  }

  function renderCta(tier: Tier) {
    if (authLoading) {
      return (
        <Button className="w-full" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("loading")}
        </Button>
      );
    }

    if (!user) {
      return (
        <Link href={`/${locale}/auth/register?redirect=/membership`} className="block">
          <Button
            className={
              tier === "free"
                ? "w-full border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                : "w-full"
            }
          >
            {tier === "free" ? t("cta.startFree") : t("cta.upgrade")}
          </Button>
        </Link>
      );
    }

    if (tier === "free") {
      return (
        <Button
          className="w-full border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
          disabled
        >
          {t("currentPlan")}
        </Button>
      );
    }

    if (currentTier === tier) {
      return (
        <Button
          className="w-full border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
          disabled
        >
          {t("currentPlan")}
        </Button>
      );
    }

    if (isCn) {
      // .cn：微信支付通道未开通 → disabled + 页面底部邮箱降级收集
      return (
        <Button className="w-full bg-gray-100 text-gray-900 hover:bg-gray-200" disabled>
          {t("cta.wechatPending")}
        </Button>
      );
    }

    // .com 已登录：POST 现有 Stripe Checkout API
    return (
      <div className="space-y-2">
        <Button
          className="w-full"
          disabled={checkoutTier !== null}
          onClick={() => handleCheckout(tier)}
        >
          {checkoutTier === tier ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {t("cta.stripePay")}
        </Button>
        {checkoutError === tier && (
          <p className="text-xs text-red-600">{t("checkoutError")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* 标题 */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-2 text-gray-500">{t("subtitle")}</p>
      </div>

      {/* 月付 / 年付 Toggle */}
      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          {(["monthly", "yearly"] as BillingCycle[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                cycle === c
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t(`billing.${c}`)}
              {c === "yearly" && (
                <span className="ml-2 rounded-full bg-accent-500/10 px-2 py-0.5 text-xs text-accent-600">
                  {t("saveBadge")}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 定价卡片 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const paid = tier !== "free" ? plans[tier as PaidTier] : null;
          const isHighlight = tier === HIGHLIGHT;
          const yearlyFinal = paid ? Math.round(paid.yearly * LIMITED_YEARLY_DISCOUNT) : 0;
          return (
            <Card
              key={tier}
              className={`relative flex flex-col space-y-4 p-6 ${
                isHighlight ? "border-primary-500 shadow-lg ring-1 ring-primary-500" : ""
              }`}
            >
              {isHighlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white">
                  {t("popular")}
                </span>
              )}
              <h2 className="text-lg font-semibold text-gray-900">
                {t(`tiers.${tier}`)}
              </h2>

              <div className="min-h-[4.5rem]">
                {paid ? (
                  cycle === "monthly" ? (
                    <p className="text-3xl font-bold text-gray-900">
                      {currency}
                      {paid.monthly}
                      <span className="text-sm font-normal text-gray-500">
                        {t("perMonth")}
                      </span>
                    </p>
                  ) : (
                    <div>
                      <p className="text-3xl font-bold text-gray-900">
                        {currency}
                        {yearlyFinal.toLocaleString()}
                        <span className="text-sm font-normal text-gray-500">
                          {t("perYear")}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        <span className="line-through">
                          {currency}
                          {paid.yearly.toLocaleString()}
                        </span>
                        <span className="ml-2 rounded bg-accent-500/10 px-1.5 py-0.5 text-xs text-accent-600">
                          {t("saveBadge")}
                        </span>
                      </p>
                    </div>
                  )
                ) : (
                  <p className="text-3xl font-bold text-gray-900">
                    {currency}0
                    <span className="text-sm font-normal text-gray-500">
                      {t("perMonth")}
                    </span>
                  </p>
                )}
              </div>

              <ul className="flex-1 space-y-2 text-sm text-gray-600">
                {(t.raw(`benefits.${tier}`) as string[]).map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {renderCta(tier)}
            </Card>
          );
        })}
      </div>

      {/* 降级邮箱收集（.cn 常驻；.com 在 Checkout 返回 503 时出现） */}
      {showWaitlist && <WaitlistCard />}

      {/* 信任条（仅 .cn；唯一标准称谓为「分会」，勿写作协会本级） */}
      {isCn && (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-gray-500">
          <ShieldCheck className="h-4 w-4 text-primary-500" />
          <span>{t("trust.cn")}</span>
        </div>
      )}
    </div>
  );
}

/** 支付通道未开放时的邮箱收集卡（建档赠送 7 天旗舰版体验） */
function WaitlistCard() {
  const t = useTranslations("membership.waitlist");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "membership_waitlist" }),
      });
      const result = await res.json();
      setState(result?.success ? "success" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <Card className="mx-auto mt-10 max-w-xl space-y-2 p-6 text-center">
        <p className="font-medium text-gray-900">{t("successTitle")}</p>
        <p className="text-sm text-gray-500">{t("successDesc")}</p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto mt-10 max-w-xl space-y-3 p-6">
      <h3 className="font-semibold text-gray-900">{t("title")}</h3>
      <p className="text-sm text-gray-500">{t("desc")}</p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("placeholder")}
          className="flex-1"
        />
        <Button type="submit" disabled={state === "loading"}>
          {t("submit")}
        </Button>
      </form>
      {state === "error" && <p className="text-xs text-red-600">{t("error")}</p>}
    </Card>
  );
}

export default MembershipPricing;
