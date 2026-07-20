"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";

interface MyOfferItem {
  id: string;
  bargainNo: string;
  title: string;
  role: "buyer" | "seller";
  askingPrice: number;
  myOffer: number | null;
  bidStatus: string | null;
  bargainStatus: string;
  acceptedPrice: number | null;
  totalBids: number;
  createdAt: string;
  product: {
    id: string;
    modelName: string;
    year: number;
    brand: { nameZh: string; nameEn: string };
    images: { url: string }[];
  };
  seller: {
    id: string;
    companyName: string | null;
    username: string | null;
  };
}

const BID_STATUS_MAP: Record<string, { zh: string; en: string; color: string }> = {
  pending: { zh: "待回复", en: "Pending", color: "bg-amber-100 text-amber-700" },
  accepted: { zh: "已成交", en: "Accepted", color: "bg-green-100 text-green-700" },
  rejected: { zh: "已拒绝", en: "Rejected", color: "bg-gray-100 text-gray-500" },
};

const BARGAIN_STATUS_MAP: Record<string, { zh: string; en: string; color: string }> = {
  active: { zh: "议价中", en: "Active", color: "bg-blue-100 text-blue-700" },
  accepted: { zh: "已成交", en: "Sold", color: "bg-green-100 text-green-700" },
  cancelled: { zh: "已取消", en: "Cancelled", color: "bg-gray-100 text-gray-500" },
};

export default function MyOffersClient() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const [items, setItems] = useState<MyOfferItem[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("all");
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    fetchMyOffers();
  }, []);

  const fetchMyOffers = async () => {
    try {
      const res = await fetch("/api/auctions/my-offers", { credentials: "include" });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setItems(json.data || []);
          setStats(json.stats || { total: 0, pending: 0, accepted: 0, active: 0 });
        }
      }
    } catch (err) {
      console.error("Failed to fetch my offers:", err);
    } finally {
      setLoading(false);
    }
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-[#F9FAFC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{isZh ? "请先登录" : "Please login first"}</p>
          <Link href={`/${locale}/auth/login`} className="px-6 py-2 bg-[#1E40AF] text-white rounded-lg font-medium">
            {isZh ? "去登录" : "Login"}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  const filtered = tab === "all" ? items : items.filter((i) => i.role === tab);

  const statCards = [
    { label: isZh ? "总议价" : "Total", value: stats.total, color: "text-gray-900" },
    { label: isZh ? "进行中" : "Active", value: stats.active, color: "text-blue-600" },
    { label: isZh ? "待回复" : "Pending", value: stats.pending, color: "text-amber-600" },
    { label: isZh ? "已成交" : "Deals", value: stats.accepted, color: "text-green-600" },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{isZh ? "我的议价" : "My Offers"}</h1>
            <Link href={`/${locale}/auctions`} className="text-sm text-[#1E40AF] hover:underline">
              {isZh ? "浏览议价" : "Browse All"}
            </Link>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {statCards.map((stat, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-3 md:p-4">
                <p className={`text-xl md:text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex gap-6">
          {[
            { value: "all", label: isZh ? "全部" : "All" },
            { value: "buyer", label: isZh ? "我出价的" : "My Bids" },
            { value: "seller", label: isZh ? "我发布的" : "My Listings" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                tab === t.value
                  ? "border-[#1E40AF] text-[#1E40AF]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Offer List */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <p className="text-gray-400 text-lg">
              {isZh ? "暂无议价记录" : "No offers yet"}
            </p>
            <Link href={`/${locale}/auctions`} className="text-[#1E40AF] text-sm hover:underline mt-2 inline-block">
              {isZh ? "去议价" : "Start negotiating"}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const bidStatus = item.bidStatus ? BID_STATUS_MAP[item.bidStatus] : null;
              const bargainStatus = BARGAIN_STATUS_MAP[item.bargainStatus] || BARGAIN_STATUS_MAP.cancelled;
              const coverImg = item.product.images[0]?.url;
              const displayPrice = item.acceptedPrice || item.askingPrice;

              return (
                <Link
                  key={`${item.id}-${item.role}`}
                  href={`/${locale}/products/${item.product.id}#bargain`}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  {/* Image */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {coverImg ? (
                      <img src={coverImg} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">🚜</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.role === "buyer" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                      }`}>
                        {item.role === "buyer" ? (isZh ? "买家" : "Buyer") : (isZh ? "卖家" : "Seller")}
                      </span>
                      {bidStatus && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${bidStatus.color}`}>
                          {isZh ? bidStatus.zh : bidStatus.en}
                        </span>
                      )}
                      {!bidStatus && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${bargainStatus.color}`}>
                          {isZh ? bargainStatus.zh : bargainStatus.en}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                    <p className="text-sm text-gray-500">
                      {isZh ? item.product.brand.nameZh : item.product.brand.nameEn} {item.product.modelName} · {item.product.year}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{item.bargainNo}</p>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    {item.role === "buyer" && item.myOffer ? (
                      <>
                        <p className="text-xs text-gray-400">{isZh ? "我的报价" : "My Offer"}</p>
                        <p className="text-lg font-bold text-gray-900 font-mono">¥{item.myOffer.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {isZh ? "要价" : "Ask"}: ¥{item.askingPrice.toLocaleString()}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400">{isZh ? "要价" : "Asking"}</p>
                        <p className="text-lg font-bold text-gray-900 font-mono">¥{displayPrice.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {isZh ? `${item.totalBids} 人报价` : `${item.totalBids} offers`}
                        </p>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
