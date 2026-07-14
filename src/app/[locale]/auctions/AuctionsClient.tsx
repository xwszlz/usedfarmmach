"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";

interface Bargain {
  id: string;
  bargainNo: string;
  title: string;
  askingPrice: number;
  status: string;
  acceptedPrice: number | null;
  totalBids: number;
  totalBidders: number;
  coverImage: string | null;
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
  _count: { bids: number };
}

const STATUS_MAP: Record<string, { zh: string; en: string; color: string }> = {
  active: { zh: "议价中", en: "Open", color: "bg-green-100 text-green-700" },
  accepted: { zh: "已成交", en: "Sold", color: "bg-blue-100 text-blue-700" },
  cancelled: { zh: "已取消", en: "Cancelled", color: "bg-gray-100 text-gray-500" },
};

export default function BargainsClient() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const [bargains, setBargains] = useState<Bargain[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchBargains();
  }, []);

  const fetchBargains = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auctions?limit=50");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setBargains(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch bargains:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === "all" ? bargains : bargains.filter((b) => b.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isZh ? "在线议价" : "Price Negotiation"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isZh ? "精选二手农机，直接报价，卖家自主选择是否成交" : "Premium used farm machinery — make your best offer"}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { value: "all", label: isZh ? "全部" : "All" },
          { value: "active", label: isZh ? "议价中" : "Open" },
          { value: "accepted", label: isZh ? "已成交" : "Sold" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <p className="text-gray-400 text-lg">
            {isZh ? "暂无议价商品" : "No bargains available"}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((bargain) => {
            const status = STATUS_MAP[bargain.status] || STATUS_MAP.cancelled;
            const displayPrice = bargain.acceptedPrice || bargain.askingPrice;

            return (
              <Link
                key={bargain.id}
                href={`/${locale}/auctions/${bargain.id}`}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Image */}
                <div className="relative h-48 bg-gray-100">
                  {bargain.coverImage || bargain.product.images[0]?.url ? (
                    <img
                      src={bargain.coverImage || bargain.product.images[0]?.url}
                      alt={bargain.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-gray-300">{isZh ? "暂无图片" : "No Image"}</span>
                    </div>
                  )}
                  <span className={`absolute top-3 left-3 px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                    {isZh ? status.zh : status.en}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate">{bargain.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {bargain.product.brand.nameZh} {bargain.product.modelName} · {bargain.product.year}
                  </p>

                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <p className="text-xs text-gray-400">
                        {bargain.status === "accepted"
                          ? (isZh ? "成交价" : "Sold Price")
                          : (isZh ? "卖家要价" : "Asking Price")}
                      </p>
                      <p className={`text-lg font-bold ${
                        bargain.status === "accepted" ? "text-green-600" : "text-blue-600"
                      }`}>
                        ¥{displayPrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {isZh ? "报价人数" : "Offers"}
                      </p>
                      <p className="text-lg font-semibold text-gray-700">
                        {bargain._count.bids}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
