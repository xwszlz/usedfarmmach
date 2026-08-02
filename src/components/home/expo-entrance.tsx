"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { isCnSite } from "@/config/site";

interface ExpoEntranceProps {
  locale: string;
  counts?: { globalLeader: number; industryPillar: number; risingSpecialty: number } | null;
}

export function ExpoEntrance({ locale, counts }: ExpoEntranceProps) {
  const t = useTranslations();
  const isCn = isCnSite();

  // 实时展品数优先；DB 查询失败（counts 为 null）时降级为旧硬编码文案
  const label = locale === "zh" ? "展品" : "Exhibits";
  const metricFor = (n?: number) =>
    counts && typeof n === "number"
      ? `${n} ${label}`
      : locale === "zh"
      ? "26+ 品牌"
      : "26+ Brands";

  const halls = [
    {
      href: "/expo/showroom?pavilion=global_leader",
      titleKey: "expoHome.globalLeadersHall",
      descKey: "expoHome.globalLeadersHallDesc",
      metric: metricFor(counts?.globalLeader),
      gradient: "from-red-500 to-orange-500",
    },
    {
      href: "/expo/showroom?pavilion=industry_pillar",
      titleKey: "expoHome.industryPillarsHall",
      descKey: "expoHome.industryPillarsHallDesc",
      metric: metricFor(counts?.industryPillar),
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      href: "/expo/showroom?pavilion=rising_specialty",
      titleKey: "expoHome.risingSpecialtyHall",
      descKey: "expoHome.risingSpecialtyHallDesc",
      metric: metricFor(counts?.risingSpecialty),
      gradient: "from-purple-500 to-pink-500",
    },
  ];

  const heading = isCn
    ? locale === "zh"
      ? "世界农机博览会"
      : "World Agricultural Machinery Expo"
    : locale === "zh"
      ? "全球农机博览会"
      : "Global Agri-Machinery Expo";
  const subheading = isCn
    ? locale === "zh"
      ? "汇聚全球顶尖农机品牌"
      : "Bringing Together the World's Top Machinery Brands"
    : locale === "zh"
      ? "汇聚全球农机，服务全球买家"
      : "Connecting the World's Machinery with Global Buyers";

  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          {!isCn && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-1.5 text-sm font-semibold text-red-700">
              Shendiao Agri-Machinery Expo™
            </div>
          )}
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            {heading}
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {subheading}
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

        {!isCn && (
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={`/${locale}/expo/showroom`}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              {locale === "zh" ? "我是买家 · 浏览全球供给" : "I'm a Buyer · Browse Global Supply"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/expo`}
              className="inline-flex items-center gap-2 rounded-full border border-red-600 px-6 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              {locale === "zh" ? "我是展商 · 申请参展" : "I'm an Exhibitor · Apply to Join"}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
