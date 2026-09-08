"use client";

/**
 * /membership 会员定价页（收银台）
 *
 * - 四档定价卡片（免费版列示作对比）
 * - 价格统一取自 @/lib/membership/pricing（唯一价格来源，杜绝「页面显示 A 价、实际扣 B 价」）
 * - 月付/年付切换；年付划线价 = 月付 × 12，直观体现年付优惠
 * - .com 已登录 → POST /api/billing/checkout（Stripe，既有链路，未改动）
 * - .cn  已登录 → POST /api/membership/checkout（微信 Native 扫码，普通商户直收增值费）
 *   503（支付未配置）→ 降级邮箱收集（/api/subscribe, source=membership_waitlist）
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isCnSite } from "@/config/site";
import { MEMBERSHIP_PRICING, type BillingCycle } from "@/lib/membership/pricing";

type PaidTier = "basic" | "premium" | "enterprise";
type Tier = "free" | PaidTier;

/** .com 会员档 → 现有 Stripe SKU（basic 无订阅 SKU，暂走增值包通道，实收以 SKU 中心表为准） */
const STRIPE_PLAN: Record<PaidTier, string> = {
  basic: "valuation_pack",
  premium: "premium",
  enterprise: "enterprise",
};

const TIER_ORDER: Tier[] = ["free", "basic", "premium", "enterprise"];
const HIGHLIGHT: PaidTier = "premium";

interface MeUser {
  membershipTier: string;
  membershipExpiresAt?: string | null;
}

