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

// 行业资讯 - 前两篇固定（buying-guide），第三篇动态拉取最新
const PINNED_ARTICLES = [
  {
    slug: "claas970-eu-2017-spotlight",
    titleZh: "¥163万入手CLAAS Jaguar 970（2017）：比国际市场省¥174万的跨境王牌",
    titleEn: "¥1.63M CLAAS Jaguar 970 (2017): Save ¥1.74M vs Global Market",
    titleRu: "¥1,63M CLAAS Jaguar 970 (2017): сэкономьте ¥1,74M",
    publishedAt: "2026-06-11",
    category: "buying-guide",
  },
  {
    slug: "orkel-densx-2019-spotlight",
    titleZh: "¥105万入手Orkel DENS-X（2019）：挪威顶级裹包机，青贮赛道独家王牌",
    titleEn: "¥1.05M Orkel DENS-X (2019): Norway's Top Baler, Silage Ace",
    titleRu: "¥1,05M Orkel DENS-X (2019): Норвежский пресс-подборщик",
    publishedAt: "2026-06-11",
    category: "buying-guide",
  },
];
const PINNED_SLUGS = PINNED_ARTICLES.map((a) => a.slug);

export function DailyReportSection({ locale }: DailyReportSectionProps) {
  const l = LABELS[locale] || LABELS.zh;
  const data = getLocalizedData(locale);
  const intelUrl = `/${locale}/intelligence`;
  const blogUrl = `/${locale}/blog`;

  const [liveIntel, setLiveIntel] = useState<{ icon: string; text: string }[] | null>(null);

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

  // 行业资讯 - 前两篇固定，第三篇动态拉取
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  useEffect(() => {
    // 第3篇动态拉取 - 最新一篇 industry-news 文章（排除固定的两篇）
    fetch(`/api/articles?status=published&category=industry-news&limit=10`)
      .then((r) => r.json())
      .then((d) => {
        const allArticles = d.articles || [];
        const pinned = PINNED_ARTICLES.map((a) => ({
          slug: a.slug,
          title: locale === "zh"
            ? a.titleZh
            : locale === "ru"
              ? (a.titleRu || a.titleZh)
              : (a.titleEn || a.titleZh),
          date: new Date(a.publishedAt).toLocaleDateString(
            locale === "zh" ? "zh-CN" : locale === "ru" ? "ru-RU" : "en-US",
            { month: "short", day: "numeric" }
          ),
          category: a.category,
        }));
        const dynamic = allArticles
          .filter((a: any) => !PINNED_SLUGS.includes(a.slug))
          .slice(0, 1)
          .map((a: any) => ({
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
          }));
        setArticles([...pinned, ...dynamic]);
      })
      .catch(() => {
        setArticles(PINNED_ARTICLES.map((a) => ({
          slug: a.slug,
          title: locale === "zh"
            ? a.titleZh
            : locale === "ru"
              ? (a.titleRu || a.titleZh)
              : (a.titleEn || a.titleZh),
          date: new Date(a.publishedAt).toLocaleDateString(
            locale === "zh" ? "zh-CN" : locale === "ru" ? "ru-RU" : "en-US",
            { month: "short", day: "numeric" }
          ),
          category: a.category,
        })));
      });
  }, [locale]);

  const formatPrice = (price: number) => {
    return `\u00a5${Math.round(price / 10000)}\u4e07`;
  };

  const top3 = data.topArbitrage.slice(0, 3);

  return (
    <section className="bg-gradient-to-br from-amber-50/30 via-white to-blue-50/30 py-12">
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

        {/* 三栏布局：TOP1套利 | 市场情报 | 行业资讯 — 行对齐 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ============ 左栏：TOP1大卡片 + TOP2/TOP3紧凑行 ============ */}
          <div className="flex flex-col rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              {l.topOpportunities}
            </h3>
            <div className="grid flex-1 grid-rows-3 gap-2">
              {/* Row 1: TOP1 大卡片 */}
              {top3[0] && (
                <Link
                  href={`/${locale}/products/${top3[0].productId}`}
                  className="block overflow-hidden rounded-lg border border-amber-300 bg-white p-3 transition-colors hover:border-amber-400 hover:bg-amber-50/50"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                      1
                    </span>
                    <span className="text-[10px] font-semibold text-amber-600">TOP 1</span>
                  </div>
                  <div className="mb-2 text-xs font-semibold text-gray-900 line-clamp-1">{top3[0].product}</div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <div>
                      <span className="text-gray-400">{l.price}</span>
                      <span className="ml-1 font-bold text-gray-900">{formatPrice(top3[0].price)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">{l.profit}</span>
                      <span className="ml-1 font-bold text-green-600">{"\u00a5"}{top3[0].profit}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">{l.margin}</span>
                      <span className="ml-1 font-bold text-red-600">{top3[0].margin}</span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-end gap-0.5 text-[10px] font-medium text-amber-600">
                    {l.viewDetail}
                    <ArrowRight className="h-2.5 w-2.5" />
                  </div>
                </Link>
              )}
              {/* Row 2: TOP2 紧凑行 */}
              {top3[1] && (
                <Link
                  href={`/${locale}/products/${top3[1].productId}`}
                  className="flex items-center gap-2 overflow-hidden rounded-lg border border-amber-100 bg-white/70 px-3 py-2 transition-colors hover:border-amber-200 hover:bg-amber-50/50"
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-800">
                    2
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{top3[1].product}</span>
                  <span className="flex-shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    {top3[1].margin}
                  </span>
                </Link>
              )}
              {/* Row 3: TOP3 紧凑行 */}
              {top3[2] && (
                <Link
                  href={`/${locale}/products/${top3[2].productId}`}
                  className="flex items-center gap-2 overflow-hidden rounded-lg border border-amber-100 bg-white/70 px-3 py-2 transition-colors hover:border-amber-200 hover:bg-amber-50/50"
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-800">
                    3
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{top3[2].product}</span>
                  <span className="flex-shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    {top3[2].margin}
                  </span>
                </Link>
              )}
            </div>
            <div className="mt-2 flex items-center justify-end">
              <Link
                href={`/${locale}/products?sort=rank`}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
              >
                {l.viewAll}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* ============ 中栏：市场情报速递 3条 ============ */}
          <div className="flex flex-col rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Globe className="h-4 w-4 text-blue-600" />
              {l.marketIntel}
            </h3>
            <div className="grid flex-1 grid-rows-3 gap-2">
              {intelItems.slice(0, 3).map((item, idx) => (
                <Link
                  key={idx}
                  href={intelUrl}
                  className="flex items-start gap-2 overflow-hidden rounded-lg border border-blue-100 bg-white p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                >
                  <span className="text-base flex-shrink-0 mt-0.5">{item.icon}</span>
                  <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3">{item.text}</p>
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
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Newspaper className="h-4 w-4 text-green-600" />
              {l.industryNews}
            </h3>
            <div className="grid flex-1 grid-rows-3 gap-2">
              {articles.length > 0 ? (
                articles.slice(0, 3).map((article, idx) => (
                  <Link
                    key={idx}
                    href={`/${locale}/blog/${article.slug}`}
                    className="group block overflow-hidden rounded-lg border border-green-100 bg-white p-3 transition-colors hover:border-green-200 hover:bg-green-50/50"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{article.date}</span>
                      {article.category && (
                        <span className="rounded bg-green-50 px-1.5 py-0.5 text-[9px] text-green-600 flex-shrink-0">
                          {article.category}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-700 leading-snug line-clamp-2 group-hover:text-green-600">
                      {article.title}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-green-100 bg-white/50">
                  <span className="text-xs text-gray-400">
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
