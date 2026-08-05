"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { CurrencyCode } from '@/types/exchange-rates';

// 动态导入套利计算器以避免服务器组件问题
const ArbitrageCalculator = dynamic(
  () => import('@/components/arbitrage/calculator/ArbitrageCalculator'),
  {
    ssr: false,
    loading: () => (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    ),
  }
);

interface ArbitrageCalculatorSectionProps {
  productId: string;
  domesticPrice: number;
  foreignPrice?: number;
  foreignCurrency?: CurrencyCode;
  showForeignPrice?: boolean;
}

export default function ArbitrageCalculatorSection({
  productId,
  domesticPrice,
  foreignPrice,
  foreignCurrency,
  showForeignPrice = false,
}: ArbitrageCalculatorSectionProps) {
  return (
    <div className="mt-6">
      <ArbitrageCalculator
        key={productId}
        productId={productId}
        initialDomesticPrice={domesticPrice}
        initialForeignPrice={foreignPrice}
      />
      
      <div className="mt-4 text-xs text-gray-500">
        <p>套利计算器为您提供详细的跨境交易成本与利润分析：</p>
        <ul className="mt-1 list-disc pl-5 space-y-1">
          <li>考虑运输成本、关税、保险等附加费用</li>
          <li>基于实时汇率计算国外价格（人民币）</li>
          <li>提供详细的成本分解与风险评估</li>
          <li>可调整参数以模拟不同交易场景</li>
        </ul>
      </div>
    </div>
  );
}