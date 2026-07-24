import { z } from "zod";

export const BuyerMatchInputSchema = z.object({
  brandId: z.string().optional(),
  brandName: z.string().optional(),
  modelName: z.string().optional(),
  categoryId: z.string().optional(),
  category: z.string().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  country: z.string().optional(),
  province: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});
export type BuyerMatchInput = z.infer<typeof BuyerMatchInputSchema>;

export interface MatchedProduct {
  productId: string;
  brandName: string;
  modelName: string;
  year: number;
  priceCny: number;
  condition: string;
  location: string;
  country: string | null;
  province: string | null;
  city: string | null;
  imageUrl: string | null;
  matchScore: number;
  matchReasons: string[];
}

export interface BuyerMatchResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalMatches: number;
  matches: MatchedProduct[];
  querySummary: Record<string, unknown>;
  log: string[];
  error?: string;
}

export interface BuyerMatchStatus {
  ok: boolean;
  agentName: "buyer-match";
  version: string;
  totalProducts: number;
  totalBrands: number;
}
