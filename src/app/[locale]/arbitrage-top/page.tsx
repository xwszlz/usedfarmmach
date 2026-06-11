import type { Metadata } from "next";
import { Suspense } from 'react';
import ArbitrageTopClient from './ArbitrageTopClient';
import { getTranslations } from 'next-intl/server';
import { generatePageMetadata } from "@/lib/seo-metadata";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("arbitrageTop", locale, {
    alternates: {
      canonical: `${BASE_URL}/${locale}/arbitrage-top`,
    },
  });
}

interface Params {
  locale: string;
}

export default async function ArbitrageTopPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  const t = await getTranslations('arbitrageTop');

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {t('title')}
            </h1>
            <p className="text-gray-600">
              {t('description')}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <h2 className="text-lg font-semibold text-green-800 mb-2">
              {t('rankingExplanationTitle')}
            </h2>
            <ul className="text-green-700 list-disc pl-5 space-y-1">
              <li>{t('explanation1')}</li>
              <li>{t('explanation2')}</li>
              <li>{t('explanation3')}</li>
              <li>{t('explanation4')}</li>
              <li>{t('explanation5')}</li>
            </ul>
          </div>

          <Suspense fallback={
            <div className="border rounded-lg p-8 bg-white shadow-sm">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="space-y-4">
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          }>
            <ArbitrageTopClient locale={locale} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
