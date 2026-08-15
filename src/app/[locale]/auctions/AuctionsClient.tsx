"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useTr } from "@/lib/i18n-tr";
import { AuctionLicenseBadge } from "@/components/auction/auction-license-badge";

interface Bargain {
  id: string;
  bargainNo: string;
  title: string;
  askingPrice: number;
  status: string;
  acceptedPrice: number | null;
  totalBids: number;
  totalBidders: number;
  coverImage: string | null;
  viewCount: number;
  product: {
    id: string;
    modelName: string;
    year: number;
    workingHours: number | null;
    condition: string;
    location: string;
    priceCny: number | null;
    enginePower: number | null;
    driveSystem: string | null;
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

const STATUS_MAP: Record<string, { zh: string; en: string; bg: string; text: string }> = {
  active: { zh: "询价中", en: "Open", bg: "bg-emerald-500", text: "text-white" },
  accepted: { zh: "已成交", en: "Sold", bg: "bg-blue-500", text: "text-white" },
  cancelled: { zh: "已取消", en: "Cancelled", bg: "bg-gray-400", text: "text-white" },
};

const CONDITION_MAP: Record<string, { zh: string; en: string }> = {
  excellent: { zh: "优秀", en: "Excellent" },
  good: { zh: "良好", en: "Good" },
  fair: { zh: "一般", en: "Fair" },
  poor: { zh: "较差", en: "Poor" },
};

export default function BargainsClient({
  auctionLicenseNo,
  site,
}: {
  auctionLicenseNo: string | null;
  site: "com" | "cn";
}) {
  const locale = useLocale();
  const isZh = locale === "zh";
  const tr = useTr();
  const isCn = site === "cn";
  const [bargains, setBargains] = useState<Bargain[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [mode, setMode] = useState<"blind" | "live">("blind");

  useEffect(() => {
    fetchBargains();
  }, []);

  const fetchBargains = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auctions?limit=50");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setBargains(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch bargains:", err);
    } finally {
      setLoading(false);
    }
  };

