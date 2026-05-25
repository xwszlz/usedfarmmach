/**
 * 套利计算核心引擎
 */
import { prisma } from '../db';
import { exchangeRateService } from './exchange-rate-service';
import type {
  ArbitrageCalculatorParams,
  ArbitrageResult,
  CostBreakdown,
  ProfitAnalysis,
  ArbitrageAssessment,
  RiskFactor,
  ProductBasicInfo,
  DataSourceInfo,
  CalculationMetadata,
  ArbitrageError,
  ScenarioVariation,
  ScenarioResult,
} from '../../types/arbitrage';
import {
  calculatePriceDifference,
  calculateCostBreakdown,
  calculateTotalCost,
  calculateProfitMargin,
  calculateBreakEvenPrice,
  calculateROI,
  assessArbitrageLevel,
  calculateArbitrageScore,
  shouldDisplayAsArbitrageOpportunity,
  roundToTwoDecimal,
} from '../arbitrage/calculations';
import {
  DEFAULT_SHIPPING_RATE,
  DEFAULT_IMPORT_TAX_RATE,
  DEFAULT_INSURANCE_RATE,
  DEFAULT_OTHER_COSTS,
  MIN_PROFIT_MARGIN_THRESHOLD,
} from '../arbitrage/formulas';
import {
  validateArbitrageParams,
  validateArbitrageResult,
} from '../arbitrage/validation';
import { DEFAULT_ARBITRAGE_PARAMS } from '../../config/arbitrage';

/**
 * 套利计算器类
 */
export class ArbitrageCalculator {
  /**
   * 计算套利结果
   */
  async calculateArbitrage(params: ArbitrageCalculatorParams): Promise<ArbitrageResult> {
    try {
      // 验证输入参数
      const validation = validateArbitrageParams(params);
      if (!validation.isValid) {
        throw new Error(`参数验证失败: ${validation.errors.join(', ')}`);
      }

      // 获取产品信息
      const productInfo = await this.getProductInfo(params.productId);
      
      // 获取国内价格（优先使用传入值，否则用数据库值）
      const domesticPrice = params.domesticPrice ?? productInfo.priceCny;
      
      // 获取国外价格信息
      const {
        foreignPrice,
        foreignCurrency,
        foreignPriceCny,
        exchangeRateUsed,
        foreignPriceSource,
      } = await this.getForeignPriceInfo(params, productInfo.id);

      // 获取汇率（优先使用传入值，否则获取最新汇率）
      const exchangeRate = params.exchangeRate ?? exchangeRateUsed;

      // 计算价格差异
      const priceDiffResult = calculatePriceDifference(domesticPrice, foreignPriceCny);
      
      // 计算成本分解
      const costBreakdown = this.calculateCostBreakdownInternal({
        foreignPriceCny,
        shippingCost: params.shippingCost,
        shippingCostPercentage: params.shippingCostPercentage,
        importTaxRate: params.importTaxRate,
        insuranceRate: params.insuranceRate,
        otherCosts: params.otherCosts,
      });

      // 计算利润分析
      const profitAnalysis = this.calculateProfitAnalysis(
        priceDiffResult.diff,
        costBreakdown.totalAdditional,
        domesticPrice,
        foreignPriceCny
      );

      // 评估套利机会
      const assessment = this.assessArbitrageOpportunityInternal(
        profitAnalysis.netMargin,
        priceDiffResult.percent,
        domesticPrice,
        foreignPriceCny,
        costBreakdown
      );

      // 构建数据源信息
      const sources = this.buildDataSourceInfo(
        domesticPrice,
        foreignPriceSource,
        exchangeRate !== params.exchangeRate ? 'exchange-rate-api' : 'user-input'
      );

      // 构建结果
      const result: ArbitrageResult = {
        productInfo: {
          id: productInfo.id,
          name: productInfo.modelName,
          nameZh: productInfo.modelName,
          brand: productInfo.brand?.nameEn || '',
          brandZh: productInfo.brand?.nameZh || '',
          model: productInfo.modelName,
          year: productInfo.year,
          category: productInfo.category?.nameZh || '',
          workingHours: productInfo.workingHours || undefined,
          condition: productInfo.condition,
          location: productInfo.location,
          productUrl: `/products/${productInfo.id}`,
          imageUrl: productInfo.images?.[0]?.url,
        },
        domesticPrice: roundToTwoDecimal(domesticPrice),
        foreignPrice: roundToTwoDecimal(foreignPrice),
        foreignPriceCny: roundToTwoDecimal(foreignPriceCny),
        priceDifference: roundToTwoDecimal(priceDiffResult.diff),
        priceDiffPercent: roundToTwoDecimal(priceDiffResult.percent),
        costs: costBreakdown,
        profit: profitAnalysis,
        assessment,
        sources,
        metadata: {
          calculatedAt: new Date().toISOString(),
          calculationId: `calc-${Date.now()}-${productInfo.id}`,
          version: '1.0',
          assumptions: [
            '运输成本基于默认百分比或用户输入值',
            '关税基于默认税率或用户输入值',
            '保险基于默认费率或用户输入值',
            '其他成本为固定值或用户输入值',
          ],
          limitations: [
            '未考虑汇率波动风险',
            '未考虑运输时间导致的资金占用成本',
            '未考虑市场供需变化',
            '未考虑政策变化风险',
          ],
        },
      };

      // 验证结果
      const resultValidation = validateArbitrageResult(result);
      if (!resultValidation.isValid) {
        throw new Error(`计算结果验证失败: ${resultValidation.errors.join(', ')}`);
      }

      return result;
    } catch (error) {
      console.error('套利计算失败:', error);
      throw error;
    }
  }

