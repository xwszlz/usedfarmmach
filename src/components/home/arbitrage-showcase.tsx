"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, TrendingUp, Shield, Globe, ChevronDown } from "lucide-react";

export function ArbitrageShowcase() {
  const t = useTranslations("home");
  const locale = useLocale();
  const [arbitrageExpanded, setArbitrageExpanded] = useState(false);
  const navT = useTranslations("nav");

  const features = [
    {
      icon: Brain,
      title: t("feature1Title"),
      desc: t("feature1Desc"),
      color: "text-primary-600 bg-primary-100",
    },
    {
      icon: TrendingUp,
      title: t("feature2Title"),
      desc: t("feature2Desc"),
      color: "text-accent-600 bg-accent-100",
    },
    {
      icon: Shield,
      title: t("feature3Title"),
      desc: t("feature3Desc"),
      color: "text-green-600 bg-green-100",
    },
    {
      icon: Globe,
      title: t("feature4Title"),
      desc: t("feature4Desc"),
      color: "text-blue-600 bg-blue-100",
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
          {features.map((feat, idx) => {
            const isArbitrage = idx === 1; // 第二个特性是跨境套利
            
            return (
              <Card 
                key={idx} 
                className={`border-0 shadow-sm transition-shadow hover:shadow-md ${isArbitrage ? 'cursor-pointer' : ''}`}
                onClick={isArbitrage ? () => setArbitrageExpanded(!arbitrageExpanded) : undefined}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`mb-4 inline-flex rounded-lg p-3 ${feat.color}`}>
                      <feat.icon className="h-6 w-6" />
                    </div>
                    {isArbitrage && (
                      <ChevronDown 
                        className={`h-5 w-5 text-gray-400 transition-transform ${arbitrageExpanded ? 'rotate-180' : ''}`} 
                      />
                    )}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-gray-500">{feat.desc}</p>
                  
                  {isArbitrage && arbitrageExpanded && (
                    <div className="mt-4 space-y-2 border-t pt-4">
                      <Link 
                        href={`/${locale}/arbitrage-calculator`}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {navT("arbitrageCalculator")}
                      </Link>
                      <Link 
                        href={`/${locale}/arbitrage-top`}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {navT("arbitrageTop")}
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
