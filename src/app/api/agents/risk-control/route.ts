import { NextRequest, NextResponse } from "next/server";
import { RiskControlInputSchema } from "@/lib/agents/risk-control/types";
import { riskControlAgent } from "@/lib/agents/risk-control/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let body: unknown = {};
  try { const text = await request.text(); body = text ? JSON.parse(text) : {}; }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = RiskControlInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const result = await riskControlAgent.run(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET() {
  const status = await riskControlAgent.getStatus();
  return NextResponse.json(status);
}
