"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Award, GraduationCap, Medal } from "lucide-react";

interface EngineerCertSectionProps {
  locale: string;
}

export function EngineerCertSection({ locale }: EngineerCertSectionProps) {
  const t = useTranslations("home.engineerCert");

  const levels = [
    { icon: GraduationCap, nameKey: "level1", color: "text-blue-600 bg-blue-50" },
    { icon: Award, nameKey: "level3", color: "text-purple-600 bg-purple-50" },
    { icon: Medal, nameKey: "level5", color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <section className="bg-gradient-to-b from-gray-50 to-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-gray-500">
            {t("subtitle")}
          </p>
        </div>

        {/* 五级认证展示 */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          {levels.map(({ icon: Icon, nameKey, color }) => (
            <div
              key={nameKey}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${color}`}
            >
              <Icon className="h-4 w-4" />
              {t(nameKey)}
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href={`/${locale}/engineer`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
          >
            {t("cta")}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
