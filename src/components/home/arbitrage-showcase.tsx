"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Wheat, Award, Newspaper, TrendingUp, ArrowRight } from "lucide-react";

export function ArbitrageShowcase() {
  const t = useTranslations("home");
  const locale = useLocale();

  const features = [
    {
      icon: Wheat,
      title: t("feature1Title"),
      desc: t("feature1Desc"),
      color: "text-primary-600 bg-primary-100",
      href: `/${locale}/category/forage-harvester`,
    },
    {
      icon: Award,
      title: t("feature2Title"),
      desc: t("feature2Desc"),
      color: "text-accent-600 bg-accent-100",
      href: `/${locale}/brand/claas`,
    },
    {
      icon: Newspaper,
      title: t("feature3Title"),
      desc: t("feature3Desc"),
      color: "text-green-600 bg-green-100",
      href: `/${locale}/blog`,
    },
    {
      icon: TrendingUp,
      title: t("feature4Title"),
      desc: t("feature4Desc"),
      color: "text-blue-600 bg-blue-100",
      href: `/${locale}/products?sort=priceHigh`,
    },
  ];

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("features")}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat, idx) => (
            <Link key={idx} href={feat.href} className="group block">
              <Card className="h-full border-0 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-lg p-3 group-hover:scale-110 transition-transform" style={{ backgroundColor: feat.color.split(' ')[1] }}>
                    <feat.icon className={`h-6 w-6 ${feat.color.split(' ')[0]}`} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">{feat.desc}</p>
                  <span className="inline-flex items-center text-xs font-medium text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {t("viewAll")} <ArrowRight className="ml-1 h-3 w-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
