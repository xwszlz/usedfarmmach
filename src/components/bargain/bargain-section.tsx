"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { Clock, FileText, MapPin, AlertCircle, MessageSquare, ShieldCheck, ChevronDown, ChevronUp, Eye, Tag } from "lucide-react";
import InspectionBookingModal from "./inspection-booking-modal";
import { useTr } from "@/lib/i18n-tr";

interface BargainData {
  id: string;
  bargainNo: string;
  title: string;
  askingPrice: number;
  status: string;
  acceptedPrice: number | null;
  totalBids: number;
  totalBidders: number;
  sellerQuoteAmount: number | null;
  sellerQuoteMsg: string | null;
  sellerQuoteAt: string | null;
  reservePrice: number | null;
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
  // 公告参数
  announcementNo?: string | null;
  announcementHtml?: string | null;
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
  contractHtml?: string | null;
  description?: string | null;
  // 报名统计
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
  const tr = useTr();

  const [bargain, setBargain] = useState<BargainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerAmount, setOfferAmount] = useState("");
  const [offering, setOffering] = useState(false);
  const [message, setMessage] = useState("");
  const [sellerActionLoading, setSellerActionLoading] = useState(false);

  // 卖家工具状态
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteMsg, setQuoteMsg] = useState("");
  const [reserveInput, setReserveInput] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [paymentCountdown, setPaymentCountdown] = useState("");
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showContract, setShowContract] = useState(false);

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

  // 付款倒计时
  useEffect(() => {
    if (!bargain) return;
    const timer = setInterval(() => {
      const now = Date.now();
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

  const toggleAnnouncement = () => setShowAnnouncement((v) => !v);
  const toggleContract = () => setShowContract((v) => !v);

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
        setMessage(tr("报价已提交！卖家将审阅您的报价并通过平台回复。"));
        setOfferAmount("");
        fetchBargain();
      } else {
        setMessage(json.error || (tr("报价失败，请先登录")));
      }
    } catch {
      setMessage(tr("提交失败，请先登录"));
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
        setMessage(tr("已接受报价，交易达成！"));
        fetchBargain();
      } else {
        setMessage(json.error || (tr("操作失败")));
      }
    } catch {
      setMessage(tr("操作失败"));
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
        setMessage(tr("已拒绝该报价"));
        fetchBargain();
      } else {
        setMessage(json.error || (tr("操作失败")));
      }
    } catch {
      setMessage(tr("操作失败"));
    } finally {
      setSellerActionLoading(false);
    }
  };

  const handleAcceptSellerQuote = async () => {
    if (!bargain || bargain.sellerQuoteAmount == null) return;
    setOffering(true);
    try {
      const res = await fetch(`/api/auctions/${bargain.id}/accept-seller-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setMessage(tr("已接受卖家还价，交易达成！"));
        fetchBargain();
      } else {
        setMessage(json.error || (tr("操作失败")));
      }
    } catch {
      setMessage(tr("操作失败"));
    } finally {
      setOffering(false);
    }
  };

  const handleSellerQuote = async () => {
    if (!bargain || !quoteAmount) return;
    setSellerActionLoading(true);
    try {
      const res = await fetch(`/api/auctions/${bargain.id}/seller-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: parseFloat(quoteAmount), message: quoteMsg }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(tr("还价已发送给买家"));
        setQuoteAmount("");
        setQuoteMsg("");
        fetchBargain();
      } else {
        setMessage(json.error || (tr("操作失败")));
      }
    } catch {
      setMessage(tr("操作失败"));
    } finally {
      setSellerActionLoading(false);
    }
  };

  const handleSetReserve = async () => {
    if (!bargain || !reserveInput) return;
    setSellerActionLoading(true);
    try {
      const res = await fetch(`/api/auctions/${bargain.id}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reservePrice: parseFloat(reserveInput) }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(tr("已保存最低接受价（仅您可见）"));
        fetchBargain();
      } else {
        setMessage(json.error || (tr("操作失败")));
      }
    } catch {
      setMessage(tr("操作失败"));
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

  // 询价/报价模式：报价列表仅卖家可见，买家看不到他人报价
  const sellerBids = [...bargain.bids].sort((a, b) => b.amount - a.amount);
  const acceptedBid = bargain.bids.find((b) => b.status === "accepted" || b.isWinning);

  // 重点标的专属块：存在公告/合同 HTML、瑕疵、评估价任一，则展示
  const hasRich =
    !!bargain.announcementHtml ||
    !!bargain.contractHtml ||
    !!bargain.knownFlaws ||
    bargain.evaluationPrice != null;

  const statusBadge = (status: string) => {
    const map: Record<string, { zh: string; en: string; bg: string }> = {
      active: { zh: "询价中", en: "Open", bg: "bg-emerald-500" },
      accepted: { zh: "已成交", en: "Sold", bg: "bg-blue-500" },
      cancelled: { zh: "已关闭", en: "Closed", bg: "bg-gray-400" },
    };
    const s = map[status] || map.cancelled;
    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-semibold text-white ${s.bg}`}>
        {tr(s.zh)}
      </span>
    );
  };

  return (
    <div id="bargain" className="space-y-4 scroll-mt-20">
      {/* ============================================================ */}
      {/*  1. 状态条                                                    */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {statusBadge(bargain.status)}
            <span className="text-sm text-gray-400 font-mono">{bargain.bargainNo}</span>
            {bargain.announcementNo && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                {tr("公告")}: {bargain.announcementNo}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">
              {isAccepted ? (tr("成交价")) : (tr("卖家要价"))}
            </p>
            <p className={`text-2xl font-bold font-mono ${isAccepted ? "text-green-600" : "text-gray-900"}`}>
              ¥{displayPrice.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 border-t border-gray-100 pt-3">
          <span>
            {isAccepted
              ? tr("已成交 · {n} 人参与询价").replace("{n}", String(bargain.totalBidders))
              : tr("已有 {n} 人询价").replace("{n}", String(bargain.totalBidders))}
          </span>
          <span className="text-[#1E40AF] font-semibold">
            {bargain.seller.companyName || bargain.seller.username || (tr("平台自营"))}
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  2. 重点标的专属块（公告/合同/瑕疵/评估价等动态内容）          */}
      {/* ============================================================ */}
      {hasRich && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* 评估价 */}
          {bargain.evaluationPrice != null && (
            <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
              <div>
                <span className="text-sm text-blue-700">{tr("参考评估价")}</span>
                <p className="text-xs text-blue-500 mt-0.5">
                  {tr("评估基准日：2025年8月 · 仅供参考")}
                </p>
              </div>
              <span className="text-lg font-bold text-blue-700 font-mono">
                ¥{Number(bargain.evaluationPrice).toLocaleString()}
              </span>
            </div>
          )}

          {/* 已知瑕疵 */}
          {bargain.knownFlaws && (
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-sm font-bold text-amber-800 mb-1">⚠ {tr("已知瑕疵")}</p>
              <p className="text-sm text-amber-700">{bargain.knownFlaws}</p>
            </div>
          )}

          {/* 工作时长 */}
          {bargain.product.workingHours != null && (
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">{tr("发动机工作时长")}</span>
              <span className="text-sm font-bold text-gray-900 font-mono">{bargain.product.workingHours} {tr("小时")}</span>
            </div>
          )}

          {/* 询价公告折叠面板 */}
          {bargain.announcementHtml && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={toggleAnnouncement}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#1E40AF]" />
                  {tr("询价公告全文")}
                </span>
                {showAnnouncement ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {showAnnouncement && (
                <div className="p-4 max-h-[500px] overflow-y-auto text-sm border-t border-gray-100">
                  <div dangerouslySetInnerHTML={{ __html: bargain.announcementHtml }} />
                </div>
              )}
            </div>
          )}

          {/* 合同模板预览 */}
          {bargain.contractHtml && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={toggleContract}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  {tr("买卖合同模板预览")}
                </span>
                {showContract ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {showContract && (
                <div className="p-4 max-h-[500px] overflow-y-auto text-sm border-t border-gray-100">
                  <div dangerouslySetInnerHTML={{ __html: bargain.contractHtml }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  3. 询价/报价区（核心：一对一询价，盲报）                      */}
      {/* ============================================================ */}
      {isActive && !isSeller && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#1E40AF]" />
              {tr("提交您的报价")}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {tr("请输入您的心理价位，卖家将审阅后决定是否接受。您的报价对其他买家不可见。")}
            </p>
          </div>

          {/* 合规提示 */}
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 leading-relaxed">
            <p className="font-bold mb-1">ℹ {tr("询价须知")}</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>{tr("本功能为在线询价/报价，不是拍卖。")}</li>
              <li>{tr("卖家可接受或拒绝任何报价，无需说明理由。")}</li>
              <li>{tr("报价相互不可见，不存在竞价。")}</li>
              <li>{tr("建议先预约看车，实地查验后再报价。")}</li>
            </ul>
          </div>

          {/* 卖家还价展示 + 接受 */}
          {bargain.sellerQuoteAmount != null && (
            <div className="bg-emerald-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-emerald-800">{tr("卖家还价")}</p>
                  {bargain.sellerQuoteAt && (
                    <p className="text-xs text-emerald-500 mt-0.5">
                      {new Date(bargain.sellerQuoteAt).toLocaleString(isZh ? "zh-CN" : "en-US")}
                    </p>
                  )}
                </div>
                <p className="text-2xl font-bold font-mono text-emerald-700">¥{bargain.sellerQuoteAmount.toLocaleString()}</p>
              </div>
              {bargain.sellerQuoteMsg && <p className="text-sm text-emerald-700">{bargain.sellerQuoteMsg}</p>}
              <button
                onClick={handleAcceptSellerQuote}
                disabled={offering}
                className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {offering ? "..." : (tr("接受此还价"))}
              </button>
            </div>
          )}

          {/* 报价输入 */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">¥</span>
              <input
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                placeholder={tr("输入您的报价金额")}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-[#1E40AF]"
              />
            </div>
            <button
              onClick={handleOffer}
              disabled={offering || !offerAmount}
              className="px-6 py-3 bg-[#1E40AF] text-white rounded-lg font-bold hover:bg-blue-800 disabled:bg-gray-300 transition-colors whitespace-nowrap"
            >
              {offering ? "..." : (tr("提交报价"))}
            </button>
          </div>

          {message && (
            <p className={`text-sm ${message.includes("成功") || message.includes("success") || message.includes("已接受") || message.includes("提交") || message.includes("已保存") || message.includes("已发送") ? "text-green-600" : "text-red-600"}`}>
              {message}
            </p>
          )}

          {/* 预约看车 */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setShowBookingModal(true)}
              className="flex-1 py-2.5 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 text-center transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <MapPin className="h-4 w-4" />
              {tr("预约看车")}
            </button>
          </div>

          {/* 保证金说明（合规改造：平台不设保证金） */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
            <p className="font-bold text-gray-700 mb-1">{tr("关于保证金")}</p>
            <p>
              {tr("本平台不强制收取保证金。如卖家要求缴纳诚意金，由买卖双方自行约定金额和支付方式，平台不代收、不验证、不托管。")}
            </p>
          </div>
        </div>
      )}

      {/* 卖家工作台：还价 + 设置最低接受价（仅卖家可见） */}
      {isSeller && isActive && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-3">
          <p className="text-sm font-bold text-amber-800">
            {tr("卖家工作台：给出还价，或设置内部最低接受价")}
          </p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-700">{tr("向买家还价")}</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">¥</span>
                <input
                  type="number"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value)}
                  placeholder={tr("还价金额")}
                  className="w-full pl-7 pr-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={handleSellerQuote}
                disabled={sellerActionLoading || !quoteAmount}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
              >
                {tr("发送还价")}
              </button>
            </div>
            <input
              type="text"
              value={quoteMsg}
              onChange={(e) => setQuoteMsg(e.target.value)}
              placeholder={tr("还价留言（选填）")}
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-2 border-t border-amber-200 pt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <Tag className="h-3.5 w-3.5" />
              {tr("内部最低接受价（仅您可见，不向买家展示）")}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={reserveInput}
                onChange={(e) => setReserveInput(e.target.value)}
                placeholder={tr("最低接受价")}
                className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleSetReserve}
                disabled={sellerActionLoading || !reserveInput}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50"
              >
                {tr("保存")}
              </button>
            </div>
            {bargain.reservePrice != null && (
              <p className="text-xs text-amber-600">
                {tr("当前最低接受价")}: ¥{bargain.reservePrice.toLocaleString()}
              </p>
            )}
          </div>

          {message && (
            <p className={`text-sm ${message.includes("成功") || message.includes("已保存") || message.includes("已发送") ? "text-green-700" : "text-red-600"}`}>
              {message}
            </p>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  4. 成交后引导                                                */}
      {/* ============================================================ */}
      {isAccepted && acceptedBid && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 font-bold text-lg">{tr("交易已达成")}</p>
              <p className="text-sm text-green-600 mt-1">
                {tr("买家 {name} 以 ¥{amount} 成交")
                  .replace("{name}", acceptedBid.bidder.companyName || acceptedBid.bidder.username || tr("用户"))
                  .replace("{amount}", acceptedBid.amount.toLocaleString())}
              </p>
            </div>
            <p className="text-2xl font-bold text-green-700 font-mono">¥{acceptedBid.amount.toLocaleString()}</p>
          </div>

          {paymentCountdown && (
            <div className="bg-red-50 rounded-lg p-3 flex items-center gap-3">
              <Clock className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">{tr("付款截止倒计时")}</p>
                <p className="text-xl font-bold text-red-600 font-mono">{paymentCountdown}</p>
                {bargain.paymentDeadline && (
                  <p className="text-xs text-red-400 mt-1">
                    {tr("截止时间")}: {new Date(bargain.paymentDeadline).toLocaleString(isZh ? "zh-CN" : "en-US")}
                  </p>
                )}
              </div>
            </div>
          )}

          {bargain.contractTemplateNo && (
            <div className="bg-white/60 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{tr("买卖合同")}</p>
                  <p className="text-sm text-gray-500 font-mono">{tr("合同编号")}：{bargain.contractTemplateNo}</p>
                </div>
              </div>
              <button
                onClick={toggleContract}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 ml-8"
              >
                <Eye className="h-3 w-3" />
                {tr("查看完整合同条款")}
                {showContract ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showContract && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg max-h-[400px] overflow-y-auto text-xs border border-gray-200">
                  {bargain.contractHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: bargain.contractHtml }} />
                  ) : (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 交付与过户（通用说明） */}
          <div className="bg-white/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-900">{tr("交付与过户")}</p>
                <p className="text-sm text-gray-500">
                  {tr("看货满意后，双方协商交付安排。大额交易建议通过担保支付保障资金安全。")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-900">{tr("权属保证")}</p>
                <p className="text-sm text-gray-500">
                  {tr("卖方应如实披露标的物权属状况。对明知或应知而未披露的重大瑕疵，卖方依法承担责任。")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isActive && !isAccepted && (
        <div className="bg-gray-100 rounded-xl p-4 text-sm text-gray-500 text-center">
          {tr("该询价已关闭")}
        </div>
      )}

      {/* ============================================================ */}
      {/*  5. 风险告知（通用）                                          */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          {tr("交易风险提示")}
        </h3>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-gray-900">{tr("设备现状说明")}</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>• {tr("标的物按实物现状交付，建议报价前实地查验。")}</li>
            <li>• {(() => {
              const wh = bargain.product.workingHours;
              const v = wh != null ? `${wh} ${tr("工时")}` : tr("运转状况以看货为准");
              return tr("发动机：{v}").replace("{v}", v);
            })()}</li>
          </ul>
          <p className="text-xs text-gray-500 mt-2">
            {tr("对明知或应知而未披露的重大瑕疵，卖方仍依法承担责任。平台仅提供信息展示与增值服务，不收取交易服务费、不碰支付。")}
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  6. 报价记录（卖家视角：可见全部；买家视角：仅可见自己的）    */}
      {/* ============================================================ */}
      {isActive && sellerBids.length > 0 && isSeller && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1">{tr("收到的报价")}</h3>
          <p className="text-xs text-gray-400 mb-4">{tr("报价仅您可见，买家之间无法看到彼此报价")}</p>
          <div className="space-y-2">
            {sellerBids.map((bid, idx) => (
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
                    {bid.bidder.companyName || bid.bidder.username || (tr("匿名用户"))}
                  </span>
                  {bid.status === "accepted" || bid.isWinning ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                      {tr("已成交")}
                    </span>
                  ) : bid.status === "rejected" ? (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-medium">
                      {tr("已拒绝")}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {tr("待处理")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 font-mono">¥{bid.amount.toLocaleString()}</span>
                  {bid.status === "pending" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAccept(bid.id)}
                        disabled={sellerActionLoading}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {tr("接受")}
                      </button>
                      <button
                        onClick={() => handleReject(bid.id)}
                        disabled={sellerActionLoading}
                        className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        {tr("拒绝")}
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

      {/* 买家视角：仅显示自己的报价记录 */}
      {isActive && !isSeller && bargain.bids.filter((b) => b.bidder.id === currentUserId).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">{tr("我的报价记录")}</h3>
          <div className="space-y-2">
            {bargain.bids
              .filter((b) => b.bidder.id === currentUserId)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((bid, idx) => (
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
                    {bid.status === "accepted" || bid.isWinning ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                        {tr("已成交")}
                      </span>
                    ) : bid.status === "rejected" ? (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-medium">
                        {tr("已拒绝")}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {tr("待卖家回复")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 font-mono">¥{bid.amount.toLocaleString()}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(bid.createdAt).toLocaleString(isZh ? "zh-CN" : "en-US")}
                    </span>
                  </div>
                </div>
              ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {tr("您的报价仅卖家可见，其他买家无法查看。")}
          </p>
        </div>
      )}

      {/* 链接到询价规则页 */}
      <div className="text-center">
        <a
          href={`/${locale}/auctions/rules`}
          className="text-sm text-gray-500 hover:text-[#1E40AF] inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {tr("查看询价规则与交易保障")}
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
