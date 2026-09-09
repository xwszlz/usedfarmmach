"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";

interface ExpoGuideEntryProps {
  locale: string;
}

export function ExpoGuideEntry({ locale }: ExpoGuideEntryProps) {
  const t = useTranslations("expoGuideEntry");

  const href = `/${locale}/expo/heilongjiang-2026/guide`;
  const points = [t("p1"), t("p2"), t("p3")];

  return (
    <section className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100/60 p-5 shadow-sm transition-shadow hover:shadow-md dark:border-amber-500/30 dark:from-amber-500/10 dark:via-gray-900 dark:to-amber-500/5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            {/* 左：标签 + 标题 + 描述 + 卖点 */}
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                {t("badge")}
              </span>

              <Link href={href} className="mt-3 block">
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                  {t("title")}
                </h2>
              </Link>

              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {t("desc")}
              </p>

              <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
                {points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <span className="min-w-0">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 右：CTA */}
            <div className="shrink-0">
              <Link
                href={href}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 sm:w-auto"
              >
                {t("cta")}
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
