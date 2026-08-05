"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MEMBERSHIP_TIERS, type MembershipTier } from "@/lib/permissions";

interface MeUser {
  membershipTier: string;
  membershipExpiresAt: string | null;
  credits: number;
}

interface QuotaItem {
  action: string;
  used: number;
  limit: number;
  remaining: number;
}

interface QuotaState {
  periodStart: string;
  resetAt: string;
  items: QuotaItem[];
}

interface MembershipCardProps {
  locale: string;
}

export function MembershipCard({ locale }: MembershipCardProps) {
  const t = useTranslations("credits");
  const tq = useTranslations("quota");
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [quota, setQuota] = useState<QuotaState | null>(null);

  useEffect(() => {
    //  ? cookie 会话鉴权：浏览器对同源请求自动附 ? httpOnly cookie ?
    // 不再读取 localStorage token（与 middleware / 真实登录态一致） ?
    fetch("/api/user/me", { method: "GET" })
      .then((res) => {
        if (res.status === 401) {
          setAuthed(false);
          return null;
        }
        return res.json();
      })
      .then((result) => {
        if (result && result.success) setUser(result.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch("/api/user/quota", { method: "GET" })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result && result.success) setQuota(result.data);
      })
      .catch(() => {});
  }, [authed]);

  if (loading) {
    return (
      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{t("membershipStatus")}</h2>
        <p className="text-sm text-gray-400">{t("refresh")} ?</p>
      </Card>
    );
  }

  if (!authed) {
    return (
      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-gray-500">{t("pleaseLogin")}</p>
      </Card>
    );
  }

  const tier = (user?.membershipTier || "free") as MembershipTier;
  const tierConfig = MEMBERSHIP_TIERS[tier] || MEMBERSHIP_TIERS.free;
  // label 仅含 zh/en/ru，其 ? locale 回退 ? zh
  const tierLabel =
    (tierConfig.label as Record<string, string>)[locale] ||
    tierConfig.label.zh ||
    tier;

  const tierColors: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    basic: "bg-blue-100 text-blue-700",
    premium: "bg-amber-100 text-amber-700",
    enterprise: "bg-purple-100 text-purple-700",
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("membershipStatus")}</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${tierColors[tier]}`}>
          {tierLabel}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>{t("creditsBalance")}</span>
          <span className="font-semibold text-gray-900">{user?.credits || 0}  ?</span>
        </div>
        {user?.membershipExpiresAt && (
          <div className="flex justify-between">
            <span>{t("validUntil")}</span>
            <span>
              {new Date(user.membershipExpiresAt).toLocaleDateString(
                locale === "zh" ? "zh-CN" : locale
              )}
            </span>
          </div>
        )}
      </div>

      {quota && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">{tq("title")}</span>
            <span className="text-xs text-gray-400">
              {tq("resetAt")}:{" "}
              {new Date(quota.resetAt).toLocaleDateString(locale === "zh" ? "zh-CN" : locale)}
            </span>
          </div>
          <div className="space-y-3">
            {quota.items.map((it) => {
              const isUnlimited = it.limit === -1;
              const exhausted = !isUnlimited && it.remaining <= 0;
              const pct = !isUnlimited ? Math.min(100, Math.round((it.used / it.limit) * 100)) : 0;
              return (
                <div key={it.action} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{tq(`actions.${it.action}`)}</span>
                    <span className={exhausted ? "font-semibold text-red-600" : "text-gray-900"}>
                      {tq("used")} {it.used}
                      {isUnlimited
                        ? ` (${tq("unlimited")})`
                        : ` / ${tq("remaining")} ${it.remaining} (${it.limit})`}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full ${exhausted ? "bg-red-500" : "bg-blue-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {quota.items.some((it) => it.limit !== -1 && it.remaining <= 0) && (
            <p className="text-xs text-red-600">
              {tq("exhausted")}{" "}
              <Link href={`/${locale}/membership`} className="underline">
                {tq("upgrade")}
              </Link>
            </p>
          )}
        </div>
      )}

      {/* 真实支付接入前，升级按钮置灰 ?"即将上线"（P0 I-6 ? */}
      <Button className="w-full" disabled title={t("upgradeComingSoon")}>
        {tier === "enterprise" ? t("alreadyHighest") : t("upgradeComingSoon")}
      </Button>
    </Card>
  );
}
