"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Award, Building2, UserCheck, Truck, Star, TrendingUp } from "lucide-react";
import { FollowButton } from "@/components/favorite/favorite-button";
import { useTr } from "@/lib/i18n-tr";
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
        certBadges: {
            type: string;
            label: string;
            validUntil: string | null;
        }[];
        ratingStats: {
            avgScore: number;
            ratingCount: number;
            avgItemMatch: number;
            avgService: number;
            avgLogistics: number;
            ratingDistribution: {
                star: number;
                count: number;
            }[];
        };
        productCount: number;
        activeProductCount: number;
        memberSince: string;
    };
}
function getTRUST_LEVEL_CONFIG(tr: (s: string) => string): Record<string, {
    label: string;
    labelEn: string;
    color: string;
    icon: typeof Award;
}> {
  return {
    gold: { label: tr("金牌卖家"), labelEn: "Gold Seller", color: "text-amber-600 bg-amber-50 border-amber-200", icon: Award },
    verified: { label: tr("认证卖家"), labelEn: "Verified Seller", color: "text-blue-600 bg-blue-50 border-blue-200", icon: ShieldCheck },
    certified: { label: tr("已认证"), labelEn: "Certified", color: "text-green-600 bg-green-50 border-green-200", icon: ShieldCheck },
    basic: { label: tr("普通卖家"), labelEn: "Basic", color: "text-gray-600 bg-gray-50 border-gray-200", icon: Building2 },
};
}
const CERT_ICONS: Record<string, typeof Building2> = {
    institution: Building2,
    personnel: UserCheck,
    vehicle: Truck,
};
export function SellerTrustCard({ sellerId, sellerName, locale, }: {
    sellerId: string;
    sellerName?: string;
    locale: string;
}) {
  const tr = useTr();
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
            }
            catch {
                // ignore
            }
            finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [sellerId]);
    if (loading) {
        return (<Card>
        <CardContent className="py-6 text-center text-sm text-gray-400">
          {isZh ? "\u52A0\u8F7D\u5356\u5BB6\u4FE1\u606F..." : "Loading seller info..."}
        </CardContent>
      </Card>);
    }
    if (!profile)
        return null;
    const { trustLevel, certBadges, ratingStats, productCount, activeProductCount, memberSince } = profile.trustProfile;
    const levelConfig = getTRUST_LEVEL_CONFIG(tr)[trustLevel] || getTRUST_LEVEL_CONFIG(tr).basic;
    const LevelIcon = levelConfig.icon;
    return (<Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {isZh ? "\u5356\u5BB6\u4FE1\u606F" : "Seller Info"}
          </span>
          <Badge className={`${levelConfig.color} border`}>
            <LevelIcon className="mr-1 h-3.5 w-3.5"/>
            {isZh ? levelConfig.label : levelConfig.labelEn}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seller name + follow */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">{sellerName || profile.seller.companyName || (isZh ? "\u672A\u547D\u540D\u5356\u5BB6" : "Unnamed Seller")}</p>
            <p className="text-xs text-gray-500">
              {isZh ? "\u5165\u9A7B\u65F6\u95F4" : "Member since"}: {new Date(memberSince).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
            </p>
          </div>
          <FollowButton sellerId={sellerId} locale={locale}/>
        </div>

        {/* Certifications */}
        {certBadges.length > 0 && (<div className="flex flex-wrap gap-2">
            {certBadges.map((cert, i) => {
                const Icon = CERT_ICONS[cert.type] || ShieldCheck;
                return (<div key={i} className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                  <Icon className="h-3.5 w-3.5"/>
                  {cert.label}
                  {cert.validUntil && (<span className="text-green-400">
                      ({new Date(cert.validUntil).toLocaleDateString(isZh ? "zh-CN" : "en-US", { year: "numeric", month: "short" })})
                    </span>)}
                </div>);
            })}
          </div>)}

        {/* Rating summary */}
        {ratingStats.ratingCount > 0 ? (<div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl font-bold text-gray-900">{ratingStats.avgScore}</span>
                <Star className="h-4 w-4 fill-amber-400 text-amber-400"/>
              </div>
              <p className="text-xs text-gray-500">
                {isZh ? `${ratingStats.ratingCount} 条评价` : `${ratingStats.ratingCount} ratings`}
              </p>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{isZh ? "\u7269\u54C1\u76F8\u7B26" : "Item Match"}</span>
                <span className="font-medium text-gray-700">{ratingStats.avgItemMatch}/5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{isZh ? "\u670D\u52A1\u6001\u5EA6" : "Service"}</span>
                <span className="font-medium text-gray-700">{ratingStats.avgService}/5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{isZh ? "\u7269\u6D41\u901F\u5EA6" : "Logistics"}</span>
                <span className="font-medium text-gray-700">{ratingStats.avgLogistics}/5</span>
              </div>
            </div>
          </div>) : (<div className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-400">
            {isZh ? "\u6682\u65E0\u8BC4\u4EF7" : "No ratings yet"}
          </div>)}

        {/* Product stats */}
        <div className="flex items-center justify-around border-t pt-3 text-sm">
          <div className="text-center">
            <div className="flex items-center gap-1 font-semibold text-gray-900">
              <TrendingUp className="h-4 w-4 text-primary-500"/>
              {activeProductCount}
            </div>
            <p className="text-xs text-gray-500">{isZh ? "\u5728\u552E\u8BBE\u5907" : "Active"}</p>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">{productCount}</div>
            <p className="text-xs text-gray-500">{isZh ? "\u603B\u53D1\u5E03" : "Total"}</p>
          </div>
          {profile.seller.membershipTier && profile.seller.membershipTier !== "free" && (<div className="text-center">
              <div className="font-semibold text-primary-600 uppercase">{profile.seller.membershipTier}</div>
              <p className="text-xs text-gray-500">{isZh ? "\u4F1A\u5458\u7B49\u7EA7" : "Membership"}</p>
            </div>)}
        </div>
      </CardContent>
    </Card>);
}