export function MembershipPricing({ locale }: { locale: string }) {
  const t = useTranslations("membership");
  const isCn = isCnSite();

  const currency = isCn ? "¥" : "$";
  /** 从唯一价格源派生，.cn 取人民币、.com 取美元 */
  const plans = (["basic", "premium", "enterprise"] as PaidTier[]).reduce(
    (acc, tier) => {
      const p = MEMBERSHIP_PRICING[tier];
      acc[tier] = {
        monthly: isCn ? p.cnyMonthly : p.usdMonthly,
        yearly: isCn ? p.cnyYearly : p.usdYearly,
      };
      return acc;
    },
    {} as Record<PaidTier, { monthly: number; yearly: number }>
  );

  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [user, setUser] = useState<MeUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [checkoutTier, setCheckoutTier] = useState<PaidTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<PaidTier | null>(null);
  // 存真实错误文案：只显示 i18n 通用文案的话，出错时根本看不出微信返回了什么
  const [checkoutErrorMsg, setCheckoutErrorMsg] = useState<Partial<Record<PaidTier, string>>>({});
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [qr, setQr] = useState<{ url: string; type: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPoll, [stopPoll]);

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

  // ---------- .com：Stripe（既有链路，未改动） ----------
  async function handleStripeCheckout(tier: PaidTier) {
    setCheckoutTier(tier);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: STRIPE_PLAN[tier], currency: "USD" }),
      });
      if (res.status === 503) {
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

  // ---------- .cn：微信 Native 扫码 ----------
  async function handleWechatCheckout(tier: PaidTier) {
    setCheckoutTier(tier);
    setCheckoutError(null);
    // 快照：用于轮询时判断「有效期是否真的被延长」
    const prevExpiry = user?.membershipExpiresAt
      ? new Date(user.membershipExpiresAt).getTime()
      : 0;
    const prevTier = currentTier;
    try {
      const res = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, channel: "wechat", cycle }),
      });
      if (res.status === 503) {
        setShowWaitlist(true);
        return;
      }
      const result = await res.json();
      if (!result?.success || !result?.data?.codeUrl) {
        setCheckoutError(tier);
        setCheckoutErrorMsg((prev) => ({
          ...prev,
          [tier]: result?.error || "下单失败（未返回支付二维码）",
        }));
        return;
      }

      // 生成二维码（qrcode 已在 package.json；失败则降级为原始码串）
      let dataUrl = "";
      try {
        const QRCodeMod = await import("qrcode").catch(() => null);
        if (QRCodeMod?.default) {
          dataUrl = await QRCodeMod.default.toDataURL(result.data.codeUrl);
        }
      } catch {
        dataUrl = "";
      }
      setQr({ url: dataUrl || result.data.codeUrl, type: result.data.type });

      // 轮询：支付成功后自动刷新，无需手动刷新页面
      stopPoll();
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries += 1;
        if (tries > 60) {
          stopPoll();
          return;
        }
        try {
          const r = await fetch("/api/user/me");
          if (!r.ok) return;
          const j = await r.json();
          const nowTier = j?.data?.membershipTier || "free";
          const nowExpiry = j?.data?.membershipExpiresAt
            ? new Date(j.data.membershipExpiresAt).getTime()
            : 0;
          // 升档：档位真的变了即判定成功
          const upgraded = prevTier !== tier && nowTier === tier;
          // 续费：档位不变，必须比较有效期是否真被延长。
          // 若只用 nowTier === tier 判定，存量会员点「续费」会在首次轮询就误判成功、
          // 二维码直接消失、用户以为已付 —— 续费功能对老会员 100% 不可用。
          const extended = nowExpiry > prevExpiry + 60_000;
          if (upgraded || extended) {
            stopPoll();
            setQr(null);
            setUser(j.data);
          }
        } catch {
          /* 忽略单次轮询失败 */
        }
      }, 3000);
    } catch (e: any) {
      setCheckoutError(tier);
      setCheckoutErrorMsg((prev) => ({
        ...prev,
        [tier]: e?.message || "网络错误，请稍后重试",
      }));
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

    if (tier === "free" || currentTier === tier) {
      return (
        <Button
          className="w-full border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
          disabled={tier === "free" || checkoutTier !== null}
          onClick={currentTier === tier && tier !== "free" ? () => handlePay(tier as PaidTier) : undefined}
        >
          {tier === "free"
            ? t("currentPlan")
            : checkoutTier === tier
              ? "处理中…"
              : isCn
                ? "续费"
                : t("currentPlan")}
        </Button>
      );
    }

    return (
      <div className="space-y-2">
        <Button
          className="w-full"
          disabled={checkoutTier !== null}
          onClick={() => handlePay(tier as PaidTier)}
        >
          {checkoutTier === tier ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isCn ? "微信支付" : t("cta.stripePay")}
        </Button>
        {checkoutError === tier && (
          <p className="break-all text-xs text-red-600">
            {checkoutErrorMsg[tier as PaidTier] || t("checkoutError")}
          </p>
        )}
      </div>
    );
  }

  function handlePay(tier: PaidTier) {
    if (isCn) {
      void handleWechatCheckout(tier);
    } else {
      void handleStripeCheckout(tier);
    }
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
          // 年付划线价 = 月付 × 12（真实可核对，不用虚高的假原价）
          const yearlyList = paid ? paid.monthly * 12 : 0;
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
                        {paid.yearly.toLocaleString()}
                        <span className="text-sm font-normal text-gray-500">
                          {t("perYear")}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        <span className="line-through">
                          {currency}
                          {yearlyList.toLocaleString()}
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

      {/* 微信扫码支付弹层（.cn） */}
      {qr && (
        <Card className="mx-auto mt-10 max-w-sm space-y-3 p-6 text-center">
          <p className="text-sm text-gray-600">请使用微信扫码支付</p>
          {qr.url.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr.url} alt="微信支付二维码" className="mx-auto h-48 w-48" />
          ) : (
            <code className="block break-all rounded bg-gray-100 p-2 text-xs">
              {qr.url}
            </code>
          )}
          <p className="text-xs text-gray-400">支付成功后本页自动更新，无需刷新</p>
          <Button
            className="w-full border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            onClick={() => {
              stopPoll();
              setQr(null);
            }}
          >
            取消支付
          </Button>
        </Card>
      )}

      {/* 降级邮箱收集（支付通道未配置时出现） */}
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
