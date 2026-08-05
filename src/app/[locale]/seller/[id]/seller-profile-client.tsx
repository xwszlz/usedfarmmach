"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Award, Building2, UserCheck, Truck, Star, TrendingUp, Package, Calendar } from "lucide-react";
import Link from "next/link";
import { getImageUrl } from "@/lib/image-url";
import { formatPrice } from "@/lib/utils";
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
    certifications: any[];
    ratingStats: {
      avgScore: number;
      ratingCount: number;
      avgItemMatch: number;
      avgService: number;
      avgLogistics: number;
      ratingDistribution: { star: number; count: number }[];
    };
    recentRatings: any[];
    productCount: number;
    activeProductCount: number;
    activeProducts: SellerProduct[];
    memberSince: string;
  };
}

interface SellerProduct {
  id: string;
  modelName: string;
  year: number;
  priceCny: number;
  condition: string;
  brand: { nameZh: string; nameEn: string };
  images: { url: string }[];
}

const TRUST_LEVEL_CONFIG: Record<string, { label: string; labelEn: string; color: string }> = {
  gold: { label: "金牌卖家", labelEn: "Gold Seller", color: "text-amber-600 bg-amber-50 border-amber-300" },
  verified: { label: "认证卖家", labelEn: "Verified Seller", color: "text-blue-600 bg-blue-50 border-blue-300" },
  certified: { label: "已认证", labelEn: "Certified", color: "text-green-600 bg-green-50 border-green-300" },
  basic: { label: "普通卖家", labelEn: "Basic", color: "text-gray-600 bg-gray-50 border-gray-200" },
};

export function SellerProfileClient({
  sellerId,
  locale,
}: {
  sellerId: string;
  locale: string;
}) {
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isZh = locale === "zh";

  useEffect(() => {
    async function fetchAll() {
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
    fetchAll();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-center text-gray-400">{isZh ? "加载中..." : "Loading..."}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-center text-gray-400">{isZh ? "卖家未找到" : "Seller not found"}</p>
      </div>
    );
  }

  const { trustLevel, certBadges, ratingStats, recentRatings, productCount, activeProductCount, memberSince, certifications, activeProducts } = profile.trustProfile;
  const levelConfig = TRUST_LEVEL_CONFIG[trustLevel] || TRUST_LEVEL_CONFIG.basic;
  const sellerName = profile.seller.companyName || (isZh ? "未命名卖家" : "Unnamed Seller");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Seller header */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
                <Building2 className="h-8 w-8 text-primary-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{sellerName}</h1>
                  <Badge className={`${levelConfig.color} border`}>
                    {isZh ? levelConfig.label : levelConfig.labelEn}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                  {profile.seller.country && <span>{profile.seller.country}</span>}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {isZh ? "入驻于" : "Joined"} {new Date(memberSince).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                  </span>
                </div>
              </div>
            </div>
            <FollowButton sellerId={sellerId} locale={locale} />
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-gray-900">
                {ratingStats.avgScore > 0 ? ratingStats.avgScore : "-"}
                {ratingStats.avgScore > 0 && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
              </div>
              <p className="text-xs text-gray-500">{isZh ? "综合评分" : "Rating"}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-gray-900">
                <Package className="h-4 w-4 text-primary-500" />
                {activeProductCount}
              </div>
              <p className="text-xs text-gray-500">{isZh ? "在售设备" : "Active"}</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{productCount}</div>
              <p className="text-xs text-gray-500">{isZh ? "总发布" : "Total Listed"}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-gray-900">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                {certBadges.length}
              </div>
              <p className="text-xs text-gray-500">{isZh ? "认证数" : "Certs"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Products */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isZh ? "在售设备" : "Active Listings"}
          </h2>
          {activeProducts.length === 0 ? (
            <p className="text-sm text-gray-400">{isZh ? "暂无在售设备" : "No active listings"}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {activeProducts.map((product) => (
                <Link key={product.id} href={`/${locale}/products/${product.id}`}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-32 bg-gray-100">
                      {product.images[0] ? (
                        <img src={getImageUrl(product.images[0].url)} alt={product.modelName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">No img</div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {isZh ? product.brand.nameZh : product.brand.nameEn} {product.modelName}
                      </p>
                      <p className="text-xs text-gray-500">{product.year} · {product.condition}</p>
                      <p className="mt-1 text-sm font-semibold text-primary-600">{formatPrice(product.priceCny, "cny")}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right: Certifications + Ratings */}
        <div className="space-y-4">
          {/* Certifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                {isZh ? "认证信息" : "Certifications"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {certifications.length === 0 ? (
                <p className="text-sm text-gray-400">{isZh ? "暂无认证" : "No certifications"}</p>
              ) : (
                certifications.map((cert, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-green-50 p-2 text-sm">
                    {cert.certType === "institution" && <Building2 className="h-4 w-4 text-green-600" />}
                    {cert.certType === "personnel" && <UserCheck className="h-4 w-4 text-green-600" />}
                    {cert.certType === "vehicle" && <Truck className="h-4 w-4 text-green-600" />}
                    <div>
                      <p className="font-medium text-green-800">
                        {cert.certType === "institution" ? (isZh ? "机构认证" : "Institution") :
                         cert.certType === "personnel" ? (isZh ? "人员认证" : "Personnel") :
                         (isZh ? "车辆认证" : "Vehicle")}
                      </p>
                      <p className="text-xs text-green-600">{cert.applicantName}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Rating distribution */}
          {ratingStats.ratingCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 text-amber-400" />
                  {isZh ? "评价分布" : "Rating Distribution"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ratingStats.ratingDistribution.map((d) => (
                  <div key={d.star} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-gray-500">{d.star}{isZh ? "星" : "★"}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${ratingStats.ratingCount > 0 ? (d.count / ratingStats.ratingCount) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-gray-500">{d.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent ratings */}
          {recentRatings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{isZh ? "最新评价" : "Recent Reviews"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentRatings.slice(0, 5).map((rating, i) => (
                  <div key={i} className="border-b last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {rating.rater?.companyName || rating.rater?.username || (isZh ? "匿名用户" : "Anonymous")}
                      </span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3 w-3 ${s <= rating.score ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                          />
                        ))}
                      </div>
                    </div>
                    {rating.comment && <p className="mt-1 text-xs text-gray-600">{rating.comment}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
