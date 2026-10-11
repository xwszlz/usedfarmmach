import { z } from "zod";

export const ArbitrageInputSchema = z.object({
  productId: z.string().optional(),
  brandId: z.string().optional(),
  targetCountries: z.array(z.string()).optional(),
  minMarginPct: z.number().default(10),
  limit: z.number().int().min(1).max(100).default(20),
  // 计费开关：仅带 bill:true 的真人请求才扣积分；系统 cron / 编排器自动化不传此字段，不扣。
  bill: z.boolean().optional(),
});
export type ArbitrageInput = z.infer<typeof ArbitrageInputSchema>;

export interface ArbitrageOpportunity {
  productId: string;
  brandName: string;
  modelName: string;
  year: number;
  domesticPriceCny: number;
  intlPriceCny: number;
  intlCountry: string | null;
  priceDiffCny: number;
  marginPct: number;
  source: string;
  opportunity: "strong" | "moderate" | "weak";
}

export interface ArbitrageResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalOpportunities: number;
  opportunities: ArbitrageOpportunity[];
  summary: { strong: number; moderate: number; weak: number };
  log: string[];
  error?: string;
}

export interface ArbitrageStatus {
  ok: boolean;
  agentName: "arbitrage-analyzer";
  version: string;
  totalIntlPrices: number;
  totalProducts: number;
}
