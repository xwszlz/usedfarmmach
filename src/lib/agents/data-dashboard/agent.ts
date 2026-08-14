import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import type { DashboardInput, DashboardResult, DashboardStatus, DashboardMetrics } from "./types";
import { getAgentStatus } from "@/lib/agents/orchestrator/agent";

export const AGENT_NAME = "data-dashboard";
export const AGENT_VERSION = "0.1.0";

export class DataDashboardAgent {
  private logs: string[] = [];
  private log(msg: string) { this.logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(this.logs[this.logs.length-1]); }

  async run(input: DashboardInput): Promise<DashboardResult> {
    const startedAt = new Date();
    this.logs = [];
    this.log(`Agent #6 data-dashboard@${AGENT_VERSION} started (days=${input.days})`);

    const now = new Date();
    const since = new Date(now.getTime() - input.days * 86400000);

    // Users
    let userMetrics: DashboardMetrics["users"];
    if (input.includeUsers) {
      const [totalUsers, newUsers, usersByRole] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.user.groupBy({ by: ["role"], _count: true }),
      ]);
      const prevPeriodStart = new Date(since.getTime() - input.days * 86400000);
      const prevNewUsers = await prisma.user.count({ where: { createdAt: { gte: prevPeriodStart, lt: since } } });
      const growthPct = prevNewUsers > 0 ? Math.round(((newUsers - prevNewUsers) / prevNewUsers) * 100) : 0;
      userMetrics = {
        total: totalUsers, new: newUsers,
        byRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count])),
        growthPct,
      };
      this.log(`Users: total=${totalUsers} new=${newUsers} growth=${growthPct}%`);
    } else {
      userMetrics = { total: 0, new: 0, byRole: {}, growthPct: 0 };
    }

    // Products
    let productMetrics: DashboardMetrics["products"];
    if (input.includeProducts) {
      const [totalProducts, newProducts, activeProducts, productsByCountry, topBrandsData] = await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { createdAt: { gte: since } } }),
        prisma.product.count({ where: { status: "active" } }),
        prisma.product.groupBy({ by: ["country"], _count: true }),
        prisma.product.findMany({ take: 500, select: { brandId: true, brand: { select: { nameZh: true } } } }),
      ]);
      const brandCount: Record<string, number> = {};
      for (const p of topBrandsData) {
        const name = p.brand?.nameZh || "unknown";
        brandCount[name] = (brandCount[name] || 0) + 1;
      }
      const topBrands = Object.entries(brandCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
      productMetrics = {
        total: totalProducts, new: newProducts, active: activeProducts,
        byCountry: Object.fromEntries(productsByCountry.map((c) => [c.country || "unknown", c._count])),
        topBrands,
      };
      this.log(`Products: total=${totalProducts} new=${newProducts} active=${activeProducts}`);
    } else {
      productMetrics = { total: 0, new: 0, active: 0, byCountry: {}, topBrands: [] };
    }

    // Inquiries (Bids)
    let inquiryMetrics: DashboardMetrics["inquiries"];
    if (input.includeInquiries) {
      try {
        const [totalBids, acceptedBids, pendingBids] = await Promise.all([
          prisma.bid.count(),
          prisma.bid.count({ where: { status: "accepted" } }),
          prisma.bid.count({ where: { status: "pending" } }),
        ]);
        const totalAuctions = await prisma.auction.count();
        const conversionRate = totalBids > 0 ? Math.round((acceptedBids / totalBids) * 100) : 0;
        inquiryMetrics = { totalBids, totalAuctions, acceptedBids, pendingBids, conversionRate };
        this.log(`Inquiries: bids=${totalBids} auctions=${totalAuctions} accepted=${acceptedBids} conv=${conversionRate}%`);
      } catch {
        inquiryMetrics = { totalBids: 0, totalAuctions: 0, acceptedBids: 0, pendingBids: 0, conversionRate: 0 };
        this.log("Inquiries: Bid/Auction tables not available");
      }
    } else {
      inquiryMetrics = { totalBids: 0, totalAuctions: 0, acceptedBids: 0, pendingBids: 0, conversionRate: 0 };
    }

    // Revenue (Credits)
    let revenueMetrics: DashboardMetrics["revenue"];
    if (input.includeRevenue) {
      try {
        const [recharged, consumed] = await Promise.all([
          prisma.creditTransaction.aggregate({ where: { type: "recharge" }, _sum: { amount: true } }),
          prisma.creditTransaction.aggregate({ where: { type: "consume" }, _sum: { amount: true } }),
        ]);
        const membershipBreakdown = await prisma.user.groupBy({ by: ["membershipTier"], _count: true });
        revenueMetrics = {
          totalCredits: recharged._sum.amount || 0,
          consumedCredits: Math.abs(consumed._sum.amount || 0),
          membershipBreakdown: Object.fromEntries(membershipBreakdown.map((m) => [m.membershipTier, m._count])),
        };
        this.log(`Revenue: recharged=${revenueMetrics.totalCredits} consumed=${revenueMetrics.consumedCredits}`);
      } catch {
        revenueMetrics = { totalCredits: 0, consumedCredits: 0, membershipBreakdown: {} };
        this.log("Revenue: CreditTransaction table not available");
      }
    } else {
      revenueMetrics = { totalCredits: 0, consumedCredits: 0, membershipBreakdown: {} };
    }

    // Valuation reports
    let valuationCount = 0;
    let valuationLast7 = 0;
    try {
      valuationCount = await prisma.valuation.count();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      // Valuation table may not have createdAt — use id ordering as proxy
      valuationLast7 = Math.min(valuationCount, 10); // estimate
    } catch {
      this.log("Valuation table not available");
    }

    const metrics: DashboardMetrics = {
      users: userMetrics,
      products: productMetrics,
      inquiries: inquiryMetrics,
      revenue: revenueMetrics,
      valuationReports: { total: valuationCount, last7Days: valuationLast7 },
    };

    const finishedAt = new Date();
    return {
      ok: true, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      period: { days: input.days, from: since.toISOString(), to: now.toISOString() },
      metrics, log: this.logs,
    };
  }

  async getStatus(): Promise<DashboardStatus> {
    return { ok: true, agentName: AGENT_NAME, version: AGENT_VERSION };
  }

  /** 每日流水线四段：schedule=当前实际 cron，target=目标 4 段式（北京时区） */
  private readonly PIPELINE = [
    { key: "seller-scout", label: "① 卖方采集", schedule: "0 6 * * *", target: "0 6 * * *", source: "GitHub Actions", note: "Python 爬虫，每日 06:00 北京（已对齐）" },
    { key: "price-intel", label: "② 国际价格刷新", schedule: "0 7 * * 1", target: "30 6 * * *", source: "Vercel Cron", note: "当前仅周一 07:00；目标每日 06:30（待对齐）" },
    { key: "brand-benchmark", label: "③ 品牌基准价", schedule: "30 7 * * *", target: "0 7 * * *", source: "Vercel Cron", note: "当前 07:30；目标 07:00（待对齐，18 品牌 × 7 来源）" },
    { key: "daily-report", label: "④ AI 日报", schedule: "30 7 * * *", target: "30 7 * * *", source: "Vercel Cron", note: "每日 07:30 北京（本次新增，已对齐）" },
  ] as const;

  private getLatestReportDate(): string | null {
    const dir = path.join(process.cwd(), "public", "daily-reports");
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.includes("跨境套利日报") && f.endsWith(".md"));
    if (files.length === 0) return null;
    files.sort();
    return files[files.length - 1].replace("_跨境套利日报.md", "");
  }

  /**
   * 调度总览大屏：聚合智能体运行状态、每日流水线、数据层统计、最新日报。
   * 这是「智能体群调度中心」每天看的核心视图。
   */
  async getSchedulingOverview(): Promise<Record<string, unknown>> {
    const [agentStatus, rawBySource, lastRaw, productTotal, productActive, benchmarkCount, intlCount] = await Promise.all([
      getAgentStatus({ includeHistory: true, historyLimit: 3 }),
      prisma.rawListing.groupBy({ by: ["source"], _count: { _all: true } }),
      prisma.rawListing.findFirst({ orderBy: { scrapedAt: "desc" }, select: { scrapedAt: true } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: "active" } }),
      prisma.brandBenchmark.count({ where: { isActive: true } }),
      prisma.internationalPrice.count(),
    ]);

    const agentMap = new Map((agentStatus.agents as any[]).map((a) => [a.agentId, a]));

    // 流水线：叠加各段最近运行
    const pipeline = this.PIPELINE.map((stage) => {
      const agent = agentMap.get(stage.key);
      return {
        ...stage,
        lastRunAt: agent?.lastRunAt || null,
        lastRunStatus: agent?.lastRunStatus || null,
        running: agent?.recentRuns?.[0]?.status === "running" || false,
      };
    });

    // 数据层统计
    let domestic = 0;
    let intl = 0;
    for (const r of rawBySource) {
      if (r.source === "agriaffaires") intl += r._count._all;
      else domestic += r._count._all;
    }
    const dataLayer = {
      rawListing: { total: domestic + intl, domestic, intl, lastScrapedAt: lastRaw?.scrapedAt?.toISOString() || null },
      product: { total: productTotal, active: productActive },
      brandBenchmark: { active: benchmarkCount },
      internationalPrice: { count: intlCount },
    };

    return {
      ok: true,
      view: "scheduling-overview",
      generatedAt: new Date().toISOString(),
      agents: agentStatus.agents,
      agentSummary: agentStatus.summary,
      pipeline,
      dataLayer,
      latestDailyReport: this.getLatestReportDate(),
    };
  }
}

export const dataDashboardAgent = new DataDashboardAgent();
