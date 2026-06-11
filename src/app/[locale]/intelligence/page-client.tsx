"use client";

import { useState, useEffect } from "react";
import {
  Globe, TrendingUp, BarChart3, Calendar, ChevronDown, ChevronUp,
  Lightbulb, Table, ArrowRight, X
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DAILY_REPORT_RANKING } from "@/config/daily-report-ranking";

interface MarketIntelItem {
  id: string;
  icon: string;
  region: string;
  tags: string[];
  text: string;
  url?: string;
  detailedContent?: string;
  dataSummary?: { label: string; value: string }[];
  actionTips?: string[];
  sortOrder: number;
}

interface IntelCardProps {
  item: MarketIntelItem;
  locale: string;
  actionTipsLabel: string;
}

function IntelCard({ item, locale, actionTipsLabel }: IntelCardProps) {
  const [expanded, setExpanded] = useState(false);

  // 将 [text](url) 格式转为可点击的 React 元素
  const renderTip = (tip: string) => {
    const parts = [];
    let remaining = tip;
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(tip)) !== null) {
      if (match.index > lastIndex) {
        parts.push(tip.slice(lastIndex, match.index));
      }
      parts.push(
        <a key={parts.length} href={match[2]} target="_blank" rel="noopener noreferrer"
           className="text-accent-600 hover:text-accent-800 underline">
          {match[1]}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < tip.length) {
      parts.push(tip.slice(lastIndex));
    }
    return parts.length > 0 ? parts : tip;
  };

  // 将Markdown表格转换为HTML
  const renderContent = (content: string) => {
    // Helper: render inline markdown (bold + links) as React elements
    const renderInlineMd = (text: string) => {
      const parts: React.ReactNode[] = [];
      let remaining = text;
      // Process [text](url) and **bold** — priority: links first, then bold
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)|(\*\*([^*]+)\*\*)/g;
      let match;
      let lastIdx = 0;
      while ((match = linkRegex.exec(remaining)) !== null) {
        if (match.index > lastIdx) {
          parts.push(remaining.slice(lastIdx, match.index));
        }
        if (match[1]) {
          // It's a link [text](url)
          parts.push(
            <a key={parts.length} href={match[2]} target="_blank" rel="noopener noreferrer"
               className="text-accent-600 hover:text-accent-800 underline">
              {match[1]}
            </a>
          );
        } else if (match[4]) {
          // It's **bold**
          parts.push(<strong key={parts.length} className="font-semibold text-gray-900">{match[4]}</strong>);
        }
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < remaining.length) {
        parts.push(remaining.slice(lastIdx));
      }
      return parts.length > 0 ? <>{parts}</> : text;
    };

    return content.split("\n").map((line, i) => {
      if (line.startsWith("## ")) {
        return <h3 key={i} className="mt-4 mb-2 text-base font-bold text-gray-800">{line.slice(3)}</h3>;
      }
      if (line.startsWith("### ")) {
        return <h4 key={i} className="mt-3 mb-1.5 text-sm font-semibold text-gray-700">{line.slice(4)}</h4>;
      }
      if (line.startsWith("|") && line.endsWith("|")) {
        // 表格行
        const cells = line.split("|").filter(c => c.trim());
        const isHeader = line.includes("---");
        return (
          <div key={i} className="flex text-xs">
            {cells.map((cell, ci) => (
              <span key={ci} className={`flex-1 px-2 py-1 ${isHeader ? "font-bold text-accent-700 bg-accent-50" : "text-gray-600 border-b border-gray-100"}`}>
                {renderInlineMd(cell.trim())}
              </span>
            ))}
          </div>
        );
      }
      if (line.startsWith("- ")) {
        return <li key={i} className="ml-4 text-xs text-gray-600 list-disc">{renderInlineMd(line.slice(2))}</li>;
      }
      if (line.match(/^\d+\.\s/)) {
        return <li key={i} className="ml-4 text-xs text-gray-600 list-decimal">{renderInlineMd(line.replace(/^\d+\.\s+/, ''))}</li>;
      }
      if (line.trim() === "") return <div key={i} className="h-1" />;
      return <p key={i} className="text-xs text-gray-600 leading-relaxed">{renderInlineMd(line)}</p>;
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all">
      {/* 卡片头部（始终可见） */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 text-left transition-colors hover:bg-accent-50/30"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0 mt-0.5">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-relaxed">{item.text}</p>
            {/* 标签 */}
            {item.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] text-accent-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 text-accent-400">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {/* 展开后的详细内容 */}
      {expanded && item.detailedContent && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <div className="p-5">
            <div className="space-y-1">
              {renderContent(item.detailedContent)}
            </div>

            {/* 行动建议 */}
            {item.actionTips && item.actionTips.length > 0 && (
              <div className="mt-4 rounded-lg border border-accent-100 bg-accent-50 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold text-accent-700">{actionTipsLabel}</span>
                </div>
                <ul className="space-y-1.5">
                  {item.actionTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="text-accent-500 mt-0.5">▸</span>
                      {renderTip(tip)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntelligencePageClient({ locale }: { locale: string }) {
  const t = useTranslations("intelligence");

  // 从 API 获取市场情报
  const [marketData, setMarketData] = useState<MarketIntelItem[]>([]);
  const [dataDate, setDataDate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/intelligence?locale=${locale}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setMarketData(d.data);
          setDataDate(d.date);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [locale]);

  // 区域顺序按语言适配
  const regionOrderZh = ["全球推广", "俄罗斯", "欧洲", "中国", "乌克兰", "巴西", "哈萨克斯坦", "乌兹别克斯坦", "东南亚", "非洲", "阿富汗"];
  const regionOrderEn = ["Global Promotion", "Russia", "Europe", "China", "Ukraine", "Brazil", "Kazakhstan", "Uzbekistan", "Southeast Asia", "Africa", "Afghanistan"];
  const regionOrderRu = ["Глобальное продвижение", "Россия", "Европа", "Китай", "Украина", "Бразилия", "Казахстан", "Узбекистан", "Юго-Восточная Азия", "Африка", "Афганистан"];
  const regionOrder = locale === "en" ? regionOrderEn : locale === "ru" ? regionOrderRu : regionOrderZh;
  const grouped: Record<string, MarketIntelItem[]> = {};
  for (const item of marketData) {
    if (!grouped[item.region]) grouped[item.region] = [];
    grouped[item.region].push(item);
  }

  // 把不在 regionOrder 里的区域追加到末尾
  const allRegions = [...regionOrder];
  for (const region of Object.keys(grouped)) {
    if (!allRegions.includes(region)) {
      allRegions.push(region);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-accent-800 via-accent-700 to-primary-800 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-8 w-8 text-accent-200" />
            <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
          </div>
          <p className="max-w-2xl text-accent-100">{t("subtitle")}</p>
          <div className="mt-6 flex items-center gap-4 text-sm text-accent-200">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{t("latest")}: {dataDate || t("loading")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span>{loading ? "..." : t("count", { count: marketData.length })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-200 border-t-accent-600" />
            <span className="ml-3">{t("loading")}</span>
          </div>
        ) : marketData.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p>{t("empty")}</p>
          </div>
        ) : (
        <>
        {/* 区域分组 */}
        {allRegions.filter(r => grouped[r]).map((region) => (
          <section key={region} className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800">
              {grouped[region][0]?.icon} {region}
              <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {t("count", { count: grouped[region].length })}
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grouped[region].map((item, idx) => (
                <IntelCard key={idx} item={item} locale={locale} actionTipsLabel={t("actionTips")} />
              ))}
            </div>
          </section>
        ))}

        {/* 套利榜单速览 */}
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800">
            <TrendingUp className="h-5 w-5 text-accent-600" />
            {t("arbitrageHighlights")}
          </h2>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              {DAILY_REPORT_RANKING.slice(0, 3).map((item) => (
                <Link
                  key={item.rank}
                  href={`/${locale}/products/${item.id}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:border-accent-200 hover:bg-accent-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-xs font-bold text-white">
                    {item.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{item.model}</div>
                    <div className="text-xs text-gray-500">¥{item.price / 10000}万</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-green-600">{item.profit}</div>
                    <div className="text-xs text-green-500">{item.margin}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
        </>
        )}
      </div>
    </div>
  );
}
