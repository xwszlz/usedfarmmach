"use client";

import { useTranslations } from "next-intl";
import { Award, Cloud, Server, Languages } from "lucide-react";

interface TrustBadgesProps {
  locale: string;
}

export function TrustBadges({ locale }: TrustBadgesProps) {
  const t = useTranslations();

  const badges = [
    {
      icon: Award,
      title: t("trust.camda"),
      desc: locale === "zh" ? "行业协会权威认证" : "Industry authority",
    },
    {
      icon: Cloud,
      title: t("trust.globalCdn"),
      desc: locale === "zh" ? "Vercel 全球加速" : "Vercel acceleration",
    },
    {
      icon: Server,
      title: t("trust.oss"),
      desc: locale === "zh" ? "阿里云对象存储" : "Alibaba Cloud storage",
    },
    {
      icon: Languages,
      title: t("trust.languages"),
      desc: locale === "zh" ? "多语言国际服务" : "International service",
    },
  ];

  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {locale === "zh" ? "全球信任 · 权威认证保障" : "Global Trust · Certified Assurance"}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {locale === "zh" ? "CAMDA认证 · 全球加速 · 多语言服务" : "CAMDA · Global CDN · Multilingual"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {badges.map((badge, i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="mb-3 inline-flex rounded-xl bg-primary-50 p-3 dark:bg-primary-900/20">
                <badge.icon className="h-6 w-6 text-primary-500" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                {badge.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {badge.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
