/**
 * 销售策略建议 API
 *
 * POST /api/sales-strategy/suggest
 *
 * 基于每日自动化数据（strategy_latest.json + competition_latest.json + 日报MD），
 * 为卖家在发布产品时提供7模块销售策略建议：
 *
 * 1. 同品类市场行情（均价/区间/数量/排名）
 * 2. 国际市场参考报价（匹配同品牌/型号）
 * 3. 汇率与出口窗口
 * 4. 推荐目标市场
 * 5. 市场情报快报（按相关性过滤）
 * 6. 定价建议（AI估值对比）
 * 7. 即时事件提醒
 *
 * 数据全部从 public/daily-reports/ 静态文件读取，零数据库查询，响应<200ms。
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDailyReportData, type IntlPriceEntry, type UpcomingEvent } from "@/lib/daily-report-parser";
import { matchPortByLocation } from "@/lib/port-matcher";

export const dynamic = "force-dynamic";

// ===== 类型定义 =====

interface StrategyProduct {
  seq: number;
  id: string;
  brandNameZh: string;
  modelName: string;
  year: number;
  priceWan: number;
  workingHours: number | null;
  condition: string;
  categoryName: string;
  tier: string;
  age: number;
  strategyCategory: string;
  strategyDirection: string;
  actionSuggestion: string;
  priority: string;
  recommendedMarket: string;
}

interface StrategyData {
  date: string;
  totalProducts: number;
  products: StrategyProduct[];
}

interface CompetitionData {
  date: string;
  eurCny: number;
  eurRub: number;
  usdCny: number;
  intelligence: any[];
}

interface SalesStrategyResponse {
  success: boolean;
  data: {
    marketOverview: {
      categoryAvgPrice: number;
      categoryMinPrice: number;
      categoryMaxPrice: number;
      similarCount: number;
      yourPriceRank: string;
      pricePercentile: number;
    };
    internationalPrices: {
      platform: string;
      matchingModels: Array<{
        model: string;
        year: number | null;
        priceForeign: string;
        priceCny: string;
        hours: string;
        location: string;
      }>;
      arbitrageWindow: string;
    } | null;
    forexAndExport: {
      eurCny: number;
      eurRub: number;
      usdCny: number;
      trend: string;
      bestExportMarket: string;
      portSuggestion: string;
    };
    recommendedMarkets: Array<{
      market: string;
      reason: string;
      priority: string;
      strategyType: string;
    }>;
    intelligence: Array<{
      title: string;
      content: string;
      impact: string;
      priority: string;
    }>;
    pricingAdvice: {
      suggestion: string;
      confidence: number;
    };
    upcomingEvent: UpcomingEvent | null;
    dataDate: string;
  };
}

// ===== 数据读取辅助 =====

function readJsonFile<T>(filePath: string): T | null {
  try {
    const fullPath = path.join(process.cwd(), "public", "daily-reports", filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`[SalesStrategy] 读取 ${filePath} 失败:`, error);
    return null;
  }
}

// ===== 情报过滤 =====

function isRelevantToIntel(
  intelItem: any[],
  brand: string,
  category: string
): boolean {
  if (!Array.isArray(intelItem) || intelItem.length < 3) return false;

  const title = String(intelItem[1] || "");
  const content = String(intelItem[2] || "");
  const region = String(intelItem[5] || "");

  // 品牌关键词
  const brandKeywords: Record<string, string[]> = {
    "克拉斯": ["claas", "970", "980", "jaguar", "克拉斯"],
    "约翰迪尔": ["john deere", "迪尔", "8000", "9000"],
    "纽荷兰": ["new holland", "fr", "cx", "纽荷兰"],
    "科罗尼": ["krone", "bigx", "科罗尼"],
  };

  const keywords = brandKeywords[brand] || [brand.toLowerCase()];

  // 品类关键词
  const categoryKeywords: Record<string, string[]> = {
    "青储机": ["青储", "forage", "970", "980"],
    "打捆机": ["打捆", "baler", "bigpack"],
    "收获机": ["收获", "harvester", "combine"],
    "拖拉机": ["拖拉", "tractor"],
  };

  const catKeywords = categoryKeywords[category] || [category];

  const allText = (title + content + region).toLowerCase();

  // 品牌匹配 或 品类匹配 或 全球性情报
  const brandMatch = keywords.some(kw => allText.includes(kw.toLowerCase()));
  const catMatch = catKeywords.some(kw => allText.includes(kw.toLowerCase()));
  const isGlobal = region.includes("全球") || title.includes("汇率") || title.includes("开局");

  return brandMatch || catMatch || isGlobal;
}

// ===== 主处理函数 =====

/**
 * POST /api/sales-strategy/suggest
 * 接收 JSON body
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      brand,
      category,
      modelName,
      year,
      priceCny,
      condition,
      workingHours,
      location,
    } = body;

    if (!brand || !category) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数: brand, category" },
        { status: 400 }
      );
    }

    // 1. 读取当日自动化数据
    const strategyData = readJsonFile<StrategyData>("strategy_latest.json");
    const competitionData = readJsonFile<CompetitionData>("competition_latest.json");
    const dailyReport = getDailyReportData(brand, modelName);

    // 2. 同品类市场行情
    let marketOverview = {
      categoryAvgPrice: 0,
      categoryMinPrice: 0,
      categoryMaxPrice: 0,
      similarCount: 0,
      yourPriceRank: "适中",
      pricePercentile: 50,
    };

    if (strategyData) {
      const sameCategory = strategyData.products.filter(
        (p) => p.categoryName === category || p.categoryName.includes(category) || category.includes(p.categoryName)
      );

      if (sameCategory.length > 0) {
        const prices = sameCategory.map((p) => p.priceWan);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        // 计算用户报价排名
        let rank = "适中";
        let percentile = 50;
        if (priceCny) {
          const priceWan = priceCny / 10000;
          if (priceWan < avgPrice * 0.85) {
            rank = "偏低";
            percentile = Math.round((prices.filter(p => p < priceWan).length / prices.length) * 100);
          } else if (priceWan > avgPrice * 1.15) {
            rank = "偏高";
            percentile = Math.round((prices.filter(p => p < priceWan).length / prices.length) * 100);
          } else {
            rank = "适中";
            percentile = Math.round((prices.filter(p => p < priceWan).length / prices.length) * 100);
          }
        }

        marketOverview = {
          categoryAvgPrice: Math.round(avgPrice * 10) / 10,
          categoryMinPrice: Math.round(minPrice * 10) / 10,
          categoryMaxPrice: Math.round(maxPrice * 10) / 10,
          similarCount: sameCategory.length,
          yourPriceRank: rank,
          pricePercentile: Math.max(5, Math.min(95, percentile)),
        };
      }
    }

    // 3. 国际市场参考报价
    let internationalPrices = null;
    if (dailyReport && dailyReport.intlPrices.length > 0) {
      const matchingModels = dailyReport.intlPrices.slice(0, 5).map(entry => ({
        model: entry.model,
        year: entry.year,
        priceForeign: entry.priceForeign,
        priceCny: entry.priceCny,
        hours: entry.hours,
        location: entry.location,
      }));

      // 计算套利空间
      let arbitrageWindow = "暂无足够数据计算";
      if (priceCny && matchingModels.length > 0) {
        const yourPriceWan = priceCny / 10000;
        // 尝试从 priceCny 文本中提取数字
        const intlPrices = matchingModels
          .map(m => {
            const match = m.priceCny.match(/[\d.]+/);
            return match ? parseFloat(match[0]) : null;
          })
          .filter((p): p is number => p !== null && p > 0);

        if (intlPrices.length > 0) {
          const minIntl = Math.min(...intlPrices);
          const maxIntl = Math.max(...intlPrices);
          const minArb = Math.round(((minIntl - yourPriceWan) / yourPriceWan) * 100);
          const maxArb = Math.round(((maxIntl - yourPriceWan) / yourPriceWan) * 100);
          arbitrageWindow = `套利空间约${minArb}%~${maxArb}%`;
        }
      }

      internationalPrices = {
        platform: dailyReport.intlPrices[0]?.platform || "Agriaffaires",
        matchingModels,
        arbitrageWindow,
      };
    }

    // 4. 汇率与出口窗口
    let forexAndExport = {
      eurCny: 7.91,
      eurRub: 87.4,
      usdCny: 6.8,
      trend: "暂无数据",
      bestExportMarket: "俄罗斯（卢布高位，毛利率最高）",
      portSuggestion: matchPortByLocation(location || ""),
    };

    if (competitionData) {
      forexAndExport = {
        eurCny: competitionData.eurCny || 7.91,
        eurRub: competitionData.eurRub || 87.4,
        usdCny: competitionData.usdCny || 6.8,
        trend: `EUR/CNY ${competitionData.eurCny}，EUR/RUB ${competitionData.eurRub}`,
        bestExportMarket: competitionData.eurRub > 85
          ? "俄罗斯（卢布高位，毛利率历史最高）"
          : "欧洲（欧元走强，套利空间扩大）",
        portSuggestion: matchPortByLocation(location || ""),
      };
    }

    // 5. 推荐目标市场
    let recommendedMarkets: Array<{
      market: string;
      reason: string;
      priority: string;
      strategyType: string;
    }> = [];

    if (strategyData) {
      const sameCategory = strategyData.products.filter(
        (p) => p.categoryName === category || p.categoryName.includes(category)
      );

      const marketMap = new Map<string, typeof recommendedMarkets[0]>();

      for (const p of sameCategory) {
        if (p.recommendedMarket && p.recommendedMarket !== "待定") {
          const key = p.recommendedMarket;
          if (!marketMap.has(key)) {
            marketMap.set(key, {
              market: p.recommendedMarket,
              reason: p.actionSuggestion || `${p.strategyCategory}策略`,
              priority: p.priority || "★★☆☆☆",
              strategyType: p.strategyCategory || "",
            });
          }
        }
      }

      recommendedMarkets = Array.from(marketMap.values()).slice(0, 3);
    }

    // 如果没有匹配到推荐市场，给默认值
    if (recommendedMarkets.length === 0) {
      recommendedMarkets = [
        {
          market: "俄罗斯/中亚",
          reason: "卢布高位，出口毛利最佳",
          priority: "★★★★☆",
          strategyType: "通用",
        },
        {
          market: "东欧",
          reason: "欧元走强，套利窗口扩大",
          priority: "★★★☆☆",
          strategyType: "通用",
        },
      ];
    }

    // 6. 市场情报快报
    let intelligence: Array<{
      title: string;
      content: string;
      impact: string;
      priority: string;
    }> = [];

    if (competitionData && Array.isArray(competitionData.intelligence)) {
      intelligence = competitionData.intelligence
        .filter((item: any[]) => isRelevantToIntel(item, brand, category))
        .slice(0, 3)
        .map((item: any[]) => ({
          title: String(item[1] || ""),
          content: String(item[2] || ""),
          impact: String(item[6] || ""),
          priority: String(item[4] || "中"),
        }));
    }

    // 7. 定价建议
    let pricingAdvice = {
      suggestion: "建议参考同品类均价定价，留出5-10%询价空间",
      confidence: 0.7,
    };

    if (priceCny && marketOverview.categoryAvgPrice > 0) {
      const yourPriceWan = priceCny / 10000;
      const avgPrice = marketOverview.categoryAvgPrice;
      const diff = ((yourPriceWan - avgPrice) / avgPrice) * 100;

      if (diff < -15) {
        pricingAdvice = {
          suggestion: `你的报价低于同品类均价${Math.abs(Math.round(diff))}%，可适当上调至${Math.round(avgPrice * 0.95)}万附近`,
          confidence: 0.8,
        };
      } else if (diff > 15) {
        pricingAdvice = {
          suggestion: `你的报价高于同品类均价${Math.round(diff)}%，建议调整至${Math.round(avgPrice * 1.05)}万附近以提升竞争力`,
          confidence: 0.8,
        };
      } else {
        pricingAdvice = {
          suggestion: `你的报价与同品类均价接近（偏差${Math.abs(Math.round(diff))}%），定价合理`,
          confidence: 0.85,
        };
      }
    }

    // 8. 即时事件
    const upcomingEvent = dailyReport?.upcomingEvent || null;

    // 组装响应
    const responseData: SalesStrategyResponse["data"] = {
      marketOverview,
      internationalPrices,
      forexAndExport,
      recommendedMarkets,
      intelligence,
      pricingAdvice,
      upcomingEvent,
      dataDate: strategyData?.date || competitionData?.date || dailyReport?.date || new Date().toISOString().split("T")[0],
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error("[SalesStrategy] 错误:", error);
    return NextResponse.json(
      { success: false, error: "获取销售策略建议失败" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sales-strategy/suggest?brand=xxx&category=xxx&priceCny=xxx
 *
 * 为小程序端提供GET方式访问（wx.request GET + query params）
 * 与POST接口逻辑完全一致，参数来源从body改为searchParams
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("brand") || "";
    const category = searchParams.get("category") || "";
    const modelName = searchParams.get("modelName") || undefined;
    const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
    const priceCny = searchParams.get("priceCny") ? Number(searchParams.get("priceCny")) : undefined;
    const condition = searchParams.get("condition") || undefined;
    const workingHours = searchParams.get("workingHours") ? Number(searchParams.get("workingHours")) : undefined;
    const location = searchParams.get("location") || undefined;

    if (!brand || !category) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数: brand, category" },
        { status: 400 }
      );
    }

    // 复用POST的完整逻辑 —— 将参数组装成与POST相同的结构
    const body = { brand, category, modelName, year, priceCny, condition, workingHours, location };

    // 1. 读取当日自动化数据
    const strategyData = readJsonFile<StrategyData>("strategy_latest.json");
    const competitionData = readJsonFile<CompetitionData>("competition_latest.json");
    const dailyReport = getDailyReportData(brand, modelName);

    // 2. 同品类市场行情
    let marketOverview = {
      categoryAvgPrice: 0,
      categoryMinPrice: 0,
      categoryMaxPrice: 0,
      similarCount: 0,
      yourPriceRank: "适中",
      pricePercentile: 50,
    };

    if (strategyData) {
      const sameCategory = strategyData.products.filter(
        (p) => p.categoryName === category || p.categoryName.includes(category) || category.includes(p.categoryName)
      );

      if (sameCategory.length > 0) {
        const prices = sameCategory.map((p) => p.priceWan);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        let rank = "适中";
        let percentile = 50;
        if (priceCny) {
          const priceWan = priceCny / 10000;
          if (priceWan < avgPrice * 0.85) {
            rank = "偏低";
            percentile = Math.round((prices.filter(p => p < priceWan).length / prices.length) * 100);
          } else if (priceWan > avgPrice * 1.15) {
            rank = "偏高";
            percentile = Math.round((prices.filter(p => p < priceWan).length / prices.length) * 100);
          } else {
            rank = "适中";
            percentile = Math.round((prices.filter(p => p < priceWan).length / prices.length) * 100);
          }
        }

        marketOverview = {
          categoryAvgPrice: Math.round(avgPrice * 10) / 10,
          categoryMinPrice: Math.round(minPrice * 10) / 10,
          categoryMaxPrice: Math.round(maxPrice * 10) / 10,
          similarCount: sameCategory.length,
          yourPriceRank: rank,
          pricePercentile: Math.max(5, Math.min(95, percentile)),
        };
      }
    }

    // 3. 国际市场参考报价
    let internationalPrices = null;
    if (dailyReport && dailyReport.intlPrices.length > 0) {
      const matchingModels = dailyReport.intlPrices.slice(0, 5).map(entry => ({
        model: entry.model,
        year: entry.year,
        priceForeign: entry.priceForeign,
        priceCny: entry.priceCny,
        hours: entry.hours,
        location: entry.location,
      }));

      let arbitrageWindow = "暂无足够数据计算";
      if (priceCny && matchingModels.length > 0) {
        const yourPriceWan = priceCny / 10000;
        const intlPrices = matchingModels
          .map(m => {
            const match = m.priceCny.match(/[\d.]+/);
            return match ? parseFloat(match[0]) : null;
          })
          .filter((p): p is number => p !== null && p > 0);

        if (intlPrices.length > 0) {
          const minIntl = Math.min(...intlPrices);
          const maxIntl = Math.max(...intlPrices);
          const minArb = Math.round(((minIntl - yourPriceWan) / yourPriceWan) * 100);
          const maxArb = Math.round(((maxIntl - yourPriceWan) / yourPriceWan) * 100);
          arbitrageWindow = `套利空间约${minArb}%~${maxArb}%`;
        }
      }

      internationalPrices = {
        platform: dailyReport.intlPrices[0]?.platform || "Agriaffaires",
        matchingModels,
        arbitrageWindow,
      };
    }

    // 4. 汇率与出口窗口
    let forexAndExport = {
      eurCny: 7.91,
      eurRub: 87.4,
      usdCny: 6.8,
      trend: "暂无数据",
      bestExportMarket: "俄罗斯（卢布高位，毛利率最高）",
      portSuggestion: matchPortByLocation(location || ""),
    };

    if (competitionData) {
      forexAndExport = {
        eurCny: competitionData.eurCny || 7.91,
        eurRub: competitionData.eurRub || 87.4,
        usdCny: competitionData.usdCny || 6.8,
        trend: `EUR/CNY ${competitionData.eurCny}，EUR/RUB ${competitionData.eurRub}`,
        bestExportMarket: competitionData.eurRub > 85
          ? "俄罗斯（卢布高位，毛利率历史最高）"
          : "欧洲（欧元走强，套利空间扩大）",
        portSuggestion: matchPortByLocation(location || ""),
      };
    }

    // 5. 推荐目标市场
    let recommendedMarkets: Array<{
      market: string;
      reason: string;
      priority: string;
      strategyType: string;
    }> = [];

    if (strategyData) {
      const sameCategory = strategyData.products.filter(
        (p) => p.categoryName === category || p.categoryName.includes(category)
      );

      const marketMap = new Map<string, typeof recommendedMarkets[0]>();

      for (const p of sameCategory) {
        if (p.recommendedMarket && p.recommendedMarket !== "待定") {
          const key = p.recommendedMarket;
          if (!marketMap.has(key)) {
            marketMap.set(key, {
              market: p.recommendedMarket,
              reason: p.actionSuggestion || `${p.strategyCategory}策略`,
              priority: p.priority || "★★☆☆☆",
              strategyType: p.strategyCategory || "",
            });
          }
        }
      }

      recommendedMarkets = Array.from(marketMap.values()).slice(0, 3);
    }

    if (recommendedMarkets.length === 0) {
      recommendedMarkets = [
        { market: "俄罗斯/中亚", reason: "卢布高位，出口毛利最佳", priority: "★★★★☆", strategyType: "通用" },
        { market: "东欧", reason: "欧元走强，套利窗口扩大", priority: "★★★☆☆", strategyType: "通用" },
      ];
    }

    // 6. 市场情报快报
    let intelligence: Array<{
      title: string;
      content: string;
      impact: string;
      priority: string;
    }> = [];

    if (competitionData && Array.isArray(competitionData.intelligence)) {
      intelligence = competitionData.intelligence
        .filter((item: any[]) => isRelevantToIntel(item, brand, category))
        .slice(0, 3)
        .map((item: any[]) => ({
          title: String(item[1] || ""),
          content: String(item[2] || ""),
          impact: String(item[6] || ""),
          priority: String(item[4] || "中"),
        }));
    }

    // 7. 定价建议
    let pricingAdvice = {
      suggestion: "建议参考同品类均价定价，留出5-10%询价空间",
      confidence: 0.7,
    };

    if (priceCny && marketOverview.categoryAvgPrice > 0) {
      const yourPriceWan = priceCny / 10000;
      const avgPrice = marketOverview.categoryAvgPrice;
      const diff = ((yourPriceWan - avgPrice) / avgPrice) * 100;

      if (diff < -15) {
        pricingAdvice = {
          suggestion: `你的报价低于同品类均价${Math.abs(Math.round(diff))}%，可适当上调至${Math.round(avgPrice * 0.95)}万附近`,
          confidence: 0.8,
        };
      } else if (diff > 15) {
        pricingAdvice = {
          suggestion: `你的报价高于同品类均价${Math.round(diff)}%，建议调整至${Math.round(avgPrice * 1.05)}万附近以提升竞争力`,
          confidence: 0.8,
        };
      } else {
        pricingAdvice = {
          suggestion: `你的报价与同品类均价接近（偏差${Math.abs(Math.round(diff))}%），定价合理`,
          confidence: 0.85,
        };
      }
    }

    // 8. 即时事件
    const upcomingEvent = dailyReport?.upcomingEvent || null;

    const responseData: SalesStrategyResponse["data"] = {
      marketOverview,
      internationalPrices,
      forexAndExport,
      recommendedMarkets,
      intelligence,
      pricingAdvice,
      upcomingEvent,
      dataDate: strategyData?.date || competitionData?.date || dailyReport?.date || new Date().toISOString().split("T")[0],
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error("[SalesStrategy GET] 错误:", error);
    return NextResponse.json(
      { success: false, error: "获取销售策略建议失败" },
      { status: 500 }
    );
  }
}
