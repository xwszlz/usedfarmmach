/**
 * 政府农机补贴政策 API
 *
 * GET /api/gov-data/policies?region=xxx&category=xxx&page=1&pageSize=20
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const region = searchParams.get("region") || undefined;
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || "active";

    const where: Record<string, unknown> = { status };
    if (region) where.region = { contains: region };
    if (category) where.category = category;

    const [policies, total] = await Promise.all([
      prisma.govSubsidyPolicy.findMany({
        where,
        orderBy: { effectiveDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.govSubsidyPolicy.count({ where }),
    ]);

    return NextResponse.json({
      policies,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Gov policies GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
