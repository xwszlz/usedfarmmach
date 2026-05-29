"use client";

import Link from "next/link";
import { TrendingUp, ArrowRight, Calendar, BarChart3, Globe } from "lucide-react";
import { DAILY_REPORT_CONFIG } from "@/config/daily-report-home";

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
    topOpportunities: "今日TOP5 套利机会",
    marketIntel: "全球市场情报",
    price: "报价",
    profit: "毛利",
  },
  en: {
    title: "Cross-Border Arbitrage Daily",
    viewReport: "View Full Report",
    topOpportunities: "Today's TOP5 Opportunities",
    marketIntel: "Global Market Intel",
    price: "Price",
    profit: "Profit",
  },
  ru: {
    title: "Ежедневный арбитраж",
    viewReport: "Полный отчёт",
    topOpportunities: "ТОП-5 возможностей",
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
  const data = DAILY_REPORT_CONFIG;
  const reportUrl = `/${locale}/arbitrage-top`;

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
                <span>货值{data.totalValue}</span>
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
          {/* TOP5 套利机会 */}
          <div className="lg:col-span-2 rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <TrendingUp className="h-4 w-4 text-accent-600" />
              {l.topOpportunities}
            </h3>
            <div className="space-y-2">
              {data.topArbitrage.map((item) => (
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

          {/* 市场情报 */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Globe className="h-4 w-4 text-blue-600" />
              {l.marketIntel}
            </h3>
            <div className="space-y-3">
              {data.marketIntel.map((item, idx) => (
                <Link key={idx} href={item.url} target={`_self`} className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-blue-50 hover:border hover:border-blue-100">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.text}</p>
                </Link>
              ))}
            </div>
            <Link
              href={reportUrl}
              className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-accent-200 bg-accent-50 py-2 text-sm font-medium text-accent-600 hover:bg-accent-100 sm:hidden"
            >
              {l.viewReport}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
