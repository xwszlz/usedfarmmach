"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";

interface AuctionDetail {
  id: string;
  auctionNo: string;
  title: string;
  description: string | null;
  startPrice: number;
  reservePrice: number | null;
  priceIncrement: number;
  deposit: number;
  startTime: string;
  endTime: string;
  status: string;
  winnerId: string | null;
  winningBid: number | null;
  totalBids: number;
  totalBidders: number;
  product: {
    id: string;
    modelName: string;
    year: number;
    workingHours: number | null;
    condition: string;
    priceCny: number;
    location: string;
    descriptionZh: string | null;
    descriptionEn: string | null;
    brand: { nameZh: string; nameEn: string };
    images: { id: string; url: string }[];
  };
  seller: {
    id: string;
    companyName: string | null;
    username: string | null;
    phone: string | null;
    country: string | null;
  };
  bids: {
    id: string;
    amount: number;
    isWinning: boolean;
    createdAt: string;
    bidder: { id: string; companyName: string | null; username: string | null };
  }[];
}

export default function AuctionDetailClient() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const params = useParams();
  const auctionId = params.id as string;

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [bidding, setBidding] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(new Date());

  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${auctionId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setAuction(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch auction:", err);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchAuction();
    const interval = setInterval(fetchAuction, 10000); // 10秒刷新
    return () => clearInterval(interval);
  }, [fetchAuction]);

  // 更新当前时间
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBid = async () => {
    if (!auction) return;
    setBidding(true);
    setMessage("");
    try {
      const res = await fetch(`/api/auctions/${auction.id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: parseFloat(bidAmount) }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(isZh ? "出价成功！" : "Bid placed successfully!");
        setBidAmount("");
        fetchAuction();
      } else {
        setMessage(json.error || (isZh ? "出价失败" : "Bid failed"));
      }
    } catch (err) {
      setMessage(isZh ? "出价失败，请登录" : "Bid failed, please login");
    } finally {
      setBidding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">{isZh ? "竞拍不存在" : "Auction not found"}</p>
      </div>
    );
  }

  const isLive = auction.status === "live";
  const endTime = new Date(auction.endTime);
  const currentBid = auction.bids[0]?.amount || auction.startPrice;
  const minNextBid = currentBid + auction.priceIncrement;

  const timeLeft = endTime.getTime() - now.getTime();
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: Images */}
        <div>
          {auction.product.images[0] ? (
            <img
              src={auction.product.images[0].url}
              alt={auction.title}
              className="w-full rounded-xl object-cover aspect-square"
            />
          ) : (
            <div className="w-full rounded-xl bg-gray-100 aspect-square flex items-center justify-center">
              <span className="text-gray-300">No Image</span>
            </div>
          )}
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {auction.product.images.slice(1, 6).map((img) => (
              <img key={img.id} src={img.url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Right: Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              auction.status === "live" ? "bg-red-100 text-red-700 animate-pulse" :
              auction.status === "scheduled" ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {auction.status === "live" ? (isZh ? "进行中" : "LIVE") :
               auction.status === "scheduled" ? (isZh ? "即将开始" : "Upcoming") :
               (isZh ? "已结束" : "Ended")}
            </span>
            <span className="text-sm text-gray-400 font-mono">{auction.auctionNo}</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">{auction.title}</h1>
          <p className="text-gray-500 mt-1">
            {auction.product.brand.nameZh} {auction.product.modelName} · {auction.product.year}
            {auction.product.workingHours && ` · ${auction.product.workingHours}h`}
          </p>

          {/* Current bid */}
          <div className="bg-blue-50 rounded-xl p-4 mt-4">
            <p className="text-sm text-gray-500">
              {auction.bids.length > 0 ? (isZh ? "当前最高出价" : "Current Highest Bid") : (isZh ? "起拍价" : "Starting Price")}
            </p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              ¥{currentBid.toLocaleString()}
            </p>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span>{isZh ? "加价幅度" : "Increment"}: ¥{auction.priceIncrement.toLocaleString()}</span>
              <span>{isZh ? "出价次数" : "Total Bids"}: {auction.totalBids}</span>
              <span>{isZh ? "参拍人数" : "Bidders"}: {auction.totalBidders}</span>
            </div>
          </div>

          {/* Countdown */}
          {isLive && timeLeft > 0 && (
            <div className="bg-red-50 rounded-xl p-4 mt-3 text-center">
              <p className="text-sm text-red-600 font-medium">{isZh ? "距竞拍结束" : "Time Left"}</p>
              <p className="text-2xl font-bold text-red-600 mt-1 font-mono">
                {days > 0 && `${days}d `}
                {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </p>
            </div>
          )}

          {/* Bid form */}
          {isLive && timeLeft > 0 && (
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`${isZh ? "最低出价" : "Min bid"}: ¥${minNextBid.toLocaleString()}`}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleBid}
                  disabled={bidding || !bidAmount}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 transition-colors"
                >
                  {bidding ? "..." : (isZh ? "出价" : "Bid")}
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setBidAmount(String(minNextBid))}
                  className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200"
                >
                  ¥{minNextBid.toLocaleString()}
                </button>
                <button
                  onClick={() => setBidAmount(String(minNextBid + auction.priceIncrement * 2))}
                  className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200"
                >
                  ¥{(minNextBid + auction.priceIncrement * 2).toLocaleString()}
                </button>
                <button
                  onClick={() => setBidAmount(String(minNextBid + auction.priceIncrement * 5))}
                  className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200"
                >
                  ¥{(minNextBid + auction.priceIncrement * 5).toLocaleString()}
                </button>
              </div>
              {message && (
                <p className={`mt-2 text-sm ${message.includes("成功") || message.includes("success") ? "text-green-600" : "text-red-600"}`}>
                  {message}
                </p>
              )}
            </div>
          )}

          {/* Result */}
          {auction.status === "ended" && (
            <div className={`mt-4 rounded-xl p-4 ${auction.winningBid ? "bg-green-50" : "bg-gray-50"}`}>
              {auction.winningBid ? (
                <>
                  <p className="text-green-600 font-medium">
                    {isZh ? "竞拍成交" : "Auction Won"}
                  </p>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    ¥{auction.winningBid.toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="text-gray-500 font-medium">
                  {isZh ? "竞拍流拍（未达保留价）" : "Auction ended without meeting reserve"}
                </p>
              )}
            </div>
          )}

          {/* Product info */}
          <div className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{isZh ? "设备状况" : "Condition"}</span>
              <span className="text-gray-900">{auction.product.condition}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{isZh ? "所在地" : "Location"}</span>
              <span className="text-gray-900">{auction.product.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{isZh ? "原价" : "List Price"}</span>
              <span className="text-gray-900">¥{auction.product.priceCny.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{isZh ? "卖家" : "Seller"}</span>
              <span className="text-gray-900">{auction.seller.companyName || auction.seller.username || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {auction.product.descriptionZh && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {isZh ? "设备描述" : "Description"}
          </h2>
          <p className="text-gray-700 whitespace-pre-wrap">
            {isZh ? auction.product.descriptionZh : (auction.product.descriptionEn || auction.product.descriptionZh)}
          </p>
        </div>
      )}

      {/* Bid history */}
      {auction.bids.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isZh ? "出价记录" : "Bid History"}
          </h2>
          <div className="space-y-2">
            {auction.bids.map((bid, idx) => (
              <div
                key={bid.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  bid.isWinning ? "bg-green-50 border border-green-200" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-6">#{idx + 1}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {bid.bidder.companyName || bid.bidder.username || (isZh ? "匿名用户" : "Anonymous")}
                  </span>
                  {bid.isWinning && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                      {isZh ? "中标" : "Won"}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">¥{bid.amount.toLocaleString()}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {new Date(bid.createdAt).toLocaleString(isZh ? "zh-CN" : "en-US")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