  // 获取所有询价（含已成交）用于统计
  const [allBargains, setAllBargains] = useState<Bargain[]>([]);
  useEffect(() => {
    fetch("/api/auctions?limit=100&status=all")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAllBargains(json.data || []);
      })
      .catch(() => {});
  }, []);

  const filtered = filter === "all" ? bargains : bargains.filter((b) => b.status === filter);

  // 统计数据
  const activeCount = bargains.length;
  const minPrice = bargains.length > 0 ? Math.min(...bargains.map((b) => b.askingPrice || b.product.priceCny || 0)) : 0;
  const totalDeals = allBargains.filter((b) => b.status === "accepted").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFC]">
      {/* Hero Header */}
      <div className="bg-[#1E40AF] px-6 py-10 md:px-12 md:py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              {mode === "live" ? tr("真实拍卖") : tr("在线询价")}
            </h1>
            <p className="text-sm md:text-base text-blue-200 mt-2">
              {mode === "live"
                ? tr("依法公开拍卖，持牌拍卖师主持，价高者得")
                : tr("一对一报价，透明询价，高效成交高价值农机设备")}
            </p>
          </div>
          {mode === "blind" && (
            <div className="flex gap-8 md:gap-12">
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-white font-mono">{activeCount}</p>
                <p className="text-xs text-blue-200 mt-1">{tr("正在询价")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-white font-mono">{totalDeals}</p>
                <p className="text-xs text-blue-200 mt-1">{tr("已成交")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-white font-mono">
                  ¥{minPrice > 0 ? (minPrice / 10000).toFixed(0) : "0"}
                  <span className="text-base">{tr("万")}</span>
                </p>
                <p className="text-xs text-blue-200 mt-1">{tr("起询价")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 拍卖经营资质公示（S4，仅 .cn 且已取证时渲染） */}
      <AuctionLicenseBadge licenseNo={auctionLicenseNo} variant="channel" />

      {/* 模式切换（真实拍卖仅 .cn 展示） */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("blind")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === "blind"
                  ? "bg-[#1E40AF] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tr("在线询价")}
            </button>
            {isCn && (
              <button
                onClick={() => setMode("live")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === "live"
                    ? "bg-[#1E40AF] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tr("真实拍卖")}
              </button>
            )}
          </div>
          {mode === "blind" && (
            <Link
              href={`/${locale}/auctions/rules`}
              className="text-sm text-gray-500 hover:text-[#1E40AF] flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {tr("询价规则")}
            </Link>
          )}
        </div>
      </div>

      {mode === "blind" ? (
        <>
          {/* Filter Bar */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center gap-2">
              {[
                { value: "all", label: tr("全部") },
                { value: "active", label: tr("询价中") },
                { value: "accepted", label: tr("已成交") },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === tab.value
                      ? "bg-[#1E40AF] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
            {filtered.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                <p className="text-gray-400 text-lg">
                  {tr("暂无询价商品")}
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((bargain) => {
                  const status = STATUS_MAP[bargain.status] || STATUS_MAP.cancelled;
                  const displayPrice = bargain.acceptedPrice || bargain.askingPrice || bargain.product.priceCny || 0;
                  const p = bargain.product;
                  const subtitleParts = [
                    p.enginePower ? `${p.enginePower}${tr("马力")}` : null,
                    p.driveSystem || null,
                    p.workingHours ? `${p.workingHours}${tr("小时")}` : null,
                  ].filter(Boolean);

                  return (
                    <Link
                      key={bargain.id}
                      href={`/${locale}/products/${bargain.product.id}#bargain`}
                      className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all group"
                    >
                      {/* Image */}
                      <div className="relative h-[150px] bg-gray-100 overflow-hidden">
                        {bargain.coverImage || p.images[0]?.url ? (
                          <img
                            src={bargain.coverImage || p.images[0]?.url}
                            alt={bargain.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
                            <span className="text-gray-300 text-4xl">{isZh ? "🚜" : "🚜"}</span>
                          </div>
                        )}
                        <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                          {tr(status.zh)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-2">
                        {/* Title Row */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-gray-900 truncate">{bargain.title}</h3>
                          <span className="text-xs text-gray-500 font-mono ml-2">{p.year}</span>
                        </div>

                        {/* Subtitle */}
                        {subtitleParts.length > 0 && (
                          <p className="text-sm text-gray-500">
                            {subtitleParts.join(" · ")}
                          </p>
                        )}

                        {/* Spec Tags */}
                        <div className="flex gap-2 flex-wrap">
                          {p.condition && (
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                              {CONDITION_MAP[p.condition]?.[isZh ? "zh" : "en"] || p.condition}
                            </span>
                          )}
                          {p.location && (
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 truncate max-w-[120px]">
                              {p.location}
                            </span>
                          )}
                        </div>

                        {/* Price Row */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-gray-400">
                            {bargain.status === "accepted"
                              ? (tr("成交价"))
                              : (tr("卖家要价"))}
                          </span>
                          <span className={`text-lg font-bold font-mono ${
                            bargain.status === "accepted" ? "text-green-600" : "text-gray-900"
                          }`}>
                            ¥{displayPrice.toLocaleString()}
                          </span>
                        </div>

                        {/* Offer Row */}
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-50">
                          <span>{tr("报价 {n} 人").replace("{n}", String(bargain._count.bids))}</span>
                          <span className="text-[#1E40AF] font-medium">
                            {bargain.seller.companyName || bargain.seller.username || (tr("平台自营"))}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* 真实拍卖占位（P1 骨架：合规公示 + 通道筹备说明，真实开拍在 P2） */
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <div className="text-5xl mb-4">🔨</div>
            <p className="text-gray-700 text-lg font-semibold">{tr("真实拍卖通道")}</p>
            <p className="text-gray-400 mt-2">
              {tr("真实拍卖需持《拍卖经营批准证书》依法开展，通道筹备中")}
            </p>
            <p className="text-gray-400 mt-1">
              {tr("正式开拍后，拍品将在此列出；当前仅作合规公示")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
