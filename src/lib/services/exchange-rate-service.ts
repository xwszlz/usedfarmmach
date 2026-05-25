/**
 * 汇率服务
 * 提供汇率获取、转换和更新功能
 */
import { prisma } from '../db';
import axios from 'axios';
import type {
  ExchangeRate,
  CurrencyCode,
  ExchangeRateApiResponse,
  CurrencyConversionRequest,
  CurrencyConversionResponse,
  ExchangeRateUpdateResponse,
  ApiSourceConfig,
} from '../../types/exchange-rates';
import { EXCHANGE_RATE_API, UPDATE_STRATEGY, SUPPORTED_CURRENCIES } from '../../config/exchange-rates';
import { validateExchangeRate } from '../arbitrage/validation';
import { EXCHANGE_RATE_CACHE_TTL } from '../arbitrage/formulas';

/**
 * 内存缓存项
 */
interface CacheItem {
  rate: ExchangeRate;
  timestamp: number;
}

/**
 * 汇率服务类
 */
export class ExchangeRateService {
  private cache: Map<string, CacheItem> = new Map();
  private updateInProgress: boolean = false;
  private lastUpdateError: Error | null = null;

  /**
   * 获取最新汇率
   * @param baseCurrency 基础货币，默认CNY
   * @param targetCurrency 目标货币
   * @returns 汇率数据
   */
  async getLatestRate(
    baseCurrency: CurrencyCode = 'CNY',
    targetCurrency: CurrencyCode
  ): Promise<ExchangeRate> {
    // 验证货币代码
    this.validateCurrencyCode(baseCurrency, 'baseCurrency');
    this.validateCurrencyCode(targetCurrency, 'targetCurrency');

    // 如果是相同货币，返回1:1汇率
    if (baseCurrency === targetCurrency) {
      return this.createIdentityRate(baseCurrency, targetCurrency);
    }

    // 检查缓存
    const cacheKey = `${baseCurrency}-${targetCurrency}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < EXCHANGE_RATE_CACHE_TTL * 1000) {
      console.log(`使用缓存的汇率: ${cacheKey} = ${cached.rate.rate}`);
      return cached.rate;
    }

    // 从数据库获取最新汇率
    let rate = await this.getLatestRateFromDb(baseCurrency, targetCurrency);
    
    // 如果数据库没有或数据过期，尝试更新
    if (!rate || this.isRateStale(rate)) {
      console.log(`汇率数据过期或不存在，触发更新: ${cacheKey}`);
      await this.updateRates([{ baseCurrency, targetCurrency }]);
      rate = await this.getLatestRateFromDb(baseCurrency, targetCurrency);
      
      // 如果仍然没有，尝试从API实时获取
      if (!rate) {
        rate = await this.fetchRateFromApi(baseCurrency, targetCurrency);
        if (rate) {
          await this.saveRateToDb(rate);
        }
      }
    }

    // 如果还没有，使用降级策略
    if (!rate) {
      console.warn(`无法获取汇率 ${cacheKey}，使用降级值`);
      rate = this.getFallbackRate(baseCurrency, targetCurrency);
    }

    // 验证汇率数据
    if (!validateExchangeRate(rate)) {
      throw new Error(`获取的汇率数据无效: ${JSON.stringify(rate)}`);
    }

    // 更新缓存
    this.cache.set(cacheKey, {
      rate,
      timestamp: Date.now(),
    });

    return rate;
  }

  /**
   * 货币转换
   * @param amount 金额
   * @param fromCurrency 源货币
   * @param toCurrency 目标货币
   * @returns 转换后的金额
   */
  async convertAmount(
    amount: number,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ): Promise<number> {
    // 验证输入
    if (amount <= 0) {
      throw new Error('转换金额必须大于0');
    }
    this.validateCurrencyCode(fromCurrency, 'fromCurrency');
    this.validateCurrencyCode(toCurrency, 'toCurrency');

    // 相同货币直接返回
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // 获取汇率
    const rate = await this.getLatestRate(fromCurrency, toCurrency);
    
    // 计算转换后的金额
    const convertedAmount = amount * rate.rate;
    
    // 四舍五入到2位小数
    return Math.round(convertedAmount * 100) / 100;
  }

  /**
   * 批量更新汇率
   * @param currencyPairs 要更新的货币对数组，默认更新所有支持货币
   * @returns 更新结果
   */
  async updateRates(
    currencyPairs?: Array<{ baseCurrency: CurrencyCode; targetCurrency: CurrencyCode }>
  ): Promise<ExchangeRateUpdateResponse> {
    // 防止并发更新
    if (this.updateInProgress) {
      console.log('汇率更新已在进行中，跳过');
      return {
        success: false,
        error: '汇率更新已在进行中',
      };
    }

    this.updateInProgress = true;
    const startTime = Date.now();
    const results: Array<{
      currencyPair: string;
      success: boolean;
      error?: string;
      cached?: boolean;
    }> = [];

    try {
      // 确定要更新的货币对
      const pairsToUpdate = currencyPairs || this.getAllCurrencyPairs();
      
      console.log(`开始更新 ${pairsToUpdate.length} 个汇率`);

      // 使用主API更新
      const apiResults = await this.updateFromApi(
        EXCHANGE_RATE_API.primary,
        pairsToUpdate
      );
      
      results.push(...apiResults);

      // 如果主API失败，尝试备用API
      const failedPairs = apiResults
        .filter(r => !r.success)
        .map(r => {
          const [base, target] = r.currencyPair.split('-');
          return { baseCurrency: base as CurrencyCode, targetCurrency: target as CurrencyCode };
        });

      if (failedPairs.length > 0 && EXCHANGE_RATE_API.fallback) {
        console.log(`${failedPairs.length} 个汇率更新失败，尝试备用API`);
        const fallbackResults = await this.updateFromApi(
          EXCHANGE_RATE_API.fallback,
          failedPairs
        );
        results.push(...fallbackResults);
      }

      // 清理缓存
      this.cleanupCache();

      // 统计结果
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      const cachedCount = results.filter(r => r.cached).length;

      console.log(`汇率更新完成: 成功 ${successCount}, 失败 ${failedCount}, 缓存 ${cachedCount}`);

      return {
        success: true,
        data: {
          updatedCount: successCount,
          failedCount,
          sourcesUsed: [
            EXCHANGE_RATE_API.primary.name,
            ...(failedPairs.length > 0 ? [EXCHANGE_RATE_API.fallback.name] : []),
          ],
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          duration: Date.now() - startTime,
          details: results.map(r => ({
            currencyPair: r.currencyPair,
            source: r.cached ? 'cache' : EXCHANGE_RATE_API.primary.name,
            success: r.success,
            error: r.error,
            cached: r.cached ?? false,
            // 可选属性：oldRate, newRate, change, changePercent 留空（可选）
          })),
        },
      };
    } catch (error) {
      console.error('汇率更新失败:', error);
      this.lastUpdateError = error as Error;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    } finally {
      this.updateInProgress = false;
    }
  }

  /**
   * 从数据库获取最新汇率
   */
  private async getLatestRateFromDb(
    baseCurrency: CurrencyCode,
    targetCurrency: CurrencyCode
  ): Promise<ExchangeRate | null> {
    try {
      const rate = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrency,
          targetCurrency,
        },
        orderBy: {
          effectiveDate: 'desc',
        },
      });

      return rate as ExchangeRate | null;
    } catch (error) {
      console.error('从数据库获取汇率失败:', error);
      return null;
    }
  }

  /**
   * 从API获取汇率
   */
  private async fetchRateFromApi(
    baseCurrency: CurrencyCode,
    targetCurrency: CurrencyCode
  ): Promise<ExchangeRate | null> {
    try {
      const config = EXCHANGE_RATE_API.primary;
      const endpoint = config.endpoints.pair.replace('{target}', targetCurrency);
      const url = `${config.baseUrl}${endpoint}`;

      const response = await axios.get<ExchangeRateApiResponse>(url, {
        headers: config.headers,
        timeout: config.timeout,
        params: config.apiKey ? { apikey: config.apiKey } : undefined,
      });

      if (response.data.success && response.data.rates?.[targetCurrency]) {
        const rateValue = response.data.rates[targetCurrency];
        
        return {
          id: `api-${Date.now()}`,
          baseCurrency,
          targetCurrency,
          rate: rateValue,
          inverseRate: 1 / rateValue,
          source: config.name,
          lastUpdated: new Date().toISOString(),
          effectiveDate: new Date().toISOString(),
          confidence: 0.9,
          isLive: true,
          isHistorical: false,
          isInterpolated: false,
        };
      }
    } catch (error) {
      console.error(`从API获取汇率失败 ${baseCurrency}-${targetCurrency}:`, error);
    }

    return null;
  }

  /**
   * 从指定API批量更新汇率
   */
  private async updateFromApi(
    apiConfig: ApiSourceConfig,
    currencyPairs: Array<{ baseCurrency: CurrencyCode; targetCurrency: CurrencyCode }>
  ): Promise<Array<{
    currencyPair: string;
    success: boolean;
    error?: string;
    cached?: boolean;
  }>> {
    const results: Array<{
      currencyPair: string;
      success: boolean;
      error?: string;
      cached?: boolean;
    }> = [];

    // 对于每个货币对，尝试获取最新汇率
    for (const pair of currencyPairs) {
      const { baseCurrency, targetCurrency } = pair;
      const currencyPair = `${baseCurrency}-${targetCurrency}`;

      try {
        // 跳过相同货币对
        if (baseCurrency === targetCurrency) {
          results.push({
            currencyPair,
            success: true,
            cached: true,
          });
          continue;
        }

        // 获取汇率
        const rate = await this.fetchRateFromApi(baseCurrency, targetCurrency);
        
        if (rate) {
          // 保存到数据库
          await this.saveRateToDb(rate);
          
          // 更新缓存
          this.cache.set(currencyPair, {
            rate,
            timestamp: Date.now(),
          });
          
          results.push({
            currencyPair,
            success: true,
          });
          
          console.log(`汇率更新成功: ${currencyPair} = ${rate.rate}`);
        } else {
          results.push({
            currencyPair,
            success: false,
            error: 'API返回无效数据',
          });
        }
      } catch (error) {
        results.push({
          currencyPair,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }

      // 遵守API限速
      await this.delay(1000 / apiConfig.rateLimit.requestsPerMinute * 60);
    }

    return results;
  }

  /**
   * 保存汇率到数据库
   */
  private async saveRateToDb(rate: ExchangeRate): Promise<void> {
    try {
      await prisma.exchangeRate.create({
        data: {
          baseCurrency: rate.baseCurrency,
          targetCurrency: rate.targetCurrency,
          rate: rate.rate,
          source: rate.source,
          lastUpdated: new Date(rate.lastUpdated),
          effectiveDate: new Date(rate.effectiveDate),
        },
      });
    } catch (error) {
      console.error('保存汇率到数据库失败:', error);
      // 忽略重复键错误（@@unique约束）
    }
  }

  /**
   * 获取降级汇率
   */
  private getFallbackRate(
    baseCurrency: CurrencyCode,
    targetCurrency: CurrencyCode
  ): ExchangeRate {
    const staticRates = UPDATE_STRATEGY.fallbackStrategy.staticRates;
    let rateValue = 1;
    
    if (baseCurrency === 'CNY' && targetCurrency in staticRates) {
      rateValue = staticRates[targetCurrency as keyof typeof staticRates];
    } else if (targetCurrency === 'CNY' && baseCurrency in staticRates) {
      rateValue = 1 / staticRates[baseCurrency as keyof typeof staticRates];
    }

    return {
      id: `fallback-${Date.now()}`,
      baseCurrency,
      targetCurrency,
      rate: rateValue,
      inverseRate: 1 / rateValue,
      source: 'static-fallback',
      lastUpdated: new Date().toISOString(),
      effectiveDate: new Date().toISOString(),
      confidence: 0.5,
      isLive: false,
      isHistorical: false,
      isInterpolated: false,
    };
  }

  /**
   * 创建相同货币的汇率（1:1）
   */
  private createIdentityRate(
    baseCurrency: CurrencyCode,
    targetCurrency: CurrencyCode
  ): ExchangeRate {
    return {
      id: `identity-${Date.now()}`,
      baseCurrency,
      targetCurrency,
      rate: 1,
      inverseRate: 1,
      source: 'identity',
      lastUpdated: new Date().toISOString(),
      effectiveDate: new Date().toISOString(),
      confidence: 1.0,
      isLive: true,
      isHistorical: false,
      isInterpolated: false,
    };
  }

  /**
   * 检查汇率是否过期
   */
  private isRateStale(rate: ExchangeRate): boolean {
    const lastUpdated = new Date(rate.lastUpdated);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceUpdate > UPDATE_STRATEGY.conditions.maxAgeHours;
  }

  /**
   * 获取所有支持的货币对
   */
  private getAllCurrencyPairs(): Array<{ baseCurrency: CurrencyCode; targetCurrency: CurrencyCode }> {
    const pairs: Array<{ baseCurrency: CurrencyCode; targetCurrency: CurrencyCode }> = [];
    
    for (const base of SUPPORTED_CURRENCIES) {
      for (const target of SUPPORTED_CURRENCIES) {
        if (base !== target) {
          pairs.push({ baseCurrency: base as CurrencyCode, targetCurrency: target as CurrencyCode });
        }
      }
    }
    
    return pairs;
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > EXCHANGE_RATE_CACHE_TTL * 1000) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 验证货币代码
   */
  private validateCurrencyCode(currency: string, fieldName: string): void {
    if (!SUPPORTED_CURRENCIES.includes(currency as any)) {
      throw new Error(`不支持的货币代码 ${fieldName}: ${currency}`);
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      cacheSize: this.cache.size,
      updateInProgress: this.updateInProgress,
      lastUpdateError: this.lastUpdateError?.message,
      supportedCurrencies: SUPPORTED_CURRENCIES.length,
    };
  }
}

// 导出单例实例
export const exchangeRateService = new ExchangeRateService();