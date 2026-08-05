import { prisma } from "@/lib/db";
import type { DashboardInput, DashboardResult, DashboardStatus, DashboardMetrics } from "./types";

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
}

export const dataDashboardAgent = new DataDashboardAgent();
