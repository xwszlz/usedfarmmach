/**
 * 开放API — 市场价格指数
 * GET /api/open/market-index?type=category&category=xxx&days=30
 *
 * 需要 API Key: Authorization: Bearer sk_xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "../_middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "overall"; // overall, category, brand, region
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30")));
    const targetId = searchParams.get("id");

    const whereClause: Record<string, unknown> = {
      date: { gte: new Date(Date.now() - days * 86400000) },
    };

    if (type === "category" && targetId) {
      whereClause.category = targetId;
      whereClause.brand = null;
      whereClause.region = null;
    } else if (type === "brand" && targetId) {
      whereClause.brand = targetId;
      whereClause.category = null;
      whereClause.region = null;
    } else if (type === "region" && targetId) {
      whereClause.region = targetId;
      whereClause.category = null;
      whereClause.brand = null;
    } else {
      // overall
      whereClause.category = null;
      whereClause.brand = null;
      whereClause.region = null;
    }

    const indices = await prisma.priceIndex.findMany({
      where: whereClause,
      orderBy: { date: "asc" },
      select: {
        date: true,
        indexValue: true,
        avgPriceCny: true,
        sampleCount: true,
        monthOverMonth: true,
        yearOverYear: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: indices,
      meta: {
        apiVersion: "v1",
        type,
        days,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Open API market-index error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
