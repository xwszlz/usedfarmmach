"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { TrendingUp, ArrowRight, Globe, Newspaper } from "lucide-react";
import { getLocalizedData } from "@/config/daily-report-home";

const LABELS: Record<string, {
  title: string;
  subtitle: string;
  topOpportunities: string;
  marketIntel: string;
  industryNews: string;
  price: string;
  profit: string;
  margin: string;
  viewDetail: string;
  viewAll: string;
}> = {
  zh: {
    title: "跨境套利日报",
    subtitle: "每日捕捉全球农机价差机会",
    topOpportunities: "今日TOP1 套利机会",
    marketIntel: "市场情报速递",
    industryNews: "行业资讯",
    price: "报价",
    profit: "毛利",
    margin: "毛利率",
    viewDetail: "查看详情",
    viewAll: "查看全部",
  },
  en: {
    title: "Cross-Border Arbitrage Daily",
    subtitle: "Daily global machinery price gap opportunities",
    topOpportunities: "Today's TOP1 Opportunity",
    marketIntel: "Global Market Intel",
    industryNews: "Industry News",
    price: "Price",
    profit: "Profit",
    margin: "Margin",
    viewDetail: "View Details",
    viewAll: "View all",
  },
  ru: {
    title: "Ежедневный арбитраж",
    subtitle: "Ежедневные возможности ценового арбитража",
    topOpportunities: "ТОП-1 возможность",
    marketIntel: "Обзор рынка",
    industryNews: "Новости отрасли",
    price: "Цена",
    profit: "Прибыль",
    margin: "Маржа",
    viewDetail: "Подробнее",
    viewAll: "Все",
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

interface ArticleItem {
  slug: string;
  title: string;
  date: string;
  category: string;
}

export function DailyReportSection({ locale }: DailyReportSectionProps) {
  const l = LABELS[locale] || LABELS.zh;
  const data = getLocalizedData(locale);
  const intelUrl = `/${locale}/intelligence`;
  const blogUrl = `/${locale}/blog`;

  const [activeIntel, setActiveIntel] = useState(0);
  const [liveIntel, setLiveIntel] = useState<{ icon: string; text: string }[] | null>(null);
  const fallbackRef = useRef(data.marketIntel.map((m) => ({ icon: m.icon, text: m.text })));

  // 从 API 拉取市场情报前3条
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

  // 行业资讯 - 从 API 拉取最新4篇文章
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  useEffect(() => {
    fetch(`/api/articles?status=published&limit=4`)
      .then((r) => r.json())
      .then((d) => {
        const items = d.articles || [];
        if (items.length > 0) {
          setArticles(items.slice(0, 4).map((a: any) => ({
            slug: a.slug,
            title: locale === "zh"
              ? a.titleZh
              : locale === "ru"
                ? (a.titleRu || a.titleZh)
                : (a.titleEn || a.titleZh),
            date: a.publishedAt
              ? new Date(a.publishedAt).toLocaleDateString(
                  locale === "zh" ? "zh-CN" : locale === "ru" ? "ru-RU" : "en-US",
                  { month: "short", day: "numeric" }
                )
              : "",
            category: a.category || "",
          })));
        }
      })
      .catch(() => {});
  }, [locale]);

  const formatPrice = (price: number) => {
    return `\u00a5${Math.round(price / 10000)}\u4e07`;
  };

  return (
    <section className="bg-gradient-to-br from-accent-50 via-white to-primary-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{l.title}</h2>
          <p className="mt-2 text-sm text-gray-500">{l.subtitle}</p>
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

        {/* 三栏布局：TOP1套利 | 市场情报 | 行业资讯 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* 左栏：TOP1 套利机会 */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <TrendingUp className="h-4 w-4 text-accent-600" />
              {l.topOpportunities}
            </h3>
            {data.topArbitrage.slice(0, 1).map((item) => (
              <Link
                key={item.rank}
                href={`/${locale}/products/${item.productId}`}
                className="block rounded-lg border border-gray-100 p-4 transition-colors hover:border-accent-200 hover:bg-accent-50/50"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-600 text-xs font-bold text-white">
                    {item.rank + 1}
                  </span>
                  <span className="text-xs font-medium text-accent-600">TOP {item.rank + 1}</span>
                </div>
                <div className="mb-3 text-sm font-medium text-gray-900">{item.product}</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{l.price}</span>
                    <span className="font-semibold text-gray-900">{formatPrice(item.price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{l.profit}</span>
                    <span className="font-semibold text-green-600">{"\u00a5"}{item.profit}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{l.margin}</span>
                    <span className="font-semibold text-red-600">{item.margin}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-accent-600 hover:text-accent-700">
                  {l.viewDetail}
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>

          {/* 中栏：市场情报 - 自动滚动 */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Globe className="h-4 w-4 text-blue-600" />
              {l.marketIntel}
            </h3>
            <div className="relative overflow-hidden rounded-lg bg-gray-50" style={{ minHeight: "120px" }}>
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
                  {l.viewAll}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

          {/* 右栏：行业资讯 */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Newspaper className="h-4 w-4 text-green-600" />
              {l.industryNews}
            </h3>
            <div className="space-y-3">
              {articles.length > 0 ? (
                articles.map((article, idx) => (
                  <Link
                    key={idx}
                    href={`/${locale}/blog/${article.slug}`}
                    className="block group"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{article.date}</span>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 leading-relaxed group-hover:text-green-600 line-clamp-2">
                          {article.title}
                        </p>
                        {article.category && (
                          <span className="mt-1 inline-block rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-600">
                            {article.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-gray-400">
                  {locale === "zh" ? "\u6682\u65e0\u6587\u7ae0" : locale === "ru" ? "\u041d\u0435\u0442 \u0441\u0442\u0430\u0442\u0435\u0439" : "No articles"}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-end">
              <Link
                href={blogUrl}
                className="text-xs font-medium text-green-600 hover:text-green-700 flex items-center gap-0.5"
              >
                {l.viewAll}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
