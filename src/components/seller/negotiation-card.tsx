"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import {
  RefreshCw,
  MessageSquare,
  Tag,
  Check,
  X,
  Clock,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

export interface NegotiationBid {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  bidder: { id: string; username: string | null; companyName: string | null };
}

export interface NegotiationAuction {
  id: string;
  bargainNo: string;
  title: string;
  askingPrice: number | null;
  status: string;
  acceptedPrice: number | null;
  reservePrice: number | null;
  sellerQuoteAmount: number | null;
  sellerQuoteMsg: string | null;
  sellerQuoteAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    modelName: string;
    priceCny: number | null;
    images: { url: string }[];
    brand: { nameZh: string | null; nameEn: string | null };
  };
  bids: NegotiationBid[];
  _count: { bids: number };
}

const PRIMARY = "#1E40AF";

function auctionStatusBadge(status: string, isZh: boolean) {
  const map: Record<string, { zh: string; en: string; bg: string }> = {
    active: { zh: "询价中", en: "Open", bg: "bg-emerald-500" },
    accepted: { zh: "已成交", en: "Sold", bg: "bg-blue-500" },
    cancelled: { zh: "已关闭", en: "Closed", bg: "bg-gray-400" },
  };
  const s = map[status] || map.cancelled;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${s.bg}`}>
      {isZh ? s.zh : s.en}
    </span>
  );
}

function bidStatusBadge(status: string, isZh: boolean) {
  const map: Record<string, { zh: string; en: string; bg: string }> = {
    pending: { zh: "待处理", en: "Pending", bg: "bg-blue-100 text-blue-700" },
    accepted: { zh: "已成交", en: "Accepted", bg: "bg-green-100 text-green-700" },
    rejected: { zh: "已拒绝", en: "Rejected", bg: "bg-gray-100 text-gray-500" },
  };
  const s = map[status] || map.pending;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.bg}`}>{isZh ? s.zh : s.en}</span>;
}

