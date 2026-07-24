import { z } from "zod";

export const DashboardInputSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
  includeRevenue: z.boolean().default(true),
  includeUsers: z.boolean().default(true),
  includeProducts: z.boolean().default(true),
  includeInquiries: z.boolean().default(true),
});
export type DashboardInput = z.infer<typeof DashboardInputSchema>;

export interface DashboardMetrics {
  users: { total: number; new: number; byRole: Record<string, number>; growthPct: number };
  products: { total: number; new: number; active: number; byCountry: Record<string, number>; topBrands: { name: string; count: number }[] };
  inquiries: { totalBids: number; totalAuctions: number; acceptedBids: number; pendingBids: number; conversionRate: number };
  revenue: { totalCredits: number; consumedCredits: number; membershipBreakdown: Record<string, number> };
  valuationReports: { total: number; last7Days: number };
}

export interface DashboardResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  period: { days: number; from: string; to: string };
  metrics: DashboardMetrics;
  log: string[];
  error?: string;
}

export interface DashboardStatus {
  ok: boolean;
  agentName: "data-dashboard";
  version: string;
}