  /**
   * 计算成本分解
   */
  calculateBreakdown(params: ArbitrageCalculatorParams): CostBreakdown {
    // 简化的成本分解计算，不依赖产品信息
    const foreignPriceCny = params.foreignPrice || 0;
    const exchangeRate = params.exchangeRate || 1;
    
    // 如果传入了国外价格和货币，需要转换
    let actualForeignPriceCny = foreignPriceCny;
    if (params.foreignCurrency && params.foreignCurrency !== 'CNY' && params.foreignPrice) {
      // 注意：这里简化处理，实际应该调用汇率服务
      actualForeignPriceCny = params.foreignPrice * exchangeRate;
    }

    return calculateCostBreakdown({
      foreignPriceCny: actualForeignPriceCny,
      shippingCost: params.shippingCost,
      shippingCostPercentage: params.shippingCostPercentage,
      importTaxRate: params.importTaxRate,
      insuranceRate: params.insuranceRate,
      otherCosts: params.otherCosts,
    });
  }

  /**
   * 模拟不同场景
   */
  async simulateScenarios(
    baseParams: ArbitrageCalculatorParams,
    variations: ScenarioVariation[]
  ): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = [];

    for (const variation of variations) {
      try {
        // 创建当前场景的参数
        const scenarioParams: ArbitrageCalculatorParams = {
          ...baseParams,
          ...variation.parameters,
        };

        // 计算套利结果
        const result = await this.calculateArbitrage(scenarioParams);

        results.push({
          scenarioName: variation.name,
          description: variation.description,
          parameters: variation.parameters,
          result,
          comparison: this.compareWithBaseScenario(result, variation.baseValue),
        });
      } catch (error) {
        console.error(`场景模拟失败: ${variation.name}`, error);
        // 跳过失败的场景，仅记录错误
      }
    }

