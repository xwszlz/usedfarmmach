"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, ShieldCheck, Truck, Banknote } from "lucide-react";

interface ServicesEntranceProps {
  locale: string;
}

export function ServicesEntrance({ locale }: ServicesEntranceProps) {
  const t = useTranslations("home.services");

  const services = [
    { icon: ShieldCheck, titleKey: "service1Title", descKey: "service1Desc" },
    { icon: Truck, titleKey: "service2Title", descKey: "service2Desc" },
    { icon: Banknote, titleKey: "service3Title", descKey: "service3Desc" },
  ];

  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm text-gray-500">{t("subtitle")}</p>
          <Link
            href={`/${locale}/services`}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            {t("learnMore")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {services.map(({ icon: Icon, titleKey, descKey }) => (
            <Link
              key={titleKey}
              href={`/${locale}/services`}
              className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-primary-300 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-green-600">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                {t(titleKey)}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {t(descKey)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
