"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { openFloatingChat } from "@/components/chat/floating-chat";
import { Phone, MessageCircle } from "lucide-react";


interface BargainData {
  id: string;
  bargainNo: string;
  title: string;
  askingPrice: number;
  status: string;
  acceptedPrice: number | null;
  totalBids: number;
  totalBidders: number;
  bids: {
    id: string;
    amount: number;
    isWinning: boolean;
    status: string;
    createdAt: string;
    bidder: { id: string; companyName: string | null; username: string | null };
  }[];
  seller: {
    id: string;
    companyName: string | null;
    username: string | null;
  };
  product: {
    id: string;
    workingHours: number | null;
  };
}

interface BargainSectionProps {
  auctionId: string;
  locale: string;
  sellerId: string;
}

export default function BargainSection({ auctionId, locale, sellerId }: BargainSectionProps) {
  const localeHook = useLocale();
  const isZh = (localeHook || locale) === "zh";

  const [bargain, setBargain] = useState<BargainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerAmount, setOfferAmount] = useState("");
  const [offering, setOffering] = useState(false);
  const [message, setMessage] = useState("");
  const [sellerActionLoading, setSellerActionLoading] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setCurrentUserId(u.id || null);
      } catch {
        /* noop */
      }
    }
  }, []);

  const fetchBargain = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${auctionId}?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setBargain(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch bargain:", err);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

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
        setMessage(isZh ? "报价提交成功！等待卖家回复" : "Offer submitted! Awaiting seller response");
        setOfferAmount("");
        fetchBargain();
      } else {
        setMessage(json.error || (isZh ? "报价失败，请先登录" : "Offer failed, please login first"));
      }
    } catch {
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
        setMessage(isZh ? "已接受报价，议价成交！" : "Offer accepted! Deal made!");
        fetchBargain();
      } else {
        setMessage(json.error || (isZh ? "操作失败" : "Action failed"));
      }
    } catch {
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
    } catch {
      setMessage(isZh ? "操作失败" : "Action failed");
    } finally {
      setSellerActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E40AF]"></div>
      </div>
    );
  }

  if (!bargain) return null;

  const isActive = bargain.status === "active";
  const isAccepted = bargain.status === "accepted";
  const isSeller = currentUserId === bargain.seller.id || currentUserId === sellerId;
  const displayPrice = bargain.acceptedPrice || bargain.askingPrice;
  const allBidsSorted = [...bargain.bids].sort((a, b) => b.amount - a.amount);
  const acceptedBid = bargain.bids.find((b) => b.status === "accepted" || b.isWinning);

  const statusBadge = (status: string) => {
    const map: Record<string, { zh: string; en: string; bg: string }> = {
      active: { zh: "议价中", en: "Open", bg: "bg-emerald-500" },
      accepted: { zh: "已成交", en: "Sold", bg: "bg-blue-500" },
      cancelled: { zh: "已取消", en: "Cancelled", bg: "bg-gray-400" },
    };
    const s = map[status] || map.cancelled;
    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-semibold text-white ${s.bg}`}>
        ● {isZh ? s.zh : s.en}
      </span>
    );
  };

  return (
    <div id="bargain" className="space-y-4 scroll-mt-20">
      {/* ============================================================ */}
      {/*  1. 议价状态条                                                */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {statusBadge(bargain.status)}
            <span className="text-sm text-gray-400 font-mono">{bargain.bargainNo}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">
              {isAccepted ? (isZh ? "成交价" : "Deal Price") : (isZh ? "卖家要价" : "Asking Price")}
            </p>
            <p className={`text-2xl font-bold font-mono ${isAccepted ? "text-green-600" : "text-gray-900"}`}>
              ¥{displayPrice.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 border-t border-gray-100 pt-3">
          <span>
            {isZh ? `已有 ${bargain.totalBidders} 人报价 · 共 ${bargain.totalBids} 条记录` : `${bargain.totalBidders} offerers · ${bargain.totalBids} offers`}
          </span>
          <span className="text-[#1E40AF] font-semibold">
            {bargain.seller.companyName || bargain.seller.username || (isZh ? "平台自营" : "Platform")}
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  2. 出价表单（买家视角） / 卖家管理区                          */}
      {/* ============================================================ */}
      {isActive && !isSeller && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-base font-bold text-gray-900">{isZh ? "发起议价" : "Make an Offer"}</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder={isZh ? "输入你的报价（¥）" : "Enter your offer (¥)"}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-[#1E40AF]"
            />
            <button
              onClick={handleOffer}
              disabled={offering || !offerAmount}
              className="px-6 py-3 bg-[#1E40AF] text-white rounded-lg font-bold hover:bg-blue-800 disabled:bg-gray-300 transition-colors whitespace-nowrap"
            >
              {offering ? "..." : (isZh ? "提交报价" : "Submit Offer")}
            </button>
          </div>
          {message && (
            <p className={`text-sm ${message.includes("成功") || message.includes("success") || message.includes("已接受") ? "text-green-600" : "text-red-600"}`}>
              {message}
            </p>
          )}
          <div className="flex gap-2">
            <a
              href={`https://wa.me/8615511395016?text=${encodeURIComponent(
                isZh
                  ? `您好，我想预约实地看车：${bargain.title}，议价编号 ${bargain.bargainNo}，卖家要价 ¥${bargain.askingPrice.toLocaleString()}，请安排时间地点。`
                  : `Hi, I'd like to inspect this machine on-site: ${bargain.title}, Bargain No. ${bargain.bargainNo}, asking price ¥${bargain.askingPrice.toLocaleString()}. Please arrange time and location.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 text-center transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Phone className="h-4 w-4" />
              {isZh ? "实地看车" : "Inspect On-site"}
            </a>
            <button
              onClick={() =>
                openFloatingChat(
                  isZh
                    ? `我想咨询这台设备：${bargain.title}，议价编号 ${bargain.bargainNo}，卖家要价 ¥${bargain.askingPrice.toLocaleString()}。`
                    : `I have a question about: ${bargain.title}, Bargain No. ${bargain.bargainNo}, asking price ¥${bargain.askingPrice.toLocaleString()}.`
                )
              }
              className="flex-1 py-2.5 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 text-center transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="h-4 w-4" />
              {isZh ? "在线咨询" : "Consult Online"}
            </button>
          </div>
        </div>
      )}

      {isSeller && isActive && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-sm text-amber-700">
          {isZh
            ? "这是你的议价商品。在下方报价记录中选择接受或拒绝买家的报价。"
            : "This is your listing. Accept or reject offers in the history below."}
        </div>
      )}

      {/* ============================================================ */}
      {/*  3. 成交状态展示                                              */}
      {/* ============================================================ */}
      {isAccepted && acceptedBid && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 font-bold text-lg">{isZh ? "议价已成交" : "Deal Made"}</p>
              <p className="text-sm text-green-600 mt-1">
                {isZh
                  ? `买家 ${acceptedBid.bidder.companyName || acceptedBid.bidder.username || "用户"} 以 ¥${acceptedBid.amount.toLocaleString()} 成交`
                  : `Buyer ${acceptedBid.bidder.companyName || acceptedBid.bidder.username || "User"} dealt at ¥${acceptedBid.amount.toLocaleString()}`}
              </p>
            </div>
            <p className="text-2xl font-bold text-green-700 font-mono">¥{acceptedBid.amount.toLocaleString()}</p>
          </div>
        </div>
      )}

      {!isActive && !isAccepted && (
        <div className="bg-gray-100 rounded-xl p-4 text-sm text-gray-500 text-center">
          {isZh ? "该议价已结束" : "This bargain has ended"}
        </div>
      )}

      {/* ============================================================ */}
      {/*  4. 风险告知三卡                                              */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-base font-bold text-gray-900">{isZh ? "风险告知与设备说明" : "Risk Disclosure"}</h3>

        {/* 无法过户风险 */}
        <div className="bg-amber-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-amber-800">⚠ {isZh ? "无法过户风险" : "Transfer Risk"}</h4>
          <p className="text-sm text-amber-700">
            {isZh
              ? "原车主拒不过户，设备所有权虽已通过司法处置合法转移，但无法办理过户手续。"
              : "The original owner refuses transfer. Ownership was legally transferred via judicial process, but registration transfer is not possible."}
          </p>
          <p className="text-sm text-amber-700">
            {isZh ? "购入渠道：江苏金融淘宝司法处置平台（合法合规）" : "Source: Jiangsu Judicial Auction Platform (legal & compliant)"}
          </p>
          <p className="text-sm text-amber-700">
            {isZh ? "法律依据：附司法拍卖成交确认书、评估报告等全套法律文件" : "Legal docs: Judicial auction confirmation, appraisal report, etc."}
          </p>
        </div>

        {/* 设备现状说明 */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-gray-900">{isZh ? "设备现状说明" : "Equipment Condition"}</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>• {isZh ? "前配重：缺失，需另行配置" : "Front weight: Missing, needs separate configuration"}</li>
            <li>• {isZh ? "后悬挂：缺失，需另行配置" : "Rear hitch: Missing, needs separate configuration"}</li>
            <li>• {isZh ? `发动机：运转正常，${bargain.product.workingHours || "—"}工时` : `Engine: Running normally, ${bargain.product.workingHours || "—"} hours`}</li>
          </ul>
        </div>

        {/* 交付资料清单 */}
        <div className="bg-green-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-gray-900">{isZh ? "交付资料清单" : "Delivery Documents"}</h4>
          <ul className="space-y-1 text-sm text-green-700">
            <li>✓ {isZh ? "司法拍卖成交确认书" : "Judicial auction confirmation"}</li>
            <li>✓ {isZh ? "设备评估报告" : "Equipment appraisal report"}</li>
            <li>✓ {isZh ? "设备交接清单" : "Equipment handover list"}</li>
            <li>✓ {isZh ? "其他法律文件" : "Other legal documents"}</li>
          </ul>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  5. 议价记录时间线                                            */}
      {/* ============================================================ */}
      {allBidsSorted.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">{isZh ? "议价记录" : "Offer History"}</h3>
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
                  <span className="font-semibold text-gray-900 font-mono">¥{bid.amount.toLocaleString()}</span>
                  {isSeller && isActive && bid.status === "pending" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAccept(bid.id)}
                        disabled={sellerActionLoading}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isZh ? "接受" : "Accept"}
                      </button>
                      <button
                        onClick={() => handleReject(bid.id)}
                        disabled={sellerActionLoading}
                        className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
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

      {/* 链接到议价规则页 */}
      <div className="text-center">
        <a
          href={`/${locale}/auctions/rules`}
          className="text-sm text-gray-500 hover:text-[#1E40AF] inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isZh ? "查看议价规则与交易保障" : "View negotiation rules & guarantees"}
        </a>
      </div>
    </div>
  );
}
