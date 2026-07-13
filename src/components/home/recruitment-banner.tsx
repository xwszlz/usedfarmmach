"use client";

import { useTranslations } from "next-intl";

interface RecruitmentBannerProps {
  locale: string;
}

export function RecruitmentBanner({ locale }: RecruitmentBannerProps) {
  const t = useTranslations("home.recruitment");

  return (
    <section className="relative overflow-hidden">
      {/* 背景图片 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(/images/banner/banner-chatgpt.jpg)`,
        }}
      />
      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white drop-shadow-lg sm:text-3xl lg:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-white/80 drop-shadow sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </div>
    </section>
  );
}
