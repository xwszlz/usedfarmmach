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
    <section className="relative overflow-hidden">
      {/* 背景图片 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(/images/banner/banner-global-trading.jpg)`,
        }}
      />
      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/75" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur">
            <Sparkles className="h-4 w-4" />
            {t("badge")}
          </div>
          <h2 className="text-3xl font-bold text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base text-white/90 drop-shadow sm:text-lg">
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
