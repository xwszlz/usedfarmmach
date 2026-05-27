"use client";

// v2026-05-26: Fixed PrismaClient browser error (API call) + functional useState + useEffect for props sync
import React, { useState, useEffect } from 'react';
import type { ArbitrageCalculatorParams, ArbitrageResult } from '@/types/arbitrage';
import CalculatorInputs from './CalculatorInputs';
import CalculatorResults from './CalculatorResults';
import CostBreakdown from './CostBreakdown';

interface ArbitrageCalculatorProps {
  productId?: string;
  initialDomesticPrice?: number;
  initialForeignPrice?: number;
}

/**
 * 套利计算器主组件
 * 提供交互式套利计算功能
 */
export default function ArbitrageCalculator({
  productId = '',
  initialDomesticPrice = 0,
  initialForeignPrice = 0
}: ArbitrageCalculatorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ArbitrageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 使用函数式 useState 初始化，避免闭包问题，确保动态导入场景下正确初始化
  const [params, setParams] = useState<ArbitrageCalculatorParams>(() => ({
    productId: productId || '',
    domesticPrice: initialDomesticPrice || undefined,
    foreignPrice: initialForeignPrice || undefined,
    shippingCostPercentage: 0.1, // 默认10% (小数形式)
    importTaxRate: 0.08, // 默认8% (小数形式)
    insuranceRate: 0.02, // 默认2% (小数形式)
    quantity: 1,
    includeAnalysis: true
  }));

  // 当外部传入的 props 变化时，同步更新 state（首次加载或切换产品时）
  useEffect(() => {
    setParams(prev => ({
      ...prev,
      productId: productId || prev.productId,
      domesticPrice: initialDomesticPrice || prev.domesticPrice,
      foreignPrice: initialForeignPrice || prev.foreignPrice,
    }));
  }, [productId, initialDomesticPrice, initialForeignPrice]);

  const handleCalculate = async () => {
    if (!params.productId) {
      setError('请选择产品');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 调用 API 而不是直接在浏览器中实例化 Service（避免 PrismaClient 浏览器报错）
      const response = await fetch('/api/arbitrage/calculator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '计算失败');
      }

      const responseData = await response.json();
      if (!responseData.success) {
        throw new Error(responseData.error || '计算失败');
      }

      setResult(responseData.data);
    } catch (err) {
      console.error('套利计算错误:', err);
      setError(err instanceof Error ? err.message : '计算失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setParams({
      productId: productId || '',
      domesticPrice: initialDomesticPrice || undefined,
      foreignPrice: initialForeignPrice || undefined,
      shippingCostPercentage: 0.1,
      importTaxRate: 0.08,
      insuranceRate: 0.02,
      quantity: 1,
      includeAnalysis: true
    });
    setResult(null);
    setError(null);
  };
  
  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">跨境套利计算器</h2>
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 transition-colors"
        >
          重置
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-700">输入参数</h3>
          <CalculatorInputs
            params={params}
            onChange={setParams}
            disabled={loading}
          />
          
          <div className="pt-4">
            <button
              onClick={handleCalculate}
              disabled={loading || !params.productId}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? '计算中...' : '计算套利机会'}
            </button>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-700">计算结果</h3>
          
          {result ? (
            <>
              <CalculatorResults result={result} />
              <CostBreakdown costs={result.costs} />
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>输入参数后点击"计算套利机会"查看结果</p>
              <p className="text-sm mt-2">计算将考虑运输成本、关税、保险等费用</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}