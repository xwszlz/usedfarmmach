"use client";

import { useTranslations } from "next-intl";

interface RecruitmentBannerProps {
  locale: string;
}

export function RecruitmentBanner({ locale }: RecruitmentBannerProps) {
  const t = useTranslations("home");

  const isRTL = locale === "ar";

  return (
    <section className="relative w-full overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      {/* Background image */}
      <img
        src="/images/banner/banner-clean.webp"
        alt={t("bannerBrand")}
        className="h-auto w-full object-cover"
      />
      {/* Text overlay - positioned at golden ratio (38.2% from top) */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-4"
        style={{ top: "8%", bottom: "52%" }}
      >
        {/* Line 1: Brand (gold) + Tagline (blue) */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 md:gap-6">
          <span
            className="font-bold leading-tight"
            style={{
              fontSize: "clamp(1.5rem, 4.5vw, 4.2rem)",
              color: "#FFD700",
              textShadow:
                "0 0 20px rgba(255,200,50,0.6), 0 0 40px rgba(255,180,0,0.3), 2px 2px 4px rgba(60,40,0,0.8), -1px -1px 2px rgba(255,255,200,0.5)",
              WebkitTextStroke: "1px rgba(180,140,20,0.6)",
            }}
          >
            {t("bannerBrand")}
          </span>
          <span
            className="font-bold leading-tight"
            style={{
              fontSize: "clamp(1.2rem, 3.8vw, 3.5rem)",
              color: "#5EB3FF",
              textShadow:
                "0 0 15px rgba(0,100,220,0.4), 2px 2px 4px rgba(0,20,80,0.8), -1px -1px 2px rgba(200,230,255,0.4)",
              WebkitTextStroke: "0.5px rgba(0,100,200,0.5)",
            }}
          >
            {t("bannerMain")}
          </span>
        </div>
        {/* Line 2: Subtitle (green) */}
        <p
          className="mt-3 text-center font-semibold leading-tight sm:mt-4 md:mt-5"
          style={{
            fontSize: "clamp(0.9rem, 3.2vw, 2.9rem)",
            color: "#5DFF9C",
            textShadow:
              "0 0 12px rgba(0,160,70,0.4), 2px 2px 4px rgba(0,40,20,0.8), -1px -1px 2px rgba(160,255,190,0.4)",
            WebkitTextStroke: "0.5px rgba(0,120,50,0.4)",
          }}
        >
          {t("bannerSub")}
        </p>
      </div>
    </section>
  );
}
