/**
 * 日报总览 API — 小程序神雕日报首页数据源
 * GET /api/daily-reports
 *
 * 返回当日所有报告的状态和摘要信息：
 * 1. 跨境套利日报（简版/完整）
 * 2. 竞争力分析报告（7工作表）
 * 3. 全量产品策略分析报告（8大策略分类）
 * 4. 每日文章列表
 */
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const REPORTS_DIR = path.join(process.cwd(), "public", "daily-reports");
// 数据文件统一放在 public/daily-reports/ 下（Vercel部署可用）
// 本地开发时也同步到此处（自动化脚本负责复制）

// 获取今天的日期字符串
function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 安全读取JSON文件
function readJson<T = unknown>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as T;
    }
    return null;
  } catch {
    return null;
  }
}

// 获取最新的N个日报HTML文件
function getRecentReports(limit = 7): Array<{ date: string; title: string }> {
  try {
    if (!fs.existsSync(REPORTS_DIR)) return [];
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
      .sort()
      .reverse()
      .slice(0, limit);

    return files.map(f => ({
      date: f.replace(".html", ""),
      title: `跨境套利日报 ${f.replace(".html", "")}`
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const today = getTodayStr();

  // 1. 日报状态检查
  const dailyHtmlPath = path.join(REPORTS_DIR, `${today}.html`);
  const dailyMdPath = path.join(REPORTS_DIR, `${today}_跨境套利日报.md`);
  const dailyPdfPath = path.join(REPORTS_DIR, `${today}_跨境套利日报_HD.pdf`);

  const dailyReport = {
    date: today,
    hasHtml: fs.existsSync(dailyHtmlPath),
    hasMd: fs.existsSync(dailyMdPath),
    hasPdf: fs.existsSync(dailyPdfPath),
    // 尝试读取MD前几行作为摘要
    preview: "",
  };

  if (dailyReport.hasMd) {
    try {
      const mdContent = fs.readFileSync(dailyMdPath, "utf-8");
      const lines = mdContent.split("\n").filter(l => l.trim());
      // 取前6行非空内容作为预览
      dailyReport.preview = lines.slice(0, 6).join("\n").substring(0, 300);
    } catch { /* ignore */ }
  }

  // 2. 竞争力报告状态
  const compJsonPath = path.join(REPORTS_DIR, "competition_latest.json");
  const compRawData = readJson<Record<string, unknown>>(compJsonPath);

  // 兼容两种JSON格式：新版（eurCny/eurRub/usdCny）和旧版（summary/sheets/rates）
  let competitionReport: Record<string, unknown>;
  if (compRawData && "eurCny" in compRawData) {
    // 新格式：直接字段 + 数组式工作表
    const sheetNames = ["情报更新", "产品信息", "国际价格", "物流成本", "套利空间", "目标市场", "策略建议"];
    const ratesObj: Record<string, string> = {};
    if (compRawData.eurCny) ratesObj.EUR_CNY = String(compRawData.eurCny);
    if (compRawData.eurRub) ratesObj.EUR_RUB = String(compRawData.eurRub);
    if (compRawData.usdCny) ratesObj.USD_CNY = String(compRawData.usdCny);

    // 计算最佳套利率
    let bestArbRate = "-";
    const arbArr = compRawData.arbitrage as Array<Record<string, unknown>> | undefined;
    if (arbArr && arbArr.length > 0) {
      for (const a of arbArr) {
        if (typeof a.margin === "string" || typeof a.margin === "number") {
          const m = String(a.margin).replace("%", "");
          const n = parseFloat(m);
          if (!isNaN(n) && (bestArbRate === "-" || n > parseFloat(String(bestArbRate).replace("%", "")))) {
            bestArbRate = String(a.margin);
          }
        }
      }
    }

    const prodArr = compRawData.products as Array<unknown> | undefined;
    competitionReport = {
      available: true,
      date: compRawData.date || today,
      title: "竞争力分析报告",
      summary: {
        total_products: Array.isArray(prodArr) ? prodArr.length : 0,
        best_arb_rate: bestArbRate,
        best_model: "-",
      },
      sheetCount: sheetNames.length,
      sheetNames,
      rates: ratesObj,
    };
  } else {
    // 旧格式
    competitionReport = {
      available: compRawData !== null,
      date: (compRawData as { date?: string })?.date || today,
      title: (compRawData as { title?: string })?.title || "竞争力分析报告",
      summary: (compRawData as { summary?: Record<string, unknown> })?.summary || null,
      sheetCount: (compRawData as { sheets?: Record<string, unknown> })?.sheets ? Object.keys((compRawData as { sheets: Record<string, unknown> }).sheets).length : 0,
      sheetNames: (compRawData as { sheets?: Record<string, unknown> })?.sheets ? Object.keys((compRawData as { sheets: Record<string, unknown> }).sheets) : [],
      rates: (compRawData as { rates?: Record<string, string> })?.rates || {},
    };
  }

  // 3. 策略分析报告状态
  const strategyJsonPath = path.join(REPORTS_DIR, "strategy_latest.json");
  const strategyData = readJson<{
    date?: string;
    totalProducts?: number;
    highArbCount?: number;
    analyzedCount?: number;
    summary?: string;
    groupActions?: Array<{ group: string; count: number; action: string; coreStrategy?: string; representativeProduct?: string }>;
    optimizationSuggestions?: string[];
    products?: Array<{
      modelName: string;
      brandNameZh?: string;
      strategyCategory?: string;
      strategyGroup?: string;
      tier?: string;
      priority?: string;
      priceWan?: number;
      suggestedPrice?: number;
      recommendedMarket?: string;
      actionSuggestion?: string;
    }>;
  }>(strategyJsonPath);

  // 按策略分组统计（兼容 strategyCategory 和 strategyGroup 两种字段名）
  const strategyGroups: Record<string, number> = {};
  if (strategyData?.products) {
    for (const p of strategyData.products) {
      const g = p.strategyCategory || p.strategyGroup || "未分类";
      strategyGroups[g] = (strategyGroups[g] || 0) + 1;
    }
  }

  const strategyReport = {
    available: strategyData !== null,
    date: strategyData?.date || today,
    totalProducts: strategyData?.totalProducts || 0,
    highArbCount: strategyData?.highArbCount || 0,
    analyzedCount: strategyData?.analyzedCount || 0,
    summary: strategyData?.summary || null,
    groups: strategyGroups,
    groupActions: strategyData?.groupActions || [],
    optimizationSuggestions: strategyData?.optimizationSuggestions || [],
  };

  // 4. 今日文章 — 从JSON文件读取（优先）或从数据库读取
  const articlesPath = path.join(REPORTS_DIR, `articles_${today}.json`);
  const articlesData = readJson<Array<{
    id?: string;
    slug?: string;
    titleZh?: string;
    titleEn?: string;
    category?: string;
    language?: string;
    coverImage?: string;
    excerptZh?: string;
  }>>(articlesPath);

  const articles = (articlesData || []).map(a => ({
    title: a.titleZh || a.titleEn || "未命名文章",
    titleEn: a.titleEn || "",
    category: a.category || "market-analysis",
    language: a.language || "zh",
    coverImage: a.coverImage || "",
    excerpt: a.excerptZh || "",
    slug: a.slug || "",
  }));

  // 如果本地JSON没有文章，尝试从数据库获取最近3篇
  if (articles.length === 0) {
    try {
      // 动态导入Prisma（仅在服务端可用）
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const dbArticles = await prisma.article.findMany({
        where: { status: "published" },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: {
          slug: true,
          titleZh: true,
          titleEn: true,
          category: true,
          coverImage: true,
          publishedAt: true,
        },
      });
      // 将DB结果追加到articles
      for (const a of dbArticles) {
        articles.push({
          title: a.titleZh || a.titleEn || "未命名文章",
          titleEn: a.titleEn || "",
          category: a.category || "market-analysis",
          language: "zh",
          coverImage: a.coverImage || "",
          excerpt: "",
          slug: a.slug || "",
        });
      }
      await prisma.$disconnect();
    } catch (e) {
      console.warn("[daily-reports] DB fallback failed:", e instanceof Error ? e.message : e);
    }
  }

  // 5. 历史日报列表
  const recentReports = getRecentReports(7);

  return NextResponse.json({
    success: true,
    date: today,
    updatedAt: new Date().toISOString(),
    reports: {
      daily: dailyReport,
      competition: competitionReport,
      strategy: strategyReport,
    },
    articles,
    recentReports,
  });
}
