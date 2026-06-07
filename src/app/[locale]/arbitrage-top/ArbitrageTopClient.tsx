"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ArbitrageTopItem, TopArbitrageResponse } from '@/types/arbitrage';
import { Loader2, ExternalLink, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import PriceTrendChart from '@/components/arbitrage/trend/PriceTrendChart';
import type { PriceDataPoint } from '@/components/arbitrage/trend/PriceTrendChart';

async function fetchTopArbitrage(limit: number = 10) {
  try {
    const response = await fetch(`/api/arbitrage/top-products?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch');
    const result: TopArbitrageResponse = await response.json();
    if (result.success && result.data) return result.data;
    throw new Error(result.error || 'Failed to fetch');
  } catch (error) {
    console.error('Error fetching:', error);
    throw error;
  }
}

interface ArbitrageTopClientProps {
  locale: string;
}

export default function ArbitrageTopClient({ locale }: ArbitrageTopClientProps) {
  const t = useTranslations('arbitrageTop');
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TopArbitrageResponse['data'] | null>(null);
  const [limit, setLimit] = useState(10);
  const [priceTrendData, setPriceTrendData] = useState<PriceDataPoint[]>([]);

  const buildProductUrl = (productId: string): string => {
    return `/${locale}/products/${productId}`;
  };

  const generateMockPriceTrendData = (arbitrageData: TopArbitrageResponse['data'] | null): PriceDataPoint[] => {
    if (!arbitrageData || arbitrageData.products.length === 0) return [];
    const mockData: PriceDataPoint[] = [];
    const now = new Date();
    const baseProduct = arbitrageData.products[0];
    const baseDomestic = baseProduct.domesticPrice;
    const baseInternational = baseProduct.foreignPrice;
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const domesticFluctuation = 1 + (Math.random() * 0.1 - 0.05);
      const internationalFluctuation = 1 + (Math.random() * 0.1 - 0.05);
      const domesticPrice = Math.round(baseDomestic * domesticFluctuation);
      const internationalPrice = Math.round(baseInternational * internationalFluctuation);
      mockData.push({
        date: date.toISOString().split('T')[0],
        domesticPrice,
        internationalPrice,
        priceDifference: internationalPrice - domesticPrice,
      });
    }
    return mockData;
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchTopArbitrage(limit);
        setData(result);
        const trendData = generateMockPriceTrendData(result);
        setPriceTrendData(trendData);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [limit, t]);

  const formatCurrency = (amount: number, currency: string = 'CNY') => {
    return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'zh-CN', {
      style: 'currency',
      currency: currency === 'CNY' ? 'CNY' : 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'zh-CN');
  };

  const getArbitrageLevelInfo = (level: string) => {
    switch (level) {
      case 'high':
        return { icon: <TrendingUp className="h-4 w-4" />, color: 'text-green-600 bg-green-100', text: t('levels.high') };
      case 'medium':
        return { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-yellow-600 bg-yellow-100', text: t('levels.medium') };
      case 'low':
        return { icon: <CheckCircle className="h-4 w-4" />, color: 'text-blue-600 bg-blue-100', text: t('levels.low') };
      default:
        return { icon: <CheckCircle className="h-4 w-4" />, color: 'text-gray-600 bg-gray-100', text: t('levels.unknown') };
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTopArbitrage(limit);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="border rounded-lg p-8 bg-white shadow-sm text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">{t('loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
          <button onClick={handleRefresh} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
            {t('reload')}
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.products.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">{t('noData')}</p>
          <p className="text-sm text-gray-500">{t('noDataHint')}</p>
        </div>
      </div>
    );
  }

  const { products, summary, generatedAt } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-medium text-gray-700">{t('liveRanking')}</h3>
          <p className="text-sm text-gray-500">{t('dataUpdatedAt')}: {formatDate(generatedAt)}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="limit" className="text-sm text-gray-700">{t('showCount')}:</label>
            <select id="limit" className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
          <button onClick={handleRefresh} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-md transition-colors flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? t('refreshing') : t('refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">{t('stats.totalProducts')}</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalProducts}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">{t('stats.profitMargin')}</p>
          <p className="text-2xl font-bold text-green-600">{summary.averageProfitMargin?.toFixed(1) || '0'}%</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">{t('stats.highOpportunity')}</p>
          <p className="text-2xl font-bold text-green-600">{summary.highOpportunityCount}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">{t('stats.totalProfit')}</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalEstimatedProfit || 0)}</p>
        </div>
      </div>

      {priceTrendData.length > 0 && (
        <div className="bg-white border rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('priceTrend')}</h3>
          <p className="text-sm text-gray-600 mb-6">
            {t('priceTrendDesc', { productName: data?.products[0]?.productName || '—' })}
          </p>
          <PriceTrendChart data={priceTrendData} title={`${data?.products[0]?.productName || ''} Price Trends`} height={350} />
        </div>
      )}

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.rank')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.productInfo')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.priceInfo')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.arbitrageEval')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('table.action')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((item) => {
                const levelInfo = getArbitrageLevelInfo(item.arbitrageLevel);
                return (
                  <tr key={item.productId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center justify-center h-8 w-8 rounded-full ${levelInfo.color} font-bold`}>{item.rank}</div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                      <p className="text-sm text-gray-500">{item.brandName} • {t('table.year', { year: item.year })}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm"><span className="text-gray-600">{t('table.domesticPrice')}:</span><span className="font-medium">{formatCurrency(item.domesticPrice)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-600">{t('table.foreignPrice')}:</span><span className="font-medium">{formatCurrency(item.foreignPrice)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-600">{t('table.priceDiff')}:</span><span className={`font-medium ${item.priceDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.priceDiff > 0 ? '+' : ''}{formatCurrency(Math.abs(item.priceDiff))}</span></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">{levelInfo.icon}<span className={`text-sm font-medium ${levelInfo.color.split(' ')[0]}`}>{levelInfo.text}</span></div>
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(item.opportunityScore, 100)}%` }} /></div>
                          <span className="text-xs text-gray-600">{t('table.score', { score: item.opportunityScore })}</span>
                        </div>
                        <div className="text-sm text-gray-600">{t('table.profitMargin')}: <span className="font-medium">{item.profitMargin?.toFixed(1) || '0'}%</span></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a href={buildProductUrl(item.productId)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900 flex items-center gap-1">
                        {t('table.viewDetail')}<ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-500 p-4 border rounded-lg bg-gray-50">
        <p>{t('note')}</p>
      </div>
    </div>
  );
}
