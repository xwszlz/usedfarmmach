"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";

interface BargainDetail {
  id: string;
  bargainNo: string;
  title: string;
  description: string | null;
  askingPrice: number;
  status: string;
  acceptedBidId: string | null;
  acceptedPrice: number | null;
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
    status: string;
    createdAt: string;
    bidder: { id: string; companyName: string | null; username: string | null };
  }[];
}

export default function BargainDetailClient() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const params = useParams();
  const bargainId = params.id as string;

  const [bargain, setBargain] = useState<BargainDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerAmount, setOfferAmount] = useState("");
  const [offering, setOffering] = useState(false);
  const [message, setMessage] = useState("");
  const [sellerActionLoading, setSellerActionLoading] = useState(false);

  // 获取当前登录用户（简单 localStorage 读取）
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setCurrentUserId(u.id || null);
      } catch {}
    }
  }, []);

  const fetchBargain = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${bargainId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setBargain(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch bargain:", err);
    } finally {
      setLoading(false);
    }
  }, [bargainId]);

  useEffect(() => {
    fetchBargain();
    const interval = setInterval(fetchBargain, 15000);
    return () => clearInterval(interval);
  }, [fetchBargain]);

  const handleOffer = async () => {
    if (!bargain) return;
    setOffering(true);
    setMessage("");
    try {
      const res = await fetch(`/api/auctions/${bargain.id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: parseFloat(offerAmount) }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(isZh ? "报价提交成功！等待卖家回复" : "Offer submitted! Waiting for seller response");
        setOfferAmount("");
        fetchBargain();
      } else {
        setMessage(json.error || (isZh ? "报价失败" : "Offer failed"));
      }
    } catch (err) {
      setMessage(isZh ? "提交失败，请先登录" : "Failed, please login first");
    } finally {
      setOffering(false);
    }
  };

  const handleAccept = async (bidId: string) => {
    if (!bargain) return;
    setSellerActionLoading(true);
    try {
      const res = await fetch(`/api/auctions/${bargain.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bidId }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(isZh ? "已接受报价，议价成交！" : "Offer accepted, deal made!");
        fetchBargain();
      } else {
        setMessage(json.error || (isZh ? "操作失败" : "Action failed"));
      }
    } catch (err) {
      setMessage(isZh ? "操作失败" : "Action failed");
    } finally {
      setSellerActionLoading(false);
    }
  };

  const handleReject = async (bidId: string) => {
    if (!bargain) return;
    setSellerActionLoading(true);
    try {
      const res = await fetch(`/api/auctions/${bargain.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bidId }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(isZh ? "已拒绝该报价" : "Offer rejected");
        fetchBargain();
      } else {
        setMessage(json.error || (isZh ? "操作失败" : "Action failed"));
      }
    } catch (err) {
      setMessage(isZh ? "操作失败" : "Action failed");
    } finally {
      setSellerActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!bargain) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">{isZh ? "议价不存在" : "Bargain not found"}</p>
      </div>
    );
  }

  const isActive = bargain.status === "active";
  const isSeller = currentUserId === bargain.seller.id;
  const isAccepted = bargain.status === "accepted";
  const displayPrice = bargain.askingPrice || 0;

  // 分类报价：待处理 / 已接受 / 已拒绝
  const pendingBids = bargain.bids.filter((b) => b.status === "pending");
  const acceptedBid = bargain.bids.find((b) => b.status === "accepted" || b.isWinning);
  const allBidsSorted = [...bargain.bids].sort((a, b) => b.amount - a.amount);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: Images */}
        <div>
          {bargain.product.images[0] ? (
            <img
              src={bargain.product.images[0].url}
              alt={bargain.title}
              className="w-full rounded-xl object-cover aspect-square"
            />
          ) : (
            <div className="w-full rounded-xl bg-gray-100 aspect-square flex items-center justify-center">
              <span className="text-gray-300">{isZh ? "暂无图片" : "No Image"}</span>
            </div>
          )}
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {bargain.product.images.slice(1, 6).map((img) => (
              <img key={img.id} src={img.url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Right: Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              bargain.status === "active" ? "bg-green-100 text-green-700" :
              bargain.status === "accepted" ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {bargain.status === "active" ? (isZh ? "议价中" : "Open") :
               bargain.status === "accepted" ? (isZh ? "已成交" : "Sold") :
               (isZh ? "已取消" : "Cancelled")}
            </span>
            <span className="text-sm text-gray-400 font-mono">{bargain.bargainNo}</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">{bargain.title}</h1>
          <p className="text-gray-500 mt-1">
            {bargain.product.brand.nameZh} {bargain.product.modelName} · {bargain.product.year}
            {bargain.product.workingHours && ` · ${bargain.product.workingHours}h`}
          </p>

          {/* Price card */}
          <div className="bg-blue-50 rounded-xl p-4 mt-4">
            <p className="text-sm text-gray-500">
              {isAccepted
                ? (isZh ? "成交价" : "Deal Price")
                : (isZh ? "卖家要价" : "Asking Price")}
            </p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              ¥{(bargain.acceptedPrice || displayPrice).toLocaleString()}
            </p>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span>{isZh ? "报价人数" : "Offerers"}: {bargain.totalBidders}</span>
              <span>{isZh ? "报价次数" : "Total Offers"}: {bargain.totalBids}</span>
            </div>
          </div>

          {/* Accepted deal info */}
          {isAccepted && acceptedBid && (
            <div className="bg-green-50 rounded-xl p-4 mt-3 border border-green-200">
              <p className="text-green-700 font-medium">
                {isZh ? "议价成交" : "Deal Made"}
              </p>
              <p className="text-2xl font-bold text-green-700 mt-1">
                ¥{acceptedBid.amount.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 mt-1">
                {isZh ? "买家: " : "Buyer: "}
                {acceptedBid.bidder.companyName || acceptedBid.bidder.username}
              </p>
            </div>
          )}

          {/* Offer form — non-seller on active bargain */}
          {isActive && !isSeller && (
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder={isZh ? "输入你的报价" : "Enter your offer"}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleOffer}
                  disabled={offering || !offerAmount}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  {offering ? "..." : (isZh ? "提交报价" : "Make Offer")}
                </button>
              </div>
              {message && (
                <p className={`mt-2 text-sm ${message.includes("成功") || message.includes("success") || message.includes("已接受") ? "text-green-600" : "text-red-600"}`}>
                  {message}
                </p>
              )}
            </div>
          )}

          {/* Seller info */}
          {isSeller && isActive && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700">
              {isZh ? "这是你的议价商品。你可以在下方报价记录中选择接受或拒绝每个报价。" : "This is your bargain listing. You can accept or reject each offer below."}
            </div>
          )}

          {/* Product info */}
          <div className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{isZh ? "设备状况" : "Condition"}</span>
              <span className="text-gray-900">{bargain.product.condition}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{isZh ? "所在地" : "Location"}</span>
              <span className="text-gray-900">{bargain.product.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{isZh ? "原发布价" : "List Price"}</span>
              <span className="text-gray-900">¥{bargain.product.priceCny.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{isZh ? "卖家" : "Seller"}</span>
              <span className="text-gray-900">{bargain.seller.companyName || bargain.seller.username || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {bargain.product.descriptionZh && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {isZh ? "设备描述" : "Description"}
          </h2>
          <p className="text-gray-700 whitespace-pre-wrap">
            {isZh ? bargain.product.descriptionZh : (bargain.product.descriptionEn || bargain.product.descriptionZh)}
          </p>
        </div>
      )}

      {/* Bid history — with seller controls */}
      {allBidsSorted.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isZh ? "报价记录" : "Offer History"}
          </h2>
          <div className="space-y-2">
            {allBidsSorted.map((bid, idx) => (
              <div
                key={bid.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  bid.status === "accepted" || bid.isWinning
                    ? "bg-green-50 border border-green-200"
                    : bid.status === "rejected"
                    ? "bg-gray-50 border border-gray-200"
                    : "bg-blue-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-6">#{idx + 1}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {bid.bidder.companyName || bid.bidder.username || (isZh ? "匿名用户" : "Anonymous")}
                  </span>
                  {(bid.status === "accepted" || bid.isWinning) && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                      {isZh ? "已成交" : "Accepted"}
                    </span>
                  )}
                  {bid.status === "rejected" && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-medium">
                      {isZh ? "已拒绝" : "Rejected"}
                    </span>
                  )}
                  {bid.status === "pending" && isActive && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {isZh ? "待处理" : "Pending"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">¥{bid.amount.toLocaleString()}</span>
                  {/* Seller controls for pending offers */}
                  {isSeller && isActive && bid.status === "pending" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAccept(bid.id)}
                        disabled={sellerActionLoading}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {isZh ? "接受" : "Accept"}
                      </button>
                      <button
                        onClick={() => handleReject(bid.id)}
                        disabled={sellerActionLoading}
                        className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
                      >
                        {isZh ? "拒绝" : "Reject"}
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-gray-400">
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
