"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { Users, Check, Clock, Loader2, AlertCircle } from "lucide-react";

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
  announcementNo: string | null;
  minParticipants: number | null;
  deposit: number;
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

  // 获取议价列表
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auctions?status=active", { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setAuctions(json.data);
          setSelectedAuction(json.data[0].id);
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
      if (json.success) setBookings(json.data);
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    }
  }, [selectedAuction]);

  useEffect(() => {
    if (selectedAuction) fetchBookings();
  }, [selectedAuction, fetchBookings]);

  const handleConfirm = async (bookingId: string) => {
    if (!confirm(isZh ? "确认已收到保证金？" : "Confirm deposit received?")) return;
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
  const minParticipants = currentAuction?.minParticipants || 3;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Users className="h-7 w-7 text-blue-600" />
        {isZh ? "议价报名管理" : "Bargain Bookings"}
      </h1>

      {/* 选择议价 */}
      {auctions.length > 0 ? (
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700">{isZh ? "选择议价" : "Select Bargain"}</label>
          <select
            value={selectedAuction}
            onChange={(e) => setSelectedAuction(e.target.value)}
            className="w-full md:w-96 px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm"
          >
            {auctions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.bargainNo})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          {isZh ? "暂无议价记录" : "No bargains available"}
        </div>
      )}

      {/* 报名进度 */}
      {currentAuction && (
        <div className="bg-blue-50 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm font-bold text-blue-900">
                {isZh ? "报名进度" : "Registration Progress"}
              </p>
              <p className="text-sm text-blue-700">
                {isZh
                  ? `已确认 ${confirmedCount} / 最低 ${minParticipants} 人`
                  : `${confirmedCount} confirmed / ${minParticipants} minimum`}
              </p>
            </div>
          </div>
          <div className="text-3xl font-bold text-blue-600 font-mono">
            {confirmedCount}/{minParticipants}
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
        {bookings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {isZh ? "暂无报名记录" : "No bookings yet"}
          </div>
        ) : (
          bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{b.name}</span>
                    <span className="text-sm text-gray-500">{b.phone}</span>
                    {b.status === "confirmed" ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> {isZh ? "已确认" : "Confirmed"}
                      </span>
                    ) : b.status === "deposit_paid" ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {isZh ? "待确认" : "Pending"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                        {isZh ? "待缴保证金" : "No Deposit"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {isZh ? "报名时间" : "Registered"}: {new Date(b.createdAt).toLocaleString("zh-CN")}
                    {b.preferredDate && ` · ${isZh ? "期望验车" : "Preferred"}: ${new Date(b.preferredDate).toLocaleDateString("zh-CN")}`}
                  </div>
                  {b.depositAmount != null && (
                    <div className="text-sm">
                      <span className="text-gray-500">{isZh ? "保证金" : "Deposit"}: </span>
                      <span className="font-semibold text-red-600">¥{b.depositAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {b.depositProofUrl && (
                    <a href={b.depositProofUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline">
                      {isZh ? "查看转账凭证 →" : "View deposit proof →"}
                    </a>
                  )}
                </div>
                {b.status === "deposit_paid" && (
                  <button
                    onClick={() => handleConfirm(b.id)}
                    disabled={confirming === b.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-2"
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