    return results;
  }

  /**
   * 评估套利机会
   */
  assessArbitrageOpportunity(result: ArbitrageResult): ArbitrageAssessment {
    return this.assessArbitrageOpportunityInternal(
      result.profit.netMargin,
      result.priceDiffPercent,
      result.domesticPrice,
      result.foreignPriceCny,
      result.costs
    );
  }

  /**
   * 内部方法：获取产品信息
   */
  private async getProductInfo(productId: string): Promise<any> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
        category: true,
        images: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new Error(`产品不存在: ${productId}`);
    }

    return product;
  }

  /**
   * 内部方法：获取国外价格信息
   */
  private async getForeignPriceInfo(
    params: ArbitrageCalculatorParams,
    productId: string
  ): Promise<{
    foreignPrice: number;
    foreignCurrency: string;
    foreignPriceCny: number;
    exchangeRateUsed: number;
    foreignPriceSource: string;
  }> {
    // 如果用户提供了国外价格，优先使用
    if (params.foreignPrice !== undefined) {
      const foreignCurrency = params.foreignCurrency || 'USD';
      let exchangeRateUsed = params.exchangeRate;
      
      // 如果需要汇率转换且未提供汇率，则获取最新汇率
      if (foreignCurrency !== 'CNY' && !exchangeRateUsed) {
        const rate = await exchangeRateService.getLatestRate('CNY', foreignCurrency as any);
        exchangeRateUsed = rate.rate;
      } else if (!exchangeRateUsed) {
        exchangeRateUsed = 1;
      }

      const foreignPriceCny = params.foreignPrice * exchangeRateUsed;

      return {
        foreignPrice: params.foreignPrice,
        foreignCurrency,
        foreignPriceCny,
        exchangeRateUsed,
        foreignPriceSource: 'user-input',
      };
    }

    // 否则从数据库获取最新的国际价格
    const latestPrice = await prisma.internationalPrice.findFirst({
      where: {
        productId,
        isActive: true,
      },
      orderBy: {
        sourceDate: 'desc',
      },
    });

    if (!latestPrice) {
      throw new Error(`产品没有可用的国际价格数据: ${productId}`);
    }

    // 使用数据库中的汇率或获取最新汇率
    const foreignCurrency = latestPrice.currency;
    let exchangeRateUsed = latestPrice.exchangeRate;
    
    if (!exchangeRateUsed || foreignCurrency !== 'CNY') {
      const rate = await exchangeRateService.getLatestRate('CNY', foreignCurrency as any);
      exchangeRateUsed = rate.rate;
    }

    const foreignPriceCny = latestPrice.priceForeignCny;

    return {
      foreignPrice: latestPrice.priceForeignRaw || latestPrice.priceForeignCny / (exchangeRateUsed || 1),
      foreignCurrency,
      foreignPriceCny,
      exchangeRateUsed: exchangeRateUsed || 1,
      foreignPriceSource: latestPrice.source,
    };
  }

  /**
   * 内部方法：计算成本分解
   */
  private calculateCostBreakdownInternal(params: {
    foreignPriceCny: number;
    shippingCost?: number;
    shippingCostPercentage?: number;
    importTaxRate?: number;
    insuranceRate?: number;
    otherCosts?: number;
  }): CostBreakdown {
    return calculateCostBreakdown({
      foreignPriceCny: params.foreignPriceCny,
      shippingCost: params.shippingCost,
      shippingCostPercentage: params.shippingCostPercentage ?? DEFAULT_SHIPPING_RATE,
      importTaxRate: params.importTaxRate ?? DEFAULT_IMPORT_TAX_RATE,
      insuranceRate: params.insuranceRate ?? DEFAULT_INSURANCE_RATE,
      otherCosts: params.otherCosts ?? DEFAULT_OTHER_COSTS,
    });
  }

  /**
   * 内部方法：计算利润分析
   */
  private calculateProfitAnalysis(
    priceDiff: number,
    totalCost: number,
    domesticPrice: number,
    foreignPriceCny: number
  ): ProfitAnalysis {
    // 毛利润 = 价差 - 总成本
    const grossProfit = priceDiff - totalCost;
    
    // 毛利率 = 毛利润 / 国内价格
    const grossMargin = domesticPrice > 0 ? grossProfit / domesticPrice : 0;
    
    // 净利润（考虑交易成本等，这里简化为毛利润的90%）
    const netProfit = grossProfit * 0.9;
    const netMargin = domesticPrice > 0 ? netProfit / domesticPrice : 0;
    
    // 盈亏平衡价格
    const breakEvenPrice = calculateBreakEvenPrice(foreignPriceCny, totalCost);
    
    // 投资回报率
    const totalInvestment = foreignPriceCny + totalCost;
    const roi = calculateROI(netProfit, totalInvestment);

    return {
      grossProfit: roundToTwoDecimal(grossProfit),
      grossMargin: roundToTwoDecimal(grossMargin),
      netProfit: roundToTwoDecimal(netProfit),
      netMargin: roundToTwoDecimal(netMargin),
      breakEvenPrice: roundToTwoDecimal(breakEvenPrice),
      roi: roundToTwoDecimal(roi),
      paybackPeriod: grossProfit > 0 ? Math.ceil(totalInvestment / grossProfit) : undefined,
    };
  }

  /**
   * 内部方法：评估套利机会
   */
  private assessArbitrageOpportunityInternal(
    profitMargin: number,
    priceDiffPercent: number,
    domesticPrice: number,
    foreignPriceCny: number,
    costs: CostBreakdown
  ): ArbitrageAssessment {
    // 确定套利等级
    const level = assessArbitrageLevel(profitMargin);
    
    // 识别风险因素
    const riskFactors = this.identifyRiskFactors(costs, priceDiffPercent);
    
    // 计算综合评分
    const score = calculateArbitrageScore(
      profitMargin,
      priceDiffPercent,
      riskFactors,
      0.7 // 默认市场需求评分
    );
    
    // 生成机会描述
    const opportunity = this.generateOpportunityDescription(level, profitMargin, priceDiffPercent);
    
    // 生成建议
    const recommendations = this.generateRecommendations(level, riskFactors);

    return {
      level,
      score: Math.round(score),
      opportunity,
      riskFactors,
      recommendations,
      confidence: 0.8, // 默认置信度
    };
  }

  /**
   * 内部方法：识别风险因素
   */
  private identifyRiskFactors(costs: CostBreakdown, priceDiffPercent: number): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];
    const { highShippingCostThreshold, highTaxRateThreshold, priceVolatilityThreshold } = DEFAULT_ARBITRAGE_PARAMS.riskFactors;

    // 检查运输成本风险
    const shippingCostRatio = costs.shipping / (costs.totalAdditional || 1);
    if (shippingCostRatio > highShippingCostThreshold) {
      riskFactors.push({
        type: 'logistics',
        severity: shippingCostRatio > 0.2 ? 'high' : 'medium',
        description: `运输成本占比过高 (${(shippingCostRatio * 100).toFixed(1)}%)`,
        mitigation: '考虑寻找更便宜的运输方案或批量运输',
      });
    }

    // 检查关税风险
    const taxRatio = costs.importTax / (costs.totalAdditional || 1);
    if (taxRatio > highTaxRateThreshold) {
      riskFactors.push({
        type: 'regulatory',
        severity: taxRatio > 0.15 ? 'high' : 'medium',
        description: `关税占比过高 (${(taxRatio * 100).toFixed(1)}%)`,
        mitigation: '了解目标国关税政策变化，考虑关税优惠方案',
      });
    }

    // 检查价格波动风险
    if (priceDiffPercent > priceVolatilityThreshold * 100) {
      riskFactors.push({
        type: 'price',
        severity: 'medium',
        description: `价格差异较大 (${priceDiffPercent.toFixed(1)}%)，可能存在价格波动风险`,
        mitigation: '密切关注市场价格变化，设定止损点',
      });
    }

    // 检查其他成本风险
    if (costs.other > DEFAULT_OTHER_COSTS * 2) {
      riskFactors.push({
        type: 'logistics',
        severity: 'low',
        description: '其他杂费较高',
        mitigation: '详细核算各项杂费，寻找降低成本的机会',
      });
    }

    return riskFactors;
  }

  /**
   * 内部方法：生成机会描述
   */
  private generateOpportunityDescription(
    level: 'high' | 'medium' | 'low' | 'none',
    profitMargin: number,
    priceDiffPercent: number
  ): string {
    const profitPercent = (profitMargin * 100).toFixed(1);
    const priceDiff = priceDiffPercent.toFixed(1);

    switch (level) {
      case 'high':
        return `高套利机会：预估利润率 ${profitPercent}%，价差 ${priceDiff}%，利润空间可观`;
      case 'medium':
        return `中等套利机会：预估利润率 ${profitPercent}%，价差 ${priceDiff}%，需仔细评估风险`;
      case 'low':
        return `低套利机会：预估利润率 ${profitPercent}%，价差 ${priceDiff}%，利润空间有限`;
      default:
        return `无套利机会：利润率 ${profitPercent}% 低于阈值 ${(MIN_PROFIT_MARGIN_THRESHOLD * 100).toFixed(0)}%`;
    }
  }

  /**
   * 内部方法：生成建议
   */
  private generateRecommendations(
    level: 'high' | 'medium' | 'low' | 'none',
    riskFactors: RiskFactor[]
  ): string[] {
    const recommendations: string[] = [];

    if (level === 'high') {
      recommendations.push('建议尽快行动，市场机会可能稍纵即逝');
      recommendations.push('考虑批量采购以降低单位成本');
    } else if (level === 'medium') {
      recommendations.push('建议深入调研目标市场情况');
      recommendations.push('考虑小批量试水，验证市场反应');
    } else if (level === 'low') {
      recommendations.push('建议寻找更好的价格时机');
      recommendations.push('考虑优化物流和关税策略');
    } else {
      recommendations.push('当前不推荐进行套利交易');
      recommendations.push('建议关注市场价格变化，等待更好时机');
    }

    // 添加针对风险因素的建议
    const highRiskFactors = riskFactors.filter(r => r.severity === 'high');
    highRiskFactors.forEach(factor => {
      if (factor.mitigation) {
        recommendations.push(factor.mitigation);
      }
    });

    return recommendations;
  }

  /**
   * 内部方法：构建数据源信息
   */
  private buildDataSourceInfo(
    domesticPrice: number,
    foreignPriceSource: string,
    exchangeRateSource: string
  ): DataSourceInfo {
    const now = new Date();
    const hoursAgo = Math.floor(Math.random() * 6); // 模拟数据新鲜度

    return {
      domesticPriceSource: 'platform-price',
      foreignPriceSource,
      exchangeRateSource,
      lastUpdated: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
      dataFreshness: hoursAgo < 24 ? 'fresh' : hoursAgo < 48 ? 'stale' : 'outdated',
      confidenceScore: 0.8,
    };
  }

  /**
   * 内部方法：与基准场景比较
   */
  private compareWithBaseScenario(
    result: ArbitrageResult,
    baseValue?: number
  ): {
    difference: number;
    percentage: number;
    assessment: string;
  } {
    // 简化比较逻辑
    const netProfit = result.profit.netProfit;
    const difference = baseValue ? netProfit - baseValue : 0;
    const percentage = baseValue ? (difference / Math.abs(baseValue)) * 100 : 0;
    let assessment = 'neutral';
    if (percentage > 20) assessment = 'highly positive';
    else if (percentage > 5) assessment = 'positive';
    else if (percentage < -20) assessment = 'highly negative';
    else if (percentage < -5) assessment = 'negative';
    return {
      difference,
      percentage,
      assessment,
    };
  }
}

// 导出单例实例
export const arbitrageCalculator = new ArbitrageCalculator();