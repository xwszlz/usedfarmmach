"use client";
import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useTr } from "@/lib/i18n-tr";
import { translate } from "@/lib/i18n-runtime";
import { AuctionLicenseBadge } from "@/components/auction/auction-license-badge";
import { InternalTestBanner } from "@/components/auction/internal-test-banner";
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
        brand: {
            nameZh: string;
            nameEn: string;
        };
        images: {
            url: string;
        }[];
    };
    seller: {
        id: string;
        companyName: string | null;
        username: string | null;
    };
    _count: {
        bids: number;
    };
}
const STATUS_MAP: Record<string, {
    zh: string;
    en: string;
    bg: string;
    text: string;
}> = {
    active: { zh: "\u8BE2\u4EF7\u4E2D", en: "Open", bg: "bg-emerald-500", text: "text-white" },
    accepted: { zh: "\u5DF2\u6210\u4EA4", en: "Sold", bg: "bg-blue-500", text: "text-white" },
    cancelled: { zh: "\u5DF2\u53D6\u6D88", en: "Cancelled", bg: "bg-gray-400", text: "text-white" },
};
const CONDITION_MAP: Record<string, {
    zh: string;
    en: string;
}> = {
    excellent: { zh: "\u4F18\u79C0", en: "Excellent" },
    good: { zh: "\u826F\u597D", en: "Good" },
    fair: { zh: "\u4E00\u822C", en: "Fair" },
    poor: { zh: "\u8F83\u5DEE", en: "Poor" },
};
/** 真实拍卖上线后的差异化能力预览（P1 内部演示用，取证后陆续开放） */
function getLIVE_PREVIEW_FEATURES(tr: (s: string) => string): {
    icon: string;
    title: string;
    desc: string;
}[] {
  return [
    {
        icon: "\uD83E\uDD16",
        title: tr("AI 智能保留价"),
        desc: "\u5408\u6CD5\u4FDD\u7559\u4EF7\u673A\u5236\uFF0C\u5356\u65B9\u51C0\u5230\u624B\u7387 >95%\uFF0C\u544A\u522B\u5F3A\u5236\u65E0\u5E95\u4EF7\u5BF9\u5356\u65B9\u7684\u4F24\u5BB3\u3002",
    },
    {
        icon: "\uD83D\uDD0D",
        title: tr("机况卡 2.0"),
        desc: "AI \u9A8C\u673A + \u7ED3\u6784\u5316\u8F66\u51B5\u62A5\u544A\uFF0C\u5355\u53F0\u6210\u672C <\u00A5200\uFF0C\u8F66\u51B5\u900F\u660E\u53EF\u8FFD\u6EAF\u3002",
    },
    {
        icon: "\u26A1",
        title: tr("T+1 即时结算"),
        desc: "\u5168\u7A0B\u4E2D\u6587 + \u79FB\u52A8\u652F\u4ED8\uFF0C\u843D\u69CC\u540E\u6B21\u65E5\u7ED3\u7B97\uFF0C\u544A\u522B\u534A\u4E2A\u6708\u8D26\u671F\u3002",
    },
    {
        icon: "\uD83C\uDF3E",
        title: tr("农业生态嵌入"),
        desc: "\u5C55\u4F1A / \u5730\u5934\u5C55 / \u5408\u4F5C\u793E / \u4EE5\u65E7\u6362\u65B0 / \u8865\u8D34\uFF0C\u6E20\u9053\u5373\u6D41\u91CF\u5373\u4FE1\u4EFB\u3002",
    },
    {
        icon: "\uD83D\uDCCA",
        title: tr("农业数据护城河"),
        desc: "\u7ADE\u4EF7\u6570\u636E \u2192 AI \u57FA\u51C6\u4EF7 \u2192 \u4FDD\u7559\u4EF7\uFF0C\u8D8A\u62CD\u8D8A\u51C6\uFF0C\u5F62\u6210\u6570\u636E\u98DE\u8F6E\u3002",
    },
    {
        icon: "\uD83C\uDFAF",
        title: tr("100% 农机垂直"),
        desc: "\u53EA\u505A\u4E8C\u624B\u519C\u673A\uFF0C\u4E0D\u505A\u5DE5\u7A0B / \u8FD0\u8F93\u6DF7\u62CD\uFF0C\u4E13\u4E1A\u5EA6\u5373\u58C1\u5792\u3002",
    },
];
}
export default function BargainsClient({ auctionLicenseNo, site, isAdmin, }: {
    auctionLicenseNo: string | null;
    site: "com" | "cn";
    isAdmin: boolean;
}) {
  const tr = useTr();
    const locale = useLocale();
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
                if (json.success)
                    setBargains(json.data || []);
            }
        }
        catch (err) {
            console.error("Failed to fetch bargains:", err);
        }
        finally {
            setLoading(false);
        }
    };
    // 获取所有询价（含已成交）用于统计
    const [allBargains, setAllBargains] = useState<Bargain[]>([]);
    useEffect(() => {
        fetch("/api/auctions?limit=100&status=all")
            .then((r) => r.json())
            .then((json) => {
            if (json.success)
                setAllBargains(json.data || []);
        })
            .catch(() => { });
    }, []);
    const filtered = filter === "all" ? bargains : bargains.filter((b) => b.status === filter);
    // 统计数据
    const activeCount = bargains.length;
    const minPrice = bargains.length > 0 ? Math.min(...bargains.map((b) => b.askingPrice || b.product.priceCny || 0)) : 0;
    const totalDeals = allBargains.filter((b) => b.status === "accepted").length;
    if (loading) {
        return (<div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>);
    }
    return (<div className="min-h-screen bg-[#F9FAFC]">
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
          {mode === "blind" && (<div className="flex gap-8 md:gap-12">
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
            </div>)}
        </div>
      </div>

      {/* 内部测试横幅：仅管理员可见，说明拍卖功能当前为 P1 占位（取证前勿宣传） */}
      {isAdmin && <InternalTestBanner site={site}/>}

      {/* 拍卖经营资质公示（S4，仅 .cn 且已取证时渲染） */}
      <AuctionLicenseBadge licenseNo={auctionLicenseNo} variant="channel"/>

      {/* 模式切换（真实拍卖仅 .cn 展示） */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setMode("blind")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "blind"
            ? "bg-[#1E40AF] text-white"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {tr("在线询价")}
            </button>
            {isCn && (<button onClick={() => setMode("live")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "live"
                ? "bg-[#1E40AF] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {tr("真实拍卖")}
              </button>)}
          </div>
          {mode === "blind" && (<Link href={`/${locale}/auctions/rules`} className="text-sm text-gray-500 hover:text-[#1E40AF] flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {tr("询价规则")}
            </Link>)}
        </div>
      </div>

      {mode === "blind" ? (<>
          {/* Filter Bar */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center gap-2">
              {[
                { value: "all", label: tr("全部") },
                { value: "active", label: tr("询价中") },
                { value: "accepted", label: tr("已成交") },
            ].map((tab) => (<button key={tab.value} onClick={() => setFilter(tab.value)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === tab.value
                    ? "bg-[#1E40AF] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {tab.label}
                </button>))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
            {filtered.length === 0 ? (<div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                <p className="text-gray-400 text-lg">
                  {tr("暂无询价商品")}
                </p>
              </div>) : (<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((bargain) => {
                    const status = STATUS_MAP[bargain.status] || STATUS_MAP.cancelled;
                    const displayPrice = bargain.acceptedPrice || bargain.askingPrice || bargain.product.priceCny || 0;
                    const p = bargain.product;
                    const subtitleParts = [
                        p.enginePower ? `${p.enginePower}${tr("马力")}` : null,
                        p.driveSystem || null,
                        p.workingHours ? `${p.workingHours}${tr("小时")}` : null,
                    ].filter(Boolean);
                    return (<Link key={bargain.id} href={`/${locale}/products/${bargain.product.id}#bargain`} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all group">
                      {/* Image */}
                      <div className="relative h-[150px] bg-gray-100 overflow-hidden">
                        {bargain.coverImage || p.images[0]?.url ? (<img src={bargain.coverImage || p.images[0]?.url} alt={bargain.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>) : (<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
                            <span className="text-gray-300 text-4xl">🚜</span>
                          </div>)}
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
                        {subtitleParts.length > 0 && (<p className="text-sm text-gray-500">
                            {subtitleParts.join(" \u00B7 ")}
                          </p>)}

                        {/* Spec Tags */}
                        <div className="flex gap-2 flex-wrap">
                          {p.condition && (<span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                              {translate(CONDITION_MAP[p.condition]?.zh ?? p.condition, locale)}
                            </span>)}
                          {p.location && (<span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 truncate max-w-[120px]">
                              {p.location}
                            </span>)}
                        </div>

                        {/* Price Row */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-gray-400">
                            {bargain.status === "accepted"
                            ? (tr("成交价"))
                            : (tr("卖家要价"))}
                          </span>
                          <span className={`text-lg font-bold font-mono ${bargain.status === "accepted" ? "text-green-600" : "text-gray-900"}`}>
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
                    </Link>);
                })}
              </div>)}
          </div>
        </>) : (
        /* 真实拍卖占位（P1 骨架：合规公示 + 通道筹备说明 + 差异化预览，真实开拍在 P2） */
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
            {/* 顶部合规提示 */}
            <div className="text-center pb-8 border-b border-gray-100">
              <div className="text-5xl mb-4">🔨</div>
              <p className="text-gray-800 text-2xl font-bold">{tr("真实拍卖通道")}</p>
              <p className="text-gray-500 mt-3 max-w-2xl mx-auto leading-relaxed">
                {tr("真实拍卖需持《拍卖经营批准证书》依法开展，通道筹备中")}
              </p>
              <p className="text-gray-400 mt-2 text-sm">
                {tr("正式开拍后，拍品将在此列出；当前仅作合规公示与内部预览")}
              </p>
            </div>

            {/* 上线后将有 — 差异化能力预览（内部演示） */}
            <div className="pt-8">
              <p className="text-center text-gray-700 font-semibold">{tr("上线后将有")}</p>
              <p className="text-center text-gray-400 text-sm mt-1 mb-6">
                {tr("以下差异化能力将在取得资质后陆续开放（内部预览）")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {getLIVE_PREVIEW_FEATURES(tr).map((f) => (<div key={f.title} className="rounded-xl border border-gray-200 p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                    <div className="text-3xl mb-2">{f.icon}</div>
                    <p className="font-semibold text-gray-800">{f.title}</p>
                    <p className="text-gray-500 text-sm mt-1 leading-relaxed">{f.desc}</p>
                  </div>))}
              </div>
            </div>
          </div>
        </div>)}
    </div>);
}
