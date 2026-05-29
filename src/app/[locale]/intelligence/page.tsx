import { getTranslations, setRequestLocale } from "next-intl/server";
import { Globe, TrendingUp, BarChart3, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { DailyReportSection } from "@/components/home/daily-report-section";
import { DAILY_REPORT_RANKING } from "@/config/daily-report-ranking";
import { ALL_MARKET_INTEL, type MarketIntelItem } from "@/config/all-market-intel";

export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "intelligence" });

  // 按地区分组
  const regionOrder = ["🇷🇺", "🇺🇦", "🇧🇷", "🇰🇿", "🇺🇿", "🇦🇫", "🌍"];
  const grouped: Record<string, MarketIntelItem[]> = {};
  for (const item of ALL_MARKET_INTEL) {
    const key = item.region || "其他";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
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
              <span>{t("latest")}: 2026-05-25</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span>{ALL_MARKET_INTEL.length} {t("items")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* 区域分组 */}
        {Object.entries(grouped).map(([region, items]) => (
          <section key={region} className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800">
              {items[0]?.icon} {region}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.url}
                  className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-accent-200 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 leading-relaxed">
                        {item.text}
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-xs text-accent-600 opacity-0 transition-opacity group-hover:opacity-100">
                        <span>查看详情</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                  {/* 标签 */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags?.map((tag) => (
                      <span key={tag} className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] text-accent-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
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
      </div>
    </div>
  );
}