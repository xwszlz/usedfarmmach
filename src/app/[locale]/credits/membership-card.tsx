"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface MembershipCardProps {
  locale: string;
}

export function MembershipCard({ locale }: MembershipCardProps) {
  const t = useTranslations("credits");
  const [user, setUser] = useState<{
    membershipTier: string;
    membershipExpiresAt: string | null;
    credits: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/me", { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setUser(result.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Card className="p-6">加载中...</Card>;

  const tier = user?.membershipTier || "free";
  const tierLabels: Record<string, string> = {
    free: "免费用户",
    basic: "普通会员",
    premium: "高级会员",
    enterprise: "企业会员",
  };

  const tierColors: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    basic: "bg-blue-100 text-blue-700",
    premium: "bg-amber-100 text-amber-700",
    enterprise: "bg-purple-100 text-purple-700",
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">会员状态</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${tierColors[tier]}`}>
          {tierLabels[tier] || "免费用户"}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>积分余额</span>
          <span className="font-semibold text-gray-900">{user?.credits || 0} 分</span>
        </div>
        {user?.membershipExpiresAt && (
          <div className="flex justify-between">
            <span>到期时间</span>
            <span>{new Date(user.membershipExpiresAt).toLocaleDateString("zh-CN")}</span>
          </div>
        )}
      </div>

      <Button
        className="w-full"
        onClick={() => {
          const tiers = ["basic", "premium", "enterprise"];
          const names = ["普通会员", "高级会员", "企业会员"];
          const idx = tiers.indexOf(tier);
          const next = idx >= 0 ? idx + 1 : 0;
          if (next < tiers.length) {
            upgradeMembership(tiers[next], names[next]);
          }
        }}
      >
        {tier === "enterprise" ? "已是最高等级" : "升级会员"}
      </Button>
    </Card>
  );
}

async function upgradeMembership(tier: string, tierName: string) {
  const confirmed = confirm(`确认升级到${tierName}？（模拟支付）`);
  if (!confirmed) return;

  const res = await fetch("/api/credits/charge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ type: "membership", tier, months: 1 }),
  });
  const result = await res.json();
  if (result.success) {
    alert("升级成功！");
    window.location.reload();
  } else {
    alert(result.error || "升级失败");
  }
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
