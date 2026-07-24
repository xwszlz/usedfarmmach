import { prisma } from "@/lib/db";
import type { ArbitrageInput, ArbitrageResult, ArbitrageStatus, ArbitrageOpportunity } from "./types";

export const AGENT_NAME = "arbitrage-analyzer";
export const AGENT_VERSION = "0.1.0";

export class ArbitrageAnalyzerAgent {
  private logs: string[] = [];
  private log(msg: string) { this.logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(this.logs[this.logs.length-1]); }

  async run(input: ArbitrageInput): Promise<ArbitrageResult> {
    const startedAt = new Date();
    this.logs = [];
    this.log(`Agent #4 arbitrage-analyzer@${AGENT_VERSION} started`);

    // Build product query
    const productWhere: Record<string, unknown> = { status: "active" };
    if (input.productId) productWhere.id = input.productId;
    if (input.brandId) productWhere.brandId = input.brandId;

    const products = await prisma.product.findMany({
      where: productWhere,
      include: { brand: true },
      take: input.limit * 5,
    });
    this.log(`Loaded ${products.length} products`);

    // Load international prices for these products
    const productIds = products.map((p) => p.id);
    const intlPrices = await prisma.internationalPrice.findMany({
      where: {
        productId: { in: productIds },
        ...(input.targetCountries && input.targetCountries.length > 0
          ? { country: { in: input.targetCountries } }
          : {}),
        isActive: true,
      },
      orderBy: { priceForeignCny: "desc" },
    });
    this.log(`Loaded ${intlPrices.length} international prices`);

    // Build opportunities
    const opportunities: ArbitrageOpportunity[] = [];
    for (const p of products) {
      const intlForProduct = intlPrices.filter((ip) => ip.productId === p.id);
      for (const ip of intlForProduct) {
        const diff = ip.priceForeignCny - p.priceCny;
        const marginPct = p.priceCny > 0 ? Math.round((diff / p.priceCny) * 1000) / 10 : 0;
        if (marginPct < input.minMarginPct) continue;

        let opp: "strong" | "moderate" | "weak";
        if (marginPct >= 50) opp = "strong";
        else if (marginPct >= 25) opp = "moderate";
        else opp = "weak";

        opportunities.push({
          productId: p.id,
          brandName: p.brand?.nameZh || p.brand?.nameEn || "unknown",
          modelName: p.modelName,
          year: p.year,
          domesticPriceCny: p.priceCny,
          intlPriceCny: ip.priceForeignCny,
          intlCountry: ip.country,
          priceDiffCny: diff,
          marginPct,
          source: ip.source,
          opportunity: opp,
        });
      }
    }

    // Also check reverse: products without intl price but high domestic value
    // (skip for now - focus on known arbitrage)

    opportunities.sort((a, b) => b.marginPct - a.marginPct);
    const top = opportunities.slice(0, input.limit);

    const summary = {
      strong: top.filter((o) => o.opportunity === "strong").length,
      moderate: top.filter((o) => o.opportunity === "moderate").length,
      weak: top.filter((o) => o.opportunity === "weak").length,
    };

    this.log(`Found ${top.length} opportunities (strong=${summary.strong} moderate=${summary.moderate} weak=${summary.weak})`);

    const finishedAt = new Date();
    return {
      ok: true, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      totalOpportunities: top.length, opportunities: top, summary, log: this.logs,
    };
  }

  async getStatus(): Promise<ArbitrageStatus> {
    const totalIntlPrices = await prisma.internationalPrice.count({ where: { isActive: true } });
    const totalProducts = await prisma.product.count({ where: { status: "active" } });
    return { ok: true, agentName: AGENT_NAME, version: AGENT_VERSION, totalIntlPrices, totalProducts };
  }
}

export const arbitrageAnalyzerAgent = new ArbitrageAnalyzerAgent();
