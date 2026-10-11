"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card } from "@/components/ui/card";


interface MeUser {
  membershipTier: string;
  membershipExpiresAt: string | null;
  credits: number;
}

interface MembershipCardProps {
  locale: string;
}

export function MembershipCard({ locale }: MembershipCardProps) {
  const t = useTranslations("credits");
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    // 走 cookie 会话鉴权：浏览器对同源请求自动附带 httpOnly cookie
    // 不再读取 localStorage token（与 middleware / 真实登录态一致）
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

  if (loading) {
    return (
      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{t("membershipStatus")}</h2>
        <p className="text-sm text-gray-400">{t("refresh")}…</p>
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

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("membershipStatus")}</h2>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
          {user?.credits || 0} {t("creditUnit")}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>{t("creditsBalance")}</span>
          <span className="font-semibold text-gray-900">{user?.credits || 0} {t("creditUnit")}</span>
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

      {/* 免费功能说明：发布产品 / 发送询盘 / 查看联系方式 不再以「月度额度」形式展示，
          这三个动作本身完全免费、不消耗积分。
          （后端仍保留统一的月度防滥用上限，那是另一套机制，与积分无关） */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <span className="text-sm font-medium text-gray-800">{t("freeFeaturesTitle")}</span>
        <p className="text-sm text-gray-600">{t("freeFeaturesBody")}</p>
      </div>

      {/* 充值入口：跳转 /credits 积分中心充值（取消会员档位后统一走积分） */}
      <Link href={`/${locale}/credits`} className="block">
        <Button className="w-full">{t("upgradeNow")}</Button>
      </Link>
    </Card>
  );
}
