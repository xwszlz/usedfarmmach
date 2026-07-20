"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { Users, Check, Clock, Loader2, AlertCircle, Gavel, FileText, Play, Pause } from "lucide-react";

interface Booking {
  id: string;
  name: string;
  phone: string;
  preferredDate: string | null;
  flawConfirmed: boolean;
  riskConfirmed: boolean;
  depositAmount: number | null;
  depositPaid: boolean;
  depositProofUrl: string | null;
  depositConfirmedAt: string | null;
  status: string;
  createdAt: string;
}

interface AuctionInfo {
  id: string;
  bargainNo: string;
  title: string;
  status: string;
  announcementNo: string | null;
  minParticipants: number | null;
  deposit: number;
  startPrice: number | null;
  askingPrice: number;
  startTime: string | null;
  _count?: { bids: number };
}

export default function AuctionBookingsPage() {
  const locale = useLocale();
  const isZh = (locale || "zh") === "zh";
  const [auctions, setAuctions] = useState<AuctionInfo[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<string>("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string>("");
  const [error, setError] = useState("");

  const getAuthHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.token) headers["Authorization"] = `Bearer ${u.token}`;
        } catch {}
      }
    }
    return headers;
  };

  // 获取所有议价（不限状态）
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auctions?status=all&limit=50", { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          // 优先选 active 的，没有就选第一个
          const firstActive = json.data.find((a: AuctionInfo) => a.status === "active");
          setAuctions(json.data);
          setSelectedAuction(firstActive?.id || json.data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch auctions:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 获取报名列表
  const fetchBookings = useCallback(async () => {
    if (!selectedAuction) return;
    try {
      const res = await fetch(`/api/auctions/${selectedAuction}/inspection-booking`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) setBookings(json.data || []);
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    }
  }, [selectedAuction]);

  useEffect(() => {
    if (selectedAuction) fetchBookings();
  }, [selectedAuction, fetchBookings]);

  const handleConfirm = async (bookingId: string) => {
    if (!confirm(isZh ? "确认已收到诚意金？" : "Confirm earnest money received?")) return;
    setConfirming(bookingId);
    setError("");
    try {
      const res = await fetch(`/api/auctions/${selectedAuction}/deposit/confirm`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ bookingId }),
      });
      const json = await res.json();
      if (json.success) {
        fetchBookings();
      } else {
        setError(json.error || "Failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setConfirming("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const currentAuction = auctions.find((a) => a.id === selectedAuction);
  const confirmedCount = bookings.filter((b) => b.depositPaid).length;
  const pendingCount = bookings.filter((b) => b.status === "deposit_paid").length;
  const minParticipants = currentAuction?.minParticipants || 3;
  const isStarted = confirmedCount >= minParticipants;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Gavel className="h-7 w-7 text-blue-600" />
        {isZh ? "询价报名管理" : "Inquiry Bookings"}
      </h1>

      {/* 议价列表 - 卡片式展示 */}
      {auctions.length > 0 ? (
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-gray-500 mb-2">{isZh ? "点击选择议价项目" : "Click to select"}</p>
          {auctions.map((a) => {
            const selected = a.id === selectedAuction;
            const isCancelled = a.status === "cancelled";
            return (
              <button
                key={a.id}
                onClick={() => setSelectedAuction(a.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  selected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900 truncate">{a.title}</span>
                      {a.announcementNo && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-mono">
                          {a.announcementNo}
                        </span>
                      )}
                      {isCancelled && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">
                          {isZh ? "已取消" : "Cancelled"}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {a.bargainNo} · {isZh ? "建议诚意金" : "Earnest"} ¥{(a.deposit || 0).toLocaleString()}
                      {a.startPrice && ` · ${isZh ? "起始价" : "Start"} ¥${a.startPrice.toLocaleString()}`}
                    </div>
                  </div>
                  {selected && (
                    <div className="flex items-center gap-1 text-blue-600 text-sm font-medium ml-2 shrink-0">
                      <Check className="h-4 w-4" />
                      {isZh ? "当前查看" : "Selected"}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          {isZh ? "暂无议价记录" : "No bargains available"}
        </div>
      )}

      {/* 状态卡片 - 最显眼的位置 */}
      {currentAuction && (
        <div className={`rounded-2xl p-5 mb-4 ${isStarted ? "bg-green-50 border-2 border-green-300" : "bg-amber-50 border-2 border-amber-300"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isStarted ? "bg-green-500" : "bg-amber-500"}`}>
                {isStarted ? (
                  <Play className="h-7 w-7 text-white" fill="white" />
                ) : (
                  <Pause className="h-7 w-7 text-white" fill="white" />
                )}
              </div>
              <div>
                <div className={`text-2xl font-bold ${isStarted ? "text-green-700" : "text-amber-700"}`}>
                  {isStarted
                    ? (isZh ? "✓ 询价进行中" : "Inquiry Active")
                    : (isZh ? "⏳ 等待询价" : "Waiting")}
                </div>
                <div className={`text-sm ${isStarted ? "text-green-600" : "text-amber-600"}`}>
                  {isStarted
                    ? (isZh ? `已确认 ${confirmedCount} 人收到诚意金，询价进行中` : `${confirmedCount} confirmed, inquiry active`)
                    : (isZh ? `已确认 ${confirmedCount} 人收到诚意金` : `${confirmedCount} confirmed`)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold font-mono ${isStarted ? "text-green-600" : "text-amber-600"}`}>
                {confirmedCount}/{minParticipants}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {isZh ? "确认人数/最低人数" : "Confirmed/Min"}
              </div>
            </div>
          </div>

          {/* 进度条 */}
          <div className="mt-4">
            <div className="w-full h-3 bg-white/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isStarted ? "bg-green-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, (confirmedCount / minParticipants) * 100)}%` }}
              />
            </div>
          </div>

          {/* 报名统计 */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-white/70 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{isZh ? "总报名" : "Total"}</p>
              <p className="text-xl font-bold text-gray-700">{bookings.length}</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{isZh ? "待确认" : "Pending"}</p>
              <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{isZh ? "已确认" : "Confirmed"}</p>
              <p className="text-xl font-bold text-green-600">{confirmedCount}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 rounded-lg p-3 mb-4 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* 报名列表 */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-blue-600" />
          {isZh ? "报名详情" : "Booking Details"}
        </h2>
        {bookings.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl">
            {isZh ? "暂无报名记录" : "No bookings yet"}
          </div>
        ) : (
          bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{b.name}</span>
                    <span className="text-sm text-gray-500">{b.phone}</span>
                    {b.status === "confirmed" ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> {isZh ? "已确认" : "Confirmed"}
                      </span>
                    ) : b.status === "deposit_paid" ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {isZh ? "待确认收款" : "Pending"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                        {isZh ? "待缴诚意金" : "No Earnest"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {isZh ? "报名时间" : "Registered"}: {new Date(b.createdAt).toLocaleString("zh-CN")}
                    {b.preferredDate && ` · ${isZh ? "期望验车" : "Preferred"}: ${new Date(b.preferredDate).toLocaleDateString("zh-CN")}`}
                  </div>
                  {b.depositAmount != null && (
                    <div className="text-sm">
                      <span className="text-gray-500">{isZh ? "诚意金" : "Earnest"}: </span>
                      <span className="font-semibold text-red-600">¥{b.depositAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {b.depositProofUrl && (
                    <a href={b.depositProofUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {isZh ? "查看转账凭证 →" : "View deposit proof →"}
                    </a>
                  )}
                  {/* 确认信息 */}
                  <div className="text-xs text-gray-400 mt-1">
                    {b.flawConfirmed ? "✓" : "✗"} {isZh ? "瑕疵已确认" : "Flaw confirmed"}
                    {" · "}
                    {b.riskConfirmed ? "✓" : "✗"} {isZh ? "风险已确认" : "Risk confirmed"}
                  </div>
                </div>
                {b.status === "deposit_paid" && (
                  <button
                    onClick={() => handleConfirm(b.id)}
                    disabled={confirming === b.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-2 shrink-0"
                  >
                    {confirming === b.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {isZh ? "确认收款" : "Confirm"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
