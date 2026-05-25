"use client";

import React, { useState } from 'react';
import { ArbitrageCalculator as CalculatorService } from '@/lib/services/arbitrage-calculator';
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
  
  const defaultParams: ArbitrageCalculatorParams = {
    productId,
    domesticPrice: initialDomesticPrice || undefined,
    foreignPrice: initialForeignPrice || undefined,
    shippingCostPercentage: 10, // 默认10%
    importTaxRate: 8, // 默认8%
    insuranceRate: 2, // 默认2%
    quantity: 1,
    includeAnalysis: true
  };
  
  const [params, setParams] = useState<ArbitrageCalculatorParams>(defaultParams);
  
  const handleCalculate = async () => {
    if (!params.productId) {
      setError('请选择产品');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const calculator = new CalculatorService();
      const calculationResult = await calculator.calculateArbitrage(params);
      setResult(calculationResult);
    } catch (err) {
      console.error('套利计算错误:', err);
      setError(err instanceof Error ? err.message : '计算失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  const handleReset = () => {
    setParams(defaultParams);
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