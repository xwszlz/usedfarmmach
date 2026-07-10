"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";

interface CTASectionProps {
  locale: string;
}

export function CTASection({ locale }: CTASectionProps) {
  const t = useTranslations();

  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-brand-accent to-primary-800 px-8 py-16 text-center">
          {/* Decorative elements */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white backdrop-blur">
              <Sparkles className="h-4 w-4" />
              AI Powered
            </div>
            <h2 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              {t("cta.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
              {t("cta.subtitle")}
            </p>
            <Link
              href={`/${locale}/arena`}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-primary-700 shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
            >
              {t("cta.button")}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