export default function NegotiationCard({
  auction,
  onChanged,
}: {
  auction: NegotiationAuction;
  onChanged: () => void;
}) {
  const localeHook = useLocale();
  const isZh = (localeHook || "zh") === "zh";

  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteMsg, setQuoteMsg] = useState("");
  const [reserveInput, setReserveInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);

  const isActive = auction.status === "active";
  const displayPrice = auction.acceptedPrice ?? auction.askingPrice ?? auction.product.priceCny ?? 0;
  const productName = `${auction.product.brand?.nameZh || auction.product.brand?.nameEn || ""} ${auction.product.modelName}`.trim();
  const imageUrl = auction.product.images?.[0]?.url;

  const sortedBids = [...auction.bids].sort((a, b) => b.amount - a.amount);

  const flash = (text: string, ok: boolean) => {
    setMsg(text);
    setMsgOk(ok);
    if (ok) {
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const callApi = async (path: string, body?: unknown) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/auctions/${auction.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (json.success) {
        return json;
      }
      flash(json.error || (isZh ? "操作失败" : "Action failed"), false);
      return null;
    } catch {
      flash(isZh ? "网络错误，请重试" : "Network error, retry", false);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (bidId: string) => {
    const r = await callApi("accept", { bidId });
    if (r) {
      flash(isZh ? "已接受报价，交易达成！" : "Offer accepted! Deal made.", true);
      setQuoteAmount("");
      setQuoteMsg("");
      onChanged();
    }
  };

  const handleReject = async (bidId: string) => {
    const r = await callApi("reject", { bidId });
    if (r) {
      flash(isZh ? "已拒绝该报价" : "Offer rejected", true);
      onChanged();
    }
  };

  const handleSellerQuote = async () => {
    if (!quoteAmount) return;
    const r = await callApi("seller-quote", {
      amount: parseFloat(quoteAmount),
      message: quoteMsg || undefined,
    });
    if (r) {
      flash(isZh ? "还价已发送给买家" : "Quote sent to buyers", true);
      setQuoteAmount("");
      setQuoteMsg("");
      onChanged();
    }
  };

  const handleSetReserve = async () => {
    if (!reserveInput) return;
    const r = await callApi("settings", { reservePrice: parseFloat(reserveInput) });
    if (r) {
      flash(isZh ? "已保存最低接受价（仅您可见）" : "Floor price saved (private)", true);
      setReserveInput("");
      onChanged();
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* 头部：产品 + 状态 */}
      <div className="flex items-start gap-4 p-5 border-b border-gray-100">
        <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={productName} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-gray-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/zh/products/${auction.product.id}`}
              className="font-semibold text-gray-900 hover:text-[#1E40AF] hover:underline truncate"
            >
              {productName}
            </Link>
            {auctionStatusBadge(auction.status, isZh)}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{auction.bargainNo}</p>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <span className="text-xs text-gray-400">
                {auction.status === "accepted"
                  ? (isZh ? "成交价" : "Deal Price")
                  : (isZh ? "卖家要价" : "Asking Price")}
              </span>
              <p className={`text-lg font-bold font-mono ${auction.status === "accepted" ? "text-green-600" : "text-gray-900"}`}>
                ¥{Number(displayPrice).toLocaleString()}
              </p>
            </div>
            <div className="text-xs text-gray-500">
              {isZh ? "报价人数" : "Offerers"}: <span className="font-semibold text-gray-700">{auction._count.bids}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 已发还价 / 内部底价提示 */}
      {(auction.sellerQuoteAmount != null || auction.reservePrice != null) && (
        <div className="flex flex-wrap gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs">
          {auction.sellerQuoteAmount != null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
              <MessageSquare className="h-3 w-3" />
              {isZh ? "已还价" : "Quoted"}: ¥{auction.sellerQuoteAmount.toLocaleString()}
              {auction.sellerQuoteAt && (
                <span className="text-emerald-500">
                  · {new Date(auction.sellerQuoteAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                </span>
              )}
            </span>
          )}
          {auction.reservePrice != null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
              <Tag className="h-3 w-3" />
              {isZh ? "内部底价" : "Floor"}: ¥{auction.reservePrice.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* 报价列表 */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-900">{isZh ? "收到的报价" : "Received Offers"}</h4>
          <button
            onClick={onChanged}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#1E40AF] transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            {isZh ? "刷新" : "Refresh"}
          </button>
        </div>

        {sortedBids.length === 0 ? (
          <p className="text-sm text-gray-400 py-3 text-center">
            {isZh ? "暂无买家报价" : "No offers yet"}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedBids.map((bid, idx) => (
              <div
                key={bid.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  bid.status === "accepted"
                    ? "bg-green-50 border-green-200"
                    : bid.status === "rejected"
                    ? "bg-gray-50 border-gray-200"
                    : "bg-blue-50/40 border-blue-100"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-400 w-5 flex-shrink-0">#{idx + 1}</span>
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {bid.bidder.companyName || bid.bidder.username || (isZh ? "匿名用户" : "Anonymous")}
                  </span>
                  {bidStatusBadge(bid.status, isZh)}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-semibold text-gray-900 font-mono text-sm">
                    ¥{Number(bid.amount).toLocaleString()}
                  </span>
                  {bid.status === "pending" && isActive && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAccept(bid.id)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        {isZh ? "接受" : "Accept"}
                      </button>
                      <button
                        onClick={() => handleReject(bid.id)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        <X className="h-3 w-3" />
                        {isZh ? "拒绝" : "Reject"}
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(bid.createdAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 卖家工具：仅询价进行中显示 */}
        {isActive && (
          <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            {/* 还价 */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">{isZh ? "向买家还价" : "Counter-offer to buyers"}</p>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">¥</span>
                  <input
                    type="number"
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(e.target.value)}
                    placeholder={isZh ? "还价金额" : "Counter price"}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#1E40AF]"
                  />
                </div>
                <button
                  onClick={handleSellerQuote}
                  disabled={loading || !quoteAmount}
                  className="px-4 py-2 bg-[#1E40AF] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isZh ? "发送还价" : "Send")}
                </button>
              </div>
              <input
                type="text"
                value={quoteMsg}
                onChange={(e) => setQuoteMsg(e.target.value)}
                placeholder={isZh ? "还价留言（选填）" : "Message (optional)"}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#1E40AF]"
              />
            </div>

            {/* 内部最低接受价 */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                <Tag className="h-3.5 w-3.5" />
                {isZh ? "内部最低接受价（仅您可见）" : "Internal floor price (private)"}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">¥</span>
                  <input
                    type="number"
                    value={reserveInput}
                    onChange={(e) => setReserveInput(e.target.value)}
                    placeholder={isZh ? "最低接受价" : "Min accept price"}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#1E40AF]"
                  />
                </div>
                <button
                  onClick={handleSetReserve}
                  disabled={loading || !reserveInput}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {isZh ? "保存" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {msg && (
          <p className={`text-sm mt-3 ${msgOk ? "text-green-600" : "text-red-600"}`}>{msg}</p>
        )}
      </div>
    </div>
  );
}
