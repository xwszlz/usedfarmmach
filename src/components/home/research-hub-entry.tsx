"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, FileText } from "lucide-react";

interface ResearchHubEntryProps {
  locale: string;
}

export function ResearchHubEntry({ locale }: ResearchHubEntryProps) {
  const t = useTranslations();

  const articles = [
    {
      title: locale === "zh" ? "2024全球农机市场趋势报告" : "2024 Global Machinery Market Trends",
      tag: locale === "zh" ? "市场报告" : "Market Report",
      date: "2024-12",
    },
    {
      title: locale === "zh" ? "AI在农业机械中的应用前景" : "AI Applications in Agricultural Machinery",
      tag: locale === "zh" ? "AI研究" : "AI Research",
      date: "2024-11",
    },
    {
      title: locale === "zh" ? "跨境农机贸易政策解读" : "Cross-border Machinery Trade Policy",
      tag: locale === "zh" ? "政策" : "Policy",
      date: "2024-10",
    },
  ];

  return (
    <section className="py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              {t("research.title")}
            </h2>
          </div>
          <Link
            href={`/${locale}/research`}
            className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            {t("research.viewAll")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {articles.map((article, i) => (
            <Link
              key={i}
              href={`/${locale}/research`}
              className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-500" />
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
                  {article.tag}
                </span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                {article.title}
              </h3>
              <p className="text-sm text-gray-400">{article.date}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
