"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "next-intl";
import { Calendar, Gavel, Clock, Check, FileText, MapPin, TrendingUp, Users, AlertCircle } from "lucide-react";
import InspectionBookingModal from "./inspection-booking-modal";

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
    priceCny?: number | null;
  };
  // 新增：公告参数
  announcementNo?: string | null;
  startPrice?: number | null;
  priceIncrement?: number | null;
  deposit?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  minParticipants?: number | null;
  paymentDeadline?: string | null;
  evaluationPrice?: number | null;
  knownFlaws?: string | null;
  contractTemplateNo?: string | null;
  description?: string | null;
  // 新增：报名统计
  totalBookingsCount?: number;
  confirmedBookingsCount?: number;
  currentUserBooking?: {
    id: string;
    status: string;
    depositPaid: boolean;
    depositProofUrl: string | null;
    createdAt: string;
  } | null;
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
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [highlightHall, setHighlightHall] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [paymentCountdown, setPaymentCountdown] = useState("");
  const hallRef = useRef<HTMLDivElement>(null);

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

  // 倒计时逻辑（仅用于付款倒计时；议价开始以确认人数为准）
  useEffect(() => {
    if (!bargain) return;
    const timer = setInterval(() => {
      const now = Date.now();
      // 付款倒计时
      if (bargain.paymentDeadline && bargain.status === "accepted") {
        const deadline = new Date(bargain.paymentDeadline).getTime();
        if (deadline > now) {
          const diff = deadline - now;
          const days = Math.floor(diff / 86400000);
          const hours = Math.floor((diff % 86400000) / 3600000);
          const mins = Math.floor((diff % 3600000) / 60000);
          setPaymentCountdown(days > 0 ? `${days}天${hours}时${mins}分` : `${hours}时${mins}分`);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [bargain]);

  const scrollToHall = () => {
    hallRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightHall(true);
    setTimeout(() => setHighlightHall(false), 2000);
  };

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

  const handleQuickBid = async (increment: number) => {
    if (!bargain) return;
    const highestBid = bargain.bids.length > 0
      ? Math.max(...bargain.bids.map((b) => b.amount))
      : bargain.startPrice || bargain.askingPrice || bargain.product.priceCny || 0;
    const newAmount = highestBid + increment;
    setOffering(true);
    setMessage("");
    try {
      const res = await fetch(`/api/auctions/${bargain.id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: newAmount }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(isZh ? `出价 ¥${newAmount.toLocaleString()} 成功！` : `Bid ¥${newAmount.toLocaleString()} placed!`);
        fetchBargain();
      } else {
        setMessage(json.error || (isZh ? "出价失败" : "Bid failed"));
      }
    } catch {
      setMessage(isZh ? "网络错误" : "Network error");
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
  const displayPrice = bargain.acceptedPrice || bargain.askingPrice || bargain.product.priceCny || 0;
  const allBidsSorted = [...bargain.bids].sort((a, b) => b.amount - a.amount);
  const acceptedBid = bargain.bids.find((b) => b.status === "accepted" || b.isWinning);

  // 议价大厅状态感知（以确认报名人数为准，不再依赖固定开始时间）
  const minParticipants = bargain.minParticipants || 3;
  const confirmedCount = bargain.confirmedBookingsCount || 0;
  const totalBookingsCount = bargain.totalBookingsCount || 0;
  const isMinReached = confirmedCount >= minParticipants;
  const isBeforeStart = isActive && !isMinReached;
  const isBargaining = isActive && isMinReached;
  const currentHighestBid = bargain.bids.length > 0
    ? Math.max(...bargain.bids.map((b) => b.amount))
    : bargain.startPrice || bargain.askingPrice || bargain.product.priceCny || 0;
  const increment = bargain.priceIncrement || 5000;

  // 当前用户报名状态
  const hasUserBooking = !!bargain.currentUserBooking;
  const isUserConfirmed = bargain.currentUserBooking?.depositPaid && bargain.currentUserBooking?.status === "confirmed";
  const userBookingId = bargain.currentUserBooking?.id;

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
            {bargain.announcementNo && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                {isZh ? "公告" : "Notice"}: {bargain.announcementNo}
              </span>
            )}
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
      {/*  2. 评估报告摘要（新增）                                      */}
      {/* ============================================================ */}
      {(bargain.evaluationPrice || bargain.knownFlaws) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            {isZh ? "评估报告摘要" : "Evaluation Summary"}
          </h3>
          {bargain.evaluationPrice != null && (
            <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
              <span className="text-sm text-blue-700">{isZh ? "参考评估价" : "Evaluation Price"}</span>
              <span className="text-lg font-bold text-blue-700 font-mono">
                ¥{Number(bargain.evaluationPrice).toLocaleString()}
                <span className="text-xs font-normal ml-1">{isZh ? "(误差±8%)" : "(±8% margin)"}</span>
              </span>
            </div>
          )}
          {bargain.knownFlaws && (
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-sm font-bold text-amber-800 mb-1">⚠ {isZh ? "已知瑕疵" : "Known Flaws"}</p>
              <p className="text-sm text-amber-700">{bargain.knownFlaws}</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  3. 议价大厅（新增，状态感知）                                */}
      {/* ============================================================ */}
      <div
        ref={hallRef}
        className={`bg-white rounded-xl border-2 p-5 space-y-4 transition-all duration-500 ${
          highlightHall ? "border-blue-500 shadow-lg" : "border-gray-200"
        }`}
      >
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Gavel className="h-5 w-5 text-[#1E40AF]" />
          {isZh ? "议价大厅" : "Bargain Hall"}
          {bargain.announcementNo && (
            <span className="text-xs text-gray-400 font-mono ml-1">{bargain.announcementNo}</span>
          )}
        </h3>

        {/* 公告中（未达到最低确认人数） */}
        {isBeforeStart && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-500 mb-1">{isZh ? "起始价" : "Start Price"}</p>
                <p className="text-lg font-bold text-blue-700 font-mono">
                  ¥{(bargain.startPrice || bargain.askingPrice || bargain.product.priceCny || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-500 mb-1">{isZh ? "加价幅度" : "Increment"}</p>
                <p className="text-lg font-bold text-green-700 font-mono">¥{increment.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-red-500 mb-1">{isZh ? "保证金" : "Deposit"}</p>
                <p className="text-lg font-bold text-red-700 font-mono">
                  ¥{(bargain.deposit || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* 报名进度与立即报名按钮 */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-4 text-white text-center">
              <p className="text-sm opacity-90 mb-2">
                {isZh ? "议价启动条件：确认报名满" : "Bargain starts when"} {minParticipants} {isZh ? "人" : "bidders"}
              </p>
              <p className="text-2xl font-bold font-mono">
                {confirmedCount}/{minParticipants}
              </p>
              <p className="text-xs opacity-75 mt-1">
                {isZh
                  ? `已确认 ${confirmedCount} 人，还需 ${Math.max(0, minParticipants - confirmedCount)} 人`
                  : `${confirmedCount} confirmed, ${Math.max(0, minParticipants - confirmedCount)} more needed`}
              </p>
            </div>

            {!isSeller && (
              <div className="flex gap-2">
                {isUserConfirmed ? (
                  <div className="flex-1 py-3 bg-green-100 text-green-700 rounded-lg font-bold text-center flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" />
                    {isZh ? "您已确认报名，议价启动后可出价" : "You are confirmed. Bid once started"}
                  </div>
                ) : hasUserBooking ? (
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="flex-1 py-3 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    {isZh ? "您已报名，继续上传保证金凭证" : "Upload deposit proof"}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="flex-1 py-3 bg-[#1E40AF] text-white rounded-lg font-bold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    {isZh ? "立即报名（预约看车）" : "Register Now"}
                  </button>
                )}
                <a
                  href={isZh ? "/zh/auctions/my-offers" : "/en/auctions/my-offers"}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors text-center flex items-center justify-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  {isZh ? "我的报名记录" : "My Registrations"}
                </a>
              </div>
            )}

            {bargain.minParticipants && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                <Users className="h-4 w-4 text-gray-400" />
                {isZh
                  ? `满 ${bargain.minParticipants} 人确认报名后即启动议价，无需等待固定时间`
                  : `Bargain starts once ${bargain.minParticipants} bidders are confirmed; no fixed time`}
              </div>
            )}
          </div>
        )}

        {/* 议价进行中 */}
        {isBargaining && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-500 mb-1">{isZh ? "当前最高价" : "Highest Bid"}</p>
                <p className="text-lg font-bold text-blue-700 font-mono">¥{currentHighestBid.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-500 mb-1">{isZh ? "参与人数" : "Bidders"}</p>
                <p className="text-lg font-bold text-green-700 font-mono">{bargain.totalBidders}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{isZh ? "出价次数" : "Total Bids"}</p>
                <p className="text-lg font-bold text-gray-700 font-mono">{bargain.totalBids}</p>
              </div>
            </div>

            {!isSeller && !isUserConfirmed && (
              <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700 text-center">
                {isZh
                  ? "您尚未确认报名，无法出价。请先报名并缴纳保证金。"
                  : "You are not confirmed. Please register and pay deposit."}
              </div>
            )}

            {/* 加价按钮 */}
            {!isSeller && isUserConfirmed && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuickBid(increment)}
                  disabled={offering}
                  className="flex-1 py-3 bg-[#1E40AF] text-white rounded-lg font-bold hover:bg-blue-800 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-1.5"
                >
                  <TrendingUp className="h-4 w-4" />
                  +¥{increment.toLocaleString()}
                </button>
                <button
                  onClick={() => handleQuickBid(increment * 2)}
                  disabled={offering}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-1.5"
                >
                  <TrendingUp className="h-4 w-4" />
                  +¥{(increment * 2).toLocaleString()}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 议价规则 */}
        {(bargain.startPrice != null && bargain.startPrice > 0) && (
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-2">
            {isZh
              ? `规则：起始价 ¥${bargain.startPrice.toLocaleString()} → 加价 ¥${increment.toLocaleString()}/次 → 最高价者成交`
              : `Rule: Start ¥${bargain.startPrice.toLocaleString()} → +¥${increment.toLocaleString()} → Highest wins`}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  4. 出价表单（买家视角） / 卖家管理区                          */}
      {/* ============================================================ */}
      {isActive && !isSeller && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-base font-bold text-gray-900">{isZh ? "发起议价" : "Make an Offer"}</h3>

          {/* 报名状态提示 */}
          {!isBargaining && (
            <div className={`rounded-lg p-3 text-sm ${
              isUserConfirmed
                ? "bg-green-50 text-green-700"
                : hasUserBooking
                ? "bg-amber-50 text-amber-700"
                : "bg-blue-50 text-blue-700"
            }`}>
              {isUserConfirmed
                ? (isZh ? "✓ 您已确认报名，议价满人启动后即可出价。" : "You are confirmed. You can bid once the bargain starts.")
                : hasUserBooking
                ? (isZh ? "⚠ 您已提交报名，请尽快上传保证金凭证并等待卖家确认。" : "Please upload deposit proof and wait for seller confirmation.")
                : (isZh ? "ℹ 参与议价前请先报名并缴纳保证金。" : "Please register and pay deposit before bidding.")}
            </div>
          )}

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
              disabled={offering || !offerAmount || !isUserConfirmed || !isBargaining}
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
            <button
              onClick={() => setShowBookingModal(true)}
              className="flex-1 py-2.5 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 text-center transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Calendar className="h-4 w-4" />
              {isZh ? "报名预约看车" : "Register & Book Inspection"}
            </button>
            <button
              onClick={scrollToHall}
              className="flex-1 py-2.5 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 text-center transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Gavel className="h-4 w-4" />
              {isZh ? "议价大厅" : "Bargain Hall"}
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
      {/*  5. 成交后引导（新增）                                        */}
      {/* ============================================================ */}
      {isAccepted && acceptedBid && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-5 space-y-4">
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

          {/* 付款倒计时 */}
          {paymentCountdown && (
            <div className="bg-red-50 rounded-lg p-3 flex items-center gap-3">
              <Clock className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">
                  {isZh ? "付款截止倒计时" : "Payment Deadline"}
                </p>
                <p className="text-xl font-bold text-red-600 font-mono">{paymentCountdown}</p>
                {bargain.paymentDeadline && (
                  <p className="text-xs text-red-400 mt-1">
                    {isZh ? "截止时间" : "Deadline"}: {new Date(bargain.paymentDeadline).toLocaleString(isZh ? "zh-CN" : "en-US")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 合同信息 */}
          {bargain.contractTemplateNo && (
            <div className="bg-white/60 rounded-lg p-3 flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-900">{isZh ? "买卖合同" : "Sales Contract"}</p>
                <p className="text-sm text-gray-500 font-mono">合同编号：{bargain.contractTemplateNo}</p>
              </div>
            </div>
          )}

          {/* 提货提醒 */}
          <div className="bg-white/60 rounded-lg p-3 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-gray-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-900">{isZh ? "提货提醒" : "Pickup Notice"}</p>
              <p className="text-sm text-gray-500">
                {isZh
                  ? "请于成交后3个工作日内联系卖方提货，不负责过户。"
                  : "Please pickup within 3 business days. Transfer not included."}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isActive && !isAccepted && (
        <div className="bg-gray-100 rounded-xl p-4 text-sm text-gray-500 text-center">
          {isZh ? "该议价已结束" : "This bargain has ended"}
        </div>
      )}

      {/* ============================================================ */}
      {/*  6. 风险告知三卡                                              */}
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
            {isZh ? "法律依据：附法院处置成交确认书、评估报告等全套法律文件" : "Legal docs: Court disposal confirmation, appraisal report, etc."}
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
            <li>✓ {isZh ? "法院处置成交确认书" : "Court disposal confirmation"}</li>
            <li>✓ {isZh ? "设备评估报告" : "Equipment appraisal report"}</li>
            <li>✓ {isZh ? "设备交接清单" : "Equipment handover list"}</li>
            <li>✓ {isZh ? "其他法律文件" : "Other legal documents"}</li>
          </ul>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  7. 议价记录时间线                                            */}
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

      {/* 预约看车弹窗 */}
      {bargain && (
        <InspectionBookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          auctionId={auctionId}
          locale={locale}
          bargain={bargain}
        />
      )}
    </div>
  );
}
