/**
 * 套利榜单计算与缓存服务
 * 负责计算Top N套利产品，管理缓存，并提供榜单数据
 */
import { prisma } from '../db';
import { ArbitrageCalculator } from './arbitrage-calculator';
import type {
  ArbitrageTopItem,
  TopArbitrageResponse,
  TopArbitrageFilters,
  TopArbitrageSummary,
  ArbitrageResult,
} from '../../types/arbitrage';
import type { CurrencyCode } from '../../types/exchange-rates';
import type { Product, Brand, Category, ProductImage, InternationalPrice } from '@prisma/client';
import { DEFAULT_ARBITRAGE_PARAMS, CACHE_CONFIG } from '../../config/arbitrage';

/**
 * 套利榜单计算服务类
 */
export class TopArbitrageService {
  private arbitrageCalculator: ArbitrageCalculator;
  
  /**
   * 构造函数
   */
  constructor() {
    this.arbitrageCalculator = new ArbitrageCalculator();
  }

  /**
   * 计算Top N套利产品（核心算法）
   * @param limit 返回的产品数量限制
   * @param minPriceDiff 最小价差百分比阈值
   * @returns 套利榜单项数组
   */
  async calculateTopProducts(limit: number = 10, minPriceDiff: number = 15): Promise<ArbitrageTopItem[]> {
    try {
      console.log(`开始计算Top ${limit}套利产品，最小价差阈值: ${minPriceDiff}%`);
      
      // 1. 获取活跃且有国际价格的产品
      const products = await this.getProductsWithInternationalPrices(limit * 5); // 获取比limit多的产品用于筛选
      
      if (products.length === 0) {
        console.log('没有找到带有国际价格的产品');
        return [];
      }

      // 2. 计算每个产品的套利结果
      const arbitrageResults: Array<{
        product: Product & {
          brand: Brand;
          category: Category;
          images: ProductImage[];
          internationalPrices: InternationalPrice[];
        };
        result: ArbitrageResult | null;
        score: number;
      }> = [];

      for (const product of products) {
        try {
          // 获取最新国际价格
          const latestInternationalPrice = this.getLatestInternationalPrice(product.internationalPrices);
          
          if (!latestInternationalPrice) {
            continue; // 没有有效国际价格
          }

          // 准备套利计算参数
          const arbitrageParams = {
            productId: product.id,
            domesticPrice: product.priceCny,
            foreignPrice: latestInternationalPrice.priceForeignRaw || latestInternationalPrice.priceForeignCny,
            foreignCurrency: (latestInternationalPrice.currency as CurrencyCode) || 'EUR',
            exchangeRate: latestInternationalPrice.exchangeRate || undefined,
          };

          // 计算套利结果
          const result = await this.arbitrageCalculator.calculateArbitrage(arbitrageParams);
          
          // 检查是否达到最小价差阈值
          if (result.priceDiffPercent < minPriceDiff) {
            continue;
          }

          // 计算套利评分（基于利润率、价差、可信度等因素）
          const score = this.calculateArbitrageScore(result);
          
          arbitrageResults.push({ product, result, score });

        } catch (error) {
          console.error(`产品 ${product.modelName} 套利计算失败:`, error);
          continue;
        }
      }

      // 3. 按绝对毛利额排序（利润高的排前面），取前N个
      const sortedResults = arbitrageResults.sort((a, b) => {
        const profitA = a.result?.profit.grossProfit || 0;
        const profitB = b.result?.profit.grossProfit || 0;
        return profitB - profitA;
      });
      const topResults = sortedResults.slice(0, limit);

      // 4. 转换为榜单项格式
      const topItems: ArbitrageTopItem[] = await Promise.all(
        topResults.map(async (item, index) => {
          const rank = index + 1;
          const { product, result } = item;
          
          // 计算成本利润信息
          const totalCosts = result?.costs.totalAdditional || 0;
          const estimatedProfit = result?.profit.grossProfit || 0;
          const profitMargin = result?.profit.netMargin || 0;
          
          // 获取最新的国际价格来源URL
          const latestPrice = this.getLatestInternationalPrice(product.internationalPrices);
          const foreignSourceUrl = latestPrice?.sourceUrl || undefined;
          
          return {
            rank,
            productId: product.id,
            productName: product.modelName,
            brandName: product.brand.nameZh || product.brand.nameEn,
            year: product.year,
            domesticPrice: product.priceCny,
            foreignPrice: result?.foreignPriceCny || 0,
            priceDiff: result?.priceDifference || 0,
            priceDiffPercent: result?.priceDiffPercent || 0,
            arbitrageLevel: (result?.assessment.level === 'none' ? 'low' : result?.assessment.level) || 'low',
            opportunityScore: Math.round(item.score),
            totalCosts,
            estimatedProfit,
            profitMargin,
            productUrl: `/products/${product.id}`,
            foreignSourceUrl,
            lastCalculated: new Date().toISOString(),
          };
        })
      );

      console.log(`Top ${limit}套利产品计算完成，共找到 ${topItems.length} 个机会`);
      return topItems;

    } catch (error) {
      console.error('Top产品计算失败:', error);
      throw new Error(`Top产品计算失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 刷新套利榜单缓存
   * @returns Promise<void>
   */
  async refreshCache(): Promise<void> {
    try {
      console.log('开始刷新套利榜单缓存...');
      
      // 1. 计算新的Top产品
      const topProducts = await this.calculateTopProducts(20, DEFAULT_ARBITRAGE_PARAMS.minPriceDiffPercentage);
      
      // 2. 删除旧缓存
      await prisma.arbitrageTopCache.deleteMany({});
      
      // 3. 创建新缓存
      const cachePromises = topProducts.map(async (product, index) => {
        try {
          return await prisma.arbitrageTopCache.create({
            data: {
              productId: product.productId,
              rank: product.rank,
              domesticPrice: product.domesticPrice,
              foreignPrice: product.foreignPrice,
              priceDiff: product.priceDiff,
              priceDiffPercent: product.priceDiffPercent,
              profitMargin: product.profitMargin,
              lastCalculated: new Date(),
              validUntil: new Date(Date.now() + CACHE_CONFIG.topListTtl * 1000),
            },
          });
        } catch (error) {
          console.error(`缓存产品 ${product.productId} 失败:`, error);
          return null;
        }
      });

      const cacheResults = await Promise.all(cachePromises);
      const successfulCaches = cacheResults.filter(result => result !== null);
      
      console.log(`缓存刷新完成，成功缓存 ${successfulCaches.length} 个产品`);
      
    } catch (error) {
      console.error('缓存刷新失败:', error);
      throw new Error(`缓存刷新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取缓存的Top套利榜单
   * @param limit 返回的产品数量限制
   * @returns 缓存的套利榜单项数组
   */
  async getCachedTop(limit: number = 10): Promise<ArbitrageTopItem[]> {
    try {
      const now = new Date();
      
      // 1. 获取未过期的缓存
      const cachedItems = await prisma.arbitrageTopCache.findMany({
        where: {
          validUntil: {
            gt: now,
          },
        },
        orderBy: {
          rank: 'asc',
        },
        take: limit,
        include: {
          product: {
            include: {
              brand: true,
              category: true,
              images: {
                orderBy: { sortOrder: "asc" as const },
                take: 1,
              },
            },
          },
        },
      });

      // 2. 转换为榜单项格式
      const topItems: ArbitrageTopItem[] = cachedItems.map(cachedItem => {
        const product = cachedItem.product;
        const primaryImage = product.images?.[0];
        
        return {
          rank: cachedItem.rank,
          productId: product.id,
          productName: product.modelName,
          brandName: product.brand.nameZh || product.brand.nameEn,
          year: product.year,
          domesticPrice: cachedItem.domesticPrice,
          foreignPrice: cachedItem.foreignPrice,
          priceDiff: cachedItem.priceDiff,
          priceDiffPercent: cachedItem.priceDiffPercent,
          arbitrageLevel: this.determineArbitrageLevel(cachedItem.priceDiffPercent, cachedItem.profitMargin ?? undefined),
          opportunityScore: this.calculateOpportunityScore(cachedItem.priceDiffPercent, cachedItem.profitMargin ?? undefined),
          totalCosts: this.estimateTotalCosts(cachedItem.domesticPrice, cachedItem.foreignPrice),
          estimatedProfit: this.estimateProfit(cachedItem.domesticPrice, cachedItem.foreignPrice, cachedItem.priceDiffPercent),
          profitMargin: cachedItem.profitMargin || 0,
          productUrl: `/products/${product.id}`,
          lastCalculated: cachedItem.lastCalculated.toISOString(),
          cacheExpiresAt: cachedItem.validUntil.toISOString(),
        };
      });

      // 3. 如果缓存不足，返回空数组（调用者可以选择触发重新计算）
      if (topItems.length === 0) {
        console.log('无有效缓存，需要重新计算');
        return [];
      }

      console.log(`从缓存获取Top ${topItems.length}个套利产品`);
      return topItems;

    } catch (error) {
      console.error('获取缓存失败:', error);
      throw new Error(`获取缓存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取套利榜单（带筛选条件）
   * @param filters 筛选条件
   * @returns 带摘要的套利榜单响应
   */
  async getTopArbitrage(filters: TopArbitrageFilters = {}): Promise<TopArbitrageResponse> {
    try {
      const { limit = 10, minPriceDiff, sortBy = 'priceDiff', includeDetails = false } = filters;
      
      // 1. 获取数据（优先使用缓存）
      let topItems: ArbitrageTopItem[];
      
      const cachedItems = await this.getCachedTop(limit);
      if (cachedItems.length >= limit) {
        console.log(`使用缓存数据，数量: ${cachedItems.length}`);
        topItems = cachedItems;
      } else {
        console.log('缓存不足，重新计算...');
        const minDiff = minPriceDiff || DEFAULT_ARBITRAGE_PARAMS.minPriceDiffPercentage;
        topItems = await this.calculateTopProducts(limit, minDiff);
        
        // 更新缓存（异步，不阻塞返回）
        this.refreshCache().catch(err => console.error('异步缓存更新失败:', err));
      }

      // 2. 应用筛选条件
      let filteredItems = topItems;
      
      if (minPriceDiff !== undefined) {
        filteredItems = filteredItems.filter(item => item.priceDiffPercent >= minPriceDiff);
      }
      
      // 3. 应用排序
      if (sortBy === 'priceDiff') {
        filteredItems.sort((a, b) => b.priceDiffPercent - a.priceDiffPercent);
      } else if (sortBy === 'profitMargin') {
        filteredItems.sort((a, b) => (b.profitMargin || 0) - (a.profitMargin || 0));
      } else if (sortBy === 'totalSaving') {
        filteredItems.sort((a, b) => b.priceDiff - a.priceDiff);
      }

      // 限制返回数量
      filteredItems = filteredItems.slice(0, limit);

      // 4. 计算摘要
      const summary = this.calculateSummary(filteredItems);

      // 5. 构建响应
      return {
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          products: filteredItems,
          summary,
          filters: includeDetails ? filters : undefined,
        },
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error('获取套利榜单失败:', error);
      return {
        success: false,
        error: `获取套利榜单失败: ${error instanceof Error ? error.message : '未知错误'}`,
        code: 'TOP_ARBITRAGE_ERROR',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 检查缓存状态
   * @returns 缓存状态信息
   */
  async checkCacheStatus(): Promise<{
    hasCache: boolean;
    cacheSize: number;
    cacheFreshness: number; // 缓存新鲜度（秒）
    needsRefresh: boolean;
  }> {
    try {
      const now = new Date();
      
      // 获取有效缓存数量
      const validCacheCount = await prisma.arbitrageTopCache.count({
        where: {
          validUntil: {
            gt: now,
          },
        },
      });

      // 获取最新缓存时间
      const latestCache = await prisma.arbitrageTopCache.findFirst({
        orderBy: {
          lastCalculated: 'desc',
        },
        select: {
          lastCalculated: true,
        },
      });

      const cacheFreshness = latestCache 
        ? (now.getTime() - latestCache.lastCalculated.getTime()) / 1000
        : Infinity;

      const needsRefresh = validCacheCount === 0 || cacheFreshness > CACHE_CONFIG.topListTtl * 0.5;

      return {
        hasCache: validCacheCount > 0,
        cacheSize: validCacheCount,
        cacheFreshness,
        needsRefresh,
      };

    } catch (error) {
      console.error('检查缓存状态失败:', error);
      throw new Error(`检查缓存状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取带有国际价格的产品
   * @param limit 限制数量
   * @returns 产品列表
   */
  private async getProductsWithInternationalPrices(limit: number) {
    return prisma.product.findMany({
      where: {
        status: 'active',
        internationalPrices: {
          some: {
            isActive: true,
            confidenceScore: {
              gte: 0.5,
            },
          },
        },
      },
      include: {
        brand: true,
        category: true,
        images: {
          orderBy: { sortOrder: "asc" as const },
          take: 1,
        },
        internationalPrices: {
          where: {
            isActive: true,
          },
          orderBy: {
            sourceDate: 'desc',
          },
          take: 1, // 只获取最新的国际价格
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * 获取最新的国际价格
   * @param internationalPrices 国际价格数组
   * @returns 最新的国际价格或null
   */
  private getLatestInternationalPrice(internationalPrices: InternationalPrice[]): InternationalPrice | null {
    if (!internationalPrices || internationalPrices.length === 0) {
      return null;
    }
    
    // 按sourceDate降序排序，取最新的
    const sortedPrices = [...internationalPrices].sort((a, b) => {
      const dateA = a.sourceDate ? new Date(a.sourceDate).getTime() : 0;
      const dateB = b.sourceDate ? new Date(b.sourceDate).getTime() : 0;
      return dateB - dateA;
    });
    
    return sortedPrices[0];
  }

  /**
   * 计算套利评分（0-100）
   * @param result 套利计算结果
   * @returns 评分
   */
  private calculateArbitrageScore(result: ArbitrageResult): number {
    try {
      const { profit, priceDiffPercent, assessment } = result;
      
      // 基础评分：利润率占比40%，价差占比40%，风险评估占比20%
      let score = 0;
      
      // 利润率评分（0-40分）
      const profitMarginScore = Math.min(profit.netMargin * 2, 40); // 利润率20%得满分40分
      score += profitMarginScore;
      
      // 价差百分比评分（0-40分）
      const priceDiffScore = Math.min(priceDiffPercent / 2, 40); // 价差80%得满分40分
      score += priceDiffScore;
      
      // 风险评估评分（0-20分）
      let riskScore = 20;
      if (assessment.riskFactors && assessment.riskFactors.length > 0) {
        const highRiskCount = assessment.riskFactors.filter(r => r.severity === 'high').length;
        const mediumRiskCount = assessment.riskFactors.filter(r => r.severity === 'medium').length;
        
        riskScore -= highRiskCount * 10; // 每个高风险-10分
        riskScore -= mediumRiskCount * 5; // 每个中风险-5分
        riskScore = Math.max(0, riskScore);
      }
      score += riskScore;
      
      // 应用置信度调整
      score *= assessment.confidence;
      
      return Math.min(Math.max(Math.round(score), 0), 100);
      
    } catch (error) {
      console.error('套利评分计算失败:', error);
      return 50; // 默认评分
    }
  }

  /**
   * 确定套利等级
   * @param priceDiffPercent 价差百分比
   * @param profitMargin 利润率
   * @returns 套利等级
   */
  private determineArbitrageLevel(priceDiffPercent: number, profitMargin?: number): 'high' | 'medium' | 'low' {
    const margin = profitMargin || 0;
    
    if (priceDiffPercent >= 30 && margin >= 20) {
      return 'high';
    } else if (priceDiffPercent >= 20 && margin >= 10) {
      return 'medium';
    } else if (priceDiffPercent >= 10 && margin >= 5) {
      return 'low';
    } else {
      return 'low'; // 默认
    }
  }

  /**
   * 计算机会评分
   * @param priceDiffPercent 价差百分比
   * @param profitMargin 利润率
   * @returns 机会评分（0-100）
   */
  private calculateOpportunityScore(priceDiffPercent: number, profitMargin?: number): number {
    const margin = profitMargin || 0;
    
    // 简单加权平均：价差占60%，利润率占40%
    const priceScore = Math.min(priceDiffPercent * 2, 100); // 价差50%得满分
    const marginScore = Math.min(margin * 5, 100); // 利润率20%得满分
    
    const score = (priceScore * 0.6) + (marginScore * 0.4);
    return Math.min(Math.max(Math.round(score), 0), 100);
  }

  /**
   * 估算总成本
   * @param domesticPrice 国内价格
   * @param foreignPrice 国外价格
   * @returns 估算的总成本
   */
  private estimateTotalCosts(domesticPrice: number, foreignPrice: number): number {
    // 简化的成本估算：运输成本12%，关税8%，保险2%，其他成本5%（均按国外价格百分比）
    const shippingCost = foreignPrice * DEFAULT_ARBITRAGE_PARAMS.shippingCostPercentage;
    const importTax = foreignPrice * DEFAULT_ARBITRAGE_PARAMS.importTaxRate;
    const insurance = foreignPrice * DEFAULT_ARBITRAGE_PARAMS.insuranceRate;
    const other = foreignPrice * DEFAULT_ARBITRAGE_PARAMS.otherCostsRate;
    
    return shippingCost + importTax + insurance + other;
  }

  /**
   * 估算利润
   * @param domesticPrice 国内价格
   * @param foreignPrice 国外价格
   * @param priceDiffPercent 价差百分比
   * @returns 估算的利润
   */
  private estimateProfit(domesticPrice: number, foreignPrice: number, priceDiffPercent: number): number {
    const priceDiff = foreignPrice - domesticPrice;
    const totalCosts = this.estimateTotalCosts(domesticPrice, foreignPrice);
    
    return Math.max(0, priceDiff - totalCosts);
  }

  /**
   * 计算榜单摘要
   * @param items 榜单项数组
   * @returns 摘要信息
   */
  private calculateSummary(items: ArbitrageTopItem[]): TopArbitrageSummary {
    if (items.length === 0) {
      return {
        totalProducts: 0,
        averagePriceDiff: 0,
        maxPriceDiff: 0,
        minPriceDiff: 0,
        highOpportunityCount: 0,
        mediumOpportunityCount: 0,
        lowOpportunityCount: 0,
        totalEstimatedProfit: 0,
        averageProfitMargin: 0,
      };
    }

    const priceDiffs = items.map(item => item.priceDiffPercent);
    const profitMargins = items.filter(item => item.profitMargin !== undefined).map(item => item.profitMargin!);
    const estimatedProfits = items.filter(item => item.estimatedProfit !== undefined).map(item => item.estimatedProfit!);
    
    const averagePriceDiff = priceDiffs.reduce((sum, diff) => sum + diff, 0) / priceDiffs.length;
    const maxPriceDiff = Math.max(...priceDiffs);
    const minPriceDiff = Math.min(...priceDiffs);
    
    const highOpportunityCount = items.filter(item => item.arbitrageLevel === 'high').length;
    const mediumOpportunityCount = items.filter(item => item.arbitrageLevel === 'medium').length;
    const lowOpportunityCount = items.filter(item => item.arbitrageLevel === 'low').length;
    
    const totalEstimatedProfit = estimatedProfits.reduce((sum, profit) => sum + profit, 0);
    const averageProfitMargin = profitMargins.length > 0 
      ? profitMargins.reduce((sum, margin) => sum + margin, 0) / profitMargins.length
      : 0;

    return {
      totalProducts: items.length,
      averagePriceDiff: Math.round(averagePriceDiff * 100) / 100,
      maxPriceDiff: Math.round(maxPriceDiff * 100) / 100,
      minPriceDiff: Math.round(minPriceDiff * 100) / 100,
      highOpportunityCount,
      mediumOpportunityCount,
      lowOpportunityCount,
      totalEstimatedProfit: Math.round(totalEstimatedProfit),
      averageProfitMargin: Math.round(averageProfitMargin * 100) / 100,
    };
  }
}

// 导出单例实例
export const topArbitrageService = new TopArbitrageService();

// 导出类供测试和特殊用途使用
export default TopArbitrageService;