"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, ArrowRight, Globe, Newspaper, BarChart3 } from "lucide-react";
import { getLocalizedData } from "@/config/daily-report-home";
import { useTr } from "@/lib/i18n-tr";
function getLABELS(tr: (s: string) => string): Record<string, {
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
    dataSituationTitle: string;
    dataSituationSubtitle: string;
    viewDetailFull: string;
    benchmarkIndex: string;
    domesticPending: string;
    statBenchmark: string;
    statArbitrage: string;
    statDomestic: string;
    statSample: string;
}> {
  return {
    zh: {
        title: tr("跨境套利日报"),
        subtitle: "\u6BCF\u65E5\u6355\u6349\u5168\u7403\u519C\u673A\u4EF7\u5DEE\u673A\u4F1A",
        topOpportunities: "\u4ECA\u65E5TOP3 \u5957\u5229\u673A\u4F1A",
        marketIntel: "\u5E02\u573A\u60C5\u62A5\u901F\u9012",
        industryNews: "\u884C\u4E1A\u8D44\u8BAF",
        price: "\u62A5\u4EF7",
        profit: "\u6BDB\u5229",
        margin: "\u6BDB\u5229\u7387",
        viewDetail: "\u67E5\u770B\u8BE6\u60C5",
        viewAll: "\u67E5\u770B\u5168\u90E8",
        dataSituationTitle: "\u6BCF\u65E5\u6570\u636E\u6001\u52BF",
        dataSituationSubtitle: "\u5168\u7403\u57FA\u51C6\u4EF7\u6307\u6570 \u00B7 \u8DE8\u5883\u5957\u5229\u5339\u914D \u00B7 \u56FD\u5185\u5356\u65B9\u91C7\u96C6",
        viewDetailFull: "\u67E5\u770B\u5B8C\u6574\u770B\u677F",
        benchmarkIndex: "\u5168\u7403\u57FA\u51C6\u4EF7\u6307\u6570\uFF08\u6837\u672C\uFF09",
        domesticPending: "\u56FD\u5185\u5356\u65B9\u91C7\u96C6\uFF1A\u91C7\u96C6\u4EFB\u52A1\u90E8\u7F72\u4E2D\uFF0C\u6570\u636E\u5F85 ECS \u8DD1\u901A\u540E\u81EA\u52A8\u5165\u5E93",
        statBenchmark: "\u57FA\u51C6\u4EF7\u6307\u6570",
        statArbitrage: "\u8DE8\u5883\u5957\u5229\u5339\u914D",
        statDomestic: "\u56FD\u5185\u91C7\u96C6\u6302\u724C",
        statSample: "\u6709\u6548\u6837\u672C\u91CF",
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
        dataSituationTitle: "Daily Data Snapshot",
        dataSituationSubtitle: "Global benchmark \u00B7 Cross-border arbitrage \u00B7 Domestic listings",
        viewDetailFull: "View full dashboard",
        benchmarkIndex: "Global Benchmark Index (sample)",
        domesticPending: "Domestic seller scraping: deployment pending, data auto-ingests after ECS run",
        statBenchmark: "Benchmark",
        statArbitrage: "Arbitrage Matches",
        statDomestic: "Domestic Listings",
        statSample: "Valid Samples",
    },
    ru: {
        title: "\u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436",
        subtitle: "\u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0435 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u0446\u0435\u043D\u043E\u0432\u043E\u0433\u043E \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436\u0430",
        topOpportunities: "\u0422\u041E\u041F-3 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438",
        marketIntel: "\u041E\u0431\u0437\u043E\u0440 \u0440\u044B\u043D\u043A\u0430",
        industryNews: "\u041D\u043E\u0432\u043E\u0441\u0442\u0438 \u043E\u0442\u0440\u0430\u0441\u043B\u0438",
        price: "\u0426\u0435\u043D\u0430",
        profit: "\u041F\u0440\u0438\u0431\u044B\u043B\u044C",
        margin: "\u041C\u0430\u0440\u0436\u0430",
        viewDetail: "\u041F\u043E\u0434\u0440\u043E\u0431\u043D\u0435\u0435",
        viewAll: "\u0412\u0441\u0435",
        dataSituationTitle: "\u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u0441\u043D\u0438\u043C\u043E\u043A \u0434\u0430\u043D\u043D\u044B\u0445",
        dataSituationSubtitle: "\u041C\u0438\u0440\u043E\u0432\u043E\u0439 \u0431\u0435\u043D\u0447\u043C\u0430\u0440\u043A \u00B7 \u0410\u0440\u0431\u0438\u0442\u0440\u0430\u0436 \u00B7 \u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F",
        viewDetailFull: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u0430\u0448\u0431\u043E\u0440\u0434",
        benchmarkIndex: "\u041C\u0438\u0440\u043E\u0432\u043E\u0439 \u0431\u0435\u043D\u0447\u043C\u0430\u0440\u043A (\u0432\u044B\u0431\u043E\u0440\u043A\u0430)",
        domesticPending: "\u0421\u0431\u043E\u0440 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u0439: \u0440\u0430\u0437\u0432\u0435\u0440\u0442\u044B\u0432\u0430\u043D\u0438\u0435, \u0434\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430 ECS",
        statBenchmark: "\u0411\u0435\u043D\u0447\u043C\u0430\u0440\u043A",
        statArbitrage: "\u0410\u0440\u0431\u0438\u0442\u0440\u0430\u0436",
        statDomestic: "\u0412\u043D\u0443\u0442\u0440. \u043E\u0431\u044A\u044F\u0432\u043B.",
        statSample: "\u0412\u044B\u0431\u043E\u0440\u043A\u0430",
    },
};
}
const colorMap: Record<string, string> = {
    red: "bg-red-100 text-red-700 border-red-200",
    green: "bg-green-100 text-green-700 border-green-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    orange: "bg-orange-100 text-orange-700 border-orange-200",
};
interface DailyReportSectionProps {
    locale: string;
    initialArticles?: {
        slug: string;
        titleZh: string;
        titleEn: string | null;
        titleRu: string | null;
        category: string | null;
        publishedAt: Date | null;
    }[];
}
interface ArticleItem {
    slug: string;
    title: string;
    date: string;
    category: string;
}
// 数据态势迷你统计卡（首页新增区块内用）
function StatCard({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="flex flex-col rounded-lg border border-indigo-100 bg-white px-4 py-3">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-lg font-bold text-indigo-700">{value}</span>
    </div>);
}
// 行业资讯 - 全部动态拉取最新3篇（固定文章在博客页面通过 isPinned 置顶）
export function DailyReportSection({ locale, initialArticles = [] }: DailyReportSectionProps) {
  const tr = useTr();
        const l = getLABELS(tr)[locale] || getLABELS(tr).zh;
    const data = getLocalizedData(locale);
    const intelUrl = `/${locale}/intelligence`;
    const blogUrl = `/${locale}/blog`;
    const [liveIntel, setLiveIntel] = useState<{
        icon: string;
        text: string;
    }[] | null>(null);
    // 从 API 动态拉取 TOP3 套利机会
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
                    profit: `${(item.estimatedProfit / 10000).toFixed(1)}万`,
                    margin: `${((item.estimatedProfit / item.domesticPrice) * 100).toFixed(1)}%`,
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
    // 新增：从日报总览 API 读取「数据态势」板块（基准价/套利/国内采集）；失败或关闭则不渲染
    const [benchmarkSection, setBenchmarkSection] = useState<{
        available: boolean;
        enabled: boolean;
        summary?: {
            benchmarkCount: number;
            arbitrageCount: number;
            domesticCount: number;
            sampleTotal: number;
            freshCount: number;
        };
        benchmark?: Array<{
            id: string;
            brand: string;
            brandNameZh?: string | null;
            model: string;
            priceCny?: number | null;
        }>;
    } | null>(null);
    useEffect(() => {
        fetch(`/api/daily-reports`)
            .then((r) => r.json())
            .then((d) => {
            if (d.benchmark && d.benchmark.enabled) {
                setBenchmarkSection(d.benchmark);
            }
        })
            .catch(() => setBenchmarkSection(null));
    }, []);
    // 行业资讯 - 优先用 SSR 传入的 initialArticles，然后客户端 fetch 覆盖更新
    const buildArticleItems = (rawList: any[]) => rawList.slice(0, 3).map((a: any) => ({
        slug: a.slug,
        title: locale === "zh"
            ? a.titleZh
            : locale === "ru"
                ? (a.titleRu || a.titleZh)
                : (a.titleEn || a.titleZh),
        date: a.publishedAt
            ? new Date(a.publishedAt).toLocaleDateString(locale === "zh" ? "zh-CN" : locale === "ru" ? "ru-RU" : "en-US", { month: "short", day: "numeric" })
            : "",
        category: a.category || "",
    }));
    const [articles, setArticles] = useState<ArticleItem[]>(buildArticleItems(initialArticles));
    useEffect(() => {
        fetch(`/api/articles?status=published&limit=3&sort=latest`)
            .then((r) => r.json())
            .then((d) => {
            const allArticles = d.articles || [];
            if (allArticles.length > 0) {
                setArticles(buildArticleItems(allArticles));
            }
        })
            .catch(() => {
            // SSR 数据已存在，失败时保持已有数据，不降级到空数组
        });
    }, [locale]);
    const formatPrice = (price: number) => {
        return `\u00a5${Math.round(price / 10000)}\u4e07`;
    };
    const top3 = liveTop3 ?? data.topArbitrage.slice(0, 3);
    return (<section className="bg-gradient-to-br from-amber-50/30 via-white to-blue-50/30 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{l.title}</h2>
          <p className="mt-3 text-base text-gray-500">{l.subtitle}</p>
        </div>

        {/* Highlights */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.highlights.map((h) => (<div key={h.label} className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${colorMap[h.color] || colorMap.blue}`}>
              <span className="text-lg">{h.emoji}</span>
              <div>
                <div className="text-xs opacity-70">{h.label}</div>
                <div className="text-base font-bold">{h.value}</div>
              </div>
            </div>))}
        </div>

        {/* 三栏布局：TOP3套利 | 市场情报 | 行业资讯 — 行对齐 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ============ 左栏：TOP3 套利机会（三个等高卡片）============ */}
          <div className="flex flex-col rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-700">
              <TrendingUp className="h-5 w-5 text-amber-600"/>
              {l.topOpportunities}
            </h3>
            <div className="grid flex-1 grid-rows-3 gap-3">
              {top3.map((item, idx) => (<Link key={idx} href={`/${locale}/products/${item.productId}`} className="flex flex-col overflow-hidden rounded-lg border border-amber-300 bg-white p-3.5 transition-colors hover:border-amber-400 hover:bg-amber-50/50">
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
                      <span className="ml-1 font-bold text-green-600">{"\u00A5"}{item.profit}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">{l.margin}</span>
                      <span className="ml-1 font-bold text-red-600">{item.margin}</span>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-end gap-1 pt-2 text-xs font-medium text-amber-600">
                    {l.viewDetail}
                    <ArrowRight className="h-3 w-3"/>
                  </div>
                </Link>))}
            </div>
            <div className="mt-2 flex items-center justify-end">
              <Link href={`/${locale}/arbitrage-top`} className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-0.5">
                {l.viewAll}
                <ArrowRight className="h-3 w-3"/>
              </Link>
            </div>
          </div>

          {/* ============ 中栏：市场情报速递 3条 ============ */}
          <div className="flex flex-col rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-700">
              <Globe className="h-5 w-5 text-blue-600"/>
              {l.marketIntel}
            </h3>
            <div className="grid flex-1 grid-rows-3 gap-3">
              {intelItems.slice(0, 3).map((item, idx) => (<Link key={idx} href={intelUrl} className="flex items-start gap-3 overflow-hidden rounded-lg border border-blue-100 bg-white p-3.5 transition-colors hover:border-blue-200 hover:bg-blue-50/50">
                  <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{item.text}</p>
                </Link>))}
            </div>
            <div className="mt-2 flex items-center justify-end">
              <Link href={intelUrl} className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                {l.viewAll}
                <ArrowRight className="h-3 w-3"/>
              </Link>
            </div>
          </div>

          {/* ============ 右栏：行业资讯 3条 ============ */}
          <div className="flex flex-col rounded-xl border border-green-200 bg-green-50/40 p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-700">
              <Newspaper className="h-5 w-5 text-green-600"/>
              {l.industryNews}
            </h3>
            <div className="grid flex-1 grid-rows-3 gap-3">
              {articles.length > 0 ? (articles.slice(0, 3).map((article, idx) => (<Link key={idx} href={`/${locale}/blog/${article.slug}`} className="group block overflow-hidden rounded-lg border border-green-100 bg-white p-3.5 transition-colors hover:border-green-200 hover:bg-green-50/50">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">{article.date}</span>
                      {article.category && (<span className="rounded bg-green-50 px-2 py-0.5 text-[10px] text-green-600 flex-shrink-0">
                          {article.category}
                        </span>)}
                    </div>
                    <p className="text-sm text-gray-700 leading-snug line-clamp-2 group-hover:text-green-600">
                      {article.title}
                    </p>
                  </Link>))) : (<div className="flex items-center justify-center rounded-lg border border-green-100 bg-white/50">
                  <span className="text-sm text-gray-400">
                    {locale === "zh" ? "\u6682\u65E0\u6587\u7AE0" : locale === "ru" ? "\u041D\u0435\u0442 \u0441\u0442\u0430\u0442\u0435\u0439" : "No articles"}
                  </span>
                </div>)}
            </div>
            <div className="mt-2 flex items-center justify-end">
              <Link href={blogUrl} className="text-xs font-medium text-green-600 hover:text-green-700 flex items-center gap-0.5">
                {l.viewAll}
                <ArrowRight className="h-3 w-3"/>
              </Link>
            </div>
          </div>
        </div>

        {/* ============ 新增区块：每日数据态势（纯追加，失败优雅降级为空）============ */}
        {benchmarkSection && benchmarkSection.available && (<div className="mt-10 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-indigo-600"/>
                <h3 className="text-xl font-bold text-gray-900">{l.dataSituationTitle}</h3>
              </div>
              <Link href={`/${locale}/benchmark`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5">
                {l.viewDetailFull}
                <ArrowRight className="h-3 w-3"/>
              </Link>
            </div>
            <p className="mb-5 text-sm text-gray-500">{l.dataSituationSubtitle}</p>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label={l.statBenchmark} value={String(benchmarkSection.summary?.benchmarkCount ?? 0)}/>
              <StatCard label={l.statArbitrage} value={String(benchmarkSection.summary?.arbitrageCount ?? 0)}/>
              <StatCard label={l.statDomestic} value={String(benchmarkSection.summary?.domesticCount ?? 0)}/>
              <StatCard label={l.statSample} value={String(benchmarkSection.summary?.sampleTotal ?? 0)}/>
            </div>

            <div className="overflow-hidden rounded-lg border border-indigo-100">
              <div className="bg-indigo-50/60 px-4 py-2 text-xs font-semibold text-indigo-700">
                {l.benchmarkIndex}
              </div>
              <ul className="divide-y divide-indigo-50">
                {(benchmarkSection.benchmark || []).slice(0, 5).map((b) => (<li key={b.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="truncate text-gray-700">{b.brandNameZh || b.brand} {b.model}</span>
                    <span className="ml-3 flex-shrink-0 font-semibold text-gray-900">
                      ¥{Math.round(b.priceCny || 0).toLocaleString()}
                    </span>
                  </li>))}
              </ul>
            </div>

            {benchmarkSection.summary?.domesticCount === 0 && (<p className="mt-3 text-xs text-gray-400">{l.domesticPending}</p>)}
          </div>)}
      </div>
    </section>);
}
