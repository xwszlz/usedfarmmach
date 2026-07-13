"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

interface ExpoEntranceProps {
  locale: string;
}

export function ExpoEntrance({ locale }: ExpoEntranceProps) {
  const t = useTranslations();

  const halls = [
    {
      href: "/expo/china-brands",
      titleKey: "expoHome.chinaHall",
      descKey: "expoHome.chinaHallDesc",
      metric: locale === "zh" ? "60+ 品牌" : "60+ Brands",
      gradient: "from-red-500 to-orange-500",
    },
    {
      href: "/expo/global-brands",
      titleKey: "expoHome.intlHall",
      descKey: "expoHome.intlHallDesc",
      metric: locale === "zh" ? "45+ 品牌" : "45+ Brands",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      href: "/expo/compare",
      titleKey: "expoHome.compareHall",
      descKey: "expoHome.compareHallDesc",
      metric: locale === "zh" ? "跨品牌对比" : "Cross-brand",
      gradient: "from-purple-500 to-pink-500",
    },
  ];

  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            {locale === "zh" ? "世界农机博览会" : "World Agricultural Machinery Expo"}
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {locale === "zh" ? "汇聚全球顶尖农机品牌" : "Bringing Together the World's Top Machinery Brands"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {halls.map((hall) => (
            <Link
              key={hall.href}
              href={`/${locale}${hall.href}`}
              className="group relative overflow-hidden rounded-2xl"
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${hall.gradient} opacity-90`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* Content */}
              <div className="relative flex h-64 flex-col justify-between p-6">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {t(hall.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm text-white/80">
                    {t(hall.descKey)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-white">
                    {hall.metric}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition-all group-hover:bg-white/30">
                    {t("expoHome.enterHall")}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
