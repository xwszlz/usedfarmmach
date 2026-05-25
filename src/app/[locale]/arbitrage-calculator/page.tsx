import { Suspense } from 'react';
import ArbitrageCalculatorClient from './ArbitrageCalculatorClient';
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '跨境套利计算器',
  description: '计算二手农机的跨境套利机会，考虑运输成本、关税、保险等费用，帮助您发现最佳投资机会。',
};

export default async function ArbitrageCalculatorPage() {
  const t = await getTranslations('arbitrageCalculator');
  
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* 页面标题和描述 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {t('title')}
            </h1>
            <p className="text-gray-600">
              {t('description')}
            </p>
          </div>

          {/* 如何使用说明 */}
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

          {/* 套利计算器客户端组件 */}
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