"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Handshake, Wrench, Tractor, Sparkles } from "lucide-react";

interface RecruitmentBannerProps {
  locale: string;
}

export function RecruitmentBanner({ locale }: RecruitmentBannerProps) {
  const t = useTranslations("home.recruitment");

  const audiences = [
    { icon: Tractor, label: t("sellers") },
    { icon: Wrench, label: t("partsDealers") },
    { icon: Handshake, label: t("serviceProviders") },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-red-600">
      {/* 装饰元素 */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-yellow-300/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur">
            <Sparkles className="h-4 w-4" />
            {t("badge")}
          </div>
          <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base text-white/85 sm:text-lg">
            {t("subtitle")}
          </p>

          {/* 目标人群 */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {audiences.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur"
              >
                <Icon className="h-4 w-4" />
                {label}
              </div>
            ))}
          </div>

          {/* CTA 按钮 */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`/${locale}/seller/products/new`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-orange-700 shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
            >
              {t("ctaApply")}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href={`/${locale}/about`}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-white/40 px-6 py-3 text-base font-semibold text-white backdrop-blur transition-all hover:bg-white/10 active:scale-95"
            >
              {t("ctaContact")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
