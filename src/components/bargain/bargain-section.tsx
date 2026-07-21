"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "next-intl";
import { Clock, Check, FileText, MapPin, TrendingUp, AlertCircle, MessageSquare, ShieldCheck, ChevronDown, ChevronUp, Truck, Wrench, Eye, Lock, X } from "lucide-react";
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
  // 公告参数
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

  const [bargain, setBargain] = useState<BargainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerAmount, setOfferAmount] = useState("");
  const [offering, setOffering] = useState(false);
  const [message, setMessage] = useState("");
  const [sellerActionLoading, setSellerActionLoading] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [paymentCountdown, setPaymentCountdown] = useState("");
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [announcementHtml, setAnnouncementHtml] = useState("");
  const [contractHtml, setContractHtml] = useState("");

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

  // 懒加载公告/合同HTML
  const loadAnnouncementHtml = useCallback(async () => {
    if (announcementHtml) return;
    try {
      const res = await fetch("/documents/mf3404_announcement.html");
      if (res.ok) setAnnouncementHtml(await res.text());
    } catch { /* noop */ }
  }, [announcementHtml]);

  const loadContractHtml = useCallback(async () => {
    if (contractHtml) return;
    try {
      const res = await fetch("/documents/mf3404_contract_template.html");
      if (res.ok) setContractHtml(await res.text());
    } catch { /* noop */ }
  }, [contractHtml]);

  const toggleAnnouncement = () => {
    if (!showAnnouncement) loadAnnouncementHtml();
    setShowAnnouncement(!showAnnouncement);
  };

  const toggleContract = () => {
    if (!showContract) loadContractHtml();
    setShowContract(!showContract);
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
        setMessage(isZh ? "报价已提交！卖家将审阅您的报价并通过平台回复。" : "Offer submitted! Seller will review and respond.");
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
        setMessage(isZh ? "已接受报价，交易达成！" : "Offer accepted! Deal made!");
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

  // 询价/报价模式：报价列表仅卖家可见，买家看不到他人报价
  const sellerBids = [...bargain.bids].sort((a, b) => b.amount - a.amount);
  const acceptedBid = bargain.bids.find((b) => b.status === "accepted" || b.isWinning);

  const statusBadge = (status: string) => {
    const map: Record<string, { zh: string; en: string; bg: string }> = {
      active: { zh: "询价中", en: "Open", bg: "bg-emerald-500" },
      accepted: { zh: "已成交", en: "Sold", bg: "bg-blue-500" },
      cancelled: { zh: "已关闭", en: "Closed", bg: "bg-gray-400" },
    };
    const s = map[status] || map.cancelled;
    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-semibold text-white ${s.bg}`}>
        {isZh ? s.zh : s.en}
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
            {isAccepted
              ? (isZh ? `已成交 · ${bargain.totalBidders} 人参与询价` : `${bargain.totalBidders} offerers · Deal closed`)
              : (isZh ? `已有 ${bargain.totalBidders} 人询价` : `${bargain.totalBidders} offerers`)}
          </span>
          <span className="text-[#1E40AF] font-semibold">
            {bargain.seller.companyName || bargain.seller.username || (isZh ? "平台自营" : "Platform")}
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  2. 车况信息卡 + 权属徽章 + 评估报告摘要                      */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* 车况信息卡 */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-[#1E40AF]" />
            {isZh ? "车辆信息" : "Vehicle Info"}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 text-xs">{isZh ? "品牌型号" : "Model"}</span>
              <p className="font-semibold text-gray-900 mt-0.5">{isZh ? "常州爱科 MF3404" : "Changzhou AGCO MF3404"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 text-xs">VIN码</span>
              <p className="font-mono font-semibold text-gray-900 mt-0.5">AKCMY48GHNB091020</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 text-xs">{isZh ? "车牌号" : "Plate"}</span>
              <p className="font-semibold text-gray-900 mt-0.5">苏09Y8888</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 text-xs">{isZh ? "最大马力" : "Max Power"}</span>
              <p className="font-semibold text-gray-900 mt-0.5">340 {isZh ? "匹" : "HP"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 text-xs">{isZh ? "出厂日期" : "Mfg Date"}</span>
              <p className="font-semibold text-gray-900 mt-0.5">2022-08-11</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 text-xs">{isZh ? "驱动形式" : "Drive"}</span>
              <p className="font-semibold text-gray-900 mt-0.5">4×4</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 text-xs">{isZh ? "排放标准" : "Emission"}</span>
              <p className="font-semibold text-gray-900 mt-0.5">{isZh ? "国三" : "China III"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 text-xs">{isZh ? "发动机品牌" : "Engine"}</span>
              <p className="font-semibold text-gray-900 mt-0.5">{isZh ? "爱科动力" : "AGCO Power"}</p>
            </div>
          </div>
        </div>

        {/* 评估价 */}
        {bargain.evaluationPrice != null && (
          <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
            <div>
              <span className="text-sm text-blue-700">{isZh ? "参考评估价" : "Evaluation Price"}</span>
              <p className="text-xs text-blue-500 mt-0.5">
                {isZh ? "评估基准日：2025年8月 · 仅供参考" : "Evaluation date: Aug 2025 · reference only"}
              </p>
            </div>
            <span className="text-lg font-bold text-blue-700 font-mono">
              ¥{Number(bargain.evaluationPrice).toLocaleString()}
            </span>
          </div>
        )}

        {/* 权属徽章 */}
        <div className="flex items-center gap-3 bg-green-50 rounded-lg p-3">
          <Lock className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">{isZh ? "权属文件已上传" : "Title Documents Uploaded"}</p>
            <p className="text-xs text-green-600 mt-0.5">
              {isZh ? "来源合同等权属证明可预约现场查验" : "Source contract & title docs available for on-site inspection"}
            </p>
          </div>
        </div>

        {/* 已知瑕疵 */}
        {bargain.knownFlaws && (
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-sm font-bold text-amber-800 mb-1">⚠ {isZh ? "已知瑕疵" : "Known Flaws"}</p>
            <p className="text-sm text-amber-700">{bargain.knownFlaws}</p>
          </div>
        )}

        {/* 工作时长 */}
        {bargain.product.workingHours != null && (
          <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">{isZh ? "发动机工作时长" : "Engine Hours"}</span>
            <span className="text-sm font-bold text-gray-900 font-mono">{bargain.product.workingHours} {isZh ? "小时" : "hrs"}</span>
          </div>
        )}

        {/* 询价公告折叠面板 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={toggleAnnouncement}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#1E40AF]" />
              {isZh ? "询价公告全文" : "Full Inquiry Announcement"}
            </span>
            {showAnnouncement ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {showAnnouncement && (
            <div className="p-4 max-h-[500px] overflow-y-auto text-sm border-t border-gray-100">
              {announcementHtml ? (
                <div dangerouslySetInnerHTML={{ __html: announcementHtml }} />
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1E40AF]"></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 合同模板预览 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={toggleContract}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              {isZh ? "买卖合同模板预览" : "Sales Contract Preview"}
            </span>
            {showContract ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {showContract && (
            <div className="p-4 max-h-[500px] overflow-y-auto text-sm border-t border-gray-100">
              {contractHtml ? (
                <div dangerouslySetInnerHTML={{ __html: contractHtml }} />
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  3. 询价/报价区（核心改造：一对一询价）                        */}
      {/* ============================================================ */}
      {isActive && !isSeller && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#1E40AF]" />
              {isZh ? "提交您的报价" : "Submit Your Offer"}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {isZh
                ? "请输入您的心理价位，卖家将审阅后决定是否接受。您的报价对其他买家不可见。"
                : "Enter your price. The seller will review and respond. Your offer is private."}
            </p>
          </div>

          {/* 合规提示 */}
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 leading-relaxed">
            <p className="font-bold mb-1">ℹ {isZh ? "询价须知" : "Inquiry Notice"}</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>{isZh ? "本功能为在线询价/报价，不是拍卖。" : "This is an online inquiry/quote, not an auction."}</li>
              <li>{isZh ? "卖家可接受或拒绝任何报价，无需说明理由。" : "Seller may accept or reject any offer."}</li>
              <li>{isZh ? "报价相互不可见，不存在竞价。" : "Offers are private — no bidding competition."}</li>
              <li>{isZh ? "建议先预约看车，实地查验后再报价。" : "We recommend inspecting the equipment before offering."}</li>
            </ul>
          </div>

          {/* 报价输入 */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">¥</span>
              <input
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                placeholder={isZh ? "输入您的报价金额" : "Enter your offer amount"}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-[#1E40AF]"
              />
            </div>
            <button
              onClick={handleOffer}
              disabled={offering || !offerAmount}
              className="px-6 py-3 bg-[#1E40AF] text-white rounded-lg font-bold hover:bg-blue-800 disabled:bg-gray-300 transition-colors whitespace-nowrap"
            >
              {offering ? "..." : (isZh ? "提交报价" : "Submit")}
            </button>
          </div>

          {message && (
            <p className={`text-sm ${message.includes("成功") || message.includes("success") || message.includes("已接受") || message.includes("提交") ? "text-green-600" : "text-red-600"}`}>
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
              {isZh ? "预约看车" : "Book Inspection"}
            </button>
          </div>

          {/* 保证金说明（合规改造：平台不设保证金） */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
            <p className="font-bold text-gray-700 mb-1">{isZh ? "关于保证金" : "About Deposit"}</p>
            <p>
              {isZh
                ? "本平台不强制收取保证金。如卖家要求缴纳诚意金，由买卖双方自行约定金额和支付方式，平台不代收、不验证、不托管。"
                : "The platform does not require deposits. Any earnest money is agreed between buyer and seller directly — the platform does not collect, verify, or hold funds."}
            </p>
          </div>
        </div>
      )}

      {/* 卖家管理区 */}
      {isSeller && isActive && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-sm text-amber-700">
          {isZh
            ? "这是您的询价商品。下方为收到的报价列表，您可以选择接受或拒绝。报价仅您可见，买家之间无法看到彼此的报价。"
            : "This is your listing. Review offers below — accept or reject. Offers are visible only to you."}
        </div>
      )}

      {/* ============================================================ */}
      {/*  4. 成交后引导                                                */}
      {/* ============================================================ */}
      {isAccepted && acceptedBid && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 font-bold text-lg">{isZh ? "交易已达成" : "Deal Made"}</p>
              <p className="text-sm text-green-600 mt-1">
                {isZh
                  ? `买家 ${acceptedBid.bidder.companyName || acceptedBid.bidder.username || "用户"} 以 ¥${acceptedBid.amount.toLocaleString()} 成交`
                  : `Buyer ${acceptedBid.bidder.companyName || acceptedBid.bidder.username || "User"} dealt at ¥${acceptedBid.amount.toLocaleString()}`}
              </p>
            </div>
            <p className="text-2xl font-bold text-green-700 font-mono">¥{acceptedBid.amount.toLocaleString()}</p>
          </div>

          {paymentCountdown && (
            <div className="bg-red-50 rounded-lg p-3 flex items-center gap-3">
              <Clock className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">{isZh ? "付款截止倒计时" : "Payment Deadline"}</p>
                <p className="text-xl font-bold text-red-600 font-mono">{paymentCountdown}</p>
                {bargain.paymentDeadline && (
                  <p className="text-xs text-red-400 mt-1">
                    {isZh ? "截止时间" : "Deadline"}: {new Date(bargain.paymentDeadline).toLocaleString(isZh ? "zh-CN" : "en-US")}
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
                  <p className="text-sm font-bold text-gray-900">{isZh ? "买卖合同" : "Sales Contract"}</p>
                  <p className="text-sm text-gray-500 font-mono">{isZh ? "合同编号" : "Contract No."}：{bargain.contractTemplateNo}</p>
                </div>
              </div>
              <button
                onClick={toggleContract}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 ml-8"
              >
                <Eye className="h-3 w-3" />
                {isZh ? "查看完整合同条款" : "View full contract terms"}
                {showContract ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showContract && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg max-h-[400px] overflow-y-auto text-xs border border-gray-200">
                  {contractHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: contractHtml }} />
                  ) : (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 交付提醒（合规改造：补充过户配合义务） */}
          <div className="bg-white/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-900">{isZh ? "交付与过户" : "Delivery & Transfer"}</p>
                <p className="text-sm text-gray-500">
                  {isZh
                    ? "卖方应配合买方办理过户手续，包括签署文件、提供农机登记证书等。具体交付安排由双方协商。"
                    : "Seller shall assist with transfer procedures. Delivery arrangements to be agreed."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-900">{isZh ? "权属保证" : "Title Guarantee"}</p>
                <p className="text-sm text-gray-500">
                  {isZh
                    ? "卖方确认其为合法所有权人或经授权的处置权人。因权属瑕疵导致无法过户的，买方有权解除合同。"
                    : "Seller confirms legal title. Buyer may cancel if title defects prevent transfer."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isActive && !isAccepted && (
        <div className="bg-gray-100 rounded-xl p-4 text-sm text-gray-500 text-center">
          {isZh ? "该询价已关闭" : "This inquiry is closed"}
        </div>
      )}

      {/* ============================================================ */}
      {/*  5. 风险告知                                                  */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          {isZh ? "风险告知与设备说明" : "Risk Disclosure"}
        </h3>

        {/* 权属与过户告知 */}
        <div className="bg-amber-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-amber-800">⚠ {isZh ? "权属与过户告知" : "Title & Transfer"}</h4>
          <p className="text-sm text-amber-700">
            {isZh
              ? "卖方确认其为标的物的合法所有权人或经合法授权的处置权人，持有相关权属证明文件。卖方应配合买方办理过户手续。"
              : "Seller confirms legal title or authorized disposal rights. Seller shall assist with transfer procedures."}
          </p>
          <p className="text-sm text-amber-700">
            {isZh
              ? "因卖方权属瑕疵导致无法过户的，买方有权解除合同，卖方应退还已付全部款项并赔偿直接损失。"
              : "If title defects prevent transfer, buyer may cancel and recover full payment plus direct losses."}
          </p>
          {bargain.knownFlaws && (
            <p className="text-sm text-amber-700">
              {isZh ? "购入渠道：江苏金融淘宝司法处置平台（合法合规）" : "Source: Jiangsu Judicial Disposal Platform (legal & compliant)"}
            </p>
          )}
        </div>

        {/* 设备现状说明 */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-gray-900">{isZh ? "设备现状说明" : "Equipment Condition"}</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>• {isZh ? "前配重：缺失，需另行配置" : "Front weight: Missing, needs separate configuration"}</li>
            <li>• {isZh ? "后悬挂：缺失，需另行配置" : "Rear hitch: Missing, needs separate configuration"}</li>
            <li>• {isZh ? `发动机：运转正常，${bargain.product.workingHours || "—"}工时` : `Engine: Running normally, ${bargain.product.workingHours || "—"} hours`}</li>
          </ul>
          <p className="text-xs text-gray-500 mt-2">
            {isZh
              ? "标的物按实物现状交付。建议买方在报价前实地查验。对明知或应知而未披露的重大瑕疵，卖方仍依法承担责任。"
              : "Sold as-is. Buyers should inspect before offering. Seller remains liable for known but undisclosed defects."}
          </p>
        </div>

        {/* 交付资料清单 */}
        <div className="bg-green-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-gray-900">{isZh ? "交付资料清单" : "Delivery Documents"}</h4>
          <ul className="space-y-1 text-sm text-green-700">
            <li>✓ {isZh ? "法院处置成交确认书" : "Court disposal confirmation"}</li>
            <li>✓ {isZh ? "设备评估报告" : "Equipment appraisal report"}</li>
            <li>✓ {isZh ? "设备交接清单" : "Equipment handover list"}</li>
            <li>✓ {isZh ? "标的物交付验收确认书" : "Delivery acceptance form"}</li>
            <li>✓ {isZh ? "其他法律文件" : "Other legal documents"}</li>
          </ul>
        </div>

        {/* 格式条款特别提示 */}
        <div className="bg-blue-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-blue-900">📋 {isZh ? "格式条款特别提示" : "Standard Terms Notice"}</h4>
          <p className="text-xs text-blue-700 leading-relaxed">
            {isZh
              ? "根据《民法典》第496条，请特别注意以下条款：①设备按现状交付，卖方对经合理查验可发现的瑕疵不承担担保责任，但对故意隐瞒或虚假陈述导致的损失仍依法承担责任；②卖方应配合过户，因权属瑕疵导致无法过户的买方有权解除合同；③违约责任对等适用。完整条款详见买卖合同。"
              : "Per PRC Civil Code Art. 496, please note: (1) Equipment sold as-is; seller not liable for discoverable defects but remains liable for concealed defects or misrepresentation; (2) Seller shall assist with transfer; buyer may cancel for title defects; (3) Liability is mutual. Full terms in the sales contract."}
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  6. 报价记录（卖家视角：可见全部；买家视角：仅可见自己的）    */}
      {/* ============================================================ */}
      {isActive && sellerBids.length > 0 && isSeller && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1">{isZh ? "收到的报价" : "Received Offers"}</h3>
          <p className="text-xs text-gray-400 mb-4">{isZh ? "报价仅您可见，买家之间无法看到彼此报价" : "Offers visible only to you"}</p>
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
                    {bid.bidder.companyName || bid.bidder.username || (isZh ? "匿名用户" : "Anonymous")}
                  </span>
                  {bid.status === "accepted" || bid.isWinning ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                      {isZh ? "已成交" : "Accepted"}
                    </span>
                  ) : bid.status === "rejected" ? (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-medium">
                      {isZh ? "已拒绝" : "Rejected"}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {isZh ? "待处理" : "Pending"}
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

      {/* 买家视角：仅显示自己的报价记录 */}
      {isActive && !isSeller && bargain.bids.filter((b) => b.bidder.id === currentUserId).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">{isZh ? "我的报价记录" : "My Offer History"}</h3>
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
                        {isZh ? "已成交" : "Accepted"}
                      </span>
                    ) : bid.status === "rejected" ? (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-medium">
                        {isZh ? "已拒绝" : "Rejected"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {isZh ? "待卖家回复" : "Pending"}
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
            {isZh ? "您的报价仅卖家可见，其他买家无法查看。" : "Your offer is visible only to the seller."}
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
          {isZh ? "查看询价规则与交易保障" : "View inquiry rules & guarantees"}
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
