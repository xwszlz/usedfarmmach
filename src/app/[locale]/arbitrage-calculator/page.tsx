import type { Metadata } from "next";
import { Suspense } from 'react';
import ArbitrageCalculatorClient from './ArbitrageCalculatorClient';
import { getTranslations } from 'next-intl/server';
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, HowToStructuredData } from "@/components/seo/structured-data";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("arbitrageCalculator", locale, "/arbitrage-calculator");
}

export default async function ArbitrageCalculatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('arbitrageCalculator');

  const howToSteps = [
    {
      name: locale === "zh" ? "选择产品" : "Select Product",
      text: locale === "zh"
        ? "从产品列表中选择您感兴趣的二手机，系统会自动填充国内价格和国外市场价格。"
        : "Select a used farm machine from the product list. Domestic and international prices are auto-filled.",
    },
    {
      name: locale === "zh" ? "调整成本参数" : "Adjust Cost Parameters",
      text: locale === "zh"
        ? "根据实际情况调整运输成本、关税税率、保险费等参数，获得更精准的利润估算。"
        : "Adjust shipping costs, tariff rates, insurance and other parameters for a more accurate profit estimate.",
    },
    {
      name: locale === "zh" ? "计算套利机会" : "Calculate Arbitrage",
      text: locale === "zh"
        ? "点击计算按钮，实时查看跨境套利空间：潜在利润、利润率百分比、风险评估和建议。"
        : "Click calculate to see real-time cross-border arbitrage: potential profit, margin percentage, risk assessment and recommendations.",
    },
    {
      name: locale === "zh" ? "决策与交易" : "Decision & Trade",
      text: locale === "zh"
        ? "根据计算结果做出投资决策。如决定购买，可直接联系我们的一站式服务团队处理后续物流和报关。"
        : "Make investment decisions based on the results. Contact our one-stop service team for logistics and customs clearance.",
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <BreadcrumbStructuredData
            locale={locale}
            items={[
              { name: locale === "zh" ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
              { name: locale === "zh" ? "套利计算器" : "Arbitrage Calculator", url: `${BASE_URL}/${locale}/arbitrage-calculator` },
            ]}
          />
          <HowToStructuredData
            name={locale === "zh" ? "跨境套利计算器" : "Cross-Border Arbitrage Calculator"}
            description={locale === "zh"
              ? "计算二手农机的跨境套利机会，考虑运输成本、关税、保险等费用，帮助您发现最佳投资机会。"
              : "Calculate cross-border arbitrage opportunities for used farm machinery, considering shipping, tariff, and insurance costs."}
            steps={howToSteps}
          />

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {t('title')}
            </h1>
            <p className="text-gray-600">
              {t('description')}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <h2 className="text-lg font-semibold text-blue-800 mb-2">
              {t('howToUseTitle')}
            </h2>
            <ol className="text-blue-700 list-decimal pl-5 space-y-1">
              <li>{t('step1')}</li>
              <li>{t('step2')}</li>
              <li>{t('step3')}</li>
              <li>{t('step4')}</li>
            </ol>
          </div>

          <Suspense fallback={
            <div className="border rounded-lg p-8 bg-white shadow-sm">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-10 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-10 bg-gray-200 rounded"></div>
                    </div>
                    <div className="space-y-4">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-24 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }>
            <ArbitrageCalculatorClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
