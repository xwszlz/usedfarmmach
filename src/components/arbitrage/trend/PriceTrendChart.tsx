'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLocale, useTranslations } from 'next-intl';

export interface PriceDataPoint {
  date: string;
  domesticPrice: number;
  internationalPrice: number;
  priceDifference: number;
}

interface PriceTrendChartProps {
  data: PriceDataPoint[];
  title?: string;
  height?: number;
}

export default function PriceTrendChart({ data, title, height = 300 }: PriceTrendChartProps) {
  const t = useTranslations('arbitrageTop');
  const locale = useLocale();
  
  // 格式化货币显示
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // 格式化日期显示
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{formatDate(label)}</p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              <span className="text-gray-700">{t('table.domesticPrice')}:</span>
              <span className="ml-2 font-semibold text-gray-900">{formatCurrency(payload[0].value)}</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span className="text-gray-700">{t('table.internationalPrice')}:</span>
              <span className="ml-2 font-semibold text-gray-900">{formatCurrency(payload[1].value)}</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
              <span className="text-gray-700">{t('table.priceDifference')}:</span>
              <span className="ml-2 font-semibold text-gray-900">{formatCurrency(payload[2].value)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 mb-2">📊</div>
          <p className="text-gray-500">{t('noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {t('description')}
          </p>
        </div>
      )}
      
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              stroke="#666"
              fontSize={12}
            />
            <YAxis 
              stroke="#666"
              fontSize={12}
              tickFormatter={formatCurrency}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="domesticPrice"
              name={t('table.domesticPrice')}
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="internationalPrice"
              name={t('table.internationalPrice')}
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="priceDifference"
              name={t('table.priceDifference')}
              stroke="#8b5cf6"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              <span className="text-sm font-medium text-gray-700">{t('table.domesticPrice')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(data[data.length - 1]?.domesticPrice || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">最新数据</p>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span className="text-sm font-medium text-gray-700">{t('table.internationalPrice')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(data[data.length - 1]?.internationalPrice || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">最新数据</p>
          </div>
          
          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
              <span className="text-sm font-medium text-gray-700">{t('table.priceDifference')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(data[data.length - 1]?.priceDifference || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">当前价差</p>
          </div>
        </div>
      </div>
    </div>
  );
}