import { z } from "zod";

export const RiskControlInputSchema = z.object({
  checkType: z.enum(["listing_scan", "user_behavior", "pii_audit", "compliance_checklist"]).default("listing_scan"),
  targetProductId: z.string().optional(),
  targetUserId: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
export type RiskControlInput = z.infer<typeof RiskControlInputSchema>;

export interface RiskFinding {
  severity: "critical" | "warning" | "info";
  category: string;
  target: string;
  description: string;
  recommendation: string;
}

export interface RiskControlResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  checkType: string;
  totalFindings: number;
  findings: RiskFinding[];
  summary: { critical: number; warning: number; info: number };
  log: string[];
  error?: string;
}

export interface RiskControlStatus {
  ok: boolean;
  agentName: "risk-control";
  version: string;
  checkTypes: string[];
}
