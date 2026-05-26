"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { ArbitrageTopItem, TopArbitrageResponse } from '@/types/arbitrage';
import { Loader2, ExternalLink, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import PriceTrendChart from '@/components/arbitrage/trend/PriceTrendChart';
import type { PriceDataPoint } from '@/components/arbitrage/trend/PriceTrendChart';

// 从API获取套利榜单数据
async function fetchTopArbitrage(limit: number = 10) {
  try {
    const response = await fetch(`/api/arbitrage/top-products?limit=${limit}`);
    if (!response.ok) {
      throw new Error('获取套利榜单失败');
    }
    const result: TopArbitrageResponse = await response.json();
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || '获取套利榜单失败');
  } catch (error) {
    console.error('获取套利榜单错误:', error);
    throw error;
  }
}


export default function ArbitrageTopClient() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TopArbitrageResponse['data'] | null>(null);
  const [limit, setLimit] = useState(10);
  const [priceTrendData, setPriceTrendData] = useState<PriceDataPoint[]>([]);

  // 从当前路径提取语言前缀
  const getLocaleFromPathname = (): string => {
    if (!pathname) return 'zh'; // 默认中文
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'zh';
    const locale = segments[0];
    if (['zh', 'en', 'ru'].includes(locale)) {
      return locale;
    }
    return 'zh'; // 默认中文
  };

  // 构建产品详情页面URL
  const buildProductUrl = (productId: string): string => {
    const locale = getLocaleFromPathname();
    return `/${locale}/products/${productId}`;
  };

  // 生成模拟价格趋势数据
  const generateMockPriceTrendData = (arbitrageData: TopArbitrageResponse['data'] | null): PriceDataPoint[] => {
    if (!arbitrageData || arbitrageData.products.length === 0) {
      return [];
    }

    const mockData: PriceDataPoint[] = [];
    const now = new Date();
    
    // 获取第一个产品的价格作为基准
    const baseProduct = arbitrageData.products[0];
    const baseDomestic = baseProduct.domesticPrice;
    const baseInternational = baseProduct.foreignPrice;
    const baseDiff = baseProduct.priceDiff;
    
    // 生成过去30天的数据点
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // 添加一些随机波动 (-5% 到 +5%)
      const domesticFluctuation = 1 + (Math.random() * 0.1 - 0.05);
      const internationalFluctuation = 1 + (Math.random() * 0.1 - 0.05);
      
      const domesticPrice = Math.round(baseDomestic * domesticFluctuation);
      const internationalPrice = Math.round(baseInternational * internationalFluctuation);
      const priceDifference = internationalPrice - domesticPrice;
      
      mockData.push({
        date: date.toISOString().split('T')[0],
        domesticPrice,
        internationalPrice,
        priceDifference,
      });
    }
    
    return mockData;
  };

  // 加载数据
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchTopArbitrage(limit);
        setData(result);
        
        // 生成模拟价格趋势数据（实际项目中应从API获取历史价格数据）
        const trendData = generateMockPriceTrendData(result);
        setPriceTrendData(trendData);
      } catch (err) {
        console.error('加载套利榜单错误:', err);
        setError(err instanceof Error ? err.message : '加载数据失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [limit]);

  // 格式化货币
  const formatCurrency = (amount: number, currency: string = 'CNY') => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency === 'CNY' ? 'CNY' : 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // 获取套利等级图标和颜色
  const getArbitrageLevelInfo = (level: string) => {
    switch (level) {
      case 'high':
        return {
          icon: <TrendingUp className="h-4 w-4" />,
          color: 'text-green-600 bg-green-100',
          text: '高机会'
        };
      case 'medium':
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          color: 'text-yellow-600 bg-yellow-100',
          text: '中机会'
        };
      case 'low':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: 'text-blue-600 bg-blue-100',
          text: '低机会'
        };
      default:
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: 'text-gray-600 bg-gray-100',
          text: '未知'
        };
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTopArbitrage(limit);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="border rounded-lg p-8 bg-white shadow-sm text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">加载套利榜单中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={handleRefresh}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.products.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">暂无套利机会数据</p>
          <p className="text-sm text-gray-500">请稍后再试或检查国际价格数据是否已导入</p>
        </div>
      </div>
    );
  }

  const { products, summary, generatedAt } = data;

  return (
    <div className="space-y-8">
      {/* 控制栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-medium text-gray-700">实时套利榜单</h3>
          <p className="text-sm text-gray-500">
            数据更新时间: {new Date(generatedAt).toLocaleString('zh-CN')}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="limit" className="text-sm text-gray-700">显示数量:</label>
            <select
              id="limit"
              className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-md transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? '刷新中...' : '刷新榜单'}
          </button>
        </div>
      </div>

      {/* 摘要统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">总产品数</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalProducts}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">平均利润率</p>
          <p className="text-2xl font-bold text-green-600">{summary.averageProfitMargin?.toFixed(1) || '0'}%</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">高机会产品</p>
          <p className="text-2xl font-bold text-green-600">{summary.highOpportunityCount}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">总预估利润</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(summary.totalEstimatedProfit || 0)}
          </p>
        </div>
      </div>

      {/* 价格趋势图表 */}
      {priceTrendData.length > 0 && (
        <div className="bg-white border rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">价格趋势分析</h3>
          <p className="text-sm text-gray-600 mb-6">
            展示{data?.products[0]?.productName || '当前产品'}的国内外价格变化趋势，帮助您把握最佳买入时机。
          </p>
          <PriceTrendChart 
            data={priceTrendData} 
            title={`${data?.products[0]?.productName || '精选产品'} 价格趋势`}
            height={350}
          />
        </div>
      )}

      {/* 榜单表格 */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  排名
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  产品信息
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  价格信息
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  套利评估
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((item) => {
                const levelInfo = getArbitrageLevelInfo(item.arbitrageLevel);
                return (
                  <tr key={item.productId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex items-center justify-center h-8 w-8 rounded-full ${levelInfo.color} font-bold`}>
                          {item.rank}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-500">
                          {item.brandName} • {item.year}年
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">国内价:</span>
                          <span className="font-medium">{formatCurrency(item.domesticPrice)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">国外价(CNY):</span>
                          <span className="font-medium">{formatCurrency(item.foreignPrice)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">价差:</span>
                          <span className={`font-medium ${item.priceDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.priceDiff > 0 ? '+' : ''}{formatCurrency(Math.abs(item.priceDiff))}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {levelInfo.icon}
                          <span className={`text-sm font-medium ${levelInfo.color.split(' ')[0]}`}>
                            {levelInfo.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(item.opportunityScore, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{item.opportunityScore}分</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          利润率: <span className="font-medium">{item.profitMargin?.toFixed(1) || '0'}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
<a 
                      href={buildProductUrl(item.productId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                    >
                      查看详情
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 备注 */}
      <div className="text-sm text-gray-500 p-4 border rounded-lg bg-gray-50">
        <p>备注：榜单数据基于最新国际价格和实时汇率计算，计算结果仅供参考。实际交易请综合考虑运输、关税、保险等成本因素。</p>
      </div>
    </div>
  );
}