"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Award, Building2, UserCheck, Truck, Star, TrendingUp } from "lucide-react";
import { FollowButton } from "@/components/favorite/favorite-button";

interface TrustProfile {
  seller: {
    id: string;
    companyName: string | null;
    country: string | null;
    role: string;
    membershipTier: string;
    createdAt: string;
  };
  trustProfile: {
    trustLevel: string;
    certBadges: { type: string; label: string; validUntil: string | null }[];
    ratingStats: {
      avgScore: number;
      ratingCount: number;
      avgItemMatch: number;
      avgService: number;
      avgLogistics: number;
      ratingDistribution: { star: number; count: number }[];
    };
    productCount: number;
    activeProductCount: number;
    memberSince: string;
  };
}

const TRUST_LEVEL_CONFIG: Record<string, { label: string; labelEn: string; color: string; icon: typeof Award }> = {
  gold: { label: "金牌卖家", labelEn: "Gold Seller", color: "text-amber-600 bg-amber-50 border-amber-200", icon: Award },
  verified: { label: "认证卖家", labelEn: "Verified Seller", color: "text-blue-600 bg-blue-50 border-blue-200", icon: ShieldCheck },
  certified: { label: "已认证", labelEn: "Certified", color: "text-green-600 bg-green-50 border-green-200", icon: ShieldCheck },
  basic: { label: "普通卖家", labelEn: "Basic", color: "text-gray-600 bg-gray-50 border-gray-200", icon: Building2 },
};

const CERT_ICONS: Record<string, typeof Building2> = {
  institution: Building2,
  personnel: UserCheck,
  vehicle: Truck,
};

export function SellerTrustCard({
  sellerId,
  sellerName,
  locale,
}: {
  sellerId: string;
  sellerName?: string;
  locale: string;
}) {
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isZh = locale === "zh";

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/seller/${sellerId}/trust-profile`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [sellerId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-400">
          {isZh ? "加载卖家信息..." : "Loading seller info..."}
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const { trustLevel, certBadges, ratingStats, productCount, activeProductCount, memberSince } = profile.trustProfile;
  const levelConfig = TRUST_LEVEL_CONFIG[trustLevel] || TRUST_LEVEL_CONFIG.basic;
  const LevelIcon = levelConfig.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {isZh ? "卖家信息" : "Seller Info"}
          </span>
          <Badge className={`${levelConfig.color} border`}>
            <LevelIcon className="mr-1 h-3.5 w-3.5" />
            {isZh ? levelConfig.label : levelConfig.labelEn}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seller name + follow */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">{sellerName || profile.seller.companyName || (isZh ? "未命名卖家" : "Unnamed Seller")}</p>
            <p className="text-xs text-gray-500">
              {isZh ? "入驻时间" : "Member since"}: {new Date(memberSince).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
            </p>
          </div>
          <FollowButton sellerId={sellerId} locale={locale} />
        </div>

        {/* Certifications */}
        {certBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {certBadges.map((cert, i) => {
              const Icon = CERT_ICONS[cert.type] || ShieldCheck;
              return (
                <div
                  key={i}
                  className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cert.label}
                  {cert.validUntil && (
                    <span className="text-green-400">
                      ({new Date(cert.validUntil).toLocaleDateString(isZh ? "zh-CN" : "en-US", { year: "numeric", month: "short" })})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Rating summary */}
        {ratingStats.ratingCount > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl font-bold text-gray-900">{ratingStats.avgScore}</span>
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-xs text-gray-500">
                {isZh ? `${ratingStats.ratingCount} 条评价` : `${ratingStats.ratingCount} ratings`}
              </p>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{isZh ? "物品相符" : "Item Match"}</span>
                <span className="font-medium text-gray-700">{ratingStats.avgItemMatch}/5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{isZh ? "服务态度" : "Service"}</span>
                <span className="font-medium text-gray-700">{ratingStats.avgService}/5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{isZh ? "物流速度" : "Logistics"}</span>
                <span className="font-medium text-gray-700">{ratingStats.avgLogistics}/5</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-400">
            {isZh ? "暂无评价" : "No ratings yet"}
          </div>
        )}

        {/* Product stats */}
        <div className="flex items-center justify-around border-t pt-3 text-sm">
          <div className="text-center">
            <div className="flex items-center gap-1 font-semibold text-gray-900">
              <TrendingUp className="h-4 w-4 text-primary-500" />
              {activeProductCount}
            </div>
            <p className="text-xs text-gray-500">{isZh ? "在售设备" : "Active"}</p>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">{productCount}</div>
            <p className="text-xs text-gray-500">{isZh ? "总发布" : "Total"}</p>
          </div>
          {profile.seller.membershipTier && profile.seller.membershipTier !== "free" && (
            <div className="text-center">
              <div className="font-semibold text-primary-600 uppercase">{profile.seller.membershipTier}</div>
              <p className="text-xs text-gray-500">{isZh ? "会员等级" : "Membership"}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
