"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { TrendingUp, ArrowRight, Calendar, BarChart3, Globe, Loader2 } from "lucide-react";
import { getLocalizedData } from "@/config/daily-report-home";

const LABELS: Record<string, {
  title: string;
  viewReport: string;
  topOpportunities: string;
  marketIntel: string;
  price: string;
  profit: string;
}> = {
  zh: {
    title: "跨境套利日报",
    viewReport: "查看完整日报",
    topOpportunities: "今日TOP1 套利机会",
    marketIntel: "市场情报速递",
    price: "报价",
    profit: "毛利",
  },
  en: {
    title: "Cross-Border Arbitrage Daily",
    viewReport: "View Full Report",
    topOpportunities: "Today's TOP1 Opportunity",
    marketIntel: "Global Market Intel",
    price: "Price",
    profit: "Profit",
  },
  ru: {
    title: "Ежедневный арбитраж",
    viewReport: "Полный отчёт",
    topOpportunities: "ТОП-1 возможность",
    marketIntel: "Обзор рынка",
    price: "Цена",
    profit: "Прибыль",
  },
};

const colorMap: Record<string, string> = {
  red: "bg-red-100 text-red-700 border-red-200",
  green: "bg-green-100 text-green-700 border-green-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
};

interface DailyReportSectionProps {
  locale: string;
}

export function DailyReportSection({ locale }: DailyReportSectionProps) {
  const l = LABELS[locale] || LABELS.zh;
  const data = getLocalizedData(locale);
  const reportUrl = `/${locale}/arbitrage-top`;
  const intelUrl = `/${locale}/intelligence`;

  const [activeIntel, setActiveIntel] = useState(0);
  const [liveIntel, setLiveIntel] = useState<{ icon: string; text: string }[] | null>(null);
  const fallbackRef = useRef(data.marketIntel.map((m) => ({ icon: m.icon, text: m.text })));

  // 从 API 拉取市场情报前3条（与情报主页同源）
  useEffect(() => {
    fetch(`/api/intelligence?locale=${locale}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.length > 0) {
          const top3 = d.data.slice(0, 3).map((item: any) => ({
            icon: item.icon,
            text: item.text,
          }));
          setLiveIntel(top3);
        }
      })
      .catch(() => setLiveIntel(null));
  }, [locale]);

  const intelItems = liveIntel ?? fallbackRef.current;

  const nextIntel = useCallback(() => {
    setActiveIntel((prev) => (prev + 1) % intelItems.length);
  }, [intelItems.length]);

  // Auto-rotate market intel every 4 seconds
  useEffect(() => {
    if (intelItems.length <= 1) return;
    const timer = setInterval(nextIntel, 4000);
    return () => clearInterval(timer);
  }, [nextIntel, intelItems.length]);

  const formatPrice = (price: number) => {
    return `¥${Math.round(price / 10000)}万`;
  };

  return (
    <section className="bg-gradient-to-br from-accent-50 via-white to-primary-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{l.title}</h2>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Calendar className="h-3.5 w-3.5" />
                <span>{data.date}</span>
                <span className="mx-1">·</span>
                <span>{data.totalProducts}台设备</span>
                <span className="mx-1">·</span>
              </div>
            </div>
          </div>
          <Link
            href={reportUrl}
            className="hidden items-center gap-1 text-sm font-medium text-accent-600 hover:text-accent-700 sm:flex"
          >
            {l.viewReport}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Highlights */}
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {data.highlights.map((h) => (
            <div
              key={h.label}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${colorMap[h.color] || colorMap.blue}`}
            >
              <span className="text-base">{h.emoji}</span>
              <div>
                <div className="opacity-70">{h.label}</div>
                <div className="font-bold">{h.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* TOP1 套利机会 */}
          <div className="lg:col-span-2 rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <TrendingUp className="h-4 w-4 text-accent-600" />
              {l.topOpportunities}
            </h3>
            <div className="space-y-2">
              {data.topArbitrage.slice(0, 1).map((item) => (
                <Link
                  key={item.rank}
                  href={`/${locale}/products/${item.productId}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:border-accent-200 hover:bg-accent-50/50"
                >
                  {/* 排名 */}
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    item.rank <= 3 ? "bg-accent-600" : "bg-gray-400"
                  }`}>
                    {item.rank}
                  </div>
                  {/* 产品 */}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{item.product}</div>
                    <div className="text-xs text-gray-500">{l.price}: {formatPrice(item.price)}</div>
                  </div>
                  {/* 利润 */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-bold text-green-600">¥{item.profit}</div>
                    <div className="text-xs text-green-500">{item.margin}</div>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 flex-shrink-0 text-gray-300 sm:block" />
                </Link>
              ))}
            </div>
          </div>

          {/* 市场情报 - 自动滚动 */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Globe className="h-4 w-4 text-blue-600" />
              {l.marketIntel}
            </h3>
            <div className="relative overflow-hidden rounded-lg bg-gray-50" style={{ minHeight: "80px" }}>
              {intelItems.map((item, idx) => (
                <Link
                  key={idx}
                  href={intelUrl}
                  className={`flex items-start gap-2 rounded-lg p-3 transition-all duration-500 ease-in-out absolute inset-0 ${
                    idx === activeIntel
                      ? "opacity-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 translate-y-4 pointer-events-none"
                  }`}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.text}</p>
                </Link>
              ))}
            </div>
            {/* 指示器 */}
            {intelItems.length > 1 && (
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-1">
                  {intelItems.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveIntel(idx)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === activeIntel ? "w-4 bg-blue-600" : "w-1.5 bg-gray-300 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
                <Link
                  href={intelUrl}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  {locale === "zh" ? "查看全部" : locale === "ru" ? "Все" : "View all"}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
