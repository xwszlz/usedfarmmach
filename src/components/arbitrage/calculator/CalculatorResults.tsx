"use client";

import React from 'react';
import type { ArbitrageResult } from '@/types/arbitrage';
import { TrendingUp, TrendingDown, DollarSign, Percent, Package, Shield, AlertCircle, CheckCircle } from 'lucide-react';

interface CalculatorResultsProps {
  result: ArbitrageResult;
}

export default function CalculatorResults({ result }: CalculatorResultsProps) {
  const { 
    productInfo,
    domesticPrice,
    foreignPriceCny,
    priceDifference,
    priceDiffPercent,
    costs,
    profit,
    assessment,
    sources
  } = result;

  // 格式化货币显示
  const formatCurrency = (value: number, currency: string = 'CNY') => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value).replace('CNY', '¥');
  };

  // 格式化百分比显示
  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // 根据套利等级获取颜色
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // 根据利润正负获取图标和颜色
  const getProfitIndicator = (profitValue: number) => {
    if (profitValue > 0) {
      return {
        icon: TrendingUp,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        text: '盈利'
      };
    } else if (profitValue < 0) {
      return {
        icon: TrendingDown,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        text: '亏损'
      };
    } else {
      return {
        icon: DollarSign,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        text: '持平'
      };
    }
  };

  const profitIndicator = getProfitIndicator(profit.grossProfit);

  return (
    <div className="space-y-6">
      {/* 产品信息摘要 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-medium text-gray-900">{productInfo.nameZh || productInfo.name}</h4>
            <p className="text-sm text-gray-500">
              {productInfo.brandZh || productInfo.brand} • {productInfo.year}年 • {productInfo.model}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getLevelColor(assessment.level)}`}>
            {assessment.level === 'high' ? '高套利机会' : 
             assessment.level === 'medium' ? '中等套利机会' : 
             assessment.level === 'low' ? '低套利机会' : '无套利机会'}
          </div>
        </div>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 价差 */}
        <div className={`p-4 rounded-lg ${priceDifference >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">价差</span>
            {priceDifference >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(Math.abs(priceDifference))}
            </div>
            <div className={`text-sm font-medium ${priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {priceDifference >= 0 ? '+' : ''}{formatPercent(priceDiffPercent)}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <div>国内: {formatCurrency(domesticPrice)}</div>
            <div>国外: {formatCurrency(foreignPriceCny)}</div>
          </div>
        </div>

        {/* 毛利润 */}
        <div className={`p-4 rounded-lg ${profitIndicator.bgColor}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">毛利润</span>
            <profitIndicator.icon className={`h-4 w-4 ${profitIndicator.color}`} />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(profit.grossProfit)}
            </div>
            <div className={`text-sm font-medium ${profitIndicator.color}`}>
              {profit.grossMargin >= 0 ? '+' : ''}{profit.grossMargin.toFixed(1)}% 毛利率
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {profitIndicator.text} • ROI: {profit.roi.toFixed(1)}%
          </div>
        </div>

        {/* 套利评分 */}
        <div className="p-4 rounded-lg bg-blue-50">
          <div className="flex items-center justify-between mb1-2">
            <span className="text-sm font-medium text-gray-700">套利评分</span>
            <Percent className="h-4 w-4 text-blue-600" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">
              {assessment.score.toFixed(0)}/100
            </div>
            <div className="text-sm font-medium text-blue-600">
              置信度: {(assessment.confidence * 100).toFixed(0)}%
            </div>
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${assessment.score}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 利润分析 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">利润分析</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">净利润</dt>
                <dd className="text-sm font-medium text-gray-900">{formatCurrency(profit.netProfit)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">净利率</dt>
                <dd className={`text-sm font-medium ${profit.netMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {profit.netMargin >= 0 ? '+' : ''}{profit.netMargin.toFixed(1)}%
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">盈亏平衡价</dt>
                <dd className="text-sm font-medium text-gray-900">{formatCurrency(profit.breakEvenPrice)}</dd>
              </div>
              {profit.paybackPeriod && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">回本周期</dt>
                  <dd className="text-sm font-medium text-gray-900">{profit.paybackPeriod} 个月</dd>
                </div>
              )}
            </dl>
          </div>
          <div>
            {profit.sensitivity && (
              <div className="text-sm">
                <p className="font-medium text-gray-700 mb-1">敏感性分析</p>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex justify-between">
                    <span>价格变化 ±10%</span>
                    <span>利润变化 {profit.sensitivity.priceSensitivity[0]?.profitChange?.toFixed(1) || 0}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>成本变化 ±10%</span>
                    <span>利润变化 {profit.sensitivity.costSensitivity[0]?.profitChange?.toFixed(1) || 0}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>汇率变化 ±5%</span>
                    <span>利润变化 {profit.sensitivity.exchangeRateSensitivity[0]?.profitChange?.toFixed(1) || 0}%</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 风险评估 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">风险评估与建议</h4>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-700 mb-2">{assessment.opportunity}</p>
            <div className="flex flex-wrap gap-2">
              {assessment.riskFactors.map((risk, index) => (
                <div key={index} className={`px-2 py-1 rounded text-xs ${
                  risk.severity === 'high' ? 'bg-red-100 text-red-800' :
                  risk.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {risk.type === 'price' ? '价格风险' :
                   risk.type === 'currency' ? '汇率风险' :
                   risk.type === 'logistics' ? '物流风险' :
                   risk.type === 'regulatory' ? '政策风险' : '市场风险'} ({risk.severity})
                </div>
              ))}
            </div>
          </div>
          
          {assessment.recommendations.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">建议:</p>
              <ul className="space-y-1">
                {assessment.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 数据源信息 */}
      <div className="text-xs text-gray-500">
        <div className="flex items-center">
          <AlertCircle className="h-3 w-3 mr-1" />
          <span>数据来源: {sources.domesticPriceSource}, {sources.foreignPriceSource}</span>
          <span className="mx-2">•</span>
          <span>更新时间: {new Date(sources.lastUpdated).toLocaleString('zh-CN')}</span>
          <span className="mx-2">•</span>
          <span>数据新鲜度: {sources.dataFreshness === 'fresh' ? '新鲜' : 
                            sources.dataFreshness === 'stale' ? '陈旧' : '过时'}</span>
        </div>
      </div>
    </div>
  );
}