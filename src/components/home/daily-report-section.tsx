"use client";

import { useState, useEffect } from "react";
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
    topOpportunities: "今日TOP3 套利机会",
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
    topOpportunities: "Today's TOP3 Opportunities",
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
    topOpportunities: "ТОП-3 возможности",
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

// 行业资讯 - 全部动态拉取最新3篇（固定文章在博客页面通过 isPinned 置顶）

export function DailyReportSection({ locale }: DailyReportSectionProps) {
  const l = LABELS[locale] || LABELS.zh;
  const data = getLocalizedData(locale);
  const intelUrl = `/${locale}/intelligence`;
  const blogUrl = `/${locale}/blog`;

  const [liveIntel, setLiveIntel] = useState<{ icon: string; text: string }[] | null>(null);

  // 从 API 动态拉取 TOP3 套利机会（productId 来自数据库，产品删除后自动消失）
  const [liveTop3, setLiveTop3] = useState<{
    product: string;
    price: number;
    profit: string;
    margin: string;
    productId: string;
  }[] | null>(null);

  useEffect(() => {
    fetch(`/api/arbitrage/top-products?limit=3`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.products?.length > 0) {
          const mapped = d.data.products.map((item: any) => ({
            product: `${item.brandName} ${item.productName}（${item.year}款）`,
            price: item.domesticPrice,
            profit: `${Math.round(item.estimatedProfit / 10000)}万`,
            margin: `${Number(item.priceDiffPercent).toFixed(1)}%`,
            productId: item.productId,
          }));
          setLiveTop3(mapped);
        }
      })
      .catch(() => setLiveTop3(null));
  }, []);

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

  const intelItems = liveIntel ?? data.marketIntel.map((m) => ({ icon: m.icon, text: m.text }));

  // 行业资讯 - 全部动态拉取最新3篇
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  useEffect(() => {
    fetch(`/api/articles?status=published&limit=3&sort=latest`)
      .then((r) => r.json())
      .then((d) => {
        const allArticles = d.articles || [];
        setArticles(allArticles.slice(0, 3).map((a: any) => ({
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
      })
      .catch(() => setArticles([]));
  }, [locale]);

  const formatPrice = (price: number) => {
    return `\u00a5${Math.round(price / 10000)}\u4e07`;
  };

  const top3 = liveTop3 ?? data.topArbitrage.slice(0, 3);

  return (
    <section className="bg-gradient-to-br from-amber-50/30 via-white to-blue-50/30 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{l.title}</h2>
          <p className="mt-3 text-base text-gray-500">{l.subtitle}</p>
        </div>

        {/* Highlights */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.highlights.map((h) => (
            <div
              key={h.label}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${colorMap[h.color] || colorMap.blue}`}
            >
              <span className="text-lg">{h.emoji}</span>
              <div>
                <div className="text-xs opacity-70">{h.label}</div>
                <div className="text-base font-bold">{h.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 三栏布局：TOP3套利 | 市场情报 | 行业资讯 — 行对齐 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ============ 左栏：TOP3 套利机会（三个等高卡片）============ */}
          <div className="flex flex-col rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-700">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              {l.topOpportunities}
            </h3>
            <div className="grid flex-1 grid-rows-3 gap-3">
              {top3.map((item, idx) => (
                <Link
                  key={idx}
                  href={`/${locale}/products/${item.productId}`}
                  className="flex flex-col overflow-hidden rounded-lg border border-amber-300 bg-white p-3.5 transition-colors hover:border-amber-400 hover:bg-amber-50/50"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-amber-600">TOP {idx + 1}</span>
                  </div>
                  <div className="mb-2 text-sm font-semibold text-gray-900 line-clamp-1">{item.product}</div>
                  <div className="flex items-center gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">{l.price}</span>
                      <span className="ml-1 font-bold text-gray-900">{formatPrice(item.price)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">{l.profit}</span>
                      <span className="ml-1 font-bold text-green-600">{"\u00a5"}{item.profit}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">{l.margin}</span>
                      <span className="ml-1 font-bold text-red-600">{item.margin}</span>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-end gap-1 pt-2 text-xs font-medium text-amber-600">
                    {l.viewDetail}
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-end">
              <Link
                href={`/${locale}/arbitrage-top`}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
              >
                {l.viewAll}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* ============ 中栏：市场情报速递 3条 ============ */}
          <div className="flex flex-col rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-700">
              <Globe className="h-5 w-5 text-blue-600" />
              {l.marketIntel}
            </h3>
            <div className="grid flex-1 grid-rows-3 gap-3">
              {intelItems.slice(0, 3).map((item, idx) => (
                <Link
                  key={idx}
                  href={intelUrl}
                  className="flex items-start gap-3 overflow-hidden rounded-lg border border-blue-100 bg-white p-3.5 transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{item.text}</p>
                </Link>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-end">
              <Link
                href={intelUrl}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
              >
                {l.viewAll}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* ============ 右栏：行业资讯 3条 ============ */}
          <div className="flex flex-col rounded-xl border border-green-200 bg-green-50/40 p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-700">
              <Newspaper className="h-5 w-5 text-green-600" />
              {l.industryNews}
            </h3>
            <div className="grid flex-1 grid-rows-3 gap-3">
              {articles.length > 0 ? (
                articles.slice(0, 3).map((article, idx) => (
                  <Link
                    key={idx}
                    href={`/${locale}/blog/${article.slug}`}
                    className="group block overflow-hidden rounded-lg border border-green-100 bg-white p-3.5 transition-colors hover:border-green-200 hover:bg-green-50/50"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">{article.date}</span>
                      {article.category && (
                        <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] text-green-600 flex-shrink-0">
                          {article.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-snug line-clamp-2 group-hover:text-green-600">
                      {article.title}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-green-100 bg-white/50">
                  <span className="text-sm text-gray-400">
                    {locale === "zh" ? "\u6682\u65e0\u6587\u7ae0" : locale === "ru" ? "\u041d\u0435\u0442 \u0441\u0442\u0430\u0442\u0435\u0439" : "No articles"}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-end">
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
