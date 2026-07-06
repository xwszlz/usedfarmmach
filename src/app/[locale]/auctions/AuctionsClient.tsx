"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";

interface Auction {
  id: string;
  auctionNo: string;
  title: string;
  startPrice: number;
  reservePrice: number | null;
  deposit: number;
  startTime: string;
  endTime: string;
  status: string;
  winningBid: number | null;
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
  scheduled: { zh: "即将开始", en: "Upcoming", color: "bg-blue-100 text-blue-700" },
  live: { zh: "正在进行", en: "Live", color: "bg-red-100 text-red-700 animate-pulse" },
  ended: { zh: "已结束", en: "Ended", color: "bg-gray-100 text-gray-600" },
  cancelled: { zh: "已取消", en: "Cancelled", color: "bg-gray-100 text-gray-500" },
  settled: { zh: "已结算", en: "Settled", color: "bg-green-100 text-green-700" },
};

export default function AuctionsClient() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auctions?limit=50");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setAuctions(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch auctions:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === "all" ? auctions : auctions.filter((a) => a.status === filter);

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
          {isZh ? "在线竞拍" : "Online Auctions"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isZh ? "精选农机设备，公开竞价，透明交易" : "Premium equipment, open bidding, transparent trading"}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { value: "all", label: isZh ? "全部" : "All" },
          { value: "scheduled", label: isZh ? "即将开始" : "Upcoming" },
          { value: "live", label: isZh ? "正在进行" : "Live" },
          { value: "ended", label: isZh ? "已结束" : "Ended" },
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
            {isZh ? "暂无竞拍卖场" : "No auctions available"}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((auction) => {
            const status = STATUS_MAP[auction.status] || STATUS_MAP.ended;
            const now = new Date();
            const isLive = auction.status === "live";
            const isUpcoming = auction.status === "scheduled";
            const endTime = new Date(auction.endTime);
            const startTime = new Date(auction.startTime);

            return (
              <Link
                key={auction.id}
                href={`/${locale}/auctions/${auction.id}`}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Image */}
                <div className="relative h-48 bg-gray-100">
                  {auction.coverImage || auction.product.images[0]?.url ? (
                    <img
                      src={auction.coverImage || auction.product.images[0]?.url}
                      alt={auction.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-gray-300">No Image</span>
                    </div>
                  )}
                  <span className={`absolute top-3 left-3 px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                    {isZh ? status.zh : status.en}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate">{auction.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {auction.product.brand.nameZh} {auction.product.modelName} · {auction.product.year}
                  </p>

                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <p className="text-xs text-gray-400">
                        {isZh ? "起拍价" : "Start Price"}
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        ¥{auction.startPrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {isZh ? "出价次数" : "Bids"}
                      </p>
                      <p className="text-lg font-semibold text-gray-700">
                        {auction._count.bids}
                      </p>
                    </div>
                  </div>

                  {/* Time info */}
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    {isLive ? (
                      <span className="text-red-600 font-medium">
                        {isZh ? "剩余" : "Ends in"}: {formatTimeLeft(endTime, now)}
                      </span>
                    ) : isUpcoming ? (
                      <span>
                        {isZh ? "开始" : "Starts"}: {startTime.toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                      </span>
                    ) : (
                      <span>
                        {auction.winningBid
                          ? `${isZh ? "成交价" : "Sold"}: ¥${auction.winningBid.toLocaleString()}`
                          : (isZh ? "已流拍" : "No sale")}
                      </span>
                    )}
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

function formatTimeLeft(endTime: Date, now: Date): string {
  const diff = endTime.getTime() - now.getTime();
  if (diff <= 0) return "00:00:00";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
