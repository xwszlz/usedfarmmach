"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Wrench, Cog, Settings } from "lucide-react";

interface PartsEntranceProps {
  locale: string;
}

export function PartsEntrance({ locale }: PartsEntranceProps) {
  const t = useTranslations("home.parts");

  const features = [
    { icon: Wrench, titleKey: "feature1Title", descKey: "feature1Desc" },
    { icon: Cog, titleKey: "feature2Title", descKey: "feature2Desc" },
    { icon: Settings, titleKey: "feature3Title", descKey: "feature3Desc" },
  ];

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-2 text-sm text-gray-500">{t("subtitle")}</p>
          <Link
            href={`/${locale}/parts`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            {t("viewAll")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {features.map(({ icon: Icon, titleKey, descKey }) => (
            <div
              key={titleKey}
              className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t(titleKey)}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {t(descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
