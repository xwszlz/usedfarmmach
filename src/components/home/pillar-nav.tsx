"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShoppingCart, Building2, Wrench, Settings, Trophy, BookOpen, ArrowRight } from "lucide-react";

interface PillarNavProps {
  locale: string;
}

export function PillarNav({ locale }: PillarNavProps) {
  const t = useTranslations();

  const pillars = [
    {
      href: "/products",
      icon: ShoppingCart,
      titleKey: "pillar.tradeTitle",
      descKey: "pillar.tradeDesc",
      metric: "200+",
      highlight: false,
    },
    {
      href: "/expo",
      icon: Building2,
      titleKey: "pillar.expoTitle",
      descKey: "pillar.expoDesc",
      metric: "105",
      highlight: false,
    },
    {
      href: "/parts",
      icon: Wrench,
      titleKey: "pillar.partsTitle",
      descKey: "pillar.partsDesc",
      metric: "500+",
      highlight: false,
    },
    {
      href: "/services",
      icon: Settings,
      titleKey: "pillar.servicesTitle",
      descKey: "pillar.servicesDesc",
      metric: locale === "zh" ? "检测/物流" : "Inspect/Logistics",
      highlight: false,
    },
    {
      href: "/arena",
      icon: Trophy,
      titleKey: "pillar.arenaTitle",
      descKey: "pillar.arenaDesc",
      metric: "AI",
      highlight: true,
    },
    {
      href: "/research",
      icon: BookOpen,
      titleKey: "pillar.researchTitle",
      descKey: "pillar.researchDesc",
      metric: locale === "zh" ? "报告/政策" : "Reports",
      highlight: false,
    },
  ];

  return (
    <section className="py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            {locale === "zh" ? "六大核心板块" : "Six Core Pillars"}
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {locale === "zh" ? "一站式农机全生态服务" : "One-stop machinery ecosystem services"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <Link
              key={pillar.href}
              href={`/${locale}${pillar.href}`}
              className={`group relative overflow-hidden rounded-2xl border p-6 transition-all hover:-translate-y-1 hover:shadow-lg ${
                pillar.highlight
                  ? "border-brand-accent bg-brand-accent-light dark:border-brand-accent"
                  : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
              }`}
            >
              {pillar.highlight && (
                <span className="absolute right-4 top-4 rounded-full bg-brand-accent px-2 py-0.5 text-xs font-bold text-white">
                  HOT
                </span>
              )}
              <div className="mb-4 inline-flex rounded-xl bg-primary-50 p-3 dark:bg-primary-900/20">
                <pillar.icon className="h-6 w-6 text-primary-500" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                {t(pillar.titleKey)}
              </h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {t(pillar.descKey)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {pillar.metric}
                </span>
                <ArrowRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-primary-500" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
