import { prisma } from "@/lib/db";
import type { BuyerMatchInput, BuyerMatchResult, BuyerMatchStatus, MatchedProduct } from "./types";

export const AGENT_NAME = "buyer-match";
export const AGENT_VERSION = "0.1.0";

const NAME_TO_BRAND_ID: Record<string, string> = {
  "john deere": "john-deere", "迪尔": "john-deere", "约翰迪尔": "john-deere",
  "claas": "claas", "克拉斯": "claas",
  "case ih": "case-ih", "凯斯": "case-ih",
  "new holland": "new-holland", "纽荷兰": "new-holland",
  "massey ferguson": "massey-ferguson", "麦赛福格森": "massey-ferguson",
  "mtz": "mtz", "belarus": "mtz", "明斯克": "mtz",
  "kubota": "kubota", "久保田": "kubota",
  "krone": "krone", "科罗尼": "krone",
  "mchale": "mchale", "麦克海尔": "mchale",
};

export class BuyerMatchAgent {
  private logs: string[] = [];
  private log(msg: string) { this.logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(this.logs[this.logs.length-1]); }

  async run(input: BuyerMatchInput): Promise<BuyerMatchResult> {
    const startedAt = new Date();
    this.logs = [];
    this.log(`Agent #2 buyer-match@${AGENT_VERSION} started`);

    let brandId = input.brandId;
    if (!brandId && input.brandName) {
      brandId = NAME_TO_BRAND_ID[input.brandName.trim().toLowerCase()] || NAME_TO_BRAND_ID[input.brandName.trim()];
    }

    // Build where clause
    const where: Record<string, unknown> = { status: "active" };
    if (brandId) where.brandId = brandId;
    if (input.modelName) where.modelName = { contains: input.modelName, mode: "insensitive" };
    if (input.categoryId) where.categoryId = input.categoryId;
    if (input.budgetMin || input.budgetMax) {
      where.priceCny = {};
      if (input.budgetMin) (where.priceCny as Record<string, unknown>).gte = input.budgetMin;
      if (input.budgetMax) (where.priceCny as Record<string, unknown>).lte = input.budgetMax;
    }
    if (input.country) where.country = input.country;
    if (input.province) where.province = { contains: input.province, mode: "insensitive" };

    this.log(`Query: brand=${brandId || "any"} model=${input.modelName || "any"} budget=${input.budgetMin || 0}-${input.budgetMax || "max"}`);

    const products = await prisma.product.findMany({
      where,
      include: { brand: true, category: true },
      orderBy: { createdAt: "desc" },
      take: input.limit * 3, // fetch more for scoring
    });

    this.log(`Found ${products.length} products from DB`);

    // Score matches
    const matches: MatchedProduct[] = products.map((p) => {
      let score = 50; // base
      const reasons: string[] = [];

      if (brandId && p.brandId === brandId) { score += 30; reasons.push("品牌匹配"); }
      if (input.modelName && p.modelName.toLowerCase().includes(input.modelName.toLowerCase())) {
        score += 25; reasons.push("型号匹配");
      } else if (input.modelName) {
        const words = input.modelName.toLowerCase().split(/\s+/);
        const matched = words.some((w) => w.length > 2 && p.modelName.toLowerCase().includes(w));
        if (matched) { score += 10; reasons.push("型号近似"); }
      }
      if (input.budgetMax && p.priceCny <= input.budgetMax) {
        score += 15; reasons.push("价格在预算内");
      }
      if (input.budgetMin && p.priceCny >= input.budgetMin) {
        score += 5; reasons.push("高于最低预算");
      }
      if (input.country && p.country === input.country) {
        score += 10; reasons.push("所在国匹配");
      }
      if (input.province && p.province?.includes(input.province)) {
        score += 10; reasons.push("同省");
      }
      if (p.condition === "excellent") { score += 5; reasons.push("车况优秀"); }
      else if (p.condition === "good") { score += 3; reasons.push("车况良好"); }

      return {
        productId: p.id,
        brandName: p.brand?.nameZh || p.brand?.nameEn || "未知",
        modelName: p.modelName,
        year: p.year,
        priceCny: p.priceCny,
        condition: p.condition,
        location: p.location,
        country: p.country,
        province: p.province,
        city: p.city,
        imageUrl: null,
        matchScore: Math.min(score, 100),
        matchReasons: reasons,
      };
    });

    matches.sort((a, b) => b.matchScore - a.matchScore);
    const topMatches = matches.slice(0, input.limit);

    this.log(`Top ${topMatches.length} matches (score >= ${topMatches[topMatches.length-1]?.matchScore || 0})`);

    const finishedAt = new Date();
    return {
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      totalMatches: topMatches.length,
      matches: topMatches,
      querySummary: { brandId, brandName: input.brandName, modelName: input.modelName, budgetMin: input.budgetMin, budgetMax: input.budgetMax, country: input.country, province: input.province },
      log: this.logs,
    };
  }

  async getStatus(): Promise<BuyerMatchStatus> {
    const totalProducts = await prisma.product.count({ where: { status: "active" } });
    const totalBrands = await prisma.brand.count();
    return { ok: true, agentName: AGENT_NAME, version: AGENT_VERSION, totalProducts, totalBrands };
  }
}

export const buyerMatchAgent = new BuyerMatchAgent();
