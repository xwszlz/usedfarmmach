import { Suspense } from 'react';
import ArbitrageTopClient from './ArbitrageTopClient';
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '套利榜单',
  description: '查看最高套利机会的农机产品排名，发现跨境投资最佳选择。',
};

export default async function ArbitrageTopPage() {
  const t = await getTranslations('arbitrageTop');
  
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

          {/* 榜单说明 */}
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

          {/* 套利榜单客户端组件 */}
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
            <ArbitrageTopClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}